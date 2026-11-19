'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { POSITION_HEIGHT_RANGES, POSITION_LABELS } from '../../data/archetypes';
import {
  analyzePositionFit,
  calculateBiomechanicalProfile,
  calculateOvr,
  canSwitchToPosition,
  getBiomechanicalGrowthElasticity,
  getSpecialCampOptions,
} from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import { PlayerStats, Position, TrainingFocus } from '../../types/game';
import { getScoutingBalanceBadges } from '../create/PlayerCreator';

const STAT_META: { key: keyof PlayerStats; label: string; desc: string }[] = [
  { key: 'ins', label: '인사이드 득점 (INS)', desc: '림 어택 레이업, 플로터, 포스트업 마무리예요.' },
  { key: 'out', label: '아웃사이드 슈팅 (OUT)', desc: '3점슛, 미드레인지 점퍼, 자유투 정확도예요.' },
  { key: 'ply', label: '플레이메이킹 (PLY)', desc: '코트 비전, 픽앤롤 패스, 볼 키핑 안정성이에요.' },
  { key: 'def', label: '수비력 (DEF)', desc: '퍼리미터 대인 수비, 스틸, 림 프로텍팅이에요.' },
  { key: 'reb', label: '리바운드 & 보드 (REB)', desc: '공격/수비 리바운드 경합 및 박스아웃이에요.' },
  { key: 'phy', label: '피지컬 & 내구도 (PHY)', desc: '스피드, 민첩성, 점프력, 부상 방지 내구도예요.' },
];

const TRAINING_FOCUS_OPTIONS: {
  id: TrainingFocus;
  label: string;
  desc: string;
}[] = [
  {
    id: 'BALANCED',
    label: '⚖️ 전천후 밸런스 훈련',
    desc: '6대 능력치를 고르게 단련하며 약점을 보완해요.',
  },
  {
    id: 'OUTSIDE_SHOOTING',
    label: '🎯 아웃사이드 슈팅 집중',
    desc: '3점슛과 미드레인지 점퍼(OUT) 성장을 극대화해요.',
  },
  {
    id: 'INSIDE_SCORING',
    label: '🔨 인사이드 피니시 집중',
    desc: '돌파 레이업과 포스트업 득점(INS) 성장을 집중 강화해요.',
  },
  {
    id: 'PLAYMAKING',
    label: '🪄 볼핸들링 & 패스 집중',
    desc: '코트 시야와 픽앤롤 조율(PLY) 능력을 집중 연마해요.',
  },
  {
    id: 'DEFENSE_LOCKDOWN',
    label: '🛡️ 락다운 수비 집중',
    desc: '대인 방어와 스틸·블록 타이밍(DEF)을 집중 강화해요.',
  },
  {
    id: 'REBOUND_POST',
    label: '🦍 보드 장악 & 박스아웃 집중',
    desc: '리바운드 위치 선정과 골밑 경합(REB)을 집중 단련해요.',
  },
  {
    id: 'PHYSICAL_CONDITIONING',
    label: '🚀 피지컬 & 코어 컨디셔닝',
    desc: '운동능력과 부상 방지 내구도(PHY)를 집중 끌어올려요.',
  },
];

function getGrowthPotentialBadge(elasticity: number): {
  label: string;
  className: string;
} {
  if (elasticity >= 0.95) {
    return {
      label: '🚀 성장 효율 최상',
      className: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    };
  }
  if (elasticity >= 0.78) {
    return {
      label: '✅ 표준 성장 효율',
      className: 'bg-slate-100 border-slate-200 text-slate-600',
    };
  }
  return {
    label: '⚠️ 체격 한계 근접 (성장 둔화)',
    className: 'bg-amber-50 border-amber-200 text-amber-700',
  };
}

