'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { POSITION_HEIGHT_RANGES, POSITION_LABELS } from '../../data/archetypes';
import {
  analyzePositionFit,
  calculateBiomechanicalProfile,
  calculateOvr,
  canSwitchToPosition,
  getBiomechanicalGrowthElasticity,
  getSpecialCampOptions,
} from '../../engine/statCalculator';
import { getEffectiveCashBalance, useCareerStore } from '../../store/useCareerStore';
import { PlayerStats, Position, TrainingFocus } from '../../types/game';
import { Modal, SelectionCheckCircle } from '../common/Modal';
import { getScoutingBalanceBadges } from '../create/PlayerCreator';

const STAT_META: { key: keyof PlayerStats; label: string; code: string }[] = [
  { key: 'ins', label: '골밑 득점', code: 'INS' },
  { key: 'out', label: '외곽 슈팅', code: 'OUT' },
  { key: 'ply', label: '패스·시야', code: 'PLY' },
  { key: 'def', label: '수비력', code: 'DEF' },
  { key: 'reb', label: '리바운드', code: 'REB' },
  { key: 'phy', label: '피지컬', code: 'PHY' },
];

const TRAINING_FOCUS_OPTIONS: {
  id: TrainingFocus;
  label: string;
  tag: string;
}[] = [
  { id: 'BALANCED', label: '밸런스 훈련', tag: '전 항목 균형' },
  { id: 'OUTSIDE_SHOOTING', label: '외곽 슈팅', tag: 'OUT 집중' },
  { id: 'INSIDE_SCORING', label: '골밑 피니시', tag: 'INS 집중' },
  { id: 'PLAYMAKING', label: '핸들링 · 패스', tag: 'PLY 집중' },
  { id: 'DEFENSE_LOCKDOWN', label: '대인 수비', tag: 'DEF 집중' },
  { id: 'REBOUND_POST', label: '리바운드 · 포스트', tag: 'REB 집중' },
  { id: 'PHYSICAL_CONDITIONING', label: '피지컬 컨디셔닝', tag: 'PHY 집중' },
];

