'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { isInternationalLiveGame } from '../../engine/internationalEngine';
import { useCareerStore } from '../../store/useCareerStore';
import {
  LiveCourtPlay,
  LivePlayerBoxSnapshot,
  LiveTacticId,
} from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const TACTIC_OPTIONS: {
  id: LiveTacticId;
  label: string;
  effect: string;
}[] = [
  { id: 'ACE_HERO', label: '에이스 모드', effect: '득점 ↑ · 체력 소모 ↑' },
  { id: 'UNSELFISH_PASS', label: '이타적 패스', effect: '어시스트 · 팀 야투 ↑' },
  { id: 'LOCKDOWN_DEFENSE', label: '락다운 수비', effect: '실점 억제 · 스틸 ↑ · 파울 위험 ↑' },
  { id: 'PACE_CONSERVE', label: '페이스 조절', effect: '4쿼터 체력 비축' },
];

const COURT_W = 320;
const COURT_H = 220;
const RIM_X = 160;
const RIM_Y = 30;

function toSvgX(nx: number): number {
  return 16 + (Math.max(0, Math.min(100, nx)) / 100) * (COURT_W - 32);
}

function toSvgY(ny: number): number {
  return 14 + (Math.max(0, Math.min(100, ny)) / 100) * (COURT_H - 28);
}

function buildArcPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const lift = Math.min(62, Math.max(22, dist * 0.38));
  const ctrlY = Math.min(y1, y2) - lift;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${ctrlY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function isCourtVisiblePlay(play: LiveCourtPlay | null | undefined): boolean {
  if (!play) return false;
  if (play.type === 'TEAM_TICK' || play.type === 'OPP_SCORE') return false;
  if (play.showOnCourt === false) return false;
  return true;
}

function resolveCourtBadge(play: LiveCourtPlay): string | null {
  if (play.courtBadge) return play.courtBadge;
  const pts =
    typeof play.shotPoints === 'number'
      ? Math.max(0, Math.min(3, Math.round(play.shotPoints)))
      : 0;
  if (play.type === 'THREE_MAKE') return '+3';
  if (play.type === 'TWO_MAKE') return '+2';
  if (play.type === 'FT') return pts > 0 ? `+${pts}` : '+1';
  if (play.type === 'ASSIST') {
    return pts > 0 ? `AST +${pts}` : 'AST';
  }
  if (play.type === 'MISS') return 'MISS';
  if (play.type === 'STEAL') return 'STL';
  if (play.type === 'BLOCK') return 'BLK';
  if (play.type === 'FOUL') return 'FOUL';
  if (play.type === 'CLUTCH') {
    if (pts > 0) return `+${pts}`;
    return play.oppDelta > 0 ? `-${play.oppDelta}` : 'STOP';
  }
  return null;
}

function getPlayAccentColor(play: LiveCourtPlay): string {
  if (play.type === 'CLUTCH') return play.oppDelta > 0 ? '#f04452' : '#f05a1f';
  if (play.type === 'THREE_MAKE' || play.type === 'TWO_MAKE' || play.type === 'FT') {
    return '#f05a1f';
  }
  if (play.type === 'ASSIST') return '#3182f6';
  if (play.type === 'STEAL' || play.type === 'BLOCK') return '#03b26c';
  if (play.type === 'FOUL') return '#f04452';
  return '#737d8a';
}

function MiniHalfCourt({
  plays,
  activeIndex,
  phase,
  quarterLabel,
  shouldReduceMotion,
}: {
  plays: LiveCourtPlay[];
  activeIndex: number;
  phase: 'FLYING' | 'LANDED';
  quarterLabel: string;
  shouldReduceMotion: boolean;
}) {
  const currentTurn =
    plays.length > 0 ? plays[Math.min(activeIndex, plays.length - 1)] : null;

  const activeCourtPlay = isCourtVisiblePlay(currentTurn) ? currentTurn : null;

  // 과거 점은 현재 턴 이전의 내 선수 코트 포제션만 표시 (현재 턴이 LANDED면 강조 유지)
  const pastCourtPlays = plays
    .slice(0, Math.max(0, activeIndex))
    .filter((p) => isCourtVisiblePlay(p));

  const sx = activeCourtPlay ? toSvgX(activeCourtPlay.x) : RIM_X;
  const sy = activeCourtPlay ? toSvgY(activeCourtPlay.y) : 110;
  const hasPass =
    Boolean(activeCourtPlay) &&
    typeof activeCourtPlay?.fromX === 'number' &&
    typeof activeCourtPlay?.fromY === 'number';
  const fx = hasPass ? toSvgX(activeCourtPlay!.fromX!) : sx;
  const fy = hasPass ? toSvgY(activeCourtPlay!.fromY!) : sy;

  const isShotPlay =
    Boolean(activeCourtPlay) &&
    (activeCourtPlay!.type === 'THREE_MAKE' ||
      activeCourtPlay!.type === 'TWO_MAKE' ||
      activeCourtPlay!.type === 'FT' ||
      activeCourtPlay!.type === 'MISS' ||
      activeCourtPlay!.type === 'ASSIST' ||
      (activeCourtPlay!.type === 'CLUTCH' &&
        ((activeCourtPlay!.shotPoints ?? 0) > 0 || activeCourtPlay!.courtBadge === 'MISS')));

  const isDefensePlay =
    Boolean(activeCourtPlay) &&
    (activeCourtPlay!.type === 'STEAL' ||
      activeCourtPlay!.type === 'BLOCK' ||
      (activeCourtPlay!.type === 'CLUTCH' &&
        (activeCourtPlay!.shotPoints ?? 0) === 0 &&
        activeCourtPlay!.oppDelta === 0));

  const isScoredPlay =
    Boolean(activeCourtPlay) && (activeCourtPlay!.shotPoints ?? 0) > 0;

  const accent = activeCourtPlay ? getPlayAccentColor(activeCourtPlay) : '#f05a1f';
  const badgeText = activeCourtPlay ? resolveCourtBadge(activeCourtPlay) : null;
  const badgeWidth = badgeText && badgeText.length >= 5 ? 50 : 40;
  const isLanded = phase === 'LANDED' || shouldReduceMotion;

  return (
    <div
      data-testid="live-mini-court"
      className="rounded-2xl bg-[var(--t-g100)] p-2.5 overflow-hidden space-y-1.5"
    >
      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--t-g600)] px-1">
        <span>HALF-COURT · {quarterLabel}</span>
        <span className="tabular-nums font-bold text-[var(--t-accent-ink)]">
          {currentTurn ? currentTurn.clock : '대기'}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${COURT_W} ${COURT_H}`}
        className="w-full h-auto block rounded-xl bg-[var(--t-court-bg)]"
        role="img"
        aria-label="실시간 농구 하프코트"
      >
        <rect
          x="10"
          y="10"
          width={COURT_W - 20}
          height={COURT_H - 20}
          rx="6"
          fill="none"
          stroke="var(--t-court-line)"
          strokeWidth="1.8"
        />

        <rect
          x={RIM_X - 44}
          y="10"
          width="88"
          height="92"
          fill="var(--t-court-paint)"
          stroke="var(--t-court-line)"
          strokeWidth="1.6"
        />

        <circle
          cx={RIM_X}
          cy="102"
          r="28"
          fill="none"
          stroke="var(--t-court-line)"
          strokeWidth="1.5"
        />

        <path
          d={`M ${RIM_X - 20} 30 A 20 20 0 0 0 ${RIM_X + 20} 30`}
          fill="none"
          stroke="var(--t-court-line)"
          strokeWidth="1.4"
        />

        <path
          d={`M 32 10 L 32 62 A 128 118 0 0 0 ${COURT_W - 32} 62 L ${COURT_W - 32} 10`}
          fill="none"
          stroke="var(--t-court-line)"
          strokeWidth="1.8"
        />

        <line
          x1={RIM_X - 18}
          y1="20"
          x2={RIM_X + 18}
          y2="20"
          stroke="var(--t-g500)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle
          cx={RIM_X}
          cy={RIM_Y}
          r="6.5"
          fill="none"
          stroke="var(--t-accent)"
          strokeWidth="2.5"
        />

        {pastCourtPlays.map((p) => {
          const px = toSvgX(p.x);
          const py = toSvgY(p.y);
          const col = getPlayAccentColor(p);
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r="3.8"
              fill={col}
              fillOpacity="0.28"
              stroke={col}
              strokeOpacity="0.5"
              strokeWidth="1.2"
            />
          );
        })}

        {activeCourtPlay && (
          <g key={activeCourtPlay.id}>
            {hasPass && (
              <>
                <motion.line
                  x1={fx}
                  y1={fy}
                  x2={sx}
                  y2={sy}
                  stroke="#3182f6"
                  strokeWidth="2.2"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.3 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
                />
                <circle
                  cx={fx}
                  cy={fy}
                  r="5"
                  fill="#3182f6"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                />
              </>
            )}

            {isShotPlay && (
              <motion.path
                d={buildArcPath(sx, sy, RIM_X, RIM_Y)}
                fill="none"
                stroke={accent}
                strokeWidth={activeCourtPlay.type === 'CLUTCH' ? 2.8 : 2.2}
                strokeDasharray={activeCourtPlay.type === 'MISS' ? '5 4' : undefined}
                strokeLinecap="round"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.45 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.36,
                  delay: hasPass && !shouldReduceMotion ? 0.1 : 0,
                  ease: 'easeOut',
                }}
              />
            )}

            {isLanded && isScoredPlay && (
              <motion.circle
                cx={RIM_X}
                cy={RIM_Y}
                r="10"
                fill="none"
                stroke="#03b26c"
                strokeWidth="2.4"
                initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0.95 }}
                animate={{ scale: 1.85, opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.48 }}
              />
            )}

            {isLanded && isDefensePlay && (
              <motion.circle
                cx={sx}
                cy={sy}
                r="12"
                fill="#03b26c"
                fillOpacity="0.18"
                stroke="#03b26c"
                strokeWidth="2"
                initial={shouldReduceMotion ? false : { scale: 0.6, opacity: 0.9 }}
                animate={{ scale: 1.4, opacity: 0.2 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.42 }}
              />
            )}

            <motion.circle
              cx={sx}
              cy={sy}
              r="7"
              fill={accent}
              stroke="#ffffff"
              strokeWidth="2"
              initial={shouldReduceMotion ? false : { scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
            />

            {isLanded && badgeText && (
              <motion.g
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              >
                <rect
                  x={Math.min(COURT_W - badgeWidth - 10, Math.max(10, sx - badgeWidth / 2))}
                  y={Math.max(12, sy - 26)}
                  width={badgeWidth}
                  height="16"
                  rx="8"
                  fill={accent}
                />
                <text
                  x={Math.min(
                    COURT_W - badgeWidth / 2 - 10,
                    Math.max(badgeWidth / 2 + 10, sx)
                  )}
                  y={Math.max(23, sy - 15)}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="700"
                >
                  {badgeText}
                </text>
              </motion.g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

export function LiveGameBroadcast() {
  const career = useCareerStore((s) => s.career);
  const setLiveGameTactic = useCareerStore((s) => s.setLiveGameTactic);
  const playNextLiveQuarter = useCareerStore((s) => s.playNextLiveQuarter);
  const resolveLiveClutchChoice = useCareerStore((s) => s.resolveLiveClutchChoice);
  const skipLiveGame = useCareerStore((s) => s.skipLiveGame);
  const closeLiveGameAndReturn = useCareerStore((s) => s.closeLiveGameAndReturn);

  const prefersReducedMotion = useReducedMotion() ?? false;
  const liveGame = career?.liveGame;

  const latestQuarterLog =
    liveGame && liveGame.quarterLogs.length > 0
      ? liveGame.quarterLogs[liveGame.quarterLogs.length - 1]
      : null;

  const latestPlays = useMemo(
    () => latestQuarterLog?.plays || [],
    [latestQuarterLog]
  );

  const replayKey = liveGame
    ? `${liveGame.quarter}_${latestPlays.length}`
    : 'NONE';

  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);
  const [replayState, setReplayState] = useState<{
    key: string;
    index: number;
    phase: 'FLYING' | 'LANDED';
    finished: boolean;
  }>({
    key: replayKey,
    index: Math.max(0, latestPlays.length - 1),
    phase: 'LANDED',
    finished: true,
  });

  const isNewKey = replayState.key !== replayKey;
  const isSkipped = Boolean(liveGame?.wasSkipped);

  const playIndex = (() => {
    if (!liveGame || latestPlays.length === 0) return 0;
    if (prefersReducedMotion || isSkipped) return latestPlays.length - 1;
    if (isNewKey) {
      const [prevQStr, prevLenStr] = replayState.key.split('_');
      const prevQ = Number(prevQStr);
      const prevLen = Number(prevLenStr);
      // 클러치 1포제션이 기존 쿼터 로그에 추가된 경우 마지막 턴만 재생
      if (
        prevQ === liveGame.quarter &&
        prevLen > 0 &&
        latestPlays.length === prevLen + 1
      ) {
        return latestPlays.length - 1;
      }
      return 0;
    }
    return Math.min(replayState.index, latestPlays.length - 1);
  })();

  const activePlay: LiveCourtPlay | null =
    latestPlays.length > 0
      ? latestPlays[Math.min(playIndex, latestPlays.length - 1)]
      : null;

  const currentPhase: 'FLYING' | 'LANDED' = (() => {
    if (!activePlay || prefersReducedMotion || isSkipped) return 'LANDED';
    if (isNewKey) {
      return isCourtVisiblePlay(activePlay) ? 'FLYING' : 'LANDED';
    }
    return replayState.phase;
  })();

  const isReplaying = Boolean(
    liveGame &&
      latestPlays.length > 0 &&
      !prefersReducedMotion &&
      !isSkipped &&
      (isNewKey || !replayState.finished)
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isReplaying || latestPlays.length === 0 || !activePlay) return;

    const atLastTurn = playIndex >= latestPlays.length - 1;
    const isCourt = isCourtVisiblePlay(activePlay);

    if (currentPhase === 'FLYING' && isCourt) {
      const flyMs = playbackSpeed === 2 ? 210 : 400;
      timerRef.current = setTimeout(() => {
        setReplayState({
          key: replayKey,
          index: playIndex,
          phase: 'LANDED',
          finished: false,
        });
      }, flyMs);
    } else if (atLastTurn) {
      const endMs = playbackSpeed === 2 ? 220 : 380;
      timerRef.current = setTimeout(() => {
        setReplayState({
          key: replayKey,
          index: latestPlays.length - 1,
          phase: 'LANDED',
          finished: true,
        });
      }, endMs);
    } else {
      const holdMs = isCourt
        ? playbackSpeed === 2
          ? 250
          : 520
        : playbackSpeed === 2
        ? 180
        : 340;
      const nextIdx = playIndex + 1;
      const nextIsCourt = isCourtVisiblePlay(latestPlays[nextIdx]);
      timerRef.current = setTimeout(() => {
        setReplayState({
          key: replayKey,
          index: nextIdx,
          phase: nextIsCourt ? 'FLYING' : 'LANDED',
          finished: false,
        });
      }, holdMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    isReplaying,
    playIndex,
    currentPhase,
    activePlay,
    latestPlays,
    playbackSpeed,
    replayKey,
  ]);

  if (!career || !liveGame) return null;

  const handleFinishQuarterReplay = () => {
    setReplayState({
      key: replayKey,
      index: Math.max(0, latestPlays.length - 1),
      phase: 'LANDED',
      finished: true,
    });
  };

  const handleSkipEntireGame = () => {
    setReplayState({
      key: replayKey,
      index: Math.max(0, latestPlays.length - 1),
      phase: 'LANDED',
      finished: true,
    });
    skipLiveGame();
  };

  // 전광판 점수 동기화: FLYING 중에는 슛 이전 점수, LANDED 이후에만 득점 반영
  const displayedTeamScore =
    isReplaying && activePlay
      ? currentPhase === 'FLYING'
        ? activePlay.teamScoreBefore ??
          latestQuarterLog?.startTeamScore ??
          liveGame.teamScore
        : activePlay.teamScoreAfter
      : liveGame.teamScore;

  const displayedOppScore =
    isReplaying && activePlay
      ? currentPhase === 'FLYING'
        ? activePlay.oppScoreBefore ??
          latestQuarterLog?.startOppScore ??
          liveGame.oppScore
        : activePlay.oppScoreAfter
      : liveGame.oppScore;

  // 내 선수 실시간 박스스코어 스냅샷 동기화 (스포일러 완전 차단)
  const displayedPlayerStats: LivePlayerBoxSnapshot = (() => {
    if (!isReplaying || !activePlay) return liveGame.playerStats;
    if (currentPhase === 'FLYING') {
      if (playIndex > 0 && latestPlays[playIndex - 1]?.playerStatsAfter) {
        return latestPlays[playIndex - 1].playerStatsAfter!;
      }
      if (latestQuarterLog?.startPlayerStats) {
        return latestQuarterLog.startPlayerStats;
      }
      return liveGame.playerStats;
    }
    return activePlay.playerStatsAfter || liveGame.playerStats;
  })();

  const userWon = liveGame.teamScore > liveGame.oppScore;
  const fgPct =
    displayedPlayerStats.fga > 0
      ? ((displayedPlayerStats.fgm / displayedPlayerStats.fga) * 100).toFixed(0)
      : '0';
  const foulLimit = liveGame.foulLimit ?? 6;
  const otCount = liveGame.overtimeCount ?? 0;
  const scoreDiff = liveGame.teamScore - liveGame.oppScore;
  const isLeadingClutch = liveGame.clutchScenario === 'LEADING';
  const isDisplayedFouledOut = displayedPlayerStats.fouls >= foulLimit;

  const scoreboardClock =
    isReplaying && activePlay
      ? `${latestQuarterLog?.label || `${liveGame.quarter}Q`} ${activePlay.clock}`
      : liveGame.isFinished
      ? otCount > 0
        ? `FINAL · ${otCount}OT`
        : 'FINAL'
      : liveGame.pendingClutchPossession
      ? '4Q 0:14.2'
      : liveGame.quarter === 0
      ? 'TIP-OFF'
      : liveGame.quarter > 4
      ? `OT${liveGame.quarter - 4} 종료`
      : `${liveGame.quarter}Q 종료`;

  // FLYING 단계에는 현재 턴 문구를 숨겨 슛 결과가 먼저 보이지 않도록 차단
  const revealedCount = isReplaying
    ? currentPhase === 'FLYING'
      ? Math.max(0, playIndex)
      : playIndex + 1
    : latestPlays.length;
  const revealedTurns = latestPlays.slice(0, revealedCount).slice().reverse();

  const showTacticsCard =
    (!liveGame.isFinished && !liveGame.pendingClutchPossession) || isReplaying;

  const showBottomDock = !liveGame.pendingClutchPossession || isReplaying;

  return (
    <div data-testid="live-game-broadcast" className="space-y-3 pb-24">
      {/* 1. 상단 전광판 카드 */}
      <section className="t-card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[12px] font-bold text-[var(--t-up)]">
              LIVE
            </span>
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--t-g900)] truncate">
              {liveGame.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPlaybackSpeed((s) => (s === 1 ? 2 : 1))}
              className="min-h-[34px] px-2.5 rounded-xl bg-[var(--t-g100)] text-[12px] font-bold text-[var(--t-g700)] tabular-nums cursor-pointer t-tap"
            >
              {playbackSpeed}x
            </button>

            {isReplaying && (
              <button
                type="button"
                onClick={handleFinishQuarterReplay}
                className="min-h-[34px] px-2.5 rounded-xl bg-[var(--t-accent-soft)] text-[12px] font-bold text-[var(--t-accent-ink)] cursor-pointer t-tap"
              >
                턴 스킵
              </button>
            )}

            {(!liveGame.isFinished || isReplaying) && (
              <button
                type="button"
                onClick={handleSkipEntireGame}
                className="min-h-[34px] px-2.5 rounded-xl bg-[var(--t-g100)] text-[12px] font-semibold text-[var(--t-g600)] cursor-pointer t-tap"
              >
                경기 스킵
              </button>
            )}
          </div>
        </div>

        {/* 국제대회 예선·토너먼트 경로 요약 (결승/3·4위전 입장 시) */}
        {isInternationalLiveGame(liveGame.gameType) &&
          liveGame.internationalPreMatches &&
          liveGame.internationalPreMatches.length > 0 && (
            <div className="px-3 py-2 rounded-xl bg-[var(--t-g100)] text-[12px] text-[var(--t-g600)] flex flex-wrap items-center gap-x-2.5 gap-y-1 tabular-nums">
              <span className="font-bold text-[var(--t-accent-ink)]">
                이전 경기
              </span>
              {liveGame.internationalPreMatches.map((m, idx) => (
                <span key={`${m.stageLabel}-${idx}`}>
                  {m.stageLabel} {m.korScore}:{m.oppScore} {m.opponentName} (
                  {m.won ? '승' : '패'})
                </span>
              ))}
            </div>
          )}

        {/* 스코어보드 */}
        <div className="grid grid-cols-3 items-center text-center py-2">
          <div className="flex flex-col items-center gap-1 min-w-0">
            <TeamEmblem team={liveGame.playerTeam} size="md" />
            <span className="text-[12px] font-semibold text-[var(--t-g600)] truncate max-w-full">
              {liveGame.playerTeam.shortName}
            </span>
            <span
              data-testid="live-team-score"
              className="text-[40px] font-bold text-[var(--t-accent)] tabular-nums leading-none mt-0.5"
            >
              {displayedTeamScore}
            </span>
          </div>

          <div className="space-y-1">
            <span className="block text-[12px] font-bold text-[var(--t-g700)] tabular-nums">
              {scoreboardClock}
            </span>
            <span className="block text-[11px] text-[var(--t-g500)] tabular-nums">
              체력 {displayedPlayerStats.stamina}% · 반칙{' '}
              {displayedPlayerStats.fouls}/{foulLimit}
            </span>
            <span className="block text-[11px] font-bold text-[var(--t-g600)]">
              {isDisplayedFouledOut
                ? `${foulLimit}반칙 퇴장`
                : isReplaying
                ? 'IN PLAY'
                : liveGame.momentum === 'HOT'
                ? 'HOT'
                : liveGame.momentum === 'COLD'
                ? 'COLD'
                : 'NORMAL'}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 min-w-0">
            <TeamEmblem team={liveGame.opponentTeam} size="md" />
            <span className="text-[12px] font-semibold text-[var(--t-g600)] truncate max-w-full">
              {liveGame.opponentTeam.shortName}
            </span>
            <span
              data-testid="live-opp-score"
              className="text-[40px] font-bold text-[var(--t-g900)] tabular-nums leading-none mt-0.5"
            >
              {displayedOppScore}
            </span>
          </div>
        </div>

        {/* 쿼터별 스코어 요약표 (진행 중 쿼터는 스포일러 방지를 위해 현재 실시간 누적값 기준 표시) */}
        {liveGame.quarterLogs.length > 0 && (
          <div
            data-testid="live-quarter-box"
            className="overflow-x-auto pt-2.5 border-t border-[var(--t-g100)]"
          >
            <table className="w-full text-[11px] tabular-nums text-center">
              <thead>
                <tr className="text-[var(--t-g500)] font-semibold">
                  <th className="text-left font-semibold py-1 pr-2">구단</th>
                  {liveGame.quarterLogs.map((ql) => (
                    <th key={ql.label} className="font-semibold py-1 px-1.5">
                      {ql.label}
                    </th>
                  ))}
                  <th className="font-bold py-1 pl-2 text-[var(--t-g800)]">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-[var(--t-g900)]">
                  <td className="text-left font-bold text-[var(--t-accent-ink)] py-1 pr-2 truncate max-w-[96px]">
                    {liveGame.playerTeam.shortName}
                  </td>
                  {liveGame.quarterLogs.map((ql, idx) => {
                    const isCurrentReplayQ =
                      isReplaying && idx === liveGame.quarterLogs.length - 1;
                    const qPtsVal = isCurrentReplayQ
                      ? Math.max(0, displayedTeamScore - (ql.startTeamScore ?? 0))
                      : ql.teamPts;
                    return (
                      <td key={`t-${ql.label}`} className="py-1 px-1.5 font-semibold">
                        {qPtsVal}
                      </td>
                    );
                  })}
                  <td className="py-1 pl-2 font-bold text-[var(--t-accent)]">
                    {displayedTeamScore}
                  </td>
                </tr>
                <tr className="text-[var(--t-g700)]">
                  <td className="text-left font-semibold py-1 pr-2 truncate max-w-[96px]">
                    {liveGame.opponentTeam.shortName}
                  </td>
                  {liveGame.quarterLogs.map((ql, idx) => {
                    const isCurrentReplayQ =
                      isReplaying && idx === liveGame.quarterLogs.length - 1;
                    const qPtsVal = isCurrentReplayQ
                      ? Math.max(0, displayedOppScore - (ql.startOppScore ?? 0))
                      : ql.oppPts;
                    return (
                      <td key={`o-${ql.label}`} className="py-1 px-1.5 font-medium">
                        {qPtsVal}
                      </td>
                    );
                  })}
                  <td className="py-1 pl-2 font-bold text-[var(--t-g900)]">
                    {displayedOppScore}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 내 선수 실시간 스탯 스트립 */}
        <div className="grid grid-cols-5 sm:grid-cols-7 pt-3.5 border-t border-[var(--t-g100)] text-center gap-1 tabular-nums">
          {[
            { label: 'PTS', val: displayedPlayerStats.pts },
            { label: 'REB', val: displayedPlayerStats.reb },
            { label: 'AST', val: displayedPlayerStats.ast },
            { label: 'STL', val: displayedPlayerStats.stl },
            { label: 'BLK', val: displayedPlayerStats.blk },
            { label: 'FG', val: `${fgPct}%`, hideSm: true },
            {
              label: '3P',
              val: `${displayedPlayerStats.tpm}/${displayedPlayerStats.tpa}`,
              hideSm: true,
            },
          ].map((st) => (
            <div
              key={st.label}
              className={st.hideSm ? 'hidden sm:block' : ''}
            >
              <span className="block text-[15px] font-bold text-[var(--t-g900)]">
                {st.val}
              </span>
              <span className="text-[10px] font-medium text-[var(--t-g500)]">
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. 미니 하프코트 + 턴별 중계 */}
      <section className="t-card grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MiniHalfCourt
          plays={latestPlays}
          activeIndex={playIndex}
          phase={currentPhase}
          quarterLabel={latestQuarterLog?.label || '1Q'}
          shouldReduceMotion={prefersReducedMotion}
        />

        <div className="rounded-2xl bg-[var(--t-g100)] p-3 flex flex-col max-h-[250px]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--t-g600)] pb-2 border-b border-[var(--t-g200)]">
            <span>문자 중계</span>
            {latestPlays.length > 0 && (
              <span className="tabular-nums text-[var(--t-g400)]">
                {Math.min(revealedCount, latestPlays.length)}/{latestPlays.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pt-2">
            {revealedTurns.length === 0 ? (
              <p className="text-[13px] text-[var(--t-g500)] text-center py-8">
                {isReplaying
                  ? `${latestQuarterLog?.label || `${liveGame.quarter}Q`} 포제션 전개 중...`
                  : '전술을 선택하고 경기를 시작하세요'}
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {revealedTurns.map((play, idx) => {
                  const isNewest = idx === 0;
                  return (
                    <motion.div
                      key={play.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`p-2.5 rounded-xl text-[12px] leading-snug ${
                        isNewest
                          ? 'bg-[var(--t-card)] text-[var(--t-g900)] font-semibold'
                          : 'text-[var(--t-g600)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--t-g400)] mb-0.5 tabular-nums">
                        <span>{play.clock}</span>
                        <span>
                          {play.teamScoreAfter} : {play.oppScoreAfter}
                        </span>
                      </div>
                      <p>{play.text}</p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </section>

      {/* 3. ±4점 접전 클러치 선택 카드 */}
      {liveGame.pendingClutchPossession && !liveGame.isFinished && !isReplaying && (
        <section
          data-testid="clutch-possession-modal"
          className="t-card space-y-4 ring-2 ring-[var(--t-accent)]"
        >
          <div className="space-y-1">
            <span className="text-[12px] font-bold text-[var(--t-up)]">
              {isLeadingClutch
                ? `클러치 수비 · ${scoreDiff}점 리드`
                : scoreDiff === 0
                ? '클러치 공격 · 동점'
                : `클러치 공격 · ${Math.abs(scoreDiff)}점 차`}
            </span>
            <p className="text-[15px] font-bold text-[var(--t-g900)] leading-snug">
              {liveGame.clutchSituationText}
            </p>
          </div>

          {isLeadingClutch ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="clutch-choice-lockdown"
                onClick={() => resolveLiveClutchChoice('LOCKDOWN_STOP')}
                className="p-4 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-accent-soft)] text-left cursor-pointer t-tap space-y-1"
              >
                <div className="text-[15px] font-bold text-[var(--t-g900)]">
                  에이스 락다운 수비
                </div>
                <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
                  DEF {career.stats.def} · 체력 {displayedPlayerStats.stamina}%
                </p>
              </button>

              <button
                type="button"
                data-testid="clutch-choice-ft"
                onClick={() => resolveLiveClutchChoice('CLUTCH_FREE_THROWS')}
                className="p-4 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-accent-soft)] text-left cursor-pointer t-tap space-y-1"
              >
                <div className="text-[15px] font-bold text-[var(--t-g900)]">
                  파울 유도 · 쐐기 자유투
                </div>
                <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
                  OUT {career.stats.out} · PLY {career.stats.ply}
                </p>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="clutch-choice-iso"
                onClick={() => resolveLiveClutchChoice('ISO_WINNER')}
                className="p-4 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-accent-soft)] text-left cursor-pointer t-tap space-y-1"
              >
                <div className="text-[15px] font-bold text-[var(--t-g900)]">
                  아이솔레이션 {Math.abs(scoreDiff) >= 3 ? '3점 ' : ''}클러치 슛
                </div>
                <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
                  INS {career.stats.ins} · OUT {career.stats.out}
                </p>
              </button>

              <button
                type="button"
                data-testid="clutch-choice-kickout"
                onClick={() => resolveLiveClutchChoice('KICKOUT_ASSIST')}
                className="p-4 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-accent-soft)] text-left cursor-pointer t-tap space-y-1"
              >
                <div className="text-[15px] font-bold text-[var(--t-g900)]">
                  코너 오픈 킥아웃 패스
                </div>
                <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
                  PLY {career.stats.ply} · 팀 전력 {liveGame.playerTeam.rating}
                </p>
              </button>
            </div>
          )}
        </section>
      )}

      {/* 4. 쿼터 전술 선택 */}
      {showTacticsCard && (
        <section className="t-card space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold text-[var(--t-g900)]">
              전술 선택
            </span>
            <span className="text-[12px] font-semibold text-[var(--t-g500)]">
              {isReplaying
                ? `${latestQuarterLog?.label || `${liveGame.quarter}Q`} 진행 중`
                : liveGame.quarter >= 4
                ? `OT${liveGame.quarter - 3}`
                : `${liveGame.quarter + 1}쿼터`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TACTIC_OPTIONS.map((t) => {
              const active = liveGame.currentTactic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isReplaying}
                  onClick={() => setLiveGameTactic(t.id)}
                  className={`min-h-[56px] p-3 rounded-2xl text-left t-tap ${
                    isReplaying ? 'opacity-65 cursor-default' : 'cursor-pointer'
                  } ${
                    active
                      ? 'bg-[var(--t-accent-soft)] ring-1 ring-[var(--t-accent)]'
                      : 'bg-[var(--t-g100)] hover:bg-[var(--t-g200)]/70'
                  }`}
                >
                  <div
                    className={`text-[14px] font-bold ${
                      active ? 'text-[var(--t-accent-ink)]' : 'text-[var(--t-g900)]'
                    }`}
                  >
                    {t.label}
                  </div>
                  <div className="text-[11px] text-[var(--t-g500)] mt-0.5">
                    {t.effect}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. 종료 헤드라인 */}
      {liveGame.finalOutcome && !isReplaying && (
        <section className="t-card space-y-2">
          {liveGame.finalOutcome.medal && (
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
              <span className="text-[var(--t-gold)]">
                {liveGame.finalOutcome.medal === 'GOLD'
                  ? '금메달 확정'
                  : liveGame.finalOutcome.medal === 'SILVER'
                  ? '은메달 확정'
                  : liveGame.finalOutcome.medal === 'BRONZE'
                  ? '동메달 확정'
                  : '4위 마감'}
              </span>
              {liveGame.finalOutcome.wonTournamentMvp && (
                <span className="text-[var(--t-accent-ink)]">· 대회 MVP</span>
              )}
              {liveGame.finalOutcome.grantedMilitaryExemption && (
                <span className="text-[var(--t-ok)]">· 병역 특례 확정</span>
              )}
              {!liveGame.finalOutcome.grantedMilitaryExemption &&
                !career.militaryExempt &&
                career.militaryServiceSeasonsLeft === 0 &&
                (liveGame.internationalTournamentType === 'ASIA_CUP' ||
                  liveGame.internationalTournamentType === 'FIBA_WORLD_CUP') && (
                  <span className="text-[var(--t-g500)] font-medium">
                    · 병역특례 비대상 대회
                  </span>
                )}
            </div>
          )}
          <p className="text-[15px] font-bold text-[var(--t-g900)] leading-relaxed">
            {liveGame.finalOutcome.headline}
          </p>
        </section>
      )}

      {/* 하단 고정 CTA 도크 */}
      {showBottomDock && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 pt-4 px-4 pb-safe"
          style={{
            background:
              'linear-gradient(to top, var(--t-dock-fade) 72%, transparent)',
          }}
        >
          <div className="max-w-[728px] mx-auto">
            {isReplaying ? (
              <button type="button" disabled className="t-cta">
                중계 진행 중...
              </button>
            ) : !liveGame.isFinished ? (
              <button
                type="button"
                onClick={playNextLiveQuarter}
                className="t-cta"
              >
                {`${
                  liveGame.quarter >= 4
                    ? `OT${liveGame.quarter - 3}`
                    : `${liveGame.quarter + 1}쿼터`
                } 진행`}
              </button>
            ) : (
              <button
                type="button"
                onClick={closeLiveGameAndReturn}
                className="t-cta"
              >
                {liveGame.gameType === 'CONF_FINALS_GAME7' && userWon
                  ? 'NBA 파이널로 이동'
                  : liveGame.gameType === 'CONF_FINALS_GAME7' && !userWon
                  ? '대진표 결과 확인'
                  : isInternationalLiveGame(liveGame.gameType)
                  ? '오프시즌 복귀'
                  : liveGame.gameType === 'LEAGUE_FINALS' &&
                    career.playoffBracket &&
                    !career.playoffBracket.championTeamId
                  ? '대진표로 돌아가기'
                  : userWon
                  ? '우승 확정 · 오프시즌으로'
                  : '경기 종료 · 오프시즌으로'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
