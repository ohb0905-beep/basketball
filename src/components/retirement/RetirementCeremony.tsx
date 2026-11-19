'use client';

import React from 'react';
import { evaluateCareerLegacy } from '../../engine/retirementEngine';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamEmblem } from '../common/TeamEmblem';

export function RetirementCeremony() {
  const career = useCareerStore((s) => s.career);
  const completeRetirementAndReturnHome = useCareerStore(
    (s) => s.completeRetirementAndReturnHome
  );
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);
  const setView = useCareerStore((s) => s.setView);

  if (!career) {
    return (
      <div className="max-w-[560px] mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-[18px] font-bold text-[var(--t-g900)]">
          은퇴 리포트를 불러올 수 없어요
        </p>
        <button
          type="button"
          onClick={() => setView('HOME')}
          className="t-cta max-w-[260px] mx-auto"
        >
          홈으로 이동
        </button>
      </div>
    );
  }

  const evaluation = career.legacyEvaluation || evaluateCareerLegacy(career);

  return (
    <div className="max-w-[560px] mx-auto px-4 pt-2 pb-12 space-y-3">
      {/* 메인 은퇴 리포트 카드 */}
      <section className="t-card text-center space-y-5">
        <div className="space-y-1.5">
          <span className="text-[12px] font-bold text-[var(--t-gold)]">
            공식 은퇴 리포트
          </span>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-[var(--t-g900)]">
            #{career.jerseyNumber} {career.name}
          </h1>
          <p className="text-[16px] font-bold text-[var(--t-accent)]">
            {evaluation.tierTitle}
          </p>
          <p className="text-[14px] text-[var(--t-g600)] leading-relaxed pt-1">
            {evaluation.summaryComment}
          </p>
        </div>

        {/* 오픈 4열 커리어 최종 지표 */}
        <div className="grid grid-cols-4 pt-4 border-t border-[var(--t-g100)] gap-1 tabular-nums">
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-g900)]">
              {career.seasonsPlayed}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">시즌</span>
          </div>
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-g900)]">
              {career.totals.points.toLocaleString()}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">통산 득점</span>
          </div>
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-gold)]">
              {career.totals.championships}/{career.totals.mvps}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">우승/MVP</span>
          </div>
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-accent)]">
              {evaluation.legacyScore.toLocaleString()}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">레거시</span>
          </div>
        </div>
      </section>

      {/* 대표 구단 및 영구결번 심사 */}
      <section className="t-card space-y-4">
        <span className="text-[13px] font-bold text-[var(--t-g500)]">
          대표 구단 · 영구결번 심사
        </span>

        <div className="flex items-center gap-4">
          <TeamEmblem team={evaluation.honoredTeam} size="lg" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <h2 className="text-[18px] font-bold text-[var(--t-g900)] truncate">
              {evaluation.honoredTeam.name}
            </h2>
            <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
              {evaluation.honoredTeamSeasons}시즌 ·{' '}
              {evaluation.honoredTeamPoints.toLocaleString()}득점 · 우승{' '}
              {evaluation.honoredTeamChamps} · MVP {evaluation.honoredTeamMvps}
            </p>
            <p
              className={`text-[13px] font-bold pt-1 ${
                evaluation.jerseyRetired
                  ? 'text-[var(--t-gold)]'
                  : 'text-[var(--t-g500)]'
              }`}
            >
              {evaluation.jerseyRetired
                ? `영구결번 #${career.jerseyNumber} 헌액 확정`
                : '영구결번 기준 미달'}
            </p>
          </div>

          {evaluation.jerseyRetired && (
            <div
              className="w-16 h-20 rounded-2xl flex flex-col items-center justify-center font-bold shrink-0"
              style={{
                backgroundColor: evaluation.honoredTeam.primaryColor,
                color: '#ffffff',
              }}
            >
              <span className="text-[9px] opacity-80">RETIRED</span>
              <span className="text-[22px] leading-tight tabular-nums">
                #{career.jerseyNumber}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 하단 액션 */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={completeRetirementAndReturnHome}
          className="t-cta"
        >
          명예의 전당 헌액 후 홈으로
        </button>
        <button
          type="button"
          onClick={() => {
            completeRetirementAndReturnHome();
            resetActiveCareer();
          }}
          className="t-cta-sub"
        >
          새 유망주 바로 시작
        </button>
      </div>
    </div>
  );
}
