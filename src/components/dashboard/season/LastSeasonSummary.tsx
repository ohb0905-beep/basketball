'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  LEAGUE_BALANCE_META,
} from '../../../config/balanceConfig';
import { LEAGUE_CONFIG } from '../../../data/leagues';
import {
  AwardRaceEntry,
  CareerState,
} from '../../../types/game';

export function LastSeasonSummary({
  career,
  setShowDetailSheet,
}: {
  career: CareerState;
  setShowDetailSheet: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [awardRaceTab, setAwardRaceTab] = useState<'MVP' | 'ROY'>('MVP');

  const leagueInfo = LEAGUE_CONFIG[career.league];
  const lastSeason =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;
  const lastSeasonLeagueMeta = lastSeason
    ? LEAGUE_BALANCE_META[lastSeason.league]
    : LEAGUE_BALANCE_META[career.league];

  const activeAwardRace: AwardRaceEntry[] | undefined =
    awardRaceTab === 'ROY' && lastSeason?.royRace
      ? lastSeason.royRace
      : lastSeason?.mvpRace;
  const activeAwardNarrative: string | undefined =
    awardRaceTab === 'ROY' && lastSeason?.royRaceNarrative
      ? lastSeason.royRaceNarrative
      : lastSeason?.mvpRaceNarrative;
  const activePlayerAwardRank: number | null | undefined =
    awardRaceTab === 'ROY' && lastSeason?.royRace
      ? lastSeason.playerRoyRank
      : lastSeason?.playerMvpRank;

  return (
    <>
      {lastSeason ? (
        <>
          <section className="t-card space-y-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                {lastSeason.year}시즌 기록
              </h2>
              <span className="text-[13px] font-semibold text-[var(--t-g500)] tabular-nums">
                정규 {lastSeason.teamRank}위 ({lastSeason.wins}승 {lastSeason.losses}패)
              </span>
            </div>

            {/* 오픈 4열 핵심 스탯 스트립 */}
            <div className="grid grid-cols-4 pt-3 border-t border-[var(--t-g100)] text-center gap-1 tabular-nums">
              <div>
                <span className="block text-[22px] font-bold text-[var(--t-accent)]">
                  {lastSeason.ppg.toFixed(1)}
                </span>
                <span className="text-[11px] font-medium text-[var(--t-g500)]">
                  PPG
                </span>
              </div>
              <div>
                <span className="block text-[22px] font-bold text-[var(--t-g900)]">
                  {lastSeason.rpg.toFixed(1)}
                </span>
                <span className="text-[11px] font-medium text-[var(--t-g500)]">
                  RPG
                </span>
              </div>
              <div>
                <span className="block text-[22px] font-bold text-[var(--t-g900)]">
                  {lastSeason.apg.toFixed(1)}
                </span>
                <span className="text-[11px] font-medium text-[var(--t-g500)]">
                  APG
                </span>
              </div>
              <div>
                <span className="block text-[22px] font-bold text-[var(--t-g900)]">
                  {lastSeason.fgPct.toFixed(1)}%
                </span>
                <span className="text-[11px] font-medium text-[var(--t-g500)]">
                  FG%
                </span>
              </div>
            </div>

            {/* 상세 기록 & 리그 순위표 바텀시트 트리거 */}
            <button
              type="button"
              onClick={() => setShowDetailSheet(true)}
              className="w-full min-h-[48px] pt-3 border-t border-[var(--t-g100)] flex items-center justify-between text-[14px] font-semibold text-[var(--t-g700)] hover:text-[var(--t-g900)] cursor-pointer t-tap"
            >
              <span>상세 기록 · 리그 순위표</span>
              <ChevronRight className="w-4 h-4 text-[var(--t-g400)]" />
            </button>
          </section>

          {/* MVP / ROY 투표 레이스 */}
          {activeAwardRace && activeAwardRace.length > 0 && (
            <section
              data-testid="award-race-board"
              className="t-card space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[16px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                  {awardRaceTab === 'ROY' && lastSeason.royRace
                    ? lastSeasonLeagueMeta.royBoardTitle
                    : lastSeasonLeagueMeta.mvpBoardTitle}
                </h2>

                {lastSeason.royRace ? (
                  <div className="inline-flex rounded-xl bg-[var(--t-g100)] p-0.5 text-[12px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setAwardRaceTab('MVP')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        awardRaceTab === 'MVP'
                          ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                          : 'text-[var(--t-g500)]'
                      }`}
                    >
                      MVP
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwardRaceTab('ROY')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        awardRaceTab === 'ROY'
                          ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                          : 'text-[var(--t-g500)]'
                      }`}
                    >
                      신인왕
                    </button>
                  </div>
                ) : !activeAwardRace.some((e) => e.isPlayer) ? (
                  <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
                    내 순위 {activePlayerAwardRank ? `${activePlayerAwardRank}위` : '권외'}
                  </span>
                ) : null}
              </div>

              {activeAwardNarrative && (
                <p
                  data-testid="award-race-narrative"
                  className="text-[13px] font-medium text-[var(--t-g700)] bg-[var(--t-g100)] rounded-2xl px-3.5 py-2.5 leading-relaxed"
                >
                  {activeAwardNarrative}
                </p>
              )}

              <div className="divide-y divide-[var(--t-g100)] -mx-2">
                {activeAwardRace.map((entry) => (
                  <div
                    key={`${entry.rank}-${entry.name}`}
                    className={`px-2.5 py-2.5 rounded-xl flex items-center justify-between gap-2 ${
                      entry.isPlayer ? 'bg-[var(--t-accent-soft)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-5 text-center text-[13px] font-bold tabular-nums shrink-0 ${
                          entry.rank === 1
                            ? 'text-[var(--t-gold)]'
                            : 'text-[var(--t-g400)]'
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-bold text-[var(--t-g900)] truncate">
                            {entry.name}
                          </span>
                          <span className="text-[11px] text-[var(--t-g500)] shrink-0">
                            {entry.teamShortName} · {entry.pos}
                          </span>
                        </div>
                        <span className="block text-[12px] text-[var(--t-g500)] tabular-nums">
                          {entry.ppg.toFixed(1)}점 {entry.rpg.toFixed(1)}리바{' '}
                          {entry.apg.toFixed(1)}도움 · {entry.wins}승 {entry.losses}패
                        </span>
                      </div>
                    </div>

                    <span className="text-[13px] font-bold text-[var(--t-g900)] tabular-nums shrink-0">
                      {entry.firstPlaceVoteShare}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="t-card py-10 text-center space-y-1.5">
          <p className="text-[16px] font-bold text-[var(--t-g900)]">
            {career.seasonYear}시즌 개막 대기
          </p>
          <p className="text-[13px] text-[var(--t-g500)]">
            {leagueInfo.name} · 정규 {leagueInfo.games}경기
          </p>
        </section>
      )}
    </>
  );
}
