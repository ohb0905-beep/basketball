'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, MessageSquareText } from 'lucide-react';

export interface AdminConsoleNavProps {
  active: 'feedback' | 'analytics';
}

const ADMIN_NAV_ITEMS = [
  {
    key: 'feedback' as const,
    href: '/admin/feedback',
    label: '피드백 관리',
    icon: MessageSquareText,
    testId: 'admin-nav-feedback',
  },
  {
    key: 'analytics' as const,
    href: '/admin/analytics',
    label: '플레이 통계',
    icon: BarChart3,
    testId: 'admin-nav-analytics',
  },
];

/**
 * 인증된 관리자 콘솔 화면 상단 전용 내비게이션 탭
 * - 미인증 로그인 화면이나 일반 게임 사용자 화면에서는 절대 렌더링하지 않습니다.
 */
export function AdminConsoleNav({ active }: AdminConsoleNavProps) {
  return (
    <nav
      aria-label="관리자 콘솔 메뉴"
      data-testid="admin-console-nav"
      className="inline-flex items-center p-1 rounded-xl bg-[var(--t-g100)] border border-[var(--t-g200)]/70"
    >
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            data-testid={item.testId}
            aria-current={isActive ? 'page' : undefined}
            className={`min-h-[34px] px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              isActive
                ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                : 'text-[var(--t-g600)] hover:text-[var(--t-g900)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
