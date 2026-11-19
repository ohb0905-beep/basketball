'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Crown, Trophy } from 'lucide-react';
import {
  PlayoffBracketState,
  PlayoffSeriesMatchup,
  StandingEntry,
} from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

interface PlayoffBracketLadderProps {
  bracket: PlayoffBracketState;
  standings: StandingEntry[];
  playerTeamId: string;
  fastMode?: boolean;
  onClimbingChange?: (climbing: boolean) => void;
}

type WingFocus = 'ALL' | 'LEFT' | 'CENTER' | 'RIGHT';

interface ConnectorEdge {
  id: string;
  d: string;
  lit: boolean;
  isPlayerPath: boolean;
  roundNumber: number;
}

function getSeriesWinnerTeamId(match?: PlayoffSeriesMatchup | null): string | null {
  return match?.winnerId || null;
}

function SeriesSlotCard({
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
          {match.involvesPlayer ? '내 팀' : `${match.bestOf}전`}
        </span>
        <span className="text-[var(--t-g400)]">
          {isFinished
            ? '확정'
            : match.higherSeedWins === 3 && match.lowerSeedWins === 3
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

function BracketConnectorSvg({
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

export function PlayoffBracketLadder({
  bracket,
  standings,
  playerTeamId,
  fastMode = false,
  onClimbingChange,
}: PlayoffBracketLadderProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [wingFocus, setWingFocus] = useState<WingFocus>('ALL');

  const completedRoundsCount = useMemo(() => {
    let count = 0;
    for (const r of bracket.rounds) {
      if (r.length > 0 && r.every((m) => Boolean(m.winnerId))) {
        count++;
      }
    }
    return count;
  }, [bracket.rounds]);

  const bracketKey = `${bracket.year}_${bracket.league}`;
  const prevStateRef = useRef<{
    key: string;
    roundsLen: number;
    completedRounds: number;
    hasChamp: boolean;
  }>({
    key: bracketKey,
    roundsLen: bracket.rounds.length,
    completedRounds: completedRoundsCount,
    hasChamp: Boolean(bracket.championTeamId),
  });

  const targetStep = bracket.championTeamId
    ? bracket.totalRounds + 1
    : bracket.rounds.length;

  const [displayStep, setDisplayStep] = useState<number>(targetStep);
  const [isClimbing, setIsClimbing] = useState<boolean>(false);

  useEffect(() => {
    const prev = prevStateRef.current;
    const isNewBracket = prev.key !== bracketKey;

    if (isNewBracket || prefersReducedMotion) {
      prevStateRef.current = {
        key: bracketKey,
        roundsLen: bracket.rounds.length,
        completedRounds: completedRoundsCount,
        hasChamp: Boolean(bracket.championTeamId),
      };
      setDisplayStep(targetStep);
      setIsClimbing(false);
      return;
    }

    const progressed =
      bracket.rounds.length > prev.roundsLen ||
      completedRoundsCount > prev.completedRounds ||
      (Boolean(bracket.championTeamId) && !prev.hasChamp);

    if (!progressed) {
      setDisplayStep(targetStep);
      setIsClimbing(false);
      return;
    }

    const startStep = Math.max(1, prev.roundsLen);
    prevStateRef.current = {
      key: bracketKey,
      roundsLen: bracket.rounds.length,
      completedRounds: completedRoundsCount,
      hasChamp: Boolean(bracket.championTeamId),
    };

    const stepDelayMs = fastMode ? 240 : 440;

    if (startStep >= targetStep) {
      setIsClimbing(true);
      const t = setTimeout(() => {
        setDisplayStep(targetStep);
        setIsClimbing(false);
      }, fastMode ? 220 : 380);
      return () => clearTimeout(t);
    }

    setDisplayStep(startStep);
    setIsClimbing(true);

    let current = startStep;
    const timers: ReturnType<typeof setTimeout>[] = [];
    while (current < targetStep) {
      current += 1;
      const stepValue = current;
      const delay = (stepValue - startStep) * stepDelayMs;
      timers.push(
        setTimeout(() => {
          setDisplayStep(stepValue);
          if (stepValue >= targetStep) {
            setIsClimbing(false);
          }
        }, delay)
      );
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [
    bracketKey,
    bracket.rounds.length,
    bracket.championTeamId,
    completedRoundsCount,
    fastMode,
    prefersReducedMotion,
    targetStep,
  ]);

  useEffect(() => {
    onClimbingChange?.(isClimbing);
  }, [isClimbing, onClimbingChange]);

  const handleSkipAnimation = () => {
    setDisplayStep(targetStep);
    setIsClimbing(false);
  };

  const isNba = bracket.league === 'NBA';
  const isSixTeam = !isNba && bracket.totalRounds === 3;

  const finalsSeries = bracket.rounds[bracket.totalRounds - 1]?.[0] || null;
  const championEntry = bracket.championTeamId
    ? standings.find((s) => s.team.id === bracket.championTeamId) || null
    : null;
  const showChampion =
    Boolean(championEntry) && displayStep >= bracket.totalRounds + 1;

  const nbaEastR1 = isNba
    ? (bracket.rounds[0] || []).filter((m) => m.conference === 'EAST')
    : [];
  const nbaWestR1 = isNba
    ? (bracket.rounds[0] || []).filter((m) => m.conference !== 'EAST')
    : [];
  const nbaEastR2 = isNba
    ? (bracket.rounds[1] || []).filter((m) => m.conference === 'EAST')
    : [];
  const nbaWestR2 = isNba
    ? (bracket.rounds[1] || []).filter((m) => m.conference !== 'EAST')
    : [];
  const nbaEastCF = isNba
    ? (bracket.rounds[2] || []).filter((m) => m.conference === 'EAST')[0] || null
    : null;
  const nbaWestCF = isNba
    ? (bracket.rounds[2] || []).filter((m) => m.conference !== 'EAST')[0] || null
    : null;

  const sixLeftR1 = isSixTeam ? bracket.rounds[0]?.[0] || null : null;
  const sixRightR1 = isSixTeam ? bracket.rounds[0]?.[1] || null : null;
  const sixLeftR2 = isSixTeam ? bracket.rounds[1]?.[0] || null : null;
  const sixRightR2 = isSixTeam ? bracket.rounds[1]?.[1] || null : null;

  const fourLeftSF = !isNba && !isSixTeam ? bracket.rounds[0]?.[0] || null : null;
  const fourRightSF = !isNba && !isSixTeam ? bracket.rounds[0]?.[1] || null : null;

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

  const showLeft = wingFocus === 'ALL' || wingFocus === 'LEFT';
  const showCenter = wingFocus === 'ALL' || wingFocus === 'CENTER';
  const showRight = wingFocus === 'ALL' || wingFocus === 'RIGHT';

  const finalsLabel = isNba
    ? 'NBA 파이널'
    : isSixTeam
    ? '챔피언 결정전'
    : '결승전';

  return (
    <div
      data-testid="playoff-bracket-ladder"
      className="rounded-2xl bg-[var(--t-g100)] p-3 sm:p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-bold text-[var(--t-g800)]">
            토너먼트 대진표
          </span>
          {isClimbing && fastMode && (
            <span className="text-[11px] font-semibold text-[var(--t-accent-ink)] truncate">
              남은 라운드 자동 진행 중
            </span>
          )}
        </div>
        {isClimbing && (
          <button
            type="button"
            onClick={handleSkipAnimation}
            className="text-[12px] font-bold text-[var(--t-accent-ink)] shrink-0 cursor-pointer"
          >
            바로 보기
          </button>
        )}
      </div>

      {/* 윙 포커스 전환 */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--t-g200)]/60 text-[12px] font-semibold">
        {(
          [
            { id: 'ALL', label: '전체' },
            { id: 'LEFT', label: isNba ? '동부' : '좌측' },
            { id: 'CENTER', label: '파이널' },
            { id: 'RIGHT', label: isNba ? '서부' : '우측' },
          ] as { id: WingFocus; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setWingFocus(tab.id)}
            className={`min-h-[34px] rounded-lg transition cursor-pointer ${
              wingFocus === tab.id
                ? 'bg-[var(--t-card)] text-[var(--t-g900)] font-bold'
                : 'text-[var(--t-g600)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 좌→중앙←우 대진표 캔버스 */}
      <div className="overflow-x-auto pb-1">
        {isNba ? (
          <div
            className={`flex items-stretch ${
              wingFocus === 'ALL' ? 'min-w-[840px]' : 'min-w-full justify-center'
            } min-h-[360px]`}
          >
            {showLeft && (
              <div className="flex items-stretch flex-1">
                <div className="flex-1 min-w-[112px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    동부 1R
                  </div>
                  <div className="flex-1 grid grid-rows-4 gap-2 items-center">
                    {[0, 1, 2, 3].map((i) => (
                      <SeriesSlotCard
                        key={`east-r1-${i}`}
                        match={nbaEastR1[i]}
                        placeholderTitle="동부 1R"
                        playerTeamId={playerTeamId}
                        isRevealed={displayStep >= 1}
                        isHighlightedNew={isClimbing && displayStep === 1}
                        compact
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex items-stretch">
                  <BracketConnectorSvg
                    edges={build4to2Edges(nbaEastR1, 'L2R', 1)}
                    shouldReduceMotion={prefersReducedMotion}
                  />
                </div>

                <div className="flex-1 min-w-[112px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    동부 4강
                  </div>
                  <div className="flex-1 grid grid-rows-2 gap-2 items-center">
                    {[0, 1].map((i) => (
                      <SeriesSlotCard
                        key={`east-r2-${i}`}
                        match={nbaEastR2[i]}
                        placeholderTitle="동부 4강"
                        playerTeamId={playerTeamId}
                        isRevealed={displayStep >= 2}
                        isHighlightedNew={isClimbing && displayStep === 2}
                        compact
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex items-stretch">
                  <BracketConnectorSvg
                    edges={build2to1Edges(nbaEastR2, 'L2R', 2)}
                    shouldReduceMotion={prefersReducedMotion}
                  />
                </div>

                <div className="flex-1 min-w-[112px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    동부 결승
                  </div>
                  <div className="flex-1 grid grid-rows-1 items-center">
                    <SeriesSlotCard
                      match={nbaEastCF}
                      placeholderTitle="동부 결승"
                      playerTeamId={playerTeamId}
                      isRevealed={displayStep >= 3}
                      isHighlightedNew={isClimbing && displayStep === 3}
                      compact
                    />
                  </div>
                </div>
              </div>
            )}

            {showLeft && showCenter && (
              <div className="pt-6 flex items-stretch">
                <BracketConnectorSvg
                  edges={build1to1Edge(nbaEastCF, 'L2R', 3)}
                  shouldReduceMotion={prefersReducedMotion}
                />
              </div>
            )}

            {showCenter && (
              <div className="w-[146px] shrink-0 flex flex-col justify-center items-center px-1">
                <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center justify-center gap-1">
                  <Trophy className="w-3 h-3" />
                  <span>{finalsLabel}</span>
                </div>
                <div className="w-full space-y-2">
                  <div
                    className={`rounded-2xl p-2.5 text-center ${
                      showChampion
                        ? 'bg-[var(--t-gold-soft)]'
                        : 'bg-[var(--t-card)]'
                    }`}
                  >
                    <div className="flex justify-center">
                      {showChampion && championEntry ? (
                        <motion.div
                          initial={prefersReducedMotion ? false : { scale: 0.75, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                          className="flex flex-col items-center gap-1"
                        >
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                            <Crown className="w-3 h-3" /> CHAMPION
                          </span>
                          <TeamEmblem team={championEntry.team} size="sm" />
                          <span className="text-[12px] font-bold text-[var(--t-g900)]">
                            {championEntry.team.shortName}
                          </span>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-1">
                          <Trophy className="w-5 h-5 text-[var(--t-gold)]" />
                          <span className="text-[10px] font-bold text-[var(--t-g500)]">
                            {bracket.playerReachedFinals ? '결승 진출' : '결승전'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <SeriesSlotCard
                    match={finalsSeries}
                    placeholderTitle={finalsLabel}
                    playerTeamId={playerTeamId}
                    isRevealed={displayStep >= 4}
                    isHighlightedNew={isClimbing && displayStep === 4}
                    compact
                  />
                </div>
              </div>
            )}

            {showRight && showCenter && (
              <div className="pt-6 flex items-stretch">
                <BracketConnectorSvg
                  edges={build1to1Edge(nbaWestCF, 'R2L', 3)}
                  shouldReduceMotion={prefersReducedMotion}
                />
              </div>
            )}

            {showRight && (
              <div className="flex items-stretch flex-1">
                <div className="flex-1 min-w-[112px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    서부 결승
                  </div>
                  <div className="flex-1 grid grid-rows-1 items-center">
                    <SeriesSlotCard
                      match={nbaWestCF}
                      placeholderTitle="서부 결승"
                      playerTeamId={playerTeamId}
                      isRevealed={displayStep >= 3}
                      isHighlightedNew={isClimbing && displayStep === 3}
                      compact
                    />
                  </div>
                </div>

                <div className="pt-6 flex items-stretch">
                  <BracketConnectorSvg
                    edges={build2to1Edges(nbaWestR2, 'R2L', 2)}
                    shouldReduceMotion={prefersReducedMotion}
                  />
                </div>

                <div className="flex-1 min-w-[112px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    서부 4강
                  </div>
                  <div className="flex-1 grid grid-rows-2 gap-2 items-center">
                    {[0, 1].map((i) => (
                      <SeriesSlotCard
                        key={`west-r2-${i}`}
                        match={nbaWestR2[i]}
                        placeholderTitle="서부 4강"
                        playerTeamId={playerTeamId}
                        isRevealed={displayStep >= 2}
                        isHighlightedNew={isClimbing && displayStep === 2}
                        compact
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex items-stretch">
                  <BracketConnectorSvg
                    edges={build4to2Edges(nbaWestR1, 'R2L', 1)}
                    shouldReduceMotion={prefersReducedMotion}
                  />
                </div>

                <div className="flex-1 min-w-[112px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    서부 1R
                  </div>
                  <div className="flex-1 grid grid-rows-4 gap-2 items-center">
                    {[0, 1, 2, 3].map((i) => (
                      <SeriesSlotCard
                        key={`west-r1-${i}`}
                        match={nbaWestR1[i]}
                        placeholderTitle="서부 1R"
                        playerTeamId={playerTeamId}
                        isRevealed={displayStep >= 1}
                        isHighlightedNew={isClimbing && displayStep === 1}
                        compact
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : isSixTeam ? (
          <div
            className={`flex items-stretch ${
              wingFocus === 'ALL' ? 'min-w-[620px]' : 'min-w-full justify-center'
            } min-h-[195px]`}
          >
            {showLeft && (
              <div className="flex items-stretch flex-1">
                <div className="flex-1 min-w-[116px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    6강 A
                  </div>
                  <div className="flex-1 grid grid-rows-1 items-center">
                    <SeriesSlotCard
                      match={sixLeftR1}
                      placeholderTitle="6강 PO"
                      playerTeamId={playerTeamId}
                      isRevealed={displayStep >= 1}
                      isHighlightedNew={isClimbing && displayStep === 1}
                    />
                  </div>
                </div>

                <div className="pt-6 flex items-stretch">
                  <BracketConnectorSvg
                    edges={build1to1Edge(sixLeftR1, 'L2R', 1)}
                    shouldReduceMotion={prefersReducedMotion}
                  />
                </div>

                <div className="flex-1 min-w-[116px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    4강 (1시드)
                  </div>
                  <div className="flex-1 grid grid-rows-1 items-center">
                    <SeriesSlotCard
                      match={sixLeftR2}
                      placeholderTitle="4강 A"
                      byeSeed={standings[0] || null}
                      playerTeamId={playerTeamId}
                      isRevealed={displayStep >= 2}
                      isHighlightedNew={isClimbing && displayStep === 2}
                    />
                  </div>
                </div>
              </div>
            )}

            {showLeft && showCenter && (
              <div className="pt-6 flex items-stretch">
                <BracketConnectorSvg
                  edges={build1to1Edge(sixLeftR2, 'L2R', 2)}
                  shouldReduceMotion={prefersReducedMotion}
                />
              </div>
            )}

            {showCenter && (
              <div className="w-[146px] shrink-0 flex flex-col justify-center items-center px-1">
                <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  <span>{finalsLabel}</span>
                </div>
                <div className="w-full space-y-2">
                  {showChampion && championEntry && (
                    <div className="rounded-xl bg-[var(--t-gold-soft)] p-2 text-center flex flex-col items-center gap-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                        <Crown className="w-3 h-3" /> CHAMPION
                      </span>
                      <TeamEmblem team={championEntry.team} size="sm" />
                      <span className="text-[12px] font-bold text-[var(--t-g900)]">
                        {championEntry.team.shortName}
                      </span>
                    </div>
                  )}
                  <SeriesSlotCard
                    match={finalsSeries}
                    placeholderTitle={finalsLabel}
                    playerTeamId={playerTeamId}
                    isRevealed={displayStep >= 3}
                    isHighlightedNew={isClimbing && displayStep === 3}
                  />
                </div>
              </div>
            )}

            {showRight && showCenter && (
              <div className="pt-6 flex items-stretch">
                <BracketConnectorSvg
                  edges={build1to1Edge(sixRightR2, 'R2L', 2)}
                  shouldReduceMotion={prefersReducedMotion}
                />
              </div>
            )}

            {showRight && (
              <div className="flex items-stretch flex-1">
                <div className="flex-1 min-w-[116px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    4강 (2시드)
                  </div>
                  <div className="flex-1 grid grid-rows-1 items-center">
                    <SeriesSlotCard
                      match={sixRightR2}
                      placeholderTitle="4강 B"
                      byeSeed={standings[1] || null}
                      playerTeamId={playerTeamId}
                      isRevealed={displayStep >= 2}
                      isHighlightedNew={isClimbing && displayStep === 2}
                    />
                  </div>
                </div>

                <div className="pt-6 flex items-stretch">
                  <BracketConnectorSvg
                    edges={build1to1Edge(sixRightR1, 'R2L', 1)}
                    shouldReduceMotion={prefersReducedMotion}
                  />
                </div>

                <div className="flex-1 min-w-[116px] flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                    6강 B
                  </div>
                  <div className="flex-1 grid grid-rows-1 items-center">
                    <SeriesSlotCard
                      match={sixRightR1}
                      placeholderTitle="6강 PO"
                      playerTeamId={playerTeamId}
                      isRevealed={displayStep >= 1}
                      isHighlightedNew={isClimbing && displayStep === 1}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`flex items-stretch ${
              wingFocus === 'ALL' ? 'min-w-[480px]' : 'min-w-full justify-center'
            } min-h-[160px]`}
          >
            {showLeft && (
              <div className="flex-1 min-w-[132px] flex flex-col">
                <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                  4강 1경기
                </div>
                <div className="flex-1 grid grid-rows-1 items-center">
                  <SeriesSlotCard
                    match={fourLeftSF}
                    placeholderTitle="4강"
                    playerTeamId={playerTeamId}
                    isRevealed={displayStep >= 1}
                    isHighlightedNew={isClimbing && displayStep === 1}
                  />
                </div>
              </div>
            )}

            {showLeft && showCenter && (
              <div className="pt-6 flex items-stretch">
                <BracketConnectorSvg
                  edges={build1to1Edge(fourLeftSF, 'L2R', 1)}
                  shouldReduceMotion={prefersReducedMotion}
                />
              </div>
            )}

            {showCenter && (
              <div className="w-[152px] shrink-0 flex flex-col justify-center items-center px-1">
                <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  <span>{finalsLabel}</span>
                </div>
                <div className="w-full space-y-2">
                  {showChampion && championEntry && (
                    <div className="rounded-xl bg-[var(--t-gold-soft)] p-2 text-center flex flex-col items-center gap-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                        <Crown className="w-3 h-3" /> 우승
                      </span>
                      <TeamEmblem team={championEntry.team} size="sm" />
                      <span className="text-[12px] font-bold text-[var(--t-g900)]">
                        {championEntry.team.shortName}
                      </span>
                    </div>
                  )}
                  <SeriesSlotCard
                    match={finalsSeries}
                    placeholderTitle={finalsLabel}
                    playerTeamId={playerTeamId}
                    isRevealed={displayStep >= 2}
                    isHighlightedNew={isClimbing && displayStep === 2}
                  />
                </div>
              </div>
            )}

            {showRight && showCenter && (
              <div className="pt-6 flex items-stretch">
                <BracketConnectorSvg
                  edges={build1to1Edge(fourRightSF, 'R2L', 1)}
                  shouldReduceMotion={prefersReducedMotion}
                />
              </div>
            )}

            {showRight && (
              <div className="flex-1 min-w-[132px] flex flex-col">
                <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
                  4강 2경기
                </div>
                <div className="flex-1 grid grid-rows-1 items-center">
                  <SeriesSlotCard
                    match={fourRightSF}
                    placeholderTitle="4강"
                    playerTeamId={playerTeamId}
                    isRevealed={displayStep >= 1}
                    isHighlightedNew={isClimbing && displayStep === 1}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 미니 범례 */}
      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-[var(--t-g500)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded-full bg-[var(--t-accent)] inline-block" />
            내 팀 경로
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded-full bg-[var(--t-g500)] inline-block" />
            진출
          </span>
        </div>
        {bracket.pendingConfFinalsGame7 && (
          <span className="font-bold text-[var(--t-up)]">7차전 성사</span>
        )}
      </div>
    </div>
  );
}

export default PlayoffBracketLadder;
