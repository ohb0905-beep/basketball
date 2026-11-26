'use client';

import { motion } from 'motion/react';
import {
  PlayoffBracketState,
  PlayoffSeriesMatchup,
  StandingEntry,
} from '../../../types/game';
import { TeamEmblem } from '../../common/TeamEmblem';

export type WingFocus = 'ALL' | 'LEFT' | 'CENTER' | 'RIGHT';

export interface ConnectorEdge {
  id: string;
  d: string;
  lit: boolean;
  isPlayerPath: boolean;
  roundNumber: number;
}

function getSeriesWinnerTeamId(match?: PlayoffSeriesMatchup | null): string | null {
  return match?.winnerId || null;
}

export function SeriesSlotCard({
  match,
  placeholderTitle,
  byeSeed,
  playerTeamId,
  isRevealed,
  isHighlightedNew,
  compact,
}: {
  match?: PlayoffSeriesMatchup | null;
  placeholderTitle: string;
  byeSeed?: StandingEntry | null;
  playerTeamId: string;
  isRevealed: boolean;
  isHighlightedNew: boolean;
  compact?: boolean;
}) {
  if (!match || !isRevealed) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[var(--t-g200)] bg-[var(--t-card)]/60 ${
          compact ? 'px-2 py-2' : 'px-2.5 py-2.5'
        } text-center min-h-[60px] flex flex-col items-center justify-center gap-0.5`}
      >
        <span className="text-[10px] font-semibold text-[var(--t-g400)]">
          {placeholderTitle}
        </span>
        {byeSeed ? (
          <span className="text-[10px] font-bold text-[var(--t-g600)] truncate max-w-full">
            #{byeSeed.conferenceRank || byeSeed.rank} {byeSeed.team.shortName} 대기
          </span>
        ) : (
          <span className="text-[10px] text-[var(--t-g400)]">대기</span>
        )}
      </div>
    );
  }

  const hiWon = match.winnerId === match.higherSeed.team.id;
  const loWon = match.winnerId === match.lowerSeed.team.id;
  const hiIsPlayer = match.higherSeed.team.id === playerTeamId;
  const loIsPlayer = match.lowerSeed.team.id === playerTeamId;
  const isFinished = Boolean(match.winnerId);

  return (
    <motion.div
      initial={isHighlightedNew ? { opacity: 0.35, scale: 0.96 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className={`rounded-xl transition-colors ${
        match.involvesPlayer
          ? 'bg-[var(--t-accent-soft)] ring-1 ring-[var(--t-accent)]/50'
          : 'bg-[var(--t-card)]'
      } ${compact ? 'p-2' : 'p-2.5'} space-y-1`}
    >
      <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
        <span
          className={
            match.involvesPlayer
              ? 'text-[var(--t-accent-ink)]'
              : 'text-[var(--t-g400)]'
          }
        >
          {match.involvesPlayer
            ? '내 팀'
            : match.bestOf === 1
            ? '단판'
            : `${match.bestOf}전`}
        </span>
        <span className="text-[var(--t-g400)]">
          {isFinished
            ? '확정'
            : match.bestOf === 7 &&
              match.higherSeedWins === 3 &&
              match.lowerSeedWins === 3
            ? '7차전'
            : '진행'}
        </span>
      </div>

      {/* 상위 시드 */}
      <div
        className={`flex items-center justify-between gap-1.5 rounded-lg px-1.5 py-1 ${
          hiWon
            ? hiIsPlayer
              ? 'bg-[var(--t-accent)]/15 text-[var(--t-g900)]'
              : 'bg-[var(--t-g100)] text-[var(--t-g900)]'
            : isFinished
            ? 'opacity-40 text-[var(--t-g500)]'
            : 'text-[var(--t-g800)]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamEmblem team={match.higherSeed.team} size="xs" />
          <span className="text-[10px] font-semibold text-[var(--t-g400)] tabular-nums shrink-0">
            {match.higherSeed.conferenceRank || match.higherSeed.rank}
          </span>
          <span
            className={`text-[11px] truncate ${
              hiIsPlayer || hiWon ? 'font-bold' : 'font-medium'
            }`}
          >
            {match.higherSeed.team.shortName}
          </span>
        </div>
        <span
          className={`text-[12px] font-bold tabular-nums shrink-0 ${
            hiWon && hiIsPlayer
              ? 'text-[var(--t-accent)]'
              : hiWon
              ? 'text-[var(--t-g900)]'
              : 'text-[var(--t-g600)]'
          }`}
        >
          {match.higherSeedWins}
        </span>
      </div>

      {/* 하위 시드 */}
      <div
        className={`flex items-center justify-between gap-1.5 rounded-lg px-1.5 py-1 ${
          loWon
            ? loIsPlayer
              ? 'bg-[var(--t-accent)]/15 text-[var(--t-g900)]'
              : 'bg-[var(--t-g100)] text-[var(--t-g900)]'
            : isFinished
            ? 'opacity-40 text-[var(--t-g500)]'
            : 'text-[var(--t-g800)]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamEmblem team={match.lowerSeed.team} size="xs" />
          <span className="text-[10px] font-semibold text-[var(--t-g400)] tabular-nums shrink-0">
            {match.lowerSeed.conferenceRank || match.lowerSeed.rank}
          </span>
          <span
            className={`text-[11px] truncate ${
              loIsPlayer || loWon ? 'font-bold' : 'font-medium'
            }`}
          >
            {match.lowerSeed.team.shortName}
          </span>
        </div>
        <span
          className={`text-[12px] font-bold tabular-nums shrink-0 ${
            loWon && loIsPlayer
              ? 'text-[var(--t-accent)]'
              : loWon
              ? 'text-[var(--t-g900)]'
              : 'text-[var(--t-g600)]'
          }`}
        >
          {match.lowerSeedWins}
        </span>
      </div>
    </motion.div>
  );
}

export function BracketConnectorSvg({
  edges,
  shouldReduceMotion,
}: {
  edges: ConnectorEdge[];
  shouldReduceMotion: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 400"
      preserveAspectRatio="none"
      className="w-6 sm:w-7 h-full shrink-0 overflow-visible"
      aria-hidden="true"
    >
      {edges.map((edge) => (
        <g key={edge.id}>
          <path
            d={edge.d}
            fill="none"
            stroke="var(--t-g200)"
            strokeWidth={1.8}
            vectorEffect="non-scaling-stroke"
          />
          {edge.lit && (
            <motion.path
              d={edge.d}
              fill="none"
              stroke={edge.isPlayerPath ? 'var(--t-accent)' : 'var(--t-g500)'}
              strokeWidth={edge.isPlayerPath ? 2.6 : 2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.5 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.42, ease: 'easeOut' }}
            />
          )}
        </g>
      ))}
    </svg>
  );
}

/** 라운드 사이 연결선 좌표 계산 (displayStep 이상으로 공개된 라운드만 불이 들어옵니다) */
export function createEdgeBuilders(displayStep: number, playerTeamId: string) {
  const build4to2Edges = (
    seriesList: PlayoffSeriesMatchup[],
    direction: 'L2R' | 'R2L',
    roundNum: number
  ): ConnectorEdge[] => {
    const startX = direction === 'L2R' ? 0 : 40;
    const endX = direction === 'L2R' ? 40 : 0;
    const yInputs = [50, 150, 250, 350];
    const yTargets = [100, 100, 300, 300];
    return yInputs.map((yIn, idx) => {
      const m = seriesList[idx];
      const winnerId = getSeriesWinnerTeamId(m);
      const lit = Boolean(winnerId) && displayStep >= roundNum + 1;
      const isPlayerPath = winnerId === playerTeamId;
      return {
        id: `${direction}_4to2_${idx}`,
        d: `M ${startX} ${yIn} H 20 V ${yTargets[idx]} H ${endX}`,
        lit,
        isPlayerPath,
        roundNumber: roundNum,
      };
    });
  };

  const build2to1Edges = (
    seriesList: (PlayoffSeriesMatchup | null | undefined)[],
    direction: 'L2R' | 'R2L',
    roundNum: number
  ): ConnectorEdge[] => {
    const startX = direction === 'L2R' ? 0 : 40;
    const endX = direction === 'L2R' ? 40 : 0;
    const yInputs = [100, 300];
    return yInputs.map((yIn, idx) => {
      const m = seriesList[idx];
      const winnerId = getSeriesWinnerTeamId(m);
      const lit = Boolean(winnerId) && displayStep >= roundNum + 1;
      const isPlayerPath = winnerId === playerTeamId;
      return {
        id: `${direction}_2to1_${idx}`,
        d: `M ${startX} ${yIn} H 20 V 200 H ${endX}`,
        lit,
        isPlayerPath,
        roundNumber: roundNum,
      };
    });
  };

  const build1to1Edge = (
    series: PlayoffSeriesMatchup | null | undefined,
    direction: 'L2R' | 'R2L',
    roundNum: number
  ): ConnectorEdge[] => {
    const startX = direction === 'L2R' ? 0 : 40;
    const endX = direction === 'L2R' ? 40 : 0;
    const winnerId = getSeriesWinnerTeamId(series);
    const lit = Boolean(winnerId) && displayStep >= roundNum + 1;
    const isPlayerPath = winnerId === playerTeamId;
    return [
      {
        id: `${direction}_1to1_${roundNum}`,
        d: `M ${startX} 200 H ${endX}`,
        lit,
        isPlayerPath,
        roundNumber: roundNum,
      },
    ];
  };

  const build2to2Edges = (
    seriesList: (PlayoffSeriesMatchup | null | undefined)[],
    direction: 'L2R' | 'R2L',
    roundNum: number
  ): ConnectorEdge[] => {
    const startX = direction === 'L2R' ? 0 : 40;
    const endX = direction === 'L2R' ? 40 : 0;
    const yInputs = [100, 300];
    return yInputs.map((yIn, idx) => {
      const m = seriesList[idx];
      const winnerId = getSeriesWinnerTeamId(m);
      const lit = Boolean(winnerId) && displayStep >= roundNum + 1;
      const isPlayerPath = winnerId === playerTeamId;
      return {
        id: `${direction}_2to2_${idx}`,
        d: `M ${startX} ${yIn} H ${endX}`,
        lit,
        isPlayerPath,
        roundNumber: roundNum,
      };
    });
  };

  return { build4to2Edges, build2to1Edges, build1to1Edge, build2to2Edges };
}

/** 대진 모양별 레이아웃이 함께 쓰는 값 */
export interface BracketLayoutProps {
  bracket: PlayoffBracketState;
  playerTeamId: string;
  prefersReducedMotion: boolean;
  wingFocus: WingFocus;
  displayStep: number;
  isClimbing: boolean;
  finalsSeries: PlayoffSeriesMatchup | null;
  championEntry: StandingEntry | null;
  showChampion: boolean;
  showLeft: boolean;
  showCenter: boolean;
  showRight: boolean;
  finalsLabel: string;
}
