'use client';

import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { PlayerStats } from '../../types/game';

const COMBINE_DRILLS: {
  id: string;
  title: string;
  effect: string;
  statKey: keyof PlayerStats;
}[] = [
  {
    id: 'DRILL_SHOOTING',
    title: '3점 · 무빙 슈팅 쇼케이스',
    effect: 'OUT +1 · 드래프트 평가 상승',
    statKey: 'out',
  },
  {
    id: 'DRILL_ATHLETIC',
    title: '버티컬 · 레인 어질리티',
    effect: 'PHY +1 · 드래프트 평가 상승',
    statKey: 'phy',
  },
  {
    id: 'DRILL_SCRIMMAGE',
    title: '5대5 실전 스크리미지',
    effect: 'PLY +1 · 드래프트 평가 상승',
    statKey: 'ply',
  },
];

export function DraftCombine() {
  const career = useCareerStore((s) => s.career);
  const runCombineDrill = useCareerStore((s) => s.runCombineDrill);
  const completeCombineInterview = useCareerStore((s) => s.completeCombineInterview);
  const withdrawFromDraft = useCareerStore((s) => s.withdrawFromDraft);
  const proceedToDraftLive = useCareerStore((s) => s.proceedToDraftLive);

  if (!career || !career.combineState) return null;

  const cs = career.combineState;
  const projectedRound =
    cs.projectedPick <= 30
      ? '1라운드'
      : cs.projectedPick <= 58
      ? '2라운드'
      : '미지명 위험';

  return (
    <div className="max-w-[560px] mx-auto px-4 pt-2 pb-28 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={withdrawFromDraft}
          className="min-h-[40px] -ml-2 px-2 inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--t-g600)] hover:text-[var(--t-g900)] cursor-pointer t-tap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>드래프트 철회</span>
        </button>
        <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
          {career.seasonYear} 시카고 컴바인
        </span>
      </div>

      {/* 예상 지명 순위 카드 */}
      <section className="t-card space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
              NBA 드래프트 컴바인
            </span>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--t-g900)] mt-0.5">
              예상 #{cs.projectedPick}순위
            </h1>
          </div>
          <span className="text-[14px] font-bold text-[var(--t-g600)] shrink-0">
            {projectedRound}
          </span>
        </div>
        <p className="text-[13px] text-[var(--t-g600)] leading-relaxed">
          {cs.scoutingReport}
        </p>
      </section>

      {/* 1. 드릴 측정 */}
      <section className="t-card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
            스킬 · 피지컬 측정
          </h2>
          <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
            {cs.completedDrills.length} / 2
          </span>
        </div>

        <div className="divide-y divide-[var(--t-g100)] -mx-2">
          {COMBINE_DRILLS.map((drill) => {
            const done = cs.completedDrills.includes(drill.id);
            const disabled = done || cs.completedDrills.length >= 2;
            return (
              <button
                key={drill.id}
                type="button"
                disabled={disabled}
                onClick={() => runCombineDrill(drill.id, drill.title, drill.statKey)}
                className={`w-full min-h-[60px] px-2.5 py-3 rounded-2xl flex items-center justify-between gap-3 text-left t-tap ${
                  done
                    ? 'bg-[var(--t-ok-soft)]'
                    : disabled
                    ? 'opacity-45 cursor-not-allowed'
                    : 'hover:bg-[var(--t-g50)] cursor-pointer'
                }`}
              >
                <div className="min-w-0">
                  <span className="block text-[15px] font-bold text-[var(--t-g900)]">
                    {drill.title}
                  </span>
                  <span className="block text-[12px] text-[var(--t-g500)]">
                    {drill.effect}
                  </span>
                </div>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--t-ok)] shrink-0">
                    <Check className="w-4 h-4" /> 완료
                  </span>
                ) : (
                  <span className="text-[13px] font-bold text-[var(--t-accent-ink)] shrink-0">
                    측정
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. 구단 단장 인터뷰 */}
      <section className="t-card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
            구단 단장 인터뷰
          </h2>
          {cs.interviewCompleted && (
            <span className="text-[12px] font-bold text-[var(--t-ok)]">완료</span>
          )}
        </div>

        <div className="space-y-2">
          {[
            {
              id: 'CONFIDENT' as const,
              label: '에이스 포부 어필',
              quote: '“이번 드래프트 최고의 스틸 픽이 되겠습니다.”',
            },
            {
              id: 'TEAM_FIRST' as const,
              label: '팀 퍼스트 강조',
              quote: '“수비와 궂은일부터 팀에 필요한 역할을 해내겠습니다.”',
            },
            {
              id: 'ANALYTICAL' as const,
              label: '전술 이해도 어필',
              quote: '“스페이싱과 스위치 수비 시스템을 완벽히 이해합니다.”',
            },
          ].map((ans) => (
            <button
              key={ans.id}
              type="button"
              disabled={cs.interviewCompleted}
              onClick={() => completeCombineInterview(ans.id)}
              className="w-full p-3.5 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-accent-soft)] disabled:opacity-45 text-left cursor-pointer t-tap space-y-0.5"
            >
              <div className="text-[14px] font-bold text-[var(--t-g900)]">
                {ans.label}
              </div>
              <p className="text-[12px] text-[var(--t-g600)]">{ans.quote}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 하단 고정 CTA 도크 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 pt-4 px-4 pb-safe"
        style={{
          background:
            'linear-gradient(to top, var(--t-dock-fade) 72%, transparent)',
        }}
      >
        <div className="max-w-[528px] mx-auto">
          <button
            type="button"
            onClick={proceedToDraftLive}
            className="t-cta"
          >
            NBA 드래프트 본무대 입장
          </button>
        </div>
      </div>
    </div>
  );
}
