/**
 * 1.1.4 앱 설치(PWA) 도우미
 * - 실행 방식(앱/브라우저) 판별, 설치 안내 대상 판별, 설치 프롬프트 보관
 */

export type PwaDisplayMode = 'standalone' | 'browser';
export type InstallGuideKind = 'android-prompt' | 'android-menu' | 'ios' | null;

/** 설치 안내 띠를 닫았는지 기록하는 localStorage 키 */
export const INSTALL_GUIDE_DISMISSED_KEY = 'road-to-mvp-install-guide-dismissed';

/** Chrome 계열이 주는 설치 프롬프트 이벤트 (표준 타입에 없음) */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function detectDisplayMode(): PwaDisplayMode {
  if (typeof window === 'undefined') return 'browser';
  try {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return 'standalone';
    if (window.matchMedia?.('(display-mode: standalone)').matches) return 'standalone';
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return 'standalone';
  } catch {
    // 판별 실패 시 브라우저로 간주
  }
  return 'browser';
}

/**
 * 어떤 설치 안내를 보여줄지 정합니다. 데스크톱이거나 이미 앱으로 실행 중이면 null.
 */
export function resolveInstallGuideKind(params: {
  userAgent: string;
  displayMode: PwaDisplayMode;
  hasInstallPrompt: boolean;
}): InstallGuideKind {
  if (params.displayMode === 'standalone') return null;
  const ua = params.userAgent || '';
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ 사파리는 맥으로 표시됨
    (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  if (isIos) return 'ios';
  if (/Android/i.test(ua)) {
    return params.hasInstallPrompt ? 'android-prompt' : 'android-menu';
  }
  return null;
}

// 설치 프롬프트는 페이지 어디서든 먼저 올 수 있어 모듈에 보관하고 구독자에게 알립니다.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
  listeners.forEach((fn) => fn());
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isInstallGuideDismissed(storage: Storage | null = safeLocalStorage()): boolean {
  try {
    return storage?.getItem(INSTALL_GUIDE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markInstallGuideDismissed(storage: Storage | null = safeLocalStorage()): void {
  try {
    storage?.setItem(INSTALL_GUIDE_DISMISSED_KEY, '1');
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 무시
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** 이미 불러온 빌드 파일·글꼴 주소 (서비스 워커에 미리 저장 요청용) */
export function collectLoadedAssetUrls(): string[] {
  if (typeof window === 'undefined' || !window.performance?.getEntriesByType) return [];
  try {
    const urls = new Set<string>();
    for (const entry of window.performance.getEntriesByType('resource')) {
      const url = entry.name;
      if (url.includes('/_next/static/') || url.includes('cdn.jsdelivr.net/gh/orioncactus/pretendard')) {
        urls.add(url);
      }
    }
    for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))) {
      if (link.href) urls.add(link.href);
    }
    return [...urls];
  } catch {
    return [];
  }
}
