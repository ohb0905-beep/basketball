'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  Lock,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { calculateEncounterSuccessChance } from '../../engine/encounterEngine';
import { RELATIONSHIP_LABELS } from '../../engine/progressionEngine';
import { checkEncounterChoiceUnlock } from '../../engine/storyArcEngine';
import {
  buildHofCompendium,
  normalizeRecordBook,
} from '../../engine/recordBookEngine';
import {
  getEffectiveCashBalance,
  useCareerStore,
} from '../../store/useCareerStore';
import {
  CareerEvent,
  CareerEventChoice,
  CareerState,
  EncounterResolutionResult,
  PlayerStats,
  RelationshipMetrics,
  ResetScope,
} from '../../types/game';
import { formatCashDelta, stripLeadingEmoji } from '../../utils/formatters';

const STAT_LABEL_KO: Record<keyof PlayerStats, string> = {
  ins: '골밑',
  out: '외곽',
  ply: '패스',
  def: '수비',
  reb: '리바운드',
  phy: '피지컬',
};

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
  testId?: string;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  testId,
}: ModalProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid={testId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { y: 36, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-[480px] bg-[var(--t-sheet)] text-[var(--t-g900)] rounded-t-[28px] sm:rounded-[24px] max-h-[88dvh] flex flex-col overflow-hidden"
      >
        {/* Mobile bottom-sheet drag handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-9 h-1 rounded-full bg-[var(--t-g200)]" />
        </div>

        <div className="px-6 pt-4 sm:pt-6 pb-3 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-snug">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] font-medium text-[var(--t-g600)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-[var(--t-g500)] hover:bg-[var(--t-g100)] cursor-pointer shrink-0 t-tap"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 pb-6 pb-safe overflow-y-auto">{children}</div>
      </motion.div>
    </div>
  );
}

export function CareerEventModal({
  event,
  career,
  lastOutcome,
  onSelectChoice,
  onDismissOutcome,
}: {
  event: CareerEvent | null;
  career: CareerState | null;
  lastOutcome: EncounterResolutionResult | null;
  onSelectChoice: (choice: CareerEventChoice) => void;
  onDismissOutcome: () => void;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [rollingState, setRollingState] = useState<{
    eventId: string;
    choice: CareerEventChoice;
  } | null>(null);
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    };
  }, []);

  const rollingChoice =
    event && rollingState?.eventId === event.id ? rollingState.choice : null;

  const handleChoiceClick = (choice: CareerEventChoice) => {
    if (!event || rollingChoice) return;
    if (choice.successCheck && !prefersReducedMotion) {
      setRollingState({ eventId: event.id, choice });
      rollTimerRef.current = setTimeout(() => {
        setRollingState(null);
        rollTimerRef.current = null;
        onSelectChoice(choice);
      }, 360);
      return;
    }
    onSelectChoice(choice);
  };

  const handleSkipRoll = () => {
    if (!rollingChoice) return;
    const picked = rollingChoice;
    if (rollTimerRef.current) {
      clearTimeout(rollTimerRef.current);
      rollTimerRef.current = null;
    }
    setRollingState(null);
    onSelectChoice(picked);
  };

  // 1) 이벤트 선택 바텀시트
  if (event) {
    const currentCash = career ? getEffectiveCashBalance(career) : 0;

    return (
      <div
        data-testid="career-event-modal"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-4"
      >
        <motion.div
          initial={prefersReducedMotion ? false : { y: 36, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full sm:max-w-[480px] bg-[var(--t-sheet)] text-[var(--t-g900)] rounded-t-[28px] sm:rounded-[24px] max-h-[90dvh] flex flex-col overflow-hidden"
        >
          <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span className="w-9 h-1 rounded-full bg-[var(--t-g200)]" />
          </div>

          <div className="px-6 pt-4 sm:pt-6 pb-6 pb-safe overflow-y-auto space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
                <span className="text-[var(--t-accent-ink)] truncate">
                  {event.arcTitle
                    ? `${event.arcTitle} · ${event.subtitle}`
                    : event.subtitle || '분기점'}
                </span>
                {career && (
                  <span className="text-[var(--t-g500)] tabular-nums shrink-0">
                    자산 {formatCashDelta(currentCash).replace('+', '')}
                  </span>
                )}
              </div>
              <h2 className="text-[20px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-snug">
                {event.title}
              </h2>
              <p className="text-[14px] text-[var(--t-g600)] leading-relaxed">
                {event.description}
              </p>
            </div>

            {rollingChoice ? (
              <div className="py-6 px-4 rounded-2xl bg-[var(--t-g100)] text-center space-y-3.5">
                <p className="text-[15px] font-bold text-[var(--t-g900)]">
                  {rollingChoice.label}
                </p>
                <div className="w-full h-1.5 rounded-full bg-[var(--t-g200)] overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.34, ease: 'easeOut' }}
                    style={{ transformOrigin: 'left' }}
                    className="h-full w-full bg-[var(--t-accent)] rounded-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSkipRoll}
                  className="text-[13px] font-semibold text-[var(--t-accent-ink)] cursor-pointer"
                >
                  결과 바로 보기
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {event.choices.map((choice, idx) => {
                  const unlockStatus = checkEncounterChoiceUnlock(career, choice);
                  const isExclusive = Boolean(
                    choice.isExclusiveChoice ||
                      choice.requirements ||
                      choice.requiredTrait
                  );
                  const isLockedByReq = !unlockStatus.unlocked;
                  const successChancePct =
                    career && choice.successCheck
                      ? calculateEncounterSuccessChance(career, choice)
                      : null;
                  const costUsd =
                    choice.cashDelta && choice.cashDelta < 0
                      ? Math.abs(choice.cashDelta)
                      : 0;
                  const cannotAfford = costUsd > 0 && currentCash < costUsd;
                  const isDisabled = cannotAfford || isLockedByReq;

                  const metaLabel = isLockedByReq
                    ? '잠금'
                    : isExclusive
                    ? '전용 분기'
                    : choice.riskTier === 'HIGH_RISK' || choice.successCheck
                    ? successChancePct !== null
                      ? `성공률 ${successChancePct}%`
                      : '도전'
                    : costUsd > 0
                    ? '자금 투자'
                    : '확정';

                  const metaColor = isLockedByReq
                    ? 'text-[var(--t-g400)]'
                    : isExclusive
                    ? 'text-[var(--t-accent-ink)]'
                    : choice.riskTier === 'HIGH_RISK' || choice.successCheck
                    ? 'text-[var(--t-accent-ink)]'
                    : costUsd > 0
                    ? 'text-[var(--t-gold)]'
                    : 'text-[var(--t-ok)]';

                  return (
                    <button
                      key={`${event.id}-choice-${idx}`}
                      type="button"
                      data-testid={
                        isExclusive
                          ? `encounter-exclusive-choice-${idx}`
                          : `encounter-choice-${idx}`
                      }
                      disabled={isDisabled}
                      onClick={() => handleChoiceClick(choice)}
                      className={`w-full min-h-[60px] text-left p-4 rounded-2xl transition t-tap space-y-1 ${
                        isDisabled
                          ? 'bg-[var(--t-g100)] opacity-50 cursor-not-allowed'
                          : isExclusive
                          ? 'bg-[var(--t-accent-soft)] ring-1 ring-[var(--t-accent)]/35 hover:ring-[var(--t-accent)] cursor-pointer'
                          : 'bg-[var(--t-g100)] hover:bg-[var(--t-accent-soft)] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-bold text-[var(--t-g900)] inline-flex items-center gap-1.5 min-w-0">
                          {isLockedByReq && (
                            <Lock className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                          )}
                          <span>{choice.label}</span>
                        </span>
                        <span
                          className={`text-[12px] font-bold tabular-nums shrink-0 ${metaColor}`}
                        >
                          {metaLabel}
                        </span>
                      </div>

                      {isExclusive && unlockStatus.requirementLabel && (
                        <p
                          className={`text-[12px] font-semibold ${
                            isLockedByReq
                              ? 'text-[var(--t-up)]'
                              : 'text-[var(--t-accent-ink)]'
                          }`}
                        >
                          {isLockedByReq
                            ? `조건 미충족 · ${unlockStatus.missingSummary}`
                            : `${unlockStatus.requirementLabel.replace(
                                /^전용 분기\s*·\s*/,
                                ''
                              )} 충족`}
                        </p>
                      )}

                      <p className="text-[13px] text-[var(--t-g600)] leading-snug">
                        {choice.description}
                      </p>

                      {(choice.effectSummary || (choice.successCheck && career)) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px]">
                          {choice.effectSummary && (
                            <span className="font-semibold text-[var(--t-g700)]">
                              {choice.effectSummary}
                            </span>
                          )}
                          {choice.successCheck && career && (
                            <span className="font-medium text-[var(--t-g500)] tabular-nums">
                              {choice.successCheck.label ||
                                STAT_LABEL_KO[choice.successCheck.statKey]}{' '}
                              {career.stats[choice.successCheck.statKey]}
                            </span>
                          )}
                        </div>
                      )}

                      {cannotAfford && (
                        <p className="text-[12px] font-semibold text-[var(--t-up)] pt-0.5 tabular-nums">
                          자산 부족 (필요 {formatCashDelta(-costUsd).replace('-', '')})
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // 2) 선택 결과 리포트 바텀시트
  if (lastOutcome) {
    const tierMeta =
      lastOutcome.outcomeTier === 'CRITICAL_SUCCESS'
        ? { label: '대성공', color: 'text-[var(--t-gold)]' }
        : lastOutcome.outcomeTier === 'SUCCESS'
        ? { label: '성공', color: 'text-[var(--t-ok)]' }
        : lastOutcome.outcomeTier === 'FAILURE'
        ? { label: '실패', color: 'text-[var(--t-up)]' }
        : { label: '확정', color: 'text-[var(--t-accent-ink)]' };

    const statEntries = (
      Object.entries(lastOutcome.statChanges || {}) as [
        keyof PlayerStats,
        number | undefined,
      ][]
    ).filter(([, val]) => typeof val === 'number' && val !== 0);

    const combinedCoachDelta =
      lastOutcome.trustDelta + (lastOutcome.relationshipChanges?.coachTrust || 0);

    const otherRelEntries = (
      Object.entries(lastOutcome.relationshipChanges || {}) as [
        keyof RelationshipMetrics,
        number | undefined,
      ][]
    ).filter(
      ([key, val]) => key !== 'coachTrust' && typeof val === 'number' && val !== 0
    );

    const deltaItems: { label: string; value: string; positive: boolean }[] = [
      ...statEntries.map(([key, val]) => ({
        label: STAT_LABEL_KO[key],
        value: (val || 0) > 0 ? `+${val}` : String(val),
        positive: (val || 0) > 0,
      })),
      ...(combinedCoachDelta !== 0
        ? [
            {
              label: '감독 신뢰',
              value:
                combinedCoachDelta > 0
                  ? `+${combinedCoachDelta}`
                  : String(combinedCoachDelta),
              positive: combinedCoachDelta > 0,
            },
          ]
        : []),
      ...otherRelEntries.map(([key, val]) => ({
        label: RELATIONSHIP_LABELS[key],
        value: (val || 0) > 0 ? `+${val}` : String(val),
        positive: (val || 0) > 0,
      })),
      ...(lastOutcome.draftStockDelta !== 0
        ? [
            {
              label: '스카우트 평가',
              value:
                lastOutcome.draftStockDelta > 0
                  ? `+${lastOutcome.draftStockDelta}`
                  : String(lastOutcome.draftStockDelta),
              positive: lastOutcome.draftStockDelta > 0,
            },
          ]
        : []),
      ...(lastOutcome.potentialDelta !== 0
        ? [
            {
              label: '잠재력',
              value:
                lastOutcome.potentialDelta > 0
                  ? `+${lastOutcome.potentialDelta}`
                  : String(lastOutcome.potentialDelta),
              positive: lastOutcome.potentialDelta > 0,
            },
          ]
        : []),
      ...(lastOutcome.cashDelta !== 0
        ? [
            {
              label: '자산',
              value: formatCashDelta(lastOutcome.cashDelta),
              positive: lastOutcome.cashDelta > 0,
            },
          ]
        : []),
    ];

    return (
      <div
        data-testid="encounter-outcome-modal"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-4"
      >
        <motion.div
          initial={prefersReducedMotion ? false : { y: 36, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full sm:max-w-[460px] bg-[var(--t-sheet)] text-[var(--t-g900)] rounded-t-[28px] sm:rounded-[24px] max-h-[88dvh] flex flex-col overflow-hidden"
        >
          <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span className="w-9 h-1 rounded-full bg-[var(--t-g200)]" />
          </div>

          <div className="px-6 pt-4 sm:pt-6 pb-6 pb-safe overflow-y-auto space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[13px] font-bold">
                <span className={tierMeta.color}>{tierMeta.label}</span>
                {lastOutcome.wasProbabilistic && (
                  <span className="text-[var(--t-g500)] font-medium tabular-nums">
                    성공률 {lastOutcome.successChancePct}%
                  </span>
                )}
              </div>
              <h3 className="text-[20px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-snug">
                {lastOutcome.eventTitle}
              </h3>
              <p className="text-[13px] text-[var(--t-g500)]">
                {lastOutcome.choiceLabel}
              </p>
            </div>

            <p className="text-[14px] text-[var(--t-g700)] leading-relaxed">
              {lastOutcome.narrative}
            </p>

            {deltaItems.length > 0 && (
              <div className="divide-y divide-[var(--t-g100)] border-y border-[var(--t-g100)]">
                {deltaItems.map((item) => (
                  <div
                    key={item.label}
                    className="py-2.5 flex items-center justify-between text-[14px]"
                  >
                    <span className="text-[var(--t-g600)]">{item.label}</span>
                    <span
                      className={`font-bold tabular-nums ${
                        item.positive
                          ? 'text-[var(--t-ok)]'
                          : 'text-[var(--t-up)]'
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {lastOutcome.arcProgressNote && (
              <div className="p-3.5 rounded-2xl bg-[var(--t-g100)] space-y-1">
                <p className="text-[11px] font-bold text-[var(--t-accent-ink)]">
                  스토리 아크
                </p>
                <p className="text-[13px] text-[var(--t-g800)] leading-relaxed">
                  {lastOutcome.arcProgressNote}
                </p>
              </div>
            )}

            {lastOutcome.chainedNextSeasonTitle && (
              <div className="p-3.5 rounded-2xl bg-[var(--t-accent-soft)] text-[13px] text-[var(--t-g800)]">
                <span className="font-bold text-[var(--t-accent-ink)] mr-1.5">
                  연쇄 이벤트 예고
                </span>
                다음 시즌 &ldquo;{lastOutcome.chainedNextSeasonTitle}&rdquo;
              </div>
            )}

            <button
              type="button"
              data-testid="dismiss-outcome-btn"
              onClick={onDismissOutcome}
              className="t-cta"
            >
              확인
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}

export function ResetConfirmModal({
  open,
  career,
  onCancel,
  onConfirmReset,
}: {
  open: boolean;
  career: CareerState | null;
  onCancel: () => void;
  onConfirmReset: () => void;
}) {
  if (!open || !career) return null;

  return (
    <Modal
      open={open}
      title="새 커리어 시작"
      subtitle={`#${career.jerseyNumber} ${career.name} · OVR ${career.ovr}`}
      onClose={onCancel}
    >
      <div className="space-y-5">
        <p className="text-[14px] text-[var(--t-g600)] leading-relaxed">
          현재 진행 중인 선수는 초기화되며, 명예의 전당 기록은 유지됩니다.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onCancel} className="t-cta-sub">
            취소
          </button>
          <button
            type="button"
            data-testid="confirm-reset-career-btn"
            onClick={onConfirmReset}
            className="w-full min-h-[50px] rounded-2xl bg-[var(--t-up)] text-white text-[15px] font-bold cursor-pointer t-tap"
          >
            초기화
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SelectiveResetPanel({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const career = useCareerStore((s) => s.career);
  const hofList = useCareerStore((s) => s.hofList);
  const recordBook = useCareerStore((s) => s.recordBook);
  const resetByScope = useCareerStore((s) => s.resetByScope);

  const [scope, setScope] = useState<ResetScope>('RECORD_BOOK');
  const [confirming, setConfirming] = useState(false);

  const normalizedRecords = normalizeRecordBook(recordBook);
  const compendium = buildHofCompendium(hofList, normalizedRecords);

  const scopeOptions: {
    id: ResetScope;
    title: string;
    detail: string;
    countLabel: string;
  }[] = [
    {
      id: 'RECORD_BOOK',
      title: '역대 기록실만 초기화',
      detail: '사용자가 경신한 리그 신기록만 역대 기본값으로 복원합니다. 명예의 전당과 진행 중 커리어는 유지됩니다.',
      countLabel: `신기록 ${compendium.userBrokenRecordsCount}건`,
    },
    {
      id: 'HALL_OF_FAME',
      title: '명예의 전당만 초기화',
      detail: '헌액된 은퇴 선수와 올타임 베스트 5를 비웁니다. 역대 기록실과 진행 중 커리어는 유지됩니다.',
      countLabel: `헌액 ${hofList.length}명`,
    },
    {
      id: 'ALL',
      title: '전체 기록 초기화',
      detail: '진행 중인 커리어, 명예의 전당, 역대 기록실 신기록을 모두 초기화합니다.',
      countLabel: career
        ? `커리어 1 · 헌액 ${hofList.length} · 신기록 ${compendium.userBrokenRecordsCount}`
        : `헌액 ${hofList.length} · 신기록 ${compendium.userBrokenRecordsCount}`,
    },
  ];

  const selectedMeta =
    scopeOptions.find((opt) => opt.id === scope) || scopeOptions[0];

  const handleConfirm = () => {
    resetByScope(scope);
    setConfirming(false);
    onComplete?.();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {scopeOptions.map((opt) => {
          const active = scope === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              data-testid={`reset-scope-${opt.id}`}
              onClick={() => {
                setScope(opt.id);
                setConfirming(false);
              }}
              className={`w-full min-h-[64px] p-3.5 rounded-2xl text-left flex items-start gap-3 transition cursor-pointer t-tap ${
                active
                  ? 'bg-[var(--t-accent-soft)] ring-1 ring-[var(--t-accent)]'
                  : 'bg-[var(--t-g100)] hover:bg-[var(--t-g200)]/70'
              }`}
            >
              <div className="pt-0.5">
                <SelectionCheckCircle selected={active} />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-bold text-[var(--t-g900)]">
                    {opt.title}
                  </span>
                  <span className="text-[12px] font-bold text-[var(--t-g600)] tabular-nums shrink-0">
                    {opt.countLabel}
                  </span>
                </div>
                <p className="text-[12px] text-[var(--t-g600)] leading-snug">
                  {opt.detail}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {!confirming ? (
        <button
          type="button"
          data-testid="request-selective-reset-btn"
          onClick={() => setConfirming(true)}
          className="w-full min-h-[50px] rounded-2xl bg-[var(--t-up)] text-white text-[14px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer t-tap"
        >
          <Trash2 className="w-4 h-4" />
          <span>{selectedMeta.title}</span>
        </button>
      ) : (
        <div className="p-4 rounded-2xl bg-[var(--t-g100)] space-y-3">
          <div className="space-y-1">
            <p className="text-[14px] font-bold text-[var(--t-up)]">
              정말 초기화하시겠습니까?
            </p>
            <p className="text-[12px] text-[var(--t-g600)] leading-relaxed">
              대상: {selectedMeta.title} ({selectedMeta.countLabel}). 삭제된 데이터는 JSON 백업이 없으면 복구할 수 없습니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="t-cta-sub"
            >
              취소
            </button>
            <button
              type="button"
              data-testid="confirm-selective-reset-btn"
              onClick={handleConfirm}
              className="w-full min-h-[48px] rounded-2xl bg-[var(--t-up)] text-white text-[14px] font-bold cursor-pointer t-tap"
            >
              초기화 확정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SelectiveResetModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      title="기록 선택 초기화"
      subtitle="원하는 범위만 안전하게 초기화할 수 있습니다"
      onClose={onClose}
      testId="selective-reset-modal"
    >
      <SelectiveResetPanel onComplete={onClose} />
    </Modal>
  );
}

export function SaveAndGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const exportSaveJson = useCareerStore((s) => s.exportSaveJson);
  const importSaveJson = useCareerStore((s) => s.importSaveJson);
  const showToast = useCareerStore((s) => s.showToast);

  const [tab, setTab] = useState<'SAVE' | 'RESET' | 'GUIDE'>('SAVE');
  const [importText, setImportText] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleDownloadJson = () => {
    const json = exportSaveJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `road-to-mvp-save-${dateStamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('백업 저장 완료', 'JSON 파일로 저장되었습니다.', 'emerald');
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportSaveJson());
      setFeedback({ ok: true, msg: '클립보드에 복사되었습니다.' });
    } catch {
      setFeedback({ ok: false, msg: '복사에 실패했습니다. 파일 다운로드를 이용해 주세요.' });
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const res = importSaveJson(text);
      setFeedback({ ok: res.ok, msg: res.message });
      if (res.ok) onClose();
    };
    reader.readAsText(file);
  };

  const handlePasteImport = () => {
    if (!importText.trim()) {
      setFeedback({ ok: false, msg: 'JSON 텍스트를 입력해 주세요.' });
      return;
    }
    const res = importSaveJson(importText);
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setImportText('');
      onClose();
    }
  };

  return (
    <Modal open={open} title="저장 · 가이드" onClose={onClose}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[var(--t-g100)] text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => setTab('SAVE')}
            className={`min-h-[40px] rounded-xl transition cursor-pointer ${
              tab === 'SAVE'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                : 'text-[var(--t-g500)]'
            }`}
          >
            백업 · 복원
          </button>
          <button
            type="button"
            data-testid="save-modal-reset-tab"
            onClick={() => setTab('RESET')}
            className={`min-h-[40px] rounded-xl transition cursor-pointer ${
              tab === 'RESET'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                : 'text-[var(--t-g500)]'
            }`}
          >
            기록 초기화
          </button>
          <button
            type="button"
            onClick={() => setTab('GUIDE')}
            className={`min-h-[40px] rounded-xl transition cursor-pointer ${
              tab === 'GUIDE'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                : 'text-[var(--t-g500)]'
            }`}
          >
            가이드
          </button>
        </div>

        {tab === 'SAVE' ? (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <p className="text-[14px] font-bold text-[var(--t-g900)]">
                데이터 내보내기
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="min-h-[46px] rounded-2xl bg-[var(--t-g900)] text-[var(--t-card)] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer t-tap"
                >
                  <Download className="w-4 h-4" />
                  JSON 저장
                </button>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="min-h-[46px] rounded-2xl bg-[var(--t-g100)] text-[var(--t-g800)] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer t-tap"
                >
                  <Copy className="w-4 h-4" />
                  텍스트 복사
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--t-g100)] space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-[var(--t-g900)]">
                  데이터 복원
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--t-accent-ink)] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  파일 불러오기
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={3}
                placeholder="JSON 데이터 붙여넣기"
                className="w-full rounded-2xl bg-[var(--t-g100)] p-3.5 text-[12px] font-mono text-[var(--t-g900)] placeholder:text-[var(--t-g400)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)]"
              />

              <button
                type="button"
                onClick={handlePasteImport}
                className="t-cta"
              >
                복원하기
              </button>

              {feedback && (
                <p
                  className={`text-[13px] font-semibold ${
                    feedback.ok ? 'text-[var(--t-ok)]' : 'text-[var(--t-up)]'
                  }`}
                >
                  {feedback.msg}
                </p>
              )}
            </div>
          </div>
        ) : tab === 'RESET' ? (
          <SelectiveResetPanel onComplete={onClose} />
        ) : (
          <div className="divide-y divide-[var(--t-g100)] text-[13px]">
            {[
              {
                title: '체격과 성장 효율',
                body: '신장과 포지션에 따라 6대 핵심 능력치 상한과 성장 속도가 달라집니다.',
              },
              {
                title: '해외 3대 프로리그 분리 운영',
                body: '일본 B.리그(12팀·60경기), 호주 NBL(10팀·29경기·플레이인), 유로리그(20팀·38경기·파이널 포)가 각 리그의 실제 규정과 포스트시즌 포맷으로 운영됩니다.',
              },
              {
                title: '관계도 · 스토리 아크 · 전용 분기',
                body: '감독 신뢰·라커룸·프런트·언론 관계도와 6대 능력치·특성이 기준을 넘으면 인카운터에서 전용 분기가 해금됩니다.',
              },
              {
                title: '포스트시즌 & 생중계',
                body: '파이널 및 7차전은 실시간 중계로 진행되며, 4쿼터 ±4점 접전 시 클러치 선택이 발생합니다.',
              },
              {
                title: '4년 주기 국제대회',
                body: '아시아컵·아시안게임·FIBA 월드컵·올림픽이 4년 주기로 열립니다. 조별리그~4강은 요약으로 진행되며 결승·메달전은 실시간 중계로 펼쳐집니다. 아시안게임 금메달 또는 올림픽 메달 시 병역 특례가 부여됩니다.',
              },
              {
                title: '자산과 통산 연봉',
                body: '캠프·퍼스널 케어 지출은 보유 자산에서만 차감되며 통산 연봉 기록은 보존됩니다.',
              },
            ].map((item) => (
              <div key={item.title} className="py-3.5 space-y-1">
                <p className="font-bold text-[var(--t-g900)]">{item.title}</p>
                <p className="text-[var(--t-g600)] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ToastBanner() {
  const toast = useCareerStore((s) => s.toast);
  const clearToast = useCareerStore((s) => s.clearToast);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 3600);
    return () => clearTimeout(timer);
  }, [toast, paused, clearToast]);

  if (!toast) return null;

  const accentBar =
    toast.tone === 'emerald'
      ? 'bg-[var(--t-ok)]'
      : toast.tone === 'rose'
      ? 'bg-[var(--t-up)]'
      : toast.tone === 'amber'
      ? 'bg-[var(--t-gold)]'
      : 'bg-[var(--t-accent)]';

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="fixed top-[60px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[440px] bg-[var(--t-g900)] text-[var(--t-card)] pl-3.5 pr-2 py-2.5 rounded-2xl shadow-lg flex items-center gap-3"
    >
      <span className={`w-1 h-7 rounded-full shrink-0 ${accentBar}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug truncate">
          {stripLeadingEmoji(toast.title)}
        </p>
        {toast.description && (
          <p className="text-[12px] opacity-75 truncate mt-0.5">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={clearToast}
        className="min-h-[40px] min-w-[40px] flex items-center justify-center opacity-70 hover:opacity-100 cursor-pointer shrink-0 rounded-xl"
        aria-label="알림 닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function SelectionCheckCircle({ selected }: { selected: boolean }) {
  return (
    <span
      className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 transition-colors ${
        selected
          ? 'bg-[var(--t-accent)] text-white'
          : 'border-2 border-[var(--t-g200)] bg-transparent'
      }`}
    >
      {selected && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
    </span>
  );
}
