'use client';

import React from 'react';
import { GAME_NAME, GAME_VERSION } from '../../config/appMeta';

export interface FooterProps {
  onRequestFeedbackModal?: () => void;
  wide?: boolean;
  bottomSpacing?: 'default' | 'tabbar' | 'dock';
}

const COPYRIGHT_YEAR = new Date().getFullYear();

export function Footer({
  onRequestFeedbackModal,
  wide = false,
  bottomSpacing = 'default',
}: FooterProps) {
  const bottomPaddingClass =
    bottomSpacing === 'dock'
      ? 'pb-[156px]'
      : bottomSpacing === 'tabbar'
      ? 'pb-[88px]'
      : 'pb-8';

  return (
    <footer
      data-testid="app-footer"
      className={`w-full border-t border-[var(--t-g200)] bg-[var(--t-bg)] mt-6 ${bottomPaddingClass}`}
    >
      <div
        className={`mx-auto px-4 pt-5 space-y-3 text-[12px] text-[var(--t-g500)] transition-[max-width] duration-200 ${
          wide ? 'max-w-[760px]' : 'max-w-[560px]'
        }`}
      >
        {/* 1행: 게임 버전 + 법적 필수 정책 링크 + 문의/피드백 */}
        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-1">
          <span
            data-testid="footer-game-version"
            className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums"
          >
            v{GAME_VERSION}
          </span>

          <nav
            aria-label="정책 및 문의"
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5"
          >
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-privacy-link"
              className="min-h-[36px] px-1.5 inline-flex items-center font-medium text-[var(--t-g600)] hover:text-[var(--t-g900)] hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              개인정보처리방침
            </a>
            <span className="text-[var(--t-g400)] select-none" aria-hidden="true">
              ·
            </span>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-terms-link"
              className="min-h-[36px] px-1.5 inline-flex items-center font-medium text-[var(--t-g600)] hover:text-[var(--t-g900)] hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              이용약관
            </a>
            {onRequestFeedbackModal && (
              <>
                <span
                  className="text-[var(--t-g400)] select-none"
                  aria-hidden="true"
                >
                  ·
                </span>
                <button
                  type="button"
                  data-testid="footer-feedback-btn"
                  onClick={onRequestFeedbackModal}
                  className="min-h-[36px] px-1.5 inline-flex items-center font-medium text-[var(--t-g600)] hover:text-[var(--t-g900)] hover:underline underline-offset-4 whitespace-nowrap cursor-pointer transition-colors"
                >
                  문의 / 피드백
                </button>
              </>
            )}
          </nav>
        </div>

        {/* 2행: 상표권·저작권 면책 문구 */}
        <p className="text-[11px] text-[var(--t-g500)] leading-relaxed text-center sm:text-left">
          본 게임은 비공식 농구 커리어 시뮬레이션 게임이며, 게임 내 언급되는
          리그·구단·대회 명칭 등 관련 상표 및 지식재산권은 각 권리자에게
          있습니다.
        </p>

        {/* 3행: 서비스 저작권 표시 */}
        <p
          suppressHydrationWarning
          className="text-[11px] text-[var(--t-g400)] tabular-nums text-center sm:text-left"
        >
          © {COPYRIGHT_YEAR} {GAME_NAME}(Road to MVP). All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
