'use client';

import { X } from 'lucide-react';
import {
  useCareerStore,
} from '../../../store/useCareerStore';
import {
  InternationalTournamentRecord,
  CareerState,
} from '../../../types/game';

function getInternationalResultLabel(
  result: InternationalTournamentRecord['result']
): string {
  if (result === 'GOLD') return '금메달';
  if (result === 'SILVER') return '은메달';
  if (result === 'BRONZE') return '동메달';
  if (result === 'FOURTH') return '4위';
  if (result === 'QUARTERFINAL') return '8강 마감';
  return '조별리그 마감';
}

export function InternationalSummaryCard({
  career,
}: {
  career: CareerState;
}) {
  const dismissInternationalSummary = useCareerStore((s) => s.dismissInternationalSummary);
  const seasonPhase = career.seasonPhase ?? 'REGULAR_SEASON';

  return (
    <>
      {career.offseasonLocked &&
        career.lastInternationalSummary &&
        seasonPhase !== 'LIVE_FINAL_BROADCAST' && (
          <section
            data-testid="international-summary-card"
            className="t-card space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                  국가대표 국제대회 결산 · {career.lastInternationalSummary.year}
                </span>
                <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)] mt-0.5 truncate">
                  {career.lastInternationalSummary.tournamentName} ·{' '}
                  {getInternationalResultLabel(career.lastInternationalSummary.result)}
                </h2>
              </div>
              <button
                type="button"
                onClick={dismissInternationalSummary}
                className="min-h-[40px] min-w-[40px] -mr-2 -mt-1 flex items-center justify-center rounded-xl text-[var(--t-g400)] hover:text-[var(--t-g800)] cursor-pointer t-tap shrink-0"
                aria-label="국제대회 요약 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13px] text-[var(--t-g700)] leading-relaxed">
              {career.lastInternationalSummary.summaryHeadline}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold tabular-nums">
              <span className="text-[var(--t-g900)]">
                대회 평균 {career.lastInternationalSummary.avgPts.toFixed(1)}점 ·{' '}
                {career.lastInternationalSummary.avgReb.toFixed(1)}리바 ·{' '}
                {career.lastInternationalSummary.avgAst.toFixed(1)}도움
              </span>
              {career.lastInternationalSummary.wonMvp && (
                <span className="text-[var(--t-gold)]">· 대회 MVP</span>
              )}
              {career.lastInternationalSummary.grantedMilitaryExemption && (
                <span className="text-[var(--t-ok)]">· 병역 특례 확정</span>
              )}
              {!career.lastInternationalSummary.grantedMilitaryExemption &&
                !career.militaryExempt &&
                career.militaryServiceSeasonsLeft === 0 &&
                (career.lastInternationalSummary.tournamentType === 'ASIA_CUP' ||
                  career.lastInternationalSummary.tournamentType ===
                    'FIBA_WORLD_CUP') && (
                  <span className="text-[var(--t-g500)] font-medium">
                    · 병역특례 비대상 대회
                  </span>
                )}
            </div>

            {career.lastInternationalSummary.matches.length > 0 && (
              <div className="divide-y divide-[var(--t-g100)] border-t border-[var(--t-g100)] text-[12px] tabular-nums">
                {career.lastInternationalSummary.matches.map((m, idx) => (
                  <div
                    key={`${m.stageLabel}-${idx}`}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-[var(--t-g600)] truncate">
                      {m.stageLabel} · vs {m.opponentName}
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        m.won ? 'text-[var(--t-ok)]' : 'text-[var(--t-up)]'
                      }`}
                    >
                      {m.korScore}:{m.oppScore} ({m.won ? '승' : '패'}) · {m.playerPts}점
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
    </>
  );
}
