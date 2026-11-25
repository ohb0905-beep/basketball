'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { Download, Share, X, MoreVertical } from 'lucide-react';
import {
  InstallGuideKind,
  detectDisplayMode,
  getDeferredInstallPrompt,
  isInstallGuideDismissed,
  markInstallGuideDismissed,
  resolveInstallGuideKind,
  setDeferredInstallPrompt,
  subscribeInstallPrompt,
} from '../../lib/pwa';

function getClientKind(): InstallGuideKind {
  if (isInstallGuideDismissed()) return null;
  return resolveInstallGuideKind({
    userAgent: navigator.userAgent,
    displayMode: detectDisplayMode(),
    hasInstallPrompt: Boolean(getDeferredInstallPrompt()),
  });
}

/**
 * 홈 화면 추가 안내 띠 (휴대폰 브라우저에서만, 닫으면 다시 안 보임)
 */
export function InstallGuideBanner() {
  const [dismissed, setDismissed] = useState(false);
  const kind = useSyncExternalStore(subscribeInstallPrompt, getClientKind, () => null);

  if (dismissed || !kind) return null;

  const dismiss = () => {
    markInstallGuideDismissed();
    setDismissed(true);
  };

  const install = async () => {
    const prompt = getDeferredInstallPrompt();
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setDeferredInstallPrompt(null);
      if (choice.outcome === 'accepted') dismiss();
    } catch {
      // 프롬프트를 쓸 수 없으면 안내만 남겨 둡니다.
    }
  };

  return (
    <section
      data-testid="install-guide-banner"
      data-kind={kind}
      className="t-card !py-3.5 flex items-start gap-3"
    >
      {/* 작은 고정 아이콘이라 next/image 최적화가 필요 없음 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={40}
        height={40}
        className="w-10 h-10 rounded-[10px] shrink-0"
      />
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[14px] font-bold text-[var(--t-g900)]">홈 화면에 앱으로 추가하기</p>
        {kind === 'android-prompt' && (
          <>
            <p className="text-[12.5px] text-[var(--t-g600)] leading-relaxed">
              주소창 없이 전체 화면으로, 인터넷이 약해도 바로 열립니다.
            </p>
            <button
              type="button"
              data-testid="install-guide-install-btn"
              onClick={install}
              className="min-h-[36px] px-3.5 rounded-xl bg-[var(--t-accent)] text-white text-[13px] font-bold inline-flex items-center gap-1.5 t-tap cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden />
              앱으로 설치
            </button>
          </>
        )}
        {kind === 'android-menu' && (
          <p className="text-[12.5px] text-[var(--t-g600)] leading-relaxed">
            브라우저 메뉴{' '}
            <MoreVertical className="inline w-3.5 h-3.5 -mt-0.5" aria-label="메뉴" /> 에서{' '}
            <b className="text-[var(--t-g800)]">홈 화면에 추가</b> 또는{' '}
            <b className="text-[var(--t-g800)]">앱 설치</b>를 누르세요.
          </p>
        )}
        {kind === 'ios' && (
          <p className="text-[12.5px] text-[var(--t-g600)] leading-relaxed">
            브라우저의 공유 버튼{' '}
            <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="공유" /> 을 누른 뒤{' '}
            <b className="text-[var(--t-g800)]">홈 화면에 추가</b>를 고르세요.
          </p>
        )}
      </div>
      <button
        type="button"
        data-testid="install-guide-dismiss-btn"
        onClick={dismiss}
        aria-label="안내 닫기"
        className="w-8 h-8 -mr-1 -mt-1 rounded-lg inline-flex items-center justify-center text-[var(--t-g500)] hover:bg-[var(--t-g100)] cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </section>
  );
}
