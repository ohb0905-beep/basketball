'use client';

import React from 'react';
import { LEAGUE_CONFIG } from '../../../data/leagues';
import {
  useCareerStore,
} from '../../../store/useCareerStore';
import { TeamEmblem } from '../../common/TeamEmblem';
import { PlayoffBracketLadder } from '../PlayoffBracketLadder';
import { CareerState } from '../../../types/game';

export function PostseasonCard({
  career,
  isBracketClimbing,
  setIsBracketClimbing,
}: {
  career: CareerState;
  isBracketClimbing: boolean;
  setIsBracketClimbing: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const advancePlayoffBracketRound = useCareerStore((s) => s.advancePlayoffBracketRound);
  const skipPlayoffsToEnd = useCareerStore((s) => s.skipPlayoffsToEnd);
  const seasonPhase = career.seasonPhase ?? 'REGULAR_SEASON';
  const leagueInfo = LEAGUE_CONFIG[career.league];
  const standings = career.currentStandings || [];

  const bracket = career.playoffBracket;
  const championEntry = bracket?.championTeamId
    ? standings.find((s) => s.team.id === bracket.championTeamId)
    : null;

  const activeRoundSeries =
    bracket && bracket.rounds.length > 0
      ? bracket.rounds[bracket.currentRound - 1] ||
        bracket.rounds[bracket.rounds.length - 1]
      : [];
  const myCurrentSeries =
    activeRoundSeries.find((m) => m.involvesPlayer) ||
    bracket?.rounds
      .slice()
      .reverse()
      .flat()
      .find((m) => m.involvesPlayer) ||
    activeRoundSeries[0] ||
    null;

  return (
    <>
      {bracket &&
        bracket.rounds.length > 0 &&
        seasonPhase !== 'LIVE_FINAL_BROADCAST' && (
          <section
            data-testid="playoff-bracket-section"
            className="t-card space-y-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                  {leagueInfo.shortName} 포스트시즌
                </span>
                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--t-g900)] mt-0.5 truncate">
                  {isBracketClimbing && bracket.playerEliminated
                    ? `${bracket.playoffResultLabel} · 남은 라운드 진행 중`
                    : championEntry
                    ? `우승 ${championEntry.team.shortName} · ${bracket.playoffResultLabel}`
                    : bracket.playerReachedFinals
                    ? '파이널 결승 진출'
                    : myCurrentSeries?.roundLabel || `${bracket.currentRound}라운드`}
                </h2>
              </div>
              {!bracket.championTeamId && (
                <button
                  type="button"
                  onClick={skipPlayoffsToEnd}
                  className="text-[12px] font-semibold text-[var(--t-g500)] hover:text-[var(--t-g900)] shrink-0 cursor-pointer"
                >
                  전체 스킵
                </button>
              )}
            </div>

            {/* 내 소속팀 현재 시리즈 스코어보드 또는 우승팀 확정 요약 */}
            {bracket.championTeamId && championEntry && !isBracketClimbing ? (
              <div className="py-4 px-3.5 rounded-2xl bg-[var(--t-g100)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <TeamEmblem team={championEntry.team} size="md" />
                  <div className="min-w-0">
                    <span className="block text-[11px] font-bold text-[var(--t-gold)]">
                      {leagueInfo.shortName} 챔피언 확정
                    </span>
                    <span className="block text-[15px] font-bold text-[var(--t-g900)] truncate">
                      {championEntry.team.name}
                    </span>
                  </div>
                </div>
                <span className="text-[12px] font-bold text-[var(--t-g600)] shrink-0">
                  {bracket.playoffResultLabel}
                </span>
              </div>
            ) : myCurrentSeries ? (
              <div className="py-4 px-3 rounded-2xl bg-[var(--t-g100)] space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--t-g500)] px-1">
                  <span>
                    {myCurrentSeries.roundLabel} · {myCurrentSeries.bestOf}전{' '}
                    {myCurrentSeries.winsNeeded}선승
                  </span>
                  <span className="text-[var(--t-accent-ink)]">
                    {myCurrentSeries.winnerId ? '종료' : '진행 중'}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-center text-center gap-2">
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <TeamEmblem team={myCurrentSeries.higherSeed.team} size="md" />
                    <span className="text-[12px] font-bold text-[var(--t-g900)] truncate max-w-full">
                      {myCurrentSeries.higherSeed.team.shortName}
                    </span>
                  </div>

                  <div className="text-[28px] font-bold text-[var(--t-g900)] tabular-nums tracking-tight">
                    {myCurrentSeries.higherSeedWins} : {myCurrentSeries.lowerSeedWins}
                  </div>

                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <TeamEmblem team={myCurrentSeries.lowerSeed.team} size="md" />
                    <span className="text-[12px] font-bold text-[var(--t-g900)] truncate max-w-full">
                      {myCurrentSeries.lowerSeed.team.shortName}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <PlayoffBracketLadder
              bracket={bracket}
              standings={standings}
              playerTeamId={career.team.id}
              fastMode={Boolean(bracket.playerEliminated && bracket.championTeamId)}
              onClimbingChange={setIsBracketClimbing}
            />

            {!bracket.championTeamId && (
              <div className="flex items-center gap-2 pt-1">
                {!bracket.playerReachedFinals &&
                  !bracket.pendingConfFinalsGame7 && (
                    <button
                      type="button"
                      onClick={advancePlayoffBracketRound}
                      className="t-cta-sub flex-1"
                    >
                      1라운드씩 진행
                    </button>
                  )}
              </div>
            )}
          </section>
        )}
    </>
  );
}
