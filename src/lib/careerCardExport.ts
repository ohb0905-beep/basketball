/**
 * 1.3.0 커리어 카드 PNG 캡처·저장·공유 (브라우저 전용)
 * - 화면에 그린 카드 DOM을 html-to-image로 1080×1350 PNG로 바꿉니다.
 * - 공유는 휴대폰 기본 공유 창(Web Share API)만 씁니다.
 */
import { toBlob } from 'html-to-image';
import { CAREER_CARD_HEIGHT, CAREER_CARD_WIDTH } from './careerCard';

export type ShareSupport = 'files' | 'none';

export function buildCardFileName(playerName: string): string {
  const safe = playerName.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return `road-to-mvp-${safe || 'career'}.png`;
}

export function detectShareSupport(
  nav: Pick<Navigator, 'share' | 'canShare'> | undefined,
  file: File
): ShareSupport {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') {
    return 'none';
  }
  try {
    return nav.canShare({ files: [file] }) ? 'files' : 'none';
  } catch {
    return 'none';
  }
}

async function waitForAssets(node: HTMLElement): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
}

/** CSS unicode-range 값을 [시작, 끝] 구간 목록으로 바꿉니다. 비어 있으면 전체 범위입니다. */
export function parseUnicodeRange(value: string): Array<[number, number]> {
  const parts = value
    .split(',')
    .map((p) => p.trim().replace(/^U\+/i, ''))
    .filter(Boolean);
  if (parts.length === 0) return [[0, 0x10ffff]];
  return parts.map((part) => {
    if (part.includes('?')) {
      return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'F'), 16)];
    }
    const [start, end] = part.split('-');
    const a = parseInt(start, 16);
    return [a, end ? parseInt(end, 16) : a];
  });
}

/** 카드 글자 중 하나라도 이 글꼴 조각의 범위에 들면 true */
export function textNeedsFontFace(text: string, ranges: Array<[number, number]>): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ranges.some(([a, b]) => code >= a && code <= b)) return true;
  }
  return false;
}

const fontDataCache = new Map<string, Promise<string>>();

async function toDataUrl(url: string): Promise<string> {
  if (!fontDataCache.has(url)) {
    fontDataCache.set(
      url,
      fetch(url)
        .then((res) => res.blob())
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            })
        )
    );
  }
  return fontDataCache.get(url)!;
}

/**
 * Pretendard는 글자 범위별로 수십 개 파일로 나뉘어 있어, 전부 넣으면 수 MB가 됩니다.
 * 카드에 실제로 쓰인 글자가 든 조각만 골라 이미지에 넣을 CSS를 만듭니다.
 */
async function buildCardFontEmbedCSS(node: HTMLElement): Promise<string | undefined> {
  const text = node.textContent ?? '';
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(cssRules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue('font-family');
      if (!/pretendard/i.test(family)) continue;
      const range = parseUnicodeRange(rule.style.getPropertyValue('unicode-range'));
      if (!textNeedsFontFace(text, range)) continue;
      const src = rule.style.getPropertyValue('src');
      const match = src.match(/url\(["']?([^"')]+)["']?\)/);
      if (!match) continue;
      const absolute = new URL(match[1], sheet.href ?? window.location.href).href;
      try {
        const dataUrl = await toDataUrl(absolute);
        const style = rule.style;
        rules.push(
          `@font-face{font-family:${family};font-weight:${style.getPropertyValue('font-weight') || 'normal'};` +
            `font-style:${style.getPropertyValue('font-style') || 'normal'};` +
            `src:url(${dataUrl});unicode-range:${style.getPropertyValue('unicode-range') || 'U+0-10FFFF'};}`
        );
      } catch {
        // 글꼴 조각을 못 받으면 그 글자는 기본 글꼴로 그려집니다.
      }
    }
  }
  // 글꼴 규칙을 하나도 못 읽었으면 html-to-image 기본 동작에 맡깁니다.
  return rules.length > 0 ? rules.join('\n') : undefined;
}

export async function renderCardToPngBlob(node: HTMLElement): Promise<Blob> {
  await waitForAssets(node);
  const options = {
    width: CAREER_CARD_WIDTH,
    height: CAREER_CARD_HEIGHT,
    pixelRatio: 1,
    cacheBust: false,
    // 로고 주소가 모두 /_next/image?url=... 이라 물음표 뒤까지 캐시 키에 넣어야 팀마다 다른 로고가 들어갑니다.
    includeQueryParams: true,
    fontEmbedCSS: await buildCardFontEmbedCSS(node),
  };
  // iOS 사파리는 첫 캡처에서 글꼴·이미지가 빠지는 경우가 있어 한 번 미리 캡처하고 버립니다.
  await toBlob(node, options).catch(() => null);
  const blob = await toBlob(node, options);
  if (!blob) throw new Error('카드 이미지를 만들지 못했습니다.');
  return blob;
}

function isIosWithoutDownload(): boolean {
  if (typeof navigator === 'undefined' || typeof HTMLAnchorElement === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) &&
    !('download' in HTMLAnchorElement.prototype)
  );
}

export function downloadBlob(blob: Blob, fileName: string): 'downloaded' | 'opened' {
  const url = URL.createObjectURL(blob);
  if (isIosWithoutDownload()) {
    window.open(url, '_blank');
    return 'opened';
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

export async function shareBlob(
  blob: Blob,
  fileName: string
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (detectShareSupport(typeof navigator === 'undefined' ? undefined : navigator, file) === 'none') {
    return 'unsupported';
  }
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}