function formatCashK(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${Math.round(amount / 1000).toLocaleString()}K`;
  return `$${amount.toLocaleString()}`;
}

export function TrainingTab() {
  const career = useCareerStore((s) => s.career);
  const setTrainingFocus = useCareerStore((s) => s.setTrainingFocus);
  const switchPrimaryPosition = useCareerStore((s) => s.switchPrimaryPosition);
  const unlockSecondaryPosition = useCareerStore((s) => s.unlockSecondaryPosition);
  const runSpecialCamp = useCareerStore((s) => s.runSpecialCamp);

  const [showPositionSheet, setShowPositionSheet] = useState(false);

  if (!career) return null;

  const rec = analyzePositionFit(
    career.stats,
    career.heightCm,
    career.primaryPos,
    career.secondaryPos,
    career.coachTrust
  );
  const biomech = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const { overallBadge, reachBadge, agilityBadge } = getScoutingBalanceBadges(biomech);
  const elasticityMap = getBiomechanicalGrowthElasticity(
    career.heightCm,
    career.primaryPos,
    career.stats
  );
  const specialCamps = getSpecialCampOptions(career);
  const campDoneThisYear = career.lastCampYear === career.seasonYear;
  const cash = getEffectiveCashBalance(career);
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  return (
    <div className="space-y-3">
      {/* 1. 6대 핵심 능력치 (1줄 슬림 바) */}
      <section className="t-card space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
            능력치
          </h2>
          <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
            잠재력 {career.potential}
          </span>
        </div>

        <div className="space-y-3">
          {STAT_META.map((item) => {
            const val = career.stats[item.key];
            const delta = career.lastSeasonDelta?.[item.key] || 0;
            const elasticity = elasticityMap[item.key] ?? 1.0;
            const isNearPhysicalCap = elasticity < 0.78;

            return (
              <div
                key={item.key}
                className="grid grid-cols-[72px_1fr_68px] items-center gap-3 text-[13px]"
              >
                <span className="font-semibold text-[var(--t-g700)] truncate">
                  {item.label}
                </span>

                <div className="h-[6px] rounded-full bg-[var(--t-g100)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isNearPhysicalCap
                        ? 'bg-[var(--t-gold)]'
                        : 'bg-[var(--t-accent)]'
                    }`}
                    style={{ width: `${val}%` }}
                  />
                </div>

                <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
                  {delta !== 0 && (
                    <span
                      className={`text-[11px] font-bold ${
                        delta > 0 ? 'text-[var(--t-up)]' : 'text-[var(--t-down)]'
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                  <span className="text-[15px] font-bold text-[var(--t-g900)] w-6 text-right">
                    {val}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. 시즌 중점 훈련 */}
      <section className="t-card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
            중점 훈련
          </h2>
          <span className="text-[12px] text-[var(--t-g500)]">다음 시즌 반영</span>
        </div>

        <div className="divide-y divide-[var(--t-g100)] -mx-2">
          {TRAINING_FOCUS_OPTIONS.map((opt) => {
            const selected = career.trainingFocus === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTrainingFocus(opt.id)}
                className={`w-full min-h-[54px] px-2.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-left cursor-pointer t-tap ${
                  selected ? 'bg-[var(--t-accent-soft)]' : 'hover:bg-[var(--t-g50)]'
                }`}
              >
                <div className="min-w-0">
                  <span className="block text-[15px] font-bold text-[var(--t-g900)]">
                    {opt.label}
                  </span>
                  <span className="block text-[12px] text-[var(--t-g500)]">
                    {opt.tag}
                  </span>
                </div>
                <SelectionCheckCircle selected={selected} />
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. 특별 훈련 캠프 */}
      <section className="t-card space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
            특별 캠프
          </h2>
          <span className="text-[13px] font-semibold text-[var(--t-ok)] tabular-nums">
            {campDoneThisYear ? '이번 시즌 수료' : `자산 ${formatCashK(cash)}`}
          </span>
        </div>

        <div className="divide-y divide-[var(--t-g100)]">
          {specialCamps.map((camp) => {
            const canAfford = cash >= camp.costUsd;
            return (
              <div
                key={camp.id}
                className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[15px] font-bold text-[var(--t-g900)] truncate">
                    {camp.title}
                  </div>
                  <div className="text-[12px] text-[var(--t-g500)] tabular-nums truncate">
                    {camp.effectText} · {formatCashK(camp.costUsd)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={campDoneThisYear || !canAfford}
                  onClick={() => runSpecialCamp(camp.id)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-[13px] font-bold whitespace-nowrap shrink-0 cursor-pointer t-tap ${
                    campDoneThisYear || !canAfford
                      ? 'bg-[var(--t-g100)] text-[var(--t-g400)] cursor-not-allowed'
                      : 'bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)] hover:bg-[var(--t-accent)] hover:text-white'
                  }`}
                >
                  {campDoneThisYear ? '완료' : canAfford ? '참가' : '부족'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. 포지션 & 체격 적합도 */}
      <section className="t-card space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
            포지션 적합도
          </h2>
          <span className="text-[13px] font-semibold text-[var(--t-g500)] tabular-nums">
            {career.primaryPos}
            {career.secondaryPos ? `/${career.secondaryPos}` : ''} · {career.heightCm}cm
          </span>
        </div>

        <div className="divide-y divide-[var(--t-g100)] text-[14px]">
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-[var(--t-g600)]">체격 밸런스</span>
            <span className={`font-bold text-right ${overallBadge.toneClass}`}>
              {overallBadge.text}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-[var(--t-g600)]">타점 · 보드</span>
            <span className="font-semibold text-[var(--t-g800)] text-right">
              {reachBadge}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-[var(--t-g600)]">기동 · 핸들링</span>
            <span className="font-semibold text-[var(--t-g800)] text-right">
              {agilityBadge}
            </span>
          </div>
        </div>

        {/* 코칭스태프 권고 */}
        <div className="p-4 rounded-2xl bg-[var(--t-g100)] space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-bold text-[var(--t-g900)]">
              추천 포지션 {rec.bestPrimaryPos}
            </span>
            <span className="text-[13px] font-bold text-[var(--t-accent-ink)] tabular-nums">
              예상 OVR {rec.bestPrimaryOvr}
            </span>
          </div>
          <p className="text-[13px] text-[var(--t-g600)] leading-relaxed">
            {rec.coachAdvice}
          </p>

          {(rec.bestPrimaryPos !== career.primaryPos || rec.canUnlockSecondary) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {rec.bestPrimaryPos !== career.primaryPos &&
                canSwitchToPosition(
                  career.primaryPos,
                  rec.bestPrimaryPos,
                  career.heightCm,
                  career.secondaryPos
                ).allowed && (
                  <button
                    type="button"
                    onClick={() => switchPrimaryPosition(rec.bestPrimaryPos)}
                    className="min-h-[40px] flex-1 px-3.5 rounded-xl bg-[var(--t-accent)] text-white font-bold text-[13px] cursor-pointer t-tap"
                  >
                    {rec.bestPrimaryPos} 전향
                  </button>
                )}

              {rec.canUnlockSecondary && (
                <button
                  type="button"
                  onClick={() => unlockSecondaryPosition(rec.recommendedSecondaryPos)}
                  className="min-h-[40px] flex-1 px-3.5 rounded-xl bg-[var(--t-ok)] text-white font-bold text-[13px] cursor-pointer t-tap"
                >
                  부포지션 {rec.recommendedSecondaryPos} 해금
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPositionSheet(true)}
          className="w-full min-h-[48px] px-1 flex items-center justify-between text-[14px] font-semibold text-[var(--t-g700)] hover:text-[var(--t-g900)] cursor-pointer t-tap"
        >
          <span>포지션별 OVR 시뮬레이터</span>
          <ChevronRight className="w-4 h-4 text-[var(--t-g400)]" />
        </button>
      </section>

      <Modal
        open={showPositionSheet}
        title="포지션별 OVR 시뮬레이터"
        subtitle={`현재 신장 ${career.heightCm}cm 기준`}
        onClose={() => setShowPositionSheet(false)}
      >
        <div className="divide-y divide-[var(--t-g100)]">
          {positions.map((pos) => {
            const range = POSITION_HEIGHT_RANGES[pos];
            const simulatedOvr = calculateOvr(career.stats, pos, career.heightCm);
            const isCurrent = career.primaryPos === pos;
            const check = canSwitchToPosition(
              career.primaryPos,
              pos,
              career.heightCm,
              career.secondaryPos
            );

            return (
              <div
                key={pos}
                className="py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[var(--t-g900)]">
                    {POSITION_LABELS[pos]}
                  </div>
                  <div className="text-[12px] text-[var(--t-g500)] tabular-nums">
                    권장 {range.optimalMin}~{range.optimalMax}cm
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[15px] font-bold text-[var(--t-accent)] tabular-nums">
                    {simulatedOvr}
                  </span>
                  {isCurrent ? (
                    <span className="text-[12px] font-bold text-[var(--t-g400)] w-12 text-center">
                      현재
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!check.allowed}
                      onClick={() => {
                        switchPrimaryPosition(pos);
                        setShowPositionSheet(false);
                      }}
                      className={`min-h-[34px] w-12 rounded-xl text-[12px] font-bold cursor-pointer t-tap ${
                        check.allowed
                          ? 'bg-[var(--t-g900)] text-[var(--t-card)]'
                          : 'bg-[var(--t-g100)] text-[var(--t-g400)] cursor-not-allowed'
                      }`}
                    >
                      {check.allowed ? '전향' : '불가'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