export function TrainingTab() {
  const career = useCareerStore((s) => s.career);
  const setTrainingFocus = useCareerStore((s) => s.setTrainingFocus);
  const switchPrimaryPosition = useCareerStore((s) => s.switchPrimaryPosition);
  const unlockSecondaryPosition = useCareerStore((s) => s.unlockSecondaryPosition);
  const runSpecialCamp = useCareerStore((s) => s.runSpecialCamp);

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
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  return (
    <div className="space-y-5">
      {/* 1. 신체 밸런스 스카우팅 리포트 & 코칭스태프 포지션 조언 */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-600" />
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              신체 밸런스 &amp; 포지션 적합도 리포트
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {career.heightCm}cm · {POSITION_LABELS[career.primaryPos]}
            {career.secondaryPos ? ` (부: ${career.secondaryPos})` : ''}
          </span>
        </div>

        {/* 한국어 스카우팅 등급 뱃지 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${overallBadge.toneClass}`}
          >
            <span>{overallBadge.text}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200 font-bold text-slate-700">
              {reachBadge}
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 font-bold text-slate-700">
              {agilityBadge}
            </div>
          </div>
        </div>

        {/* 감독의 포지션 전향 / 듀얼 포지션 추천 배너 */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                코칭스태프 권고 (추천 주포지션: {rec.bestPrimaryPos} · OVR {rec.bestPrimaryOvr})
              </h4>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">{rec.coachAdvice}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                  className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  주포지션 {rec.bestPrimaryPos} 전향
                </button>
              )}

            {rec.canUnlockSecondary && (
              <button
                type="button"
                onClick={() => unlockSecondaryPosition(rec.recommendedSecondaryPos)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                부포지션 {rec.recommendedSecondaryPos} 해금
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. 6대 핵심 능력치 & 시즌 중점 훈련 프로그램 */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-orange-600" />
            6대 핵심 능력치 &amp; 시즌 중점 훈련
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            선택한 중점 훈련 코스가 다음 시즌 능력치 성장에 집중 반영돼요.
          </p>
        </div>

        {/* 6대 능력치 바 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STAT_META.map((item) => {
            const val = career.stats[item.key];
            const delta = career.lastSeasonDelta?.[item.key] || 0;
            const badge = getGrowthPotentialBadge(elasticityMap[item.key] ?? 1.0);

            return (
              <div
                key={item.key}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    {delta !== 0 && (
                      <span
                        className={`text-xs font-extrabold ${
                          delta > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                    <span className="text-base font-black text-orange-600">{val}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-600 rounded-full transition-all"
                    style={{ width: `${val}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">{item.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 중점 훈련 선택 */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-extrabold text-slate-700">
            이번 시즌 중점 훈련 코스 선택
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TRAINING_FOCUS_OPTIONS.map((opt) => {
              const selected = career.trainingFocus === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTrainingFocus(opt.id)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    selected
                      ? 'border-orange-500 bg-orange-50/70 ring-1 ring-orange-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-extrabold text-slate-900">{opt.label}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. 비시즌 특별 스킬 캠프 */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            특별 훈련 캠프 &amp; 신체 개조 (시즌당 1회)
          </h3>
          {campDoneThisYear && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> 이번 시즌 수료 완료
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {specialCamps.map((camp) => (
            <div
              key={camp.id}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="text-sm font-extrabold text-slate-900">{camp.title}</div>
                <p className="text-xs text-slate-600">{camp.subtitle}</p>
                <p className="text-[11px] font-bold text-orange-600">
                  {camp.effectText} · 비용 ${(camp.costUsd / 1000).toFixed(0)}K
                </p>
              </div>
              <button
                type="button"
                disabled={campDoneThisYear}
                onClick={() => runSpecialCamp(camp.id)}
                className="shrink-0 px-3.5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-extrabold text-xs transition cursor-pointer"
              >
                캠프 참가
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 인접 포지션 전향 시뮬레이터 */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
            인접 포지션 전향 시뮬레이터
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            현재 신장({career.heightCm}cm)으로 각 포지션을 소화할 때의 예상 OVR과 신체 적합도를 확인해 보세요.
          </p>
        </div>

        <div className="space-y-2">
          {positions.map((pos) => {
            const range = POSITION_HEIGHT_RANGES[pos];
            const simulatedOvr = calculateOvr(career.stats, pos, career.heightCm);
            const posBiomech = calculateBiomechanicalProfile(career.heightCm, pos);
            const posBadges = getScoutingBalanceBadges(posBiomech);
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
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                  isCurrent
                    ? 'bg-orange-50 border-orange-400 text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-extrabold">{POSITION_LABELS[pos]}</span>
                    <span className="text-xs text-slate-500">
                      (권장 {range.optimalMin}~{range.optimalMax}cm)
                    </span>
                  </div>
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${posBadges.overallBadge.toneClass}`}
                  >
                    {posBadges.overallBadge.text}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-sm font-black text-orange-600 tabular-nums">
                    OVR {simulatedOvr}
                  </span>
                  {!isCurrent ? (
                    <button
                      type="button"
                      disabled={!check.allowed}
                      onClick={() => switchPrimaryPosition(pos)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-xs font-bold text-white transition cursor-pointer"
                    >
                      {check.allowed ? '전향하기' : '전향 제한'}
                    </button>
                  ) : (
                    <span className="text-xs font-black text-orange-600 px-2">현재</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
