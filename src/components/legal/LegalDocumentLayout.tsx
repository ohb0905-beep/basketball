import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GAME_NAME, GAME_VERSION } from '../../config/appMeta';

export interface LegalDocumentLayoutProps {
  title: string;
  updatedAt: string;
  /** 메타 줄의 날짜 앞 라벨 (기본값: 시행일) */
  updatedAtLabel?: string;
  currentPath: '/privacy' | '/terms' | '/patch-notes';
  children: React.ReactNode;
}

const COPYRIGHT_YEAR = new Date().getFullYear();

export function LegalDocumentLayout({
  title,
  updatedAt,
  updatedAtLabel = '시행일',
  currentPath,
  children,
}: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-g900)] flex flex-col">
      <header className="sticky top-0 z-30 bg-[var(--t-bg)]/92 backdrop-blur-md border-b border-[var(--t-g200)] pt-safe">
        <div className="max-w-[680px] mx-auto px-4 h-[52px] flex items-center justify-between gap-3">
          <Link
            href="/"
            aria-label={`${GAME_NAME}로 돌아가기`}
            className="min-h-[40px] inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--t-g900)] hover:text-[var(--t-accent-ink)] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {/* 좁은 화면에서는 정책 링크 3개가 들어가도록 게임 이름을 숨깁니다 */}
            <span className="hidden sm:inline">{GAME_NAME}</span>
          </Link>

          <nav
            aria-label="정책 문서 이동"
            className="flex items-center gap-3 text-[13px]"
          >
            <Link
              href="/patch-notes"
              className={`min-h-[36px] inline-flex items-center whitespace-nowrap transition-colors ${
                currentPath === '/patch-notes'
                  ? 'font-bold text-[var(--t-g900)]'
                  : 'font-medium text-[var(--t-g500)] hover:text-[var(--t-g800)]'
              }`}
            >
              패치노트
            </Link>
            <span className="text-[var(--t-g400)] select-none" aria-hidden="true">
              ·
            </span>
            <Link
              href="/privacy"
              className={`min-h-[36px] inline-flex items-center whitespace-nowrap transition-colors ${
                currentPath === '/privacy'
                  ? 'font-bold text-[var(--t-g900)]'
                  : 'font-medium text-[var(--t-g500)] hover:text-[var(--t-g800)]'
              }`}
            >
              개인정보처리방침
            </Link>
            <span className="text-[var(--t-g400)] select-none" aria-hidden="true">
              ·
            </span>
            <Link
              href="/terms"
              className={`min-h-[36px] inline-flex items-center whitespace-nowrap transition-colors ${
                currentPath === '/terms'
                  ? 'font-bold text-[var(--t-g900)]'
                  : 'font-medium text-[var(--t-g500)] hover:text-[var(--t-g800)]'
              }`}
            >
              이용약관
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[680px] mx-auto px-4 py-7 sm:py-10">
        <article className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[22px] p-6 sm:p-8 space-y-6">
          <header className="space-y-1.5 pb-5 border-b border-[var(--t-g100)]">
            <p className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums">
              {GAME_NAME}(Road to MVP) · v{GAME_VERSION} · {updatedAtLabel} {updatedAt}
            </p>
            <h1 className="text-[22px] sm:text-[24px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-snug">
              {title}
            </h1>
          </header>

          <div className="space-y-6 text-[14px] text-[var(--t-g700)] leading-relaxed">
            {children}
          </div>
        </article>
      </main>

      <footer className="w-full border-t border-[var(--t-g200)] bg-[var(--t-bg)]">
        <div className="max-w-[680px] mx-auto px-4 py-6 space-y-2 text-[11px] text-[var(--t-g500)]">
          <p className="leading-relaxed">
            본 게임은 비공식 농구 커리어 시뮬레이션 게임이며, 게임 내 언급되는
            리그·구단·대회 명칭 등 관련 상표 및 지식재산권은 각 권리자에게
            있습니다.
          </p>
          <p suppressHydrationWarning className="text-[var(--t-g400)] tabular-nums">
            © {COPYRIGHT_YEAR} {GAME_NAME}(Road to MVP). All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
