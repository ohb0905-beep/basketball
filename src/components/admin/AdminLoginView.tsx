'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, ShieldAlert } from 'lucide-react';
import { GAME_NAME, GAME_VERSION } from '../../config/appMeta';

export interface AdminLoginViewProps {
  envConfigured: boolean;
}

export function AdminLoginView({ envConfigured }: AdminLoginViewProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    if (!password) {
      setErrorMessage('관리자 비밀번호를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = (await res.json()) as { ok?: boolean; error?: string };
      } catch {
        data = null;
      }

      if (!res.ok || !data?.ok) {
        setErrorMessage(
          data?.error || '로그인에 실패했습니다. 비밀번호와 서버 설정을 확인해 주세요.'
        );
        return;
      }

      setPassword('');
      router.refresh();
    } catch {
      setErrorMessage(
        '네트워크 오류로 로그인 요청을 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-g900)] flex items-center justify-center px-4 py-12">
      <main className="w-full max-w-[420px]">
        <div className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[24px] p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[var(--t-g500)]">
              <span>{GAME_NAME} 관리자 콘솔</span>
              <span className="tabular-nums">v{GAME_VERSION}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--t-accent-soft)] text-[var(--t-accent)] flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-tight">
                피드백 관리 로그인
              </h1>
            </div>
            <p className="text-[13px] text-[var(--t-g600)] leading-relaxed">
              서버 환경변수에 등록된 관리자 비밀번호로 인증해야 피드백 목록과 상세 정보를 조회할 수 있습니다.
            </p>
          </div>

          {!envConfigured && (
            <div
              role="alert"
              data-testid="admin-env-warning"
              className="p-4 rounded-2xl bg-[var(--t-gold-soft)] text-[var(--t-g900)] space-y-1.5"
            >
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--t-gold)]">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>서버 인증 환경변수 미설정</span>
              </div>
              <p className="text-[12px] text-[var(--t-g700)] leading-relaxed">
                현재 서버에{' '}
                <code className="font-mono font-semibold text-[var(--t-g900)]">
                  ADMIN_PASSWORD
                </code>{' '}
                또는{' '}
                <code className="font-mono font-semibold text-[var(--t-g900)]">
                  ADMIN_SESSION_SECRET
                </code>
                이 설정되지 않아 로그인이 차단되어 있습니다. 배포 환경 또는{' '}
                <code className="font-mono">.env.local</code>에 설정한 뒤 서버를 재시작해 주세요.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-password-input"
                className="block text-[13px] font-bold text-[var(--t-g800)]"
              >
                관리자 비밀번호
              </label>
              <div className="relative">
                <input
                  id="admin-password-input"
                  data-testid="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  disabled={submitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full min-h-[48px] pl-3.5 pr-12 py-2.5 rounded-xl bg-[var(--t-g100)] text-[15px] text-[var(--t-g900)] placeholder:text-[var(--t-g400)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[var(--t-g500)] hover:text-[var(--t-g800)] cursor-pointer"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                data-testid="admin-login-error"
                className="px-3.5 py-3 rounded-xl bg-[var(--t-up-soft)] text-[13px] font-semibold text-[var(--t-up)] leading-snug"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              data-testid="admin-login-submit"
              className="t-cta min-h-[50px] gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>인증 확인 중...</span>
                </>
              ) : (
                <span>관리자 로그인</span>
              )}
            </button>
          </form>

          <p className="text-[12px] text-[var(--t-g500)] text-center leading-relaxed pt-2 border-t border-[var(--t-g100)]">
            인증 세션은 서버 서명 HttpOnly 쿠키로 관리되며 12시간 후 자동 만료됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
