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

export async function renderCardToPngBlob(node: HTMLElement): Promise<Blob> {
  await waitForAssets(node);
  const options = {
    width: CAREER_CARD_WIDTH,
    height: CAREER_CARD_HEIGHT,
    pixelRatio: 1,
    cacheBust: false,
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
