'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
  RefreshCw,
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

const STAT_META: { key: keyof PlayerStats; label: string; desc: string }[] = [
  { key: 'ins', label: '인사이드 득점 (INS)', desc: '림 어택 레이업, 플로터, 포스트업 마무리' },
  { key: 'out', label: '아웃사이드 슈팅 (OUT)', desc: '3점슛, 미드레인지 점퍼, 자유투 정확도' },
  { key: 'ply', label: '플레이메이킹 (PLY)', desc: '코트 비전, 픽앤롤 패스, 볼 키핑 안정성' },
  { key: 'def', label: '수비력 (DEF)', desc: '퍼리미터 대인 수비, 스틸, 림 프로텍팅' },
  { key: 'reb', label: '리바운드 & 보드 (REB)', desc: '공격/수비 리바운드 경합 및 박스아웃' },
  { key: 'phy', label: '피지컬 & 내구도 (PHY)', desc: '스피드, 민첩성, 버티컬 점프, 코어 지구력' },
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
  const elasticityMap = getBiomechanicalGrowthElasticity(
    career.heightCm,
    career.primaryPos,
    career.stats
  );
  const specialCamps = getSpecialCampOptions(career);
  const campDoneThisYear = career.lastCampYear === career.seasonYear;
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  return (
    <div className="space-y-6">
      {/* 1. 양방향 생체역학 물리 엔진 진단 리포트 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-extrabold text-slate-900">
              양방향 생체역학(Biomechanics) 코트 효율 진단
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {career.heightCm}cm · 현재 주 포지션: {POSITION_LABELS[career.primaryPos]}
            {career.secondaryPos ? ` (부: ${career.secondaryPos})` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-600">① 타점 및 림 장악력 (Reach)</span>
              <span className="font-black text-sky-600">{biomech.reachLeverage.toFixed(2)}x</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              골밑 야투 보정({biomech.insideFgModifier >= 0 ? `+${biomech.insideFgModifier}` : biomech.insideFgModifier}%p) · 리바운드 배율({biomech.rebMultiplier}x) · 블록 배율({biomech.blkMultiplier}x)에 연속 반영돼요.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-600">② 무게중심·볼 키핑 민첩성 (CoG)</span>
              <span className="font-black text-emerald-600">{biomech.centerOfGravityAgility.toFixed(2)}x</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              드리블 턴오버 페널티(+{biomech.tovRatePenalty}) · 외곽 수비 감점(-{biomech.perimeterDefPenalty})에 연속 반영돼요.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-600">③ 포지션 물리 괴리 부하 (Strain)</span>
              <span
                className={`font-black ${
                  biomech.positionalPhysicsStrain >= 0.4 ? 'text-rose-600' : 'text-slate-800'
                }`}
              >
                {biomech.positionalPhysicsStrain.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              체력 소모 배율(x{biomech.staminaDrainMultiplier}) 및 비적정 포지션 소화 시 실효 야투율·수비 마진 손실을 나타내요.
            </p>
          </div>
        </div>

        {/* 감독의 포지션 전향 / 듀얼 포지션 추천 배너 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                코칭스태프 포지션 적합도 리포트 (최적 주포지션: {rec.bestPrimaryPos} · OVR {rec.bestPrimaryOvr})
              </h4>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">{rec.coachAdvice}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {rec.bestPrimaryPos !== career.primaryPos &&
              canSwitchToPosition(
                career.primaryPos,
                rec.bestPrimaryPos,
                career.secondaryPos,
                career.heightCm
              ).allowed && (
                <button
                  type="button"
                  onClick={() => switchPrimaryPosition(rec.bestPrimaryPos)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  주포지션 {rec.bestPrimaryPos}(으)로 전향
                </button>
              )}

            {rec.canUnlockSecondary && (
              <button
                type="button"
                onClick={() => unlockSecondaryPosition(rec.recommendedSecondaryPos)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                부포지션 {rec.recommendedSecondaryPos} 해금 (+신뢰도)
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. 6대 능력치 상세 및 시즌 중점 훈련 프로그램 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-orange-600" />
              6대 핵심 능력치 &amp; 시즌 중점 훈련 프로그램
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              선택한 시즌 중점 훈련 코스와 생체역학 성장 탄력성(Elasticity)이 다음 시즌 능력치 상승폭에 반영돼요.
            </p>
          </div>
        </div>

        {/* 6대 능력치 바 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STAT_META.map((item) => {
            const val = career.stats[item.key];
            const delta = career.lastSeasonDelta?.[item.key] || 0;
            const elasticity = elasticityMap[item.key] ?? 1.0;
            const elasticityPct = Math.round(elasticity * 100);

            return (
              <div
                key={item.key}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-900">{item.label}</span>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      탄력성 {elasticityPct}%
                    </span>
                    {delta !== 0 && (
                      <span
                        className={`text-xs font-extrabold ${
                          delta > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                    <span className="text-lg font-black text-orange-600">{val}</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-600 rounded-full transition-all"
                    style={{ width: `${val}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">{item.desc}</p>
              </div>
            );
          })}
        </div>

        {/* 중점 훈련 선택 */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-extrabold text-slate-700">
            이번 시즌 중점 훈련 코스 선택
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {TRAINING_FOCUS_OPTIONS.map((opt) => {
              const selected = career.trainingFocus === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTrainingFocus(opt.id)}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    selected
                      ? 'border-orange-500 bg-orange-50/70 ring-1 ring-orange-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-extrabold text-slate-900">{opt.label}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. 비시즌 특별 스킬 캠프 & 포지션 전향 시뮬레이터 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              비시즌 특별 캠프 &amp; 신체 개조 (시즌당 1회)
            </h3>
            {campDoneThisYear && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> 이번 시즌 수료 완료
              </span>
            )}
          </div>

          <div className="space-y-3">
            {specialCamps.map((camp) => (
              <div
                key={camp.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3"
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

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
              포지션 밸런스 및 인접 포지션 전향 시뮬레이터
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              현재 신장({career.heightCm}cm)으로 각 포지션을 소화할 때의 실효 OVR과 전향 가능 여부를 확인해요.
            </p>
          </div>

          <div className="space-y-2.5">
            {positions.map((pos) => {
              const range = POSITION_HEIGHT_RANGES[pos];
              const simulatedOvr = calculateOvr(career.stats, pos, career.heightCm);
              const posBiomech = calculateBiomechanicalProfile(career.heightCm, pos);
              const isCurrent = career.primaryPos === pos;
              const check = canSwitchToPosition(
                career.primaryPos,
                pos,
                career.secondaryPos,
                career.heightCm
              );

              return (
                <div
                  key={pos}
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isCurrent
                      ? 'bg-orange-50 border-orange-400 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold">{POSITION_LABELS[pos]}</span>
                      <span className="text-xs text-slate-500">
                        (권장 {range.optimalMin}~{range.optimalMax}cm)
                      </span>
                      {posBiomech.positionalPhysicsStrain >= 0.3 && (
                        <span className="text-[11px] font-bold text-amber-600">
                          물리 부하 {posBiomech.positionalPhysicsStrain.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-orange-600 tabular-nums">
                      OVR {simulatedOvr}
                    </span>
                    {!isCurrent ? (
                      <button
                        type="button"
                        disabled={!check.allowed}
                        onClick={() => switchPrimaryPosition(pos)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-xs font-bold text-white transition cursor-pointer"
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
    </div>
  );
}
