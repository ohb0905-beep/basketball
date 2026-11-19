'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getTraitInfo } from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import { HallOfFameEntry, Position } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';
import { Modal } from '../common/Modal';

const COURT_POSITIONS: {
  pos: Position;
  coordClass: string;
}[] = [
  { pos: 'PG', coordClass: 'top-[10%] left-1/2 -translate-x-1/2' },
  { pos: 'SG', coordClass: 'top-[34%] left-[21%] -translate-x-1/2' },
  { pos: 'SF', coordClass: 'top-[34%] left-[79%] -translate-x-1/2' },
  { pos: 'PF', coordClass: 'top-[64%] left-[27%] -translate-x-1/2' },
  { pos: 'C', coordClass: 'top-[64%] left-[73%] -translate-x-1/2' },
];

function stripLeadingSymbol(text: string): string {
  return text.replace(/^[^\p{L}\p{N}#]+/u, '').trim();
}

export function BestFiveCourt() {
  const hofList = useCareerStore((s) => s.hofList);
  const [selectedEntry, setSelectedEntry] = useState<HallOfFameEntry | null>(null);

  const bestFiveByPos: Record<Position, HallOfFameEntry | null> = {
    PG: null,
    SG: null,
    SF: null,
    PF: null,
    C: null,
  };

  const placedPlayerIds = new Set<string>();
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) {
    const primaryMatch = hofList
      .filter((entry) => entry.primaryPos === pos && !placedPlayerIds.has(entry.id))
      .sort((a, b) => b.legacyScore - a.legacyScore)[0];

    if (primaryMatch) {
      bestFiveByPos[pos] = primaryMatch;
      placedPlayerIds.add(primaryMatch.id);
    }
  }

  const filledCount = Object.values(bestFiveByPos).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* 1. 올타임 베스트 5 하프코트 */}
      <section className="t-card space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
            올타임 베스트 5
          </h2>
          <span className="text-[13px] font-semibold text-[var(--t-g500)] tabular-nums">
            {filledCount} / 5
          </span>
        </div>

        <div
          data-testid="best-five-halfcourt"
          className="relative w-full h-[340px] sm:h-[360px] rounded-[18px] bg-[var(--t-court-bg)] overflow-hidden select-none"
        >
          <svg
            viewBox="0 0 500 420"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <circle
              cx="250"
              cy="0"
              r="55"
              fill="none"
              stroke="var(--t-court-line)"
              strokeWidth="2"
            />
            <path
              d="M 45 420 L 45 290 A 210 205 0 0 1 455 290 L 455 420"
              fill="none"
              stroke="var(--t-court-line)"
              strokeWidth="2"
            />
            <rect
              x="170"
              y="230"
              width="160"
              height="190"
              fill="var(--t-court-paint)"
              stroke="var(--t-court-line)"
              strokeWidth="1.8"
            />
            <circle
              cx="250"
              cy="230"
              r="55"
              fill="none"
              stroke="var(--t-court-line)"
              strokeWidth="1.8"
              strokeDasharray="6 6"
            />
            <line
              x1="215"
              y1="392"
              x2="285"
              y2="392"
              stroke="var(--t-accent)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle
              cx="250"
              cy="376"
              r="11"
              fill="none"
              stroke="var(--t-accent)"
              strokeWidth="2.8"
            />
          </svg>

          {COURT_POSITIONS.map(({ pos, coordClass }) => {
            const player = bestFiveByPos[pos];
            return (
              <div
                key={pos}
                className={`absolute ${coordClass} w-[124px] sm:w-[138px]`}
              >
                {player ? (
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(player)}
                    className="w-full rounded-2xl bg-[var(--t-card)] px-2.5 py-2 shadow-sm text-left cursor-pointer t-tap ring-1 ring-[var(--t-accent)]/40"
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[11px] font-bold text-[var(--t-accent-ink)]">
                        {pos}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--t-g900)] tabular-nums">
                        {player.peakOvr}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TeamEmblem team={player.iconicTeam} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[var(--t-g900)] truncate">
                          {player.name}
                        </p>
                        <p className="text-[10px] text-[var(--t-g500)] truncate tabular-nums">
                          {player.careerAverages.ppg} PPG
                        </p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="w-full rounded-2xl bg-[var(--t-card)]/90 px-2.5 py-2.5 text-center border border-dashed border-[var(--t-g200)]">
                    <span className="block text-[12px] font-bold text-[var(--t-g700)]">
                      {pos}
                    </span>
                    <span className="block text-[10px] text-[var(--t-g400)] mt-0.5">
                      공석
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. 명예의 전당 리스트 */}
      <section className="t-card space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
            명예의 전당
          </h2>
          <span className="text-[13px] font-semibold text-[var(--t-g500)] tabular-nums">
            {hofList.length}명
          </span>
        </div>

        {hofList.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[14px] font-semibold text-[var(--t-g600)]">
              아직 헌액된 선수가 없어요
            </p>
            <p className="text-[12px] text-[var(--t-g400)] mt-1">
              은퇴한 선수의 기록이 이곳에 남습니다
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--t-g100)] -mx-2">
            {hofList.map((entry, idx) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedEntry(entry)}
                className="w-full min-h-[64px] px-2 py-2.5 rounded-2xl hover:bg-[var(--t-g50)] text-left flex items-center gap-3 cursor-pointer t-tap"
              >
                <span className="w-5 text-center text-[13px] font-bold text-[var(--t-g400)] tabular-nums shrink-0">
                  {idx + 1}
                </span>
                <TeamEmblem team={entry.iconicTeam} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[15px] font-bold text-[var(--t-g900)] truncate">
                      {entry.name}
                    </span>
                    <span className="text-[12px] font-medium text-[var(--t-g500)] shrink-0 tabular-nums">
                      {entry.primaryPos} · {entry.peakOvr}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--t-g500)] truncate tabular-nums">
                    {entry.totals.points.toLocaleString()}득점 · {entry.seasonsPlayed}시즌
                    {entry.jerseyRetired ? ' · 영구결번' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[14px] font-bold text-[var(--t-g900)] tabular-nums">
                    {entry.legacyScore.toLocaleString()}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--t-g400)]" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(selectedEntry)}
        title={
          selectedEntry
            ? `#${selectedEntry.jerseyNumber} ${selectedEntry.name}`
            : ''
        }
        subtitle={
          selectedEntry
            ? `${selectedEntry.primaryPos} · ${selectedEntry.legacyTitle}`
            : undefined
        }
        onClose={() => setSelectedEntry(null)}
      >
        {selectedEntry && (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5">
              <TeamEmblem team={selectedEntry.iconicTeam} size="lg" />
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-[var(--t-g900)] truncate">
                  {selectedEntry.iconicTeam.name}
                </p>
                <p className="text-[13px] font-semibold text-[var(--t-accent-ink)] mt-0.5">
                  {selectedEntry.jerseyRetired
                    ? `영구결번 #${selectedEntry.jerseyNumber}`
                    : `${selectedEntry.seasonsPlayed}시즌 · 만 ${selectedEntry.finalAge}세 은퇴`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 pt-4 border-t border-[var(--t-g100)] text-center tabular-nums">
              <div>
                <span className="block text-[20px] font-bold text-[var(--t-g900)]">
                  {selectedEntry.careerAverages.ppg}
                </span>
                <span className="text-[11px] font-medium text-[var(--t-g500)]">PPG</span>
              </div>
              <div>
                <span className="block text-[20px] font-bold text-[var(--t-g900)]">
                  {selectedEntry.careerAverages.rpg}
                </span>
                <span className="text-[11px] font-medium text-[var(--t-g500)]">RPG</span>
              </div>
              <div>
                <span className="block text-[20px] font-bold text-[var(--t-g900)]">
                  {selectedEntry.careerAverages.apg}
                </span>
                <span className="text-[11px] font-medium text-[var(--t-g500)]">APG</span>
              </div>
            </div>

            <div className="divide-y divide-[var(--t-g100)] border-y border-[var(--t-g100)] text-[14px]">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--t-g600)]">통산 득점</span>
                <span className="font-bold text-[var(--t-g900)] tabular-nums">
                  {selectedEntry.totals.points.toLocaleString()}점 ({selectedEntry.totals.gp}G)
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--t-g600)]">우승 / MVP / 올스타</span>
                <span className="font-bold text-[var(--t-gold)] tabular-nums">
                  {selectedEntry.totals.championships} / {selectedEntry.totals.mvps} /{' '}
                  {selectedEntry.totals.allStars}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--t-g600)]">통산 연봉</span>
                <span className="font-bold text-[var(--t-g900)] tabular-nums">
                  {(selectedEntry.careerEarnings || 0) >= 1000000
                    ? `$${((selectedEntry.careerEarnings || 0) / 1000000).toFixed(2)}M`
                    : `$${Math.round((selectedEntry.careerEarnings || 0) / 1000).toLocaleString()}K`}
                </span>
              </div>
              {selectedEntry.traits && selectedEntry.traits.length > 0 && (
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[var(--t-g600)] shrink-0">보유 특성</span>
                  <span className="font-semibold text-[var(--t-g800)] text-right truncate">
                    {selectedEntry.traits
                      .map((tId) => stripLeadingSymbol(getTraitInfo(tId).badge))
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[13px] text-[var(--t-g600)] leading-relaxed">
              {selectedEntry.epitaph}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
