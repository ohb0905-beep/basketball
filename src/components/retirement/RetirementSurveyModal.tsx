'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { collectFeedbackGameContext } from '../../lib/feedback';
import { getOrCreateCareerRunId, trackGameEvent } from '../../lib/analytics';
import {
  SURVEY_COMMENT_MAX,
  SURVEY_FEEDBACK_TITLE,
  SURVEY_ID,
  SURVEY_QUESTIONS,
  SurveyAnswers,
  buildSurveyResponsePayload,
  formatSurveyAnswersForFeedback,
  isSurveyComplete,
} from '../../lib/survey';
import { useCareerStore } from '../../store/useCareerStore';
import type { CareerState } from '../../types/game';

export interface RetirementSurveyModalProps {
  open: boolean;
  career: CareerState;
  onClose: () => void;
}

/**
 * 은퇴 화면 난이도 설문 (1인 1회, 노출 여부는 부모가 결정)
 */
export function RetirementSurveyModal({ open, career, onClose }: RetirementSurveyModalProps) {
  const showToast = useCareerStore((s) => s.showToast);
  const view = useCareerStore((s) => s.view);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const complete = isSurveyComplete(answers);
  const answeredCount = SURVEY_QUESTIONS.filter((q) => answers[q.id] != null).length;

  const send = (status: 'submitted' | 'skipped', hasComment: boolean) => {
    trackGameEvent(
      'survey_response',
      buildSurveyResponsePayload({ career, status, answers, hasComment }),
      {
        careerRunId: getOrCreateCareerRunId(career.id),
        dedupeKey: `survey_response:${SURVEY_ID}`,
        dedupeScope: 'persistent',
      }
    );
  };

  const handleSkip = () => {
    if (submitting) return;
    send('skipped', false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || submitting) return;
    const trimmed = comment.trim();
    send('submitted', trimmed.length > 0);

    if (trimmed.length > 0) {
      setSubmitting(true);
      try {
        const context = collectFeedbackGameContext({ view, career });
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'balance',
            title: SURVEY_FEEDBACK_TITLE,
            content: `${trimmed}\n\n---\n${formatSurveyAnswersForFeedback(answers)}`,
            gameVersion: context.gameVersion,
            gameContext: context,
          }),
        });
      } catch {
        // 의견 전송 실패는 게임 진행에 영향을 주지 않습니다. 점수 답변은 이미 보냈습니다.
      } finally {
        setSubmitting(false);
      }
    }

    showToast('설문에 참여해 주셔서 감사합니다', '다음 밸런스 조정에 꼭 반영하겠습니다.', 'emerald');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="난이도 설문"
      subtitle="커리어를 마친 소감을 알려주세요 · 한 번만 묻습니다"
      onClose={submitting ? undefined : handleSkip}
      testId="retirement-survey-modal"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {SURVEY_QUESTIONS.map((question, index) => (
          <fieldset key={question.id} className="space-y-2">
            <legend className="text-[13px] font-bold text-[var(--t-g800)]">
              {index + 1}. {question.title}
            </legend>
            <div
              role="radiogroup"
              aria-label={question.title}
              className="grid grid-cols-5 gap-1"
            >
              {question.options.map((option) => {
                const selected = answers[question.id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={submitting}
                    data-testid={`survey-${question.id}-${option.value}`}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [question.id]: option.value }))
                    }
                    className={`min-h-[44px] px-1 py-1.5 rounded-xl text-center text-[12px] leading-tight font-semibold transition cursor-pointer t-tap ${
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
          </fieldset>
        ))}

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="survey-comment-input"
              className="text-[13px] font-bold text-[var(--t-g800)]"
            >
              {SURVEY_QUESTIONS.length + 1}. 하고 싶은 말{' '}
              <span className="font-medium text-[var(--t-g500)]">(선택)</span>
            </label>
            <span className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums">
              {comment.length} / {SURVEY_COMMENT_MAX}
            </span>
          </div>
          <textarea
            id="survey-comment-input"
            data-testid="survey-comment-input"
            rows={3}
            value={comment}
            maxLength={SURVEY_COMMENT_MAX}
            disabled={submitting}
            onChange={(e) => setComment(e.target.value)}
            placeholder="좋았던 점, 아쉬웠던 점을 자유롭게 남겨주세요"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--t-g100)] text-[14px] text-[var(--t-g900)] placeholder:text-[var(--t-g400)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] disabled:opacity-60"
          />
        </div>

        <div className="space-y-2">
          <button
            type="submit"
            data-testid="survey-submit-btn"
            disabled={!complete || submitting}
            className="t-cta disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {complete
              ? '설문 보내기'
              : `${SURVEY_QUESTIONS.length}개 중 ${answeredCount}개 응답`}
          </button>
          <button
            type="button"
            data-testid="survey-skip-btn"
            onClick={handleSkip}
            disabled={submitting}
            className="t-cta-sub"
          >
            건너뛰기
          </button>
        </div>
      </form>
    </Modal>
  );
}
