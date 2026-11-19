'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  Upload,
  X,
} from 'lucide-react';
import { calculateEncounterSuccessChance } from '../../engine/encounterEngine';
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
} from '../../types/game';

const STAT_LABEL_KO: Record<keyof PlayerStats, string> = {
  ins: '골밑',
  out: '외곽',
  ply: '패스',
  def: '수비',
  reb: '리바운드',
  phy: '피지컬',
};

function formatCashDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '-';
  const abs = Math.abs(delta);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000).toLocaleString()}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

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
              className="min-h-[40px] min-w-[40px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-[var(--t-g500)] hover:bg-[var(--t-g100)] cursor-pointer shrink-0 t-tap"
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
                <span className="text-[var(--t-accent-ink)]">
                  {event.subtitle || '분기점'}
                </span>
                {career && (
                  <span className="text-[var(--t-g500)] tabular-nums">
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
                  const successChancePct =
                    career && choice.successCheck
                      ? calculateEncounterSuccessChance(career, choice)
                      : null;
                  const costUsd =
                    choice.cashDelta && choice.cashDelta < 0
                      ? Math.abs(choice.cashDelta)
                      : 0;
                  const cannotAfford = costUsd > 0 && currentCash < costUsd;

                  const metaLabel =
                    choice.riskTier === 'HIGH_RISK' || choice.successCheck
                      ? successChancePct !== null
                        ? `성공률 ${successChancePct}%`
                        : '도전'
                      : choice.riskTier === 'BALANCED'
                      ? '트레이드오프'
                      : '확정';

                  const metaColor =
                    choice.riskTier === 'HIGH_RISK' || choice.successCheck
                      ? 'text-[var(--t-accent-ink)]'
                      : choice.riskTier === 'BALANCED'
                      ? 'text-[var(--t-gold)]'
                      : 'text-[var(--t-ok)]';

                  return (
                    <button
                      key={`${event.id}-choice-${idx}`}
                      type="button"
                      disabled={cannotAfford}
                      onClick={() => handleChoiceClick(choice)}
                      className={`w-full min-h-[60px] text-left p-4 rounded-2xl transition t-tap space-y-1 ${
                        cannotAfford
                          ? 'bg-[var(--t-g100)] opacity-45 cursor-not-allowed'
                          : 'bg-[var(--t-g100)] hover:bg-[var(--t-accent-soft)] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-bold text-[var(--t-g900)]">
                          {choice.label}
                        </span>
                        <span
                          className={`text-[12px] font-bold tabular-nums shrink-0 ${metaColor}`}
                        >
                          {metaLabel}
                        </span>
                      </div>

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

    const deltaItems: { label: string; value: string; positive: boolean }[] = [
      ...statEntries.map(([key, val]) => ({
        label: STAT_LABEL_KO[key],
        value: (val || 0) > 0 ? `+${val}` : String(val),
        positive: (val || 0) > 0,
      })),
      ...(lastOutcome.trustDelta !== 0
        ? [
            {
              label: '감독 신뢰',
              value:
                lastOutcome.trustDelta > 0
                  ? `+${lastOutcome.trustDelta}`
                  : String(lastOutcome.trustDelta),
              positive: lastOutcome.trustDelta > 0,
            },
          ]
        : []),
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
      title="새 커리어를 시작할까요?"
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

  const [tab, setTab] = useState<'SAVE' | 'GUIDE'>('SAVE');
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
    a.download = `bench-to-mvp-save-${dateStamp}.json`;
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
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--t-g100)] text-[13px] font-semibold">
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
            onClick={() => setTab('GUIDE')}
            className={`min-h-[40px] rounded-xl transition cursor-pointer ${
              tab === 'GUIDE'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                : 'text-[var(--t-g500)]'
            }`}
          >
            플레이 가이드
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
        ) : (
          <div className="divide-y divide-[var(--t-g100)] text-[13px]">
            {[
              {
                title: '체격과 성장 효율',
                body: '신장과 포지션에 따라 스탯 상한과 성장 속도가 달라집니다.',
              },
              {
                title: '인카운터 판정',
                body: '도전 선택지는 보유 능력치로 성공 확률이 결정되며 대성공 시 연쇄 이벤트가 열립니다.',
              },
              {
                title: '포스트시즌 & 생중계',
                body: '파이널 및 7차전은 실시간 중계로 진행되며, 4쿼터 ±4점 접전 시 클러치 선택이 발생합니다.',
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

  const dotColor =
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
      className="fixed top-[60px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[440px] bg-[var(--t-g900)] text-[var(--t-card)] px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug truncate">
          {toast.title.replace(/^[^\p{L}\p{N}#]+/u, '').trim()}
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
        className="min-h-[32px] min-w-[32px] flex items-center justify-center opacity-70 hover:opacity-100 cursor-pointer shrink-0"
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
