'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  DashboardTabId,
  FEEDBACK_CONTENT_MAX,
  FEEDBACK_TITLE_MAX,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPE_OPTIONS,
  FeedbackType,
  collectFeedbackGameContext,
  formatGameContextPreviewRows,
} from '../../lib/feedback';
import { useCareerStore } from '../../store/useCareerStore';
import { Modal } from './Modal';

export interface FeedbackModalProps {
  open: boolean;
  activeTab: DashboardTabId;
  onClose: () => void;
}

export function FeedbackModal({
  open,
  activeTab,
  onClose,
}: FeedbackModalProps) {
  const view = useCareerStore((s) => s.view);
  const career = useCareerStore((s) => s.career);
  const showToast = useCareerStore((s) => s.showToast);

  const [type, setType] = useState<FeedbackType | ''>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewContext = useMemo(() => {
    if (!open) return null;
    return collectFeedbackGameContext({
      view,
      activeTab,
      career,
    });
  }, [open, view, activeTab, career]);

  const contextRows = useMemo(
    () => (previewContext ? formatGameContextPreviewRows(previewContext) : []),
    [previewContext]
  );

  const resetForm = () => {
    setType('');
    setTitle('');
    setContent('');
    setShowContextPreview(false);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!type) {
      setErrorMessage('제보 유형을 선택해 주세요.');
      return;
    }
    if (!trimmedTitle) {
      setErrorMessage('제목을 입력해 주세요.');
      return;
    }
    if (trimmedTitle.length > FEEDBACK_TITLE_MAX) {
      setErrorMessage(
        `제목은 최대 ${FEEDBACK_TITLE_MAX}자까지 입력할 수 있습니다.`
      );
      return;
    }
    if (!trimmedContent) {
      setErrorMessage('상세 내용을 입력해 주세요.');
      return;
    }
    if (trimmedContent.length > FEEDBACK_CONTENT_MAX) {
      setErrorMessage(
        `상세 내용은 최대 ${FEEDBACK_CONTENT_MAX.toLocaleString()}자까지 입력할 수 있습니다.`
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const latestContext = collectFeedbackGameContext({
      view,
      activeTab,
      career,
    });

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          title: trimmedTitle,
          content: trimmedContent,
          gameVersion: latestContext.gameVersion,
          gameContext: latestContext,
        }),
      });

      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = (await res.json()) as { ok?: boolean; error?: string };
      } catch {
        data = null;
      }

      if (!res.ok || !data?.ok) {
        setErrorMessage(
          data?.error ||
            '피드백을 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      showToast(
        '피드백이 접수되었습니다',
        '보내주신 소중한 제보와 의견을 빠르게 확인하겠습니다.',
        'emerald'
      );
      resetForm();
      onClose();
    } catch {
      setErrorMessage(
        '네트워크 연결이 원활하지 않아 전송에 실패했습니다. 작성하신 내용은 그대로 유지되니 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="버그 제보 · 피드백"
      subtitle="익명으로 접수되며 개인정보는 요구하지 않습니다"
      onClose={submitting ? undefined : onClose}
      testId="feedback-modal"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* 1. 제보 유형 선택 */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-[13px] font-bold text-[var(--t-g800)]">
              제보 유형 <span className="text-[var(--t-accent)]">*</span>
            </label>
            {type && (
              <span className="text-[12px] font-medium text-[var(--t-accent-ink)]">
                {FEEDBACK_TYPE_LABELS[type]}
              </span>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="제보 유형 선택"
            className="grid grid-cols-1 sm:grid-cols-2 gap-1.5"
          >
            {FEEDBACK_TYPE_OPTIONS.map((option) => {
              const selected = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={submitting}
                  data-testid={`feedback-type-${option.value}`}
                  onClick={() => {
                    setType(option.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-left text-[13px] font-semibold transition cursor-pointer t-tap ${
                    option.value === 'other' ? 'sm:col-span-2' : ''
                  } ${
                    selected
                      ? 'bg-[var(--t-accent)] text-white'
                      : 'bg-[var(--t-g100)] text-[var(--t-g800)] hover:bg-[var(--t-g200)]/80'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 제목 입력 */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="feedback-title-input"
              className="text-[13px] font-bold text-[var(--t-g800)]"
            >
              제목 <span className="text-[var(--t-accent)]">*</span>
            </label>
            <span
              data-testid="feedback-title-count"
              className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums"
            >
              {title.length} / {FEEDBACK_TITLE_MAX}
            </span>
          </div>
          <input
            id="feedback-title-input"
            data-testid="feedback-title-input"
            type="text"
            value={title}
            maxLength={FEEDBACK_TITLE_MAX}
            disabled={submitting}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="어떤 문제나 의견인지 한 줄로 간단히 적어주세요"
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--t-g100)] text-[14px] text-[var(--t-g900)] placeholder:text-[var(--t-g400)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] disabled:opacity-60"
          />
        </div>

        {/* 3. 상세 내용 입력 */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="feedback-content-input"
              className="text-[13px] font-bold text-[var(--t-g800)]"
            >
              상세 내용 <span className="text-[var(--t-accent)]">*</span>
            </label>
            <span
              data-testid="feedback-content-count"
              className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums"
            >
              {content.length.toLocaleString()} /{' '}
              {FEEDBACK_CONTENT_MAX.toLocaleString()}
            </span>
          </div>
          <textarea
            id="feedback-content-input"
            data-testid="feedback-content-input"
            rows={5}
            value={content}
            maxLength={FEEDBACK_CONTENT_MAX}
            disabled={submitting}
            onChange={(e) => {
              setContent(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="문제가 발생한 상황·재현 순서나 밸런스·기능 개선 의견을 구체적으로 작성해 주세요."
            className="w-full px-3.5 py-3 rounded-xl bg-[var(--t-g100)] text-[14px] text-[var(--t-g900)] placeholder:text-[var(--t-g400)] leading-relaxed resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] disabled:opacity-60"
          />
        </div>

        {/* 4. 자동 첨부 게임 요약 및 제출 내용 미리보기 아코디언 */}
        <div className="border-t border-[var(--t-g100)] pt-3">
          <button
            type="button"
            data-testid="feedback-context-toggle"
            aria-expanded={showContextPreview}
            onClick={() => setShowContextPreview((prev) => !prev)}
            className="w-full min-h-[44px] px-1 flex items-center justify-between gap-2 text-left cursor-pointer t-tap"
          >
            <span className="text-[13px] font-semibold text-[var(--t-g700)]">
              함께 전송되는 게임 요약 정보 확인
            </span>
            {showContextPreview ? (
              <ChevronUp className="w-4 h-4 text-[var(--t-g500)] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--t-g500)] shrink-0" />
            )}
          </button>

          {showContextPreview && (
            <div
              data-testid="feedback-context-preview"
              className="mt-2 px-3.5 py-3 rounded-2xl bg-[var(--t-g100)] space-y-2.5 text-[12px]"
            >
              <div className="divide-y divide-[var(--t-g200)]">
                <div className="py-1.5 first:pt-0 flex items-baseline justify-between gap-3">
                  <span className="text-[var(--t-g500)] shrink-0">작성 요약</span>
                  <span className="font-semibold text-[var(--t-g900)] text-right truncate">
                    {type ? FEEDBACK_TYPE_LABELS[type] : '유형 미선택'} ·{' '}
                    {title.trim() || '제목 미입력'}
                  </span>
                </div>
                {contextRows.map((row) => (
                  <div
                    key={row.label}
                    className="py-1.5 last:pb-0 flex items-baseline justify-between gap-3"
                  >
                    <span className="text-[var(--t-g500)] shrink-0">
                      {row.label}
                    </span>
                    <span className="font-medium text-[var(--t-g800)] text-right tabular-nums break-all">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[var(--t-g500)] leading-relaxed pt-1 border-t border-[var(--t-g200)]">
                디버깅을 위한 최소한의 진행 요약과 화면 환경만 자동 첨부됩니다.
                이메일·비밀번호·전체 세이브 파일 등 개인정보는 수집하지 않습니다.
              </p>
            </div>
          )}
        </div>

        {/* 5. 인라인 오류 메시지 (작성 내용 유지) */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="feedback-error-banner"
            className="px-3.5 py-3 rounded-xl bg-[var(--t-up-soft)] text-[13px] font-semibold text-[var(--t-up)] leading-snug"
          >
            {errorMessage}
          </div>
        )}

        {/* 6. 제출 버튼 */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="min-h-[48px] px-4 rounded-2xl bg-[var(--t-g100)] text-[var(--t-g700)] font-bold text-[14px] whitespace-nowrap cursor-pointer t-tap disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="submit"
            disabled={submitting}
            data-testid="feedback-submit-btn"
            className="t-cta flex-1 min-h-[48px] gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>제출 중...</span>
              </>
            ) : (
              <span>피드백 보내기</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
