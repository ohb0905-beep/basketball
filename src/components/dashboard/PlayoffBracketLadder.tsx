'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  PlayoffBracketState,
  StandingEntry,
} from '../../types/game';
import { isHighSchoolLeague } from '../../data/leagues';
import { WingFocus } from './bracket/bracketParts';
import { PlayInBracket } from './bracket/PlayInBracket';
import {
  Bracket16Layout,
  Bracket12Layout,
  Bracket8Layout,
  Bracket6Layout,
  Bracket4Layout,
} from './bracket/BracketLayouts';

interface PlayoffBracketLadderProps {
  bracket: PlayoffBracketState;
  standings: StandingEntry[];
  playerTeamId: string;
  fastMode?: boolean;
  onClimbingChange?: (climbing: boolean) => void;
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

  const bracketKey = `${bracket.year}_${bracket.league}_${bracket.stageType || 'MAIN_PLAYOFF'}`;
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

  const isPlayInStage =
    bracket.stageType === 'PLAY_IN_ROUND_1' ||
    bracket.stageType === 'PLAY_IN_DECIDER';
  const isNba = !isPlayInStage && bracket.league === 'NBA';
  const isNcaa = !isPlayInStage && bracket.league === 'NCAA';
  const is16Team = isNba || isNcaa;
  const is12Team = !isPlayInStage && bracket.league === 'GLEAGUE';
  const is8Team =
    !isPlayInStage &&
    (bracket.league === 'B_LEAGUE' ||
      bracket.league === 'EUROLEAGUE' ||
      bracket.league === 'U_LEAGUE' ||
      isHighSchoolLeague(bracket.league));
  const isSixTeam = !isPlayInStage && bracket.league === 'KBL';

  const finalsSeries =
    !isPlayInStage
      ? bracket.rounds[bracket.totalRounds - 1]?.[0] || null
      : null;
  const championEntry = bracket.championTeamId
    ? standings.find((s) => s.team.id === bracket.championTeamId) || null
    : null;
  const showChampion =
    Boolean(championEntry) && displayStep >= bracket.totalRounds + 1;

  // 16-team (NBA East/West or NCAA Left/Right)
  const left16R1 = isNba
    ? (bracket.rounds[0] || []).filter((m) => m.conference === 'EAST')
    : isNcaa
    ? (bracket.rounds[0] || []).slice(0, 4)
    : [];
  const right16R1 = isNba
    ? (bracket.rounds[0] || []).filter((m) => m.conference !== 'EAST')
    : isNcaa
    ? (bracket.rounds[0] || []).slice(4, 8)
    : [];
  const left16R2 = isNba
    ? (bracket.rounds[1] || []).filter((m) => m.conference === 'EAST')
    : isNcaa
    ? (bracket.rounds[1] || []).slice(0, 2)
    : [];
  const right16R2 = isNba
    ? (bracket.rounds[1] || []).filter((m) => m.conference !== 'EAST')
    : isNcaa
    ? (bracket.rounds[1] || []).slice(2, 4)
    : [];
  const left16CF = isNba
    ? (bracket.rounds[2] || []).filter((m) => m.conference === 'EAST')[0] || null
    : isNcaa
    ? bracket.rounds[2]?.[0] || null
    : null;
  const right16CF = isNba
    ? (bracket.rounds[2] || []).filter((m) => m.conference !== 'EAST')[0] || null
    : isNcaa
    ? bracket.rounds[2]?.[1] || null
    : null;

  // 12-team (G League East/West: 2 R1 matches -> 2 R2 matches w/ #1/#2 bye -> 1 CF -> Finals)
  const gEastStandings = is12Team
    ? standings
        .filter((s) => (s.conference || s.team.conference) === 'EAST')
        .sort((a, b) => (a.conferenceRank || a.rank) - (b.conferenceRank || b.rank))
    : [];
  const gWestStandings = is12Team
    ? standings
        .filter((s) => (s.conference || s.team.conference) === 'WEST')
        .sort((a, b) => (a.conferenceRank || a.rank) - (b.conferenceRank || b.rank))
    : [];
  const gEastR1 = is12Team
    ? (bracket.rounds[0] || []).filter((m) => m.conference === 'EAST')
    : [];
  const gWestR1 = is12Team
    ? (bracket.rounds[0] || []).filter((m) => m.conference !== 'EAST')
    : [];
  const gEastR2 = is12Team
    ? (bracket.rounds[1] || []).filter((m) => m.conference === 'EAST')
    : [];
  const gWestR2 = is12Team
    ? (bracket.rounds[1] || []).filter((m) => m.conference !== 'EAST')
    : [];
  const gEastCF = is12Team
    ? (bracket.rounds[2] || []).filter((m) => m.conference === 'EAST')[0] || null
    : null;
  const gWestCF = is12Team
    ? (bracket.rounds[2] || []).filter((m) => m.conference !== 'EAST')[0] || null
    : null;

  // 8-team (B.League / EuroLeague / U-League / High School: 4 QF -> 2 SF -> Finals)
  const eightLeftQF = is8Team ? (bracket.rounds[0] || []).slice(0, 2) : [];
  const eightRightQF = is8Team ? (bracket.rounds[0] || []).slice(2, 4) : [];
  const eightLeftSF = is8Team ? bracket.rounds[1]?.[0] || null : null;
  const eightRightSF = is8Team ? bracket.rounds[1]?.[1] || null : null;

  // 6-team (KBL: 2 R1 -> 2 SF w/ #1/#2 bye -> Finals)
  const sixLeftR1 = isSixTeam ? bracket.rounds[0]?.[0] || null : null;
  const sixRightR1 = isSixTeam ? bracket.rounds[0]?.[1] || null : null;
  const sixLeftR2 = isSixTeam ? bracket.rounds[1]?.[0] || null : null;
  const sixRightR2 = isSixTeam ? bracket.rounds[1]?.[1] || null : null;

  // 4-team (NBL Main PO: 2 SF -> Championship)
  const fourLeftSF =
    !isPlayInStage && !is16Team && !is12Team && !is8Team && !isSixTeam
      ? bracket.rounds[0]?.[0] || null
      : null;
  const fourRightSF =
    !isPlayInStage && !is16Team && !is12Team && !is8Team && !isSixTeam
      ? bracket.rounds[0]?.[1] || null
      : null;

  const showLeft = wingFocus === 'ALL' || wingFocus === 'LEFT';
  const showCenter = wingFocus === 'ALL' || wingFocus === 'CENTER';
  const showRight = wingFocus === 'ALL' || wingFocus === 'RIGHT';

  const finalsLabel =
    bracket.league === 'NBA'
      ? 'NBA 파이널'
      : bracket.league === 'GLEAGUE'
      ? 'G리그 파이널'
      : bracket.league === 'EUROLEAGUE'
      ? '유로리그 파이널'
      : bracket.league === 'B_LEAGUE'
      ? 'B.리그 파이널'
      : bracket.league === 'NBL'
      ? 'NBL 챔피언십'
      : bracket.league === 'KBL'
      ? '챔피언 결정전'
      : bracket.league === 'NCAA'
      ? 'NCAA 결승전'
      : '결승전';

  const layoutProps = {
    bracket,
    playerTeamId,
    prefersReducedMotion,
    wingFocus,
    displayStep,
    isClimbing,
    finalsSeries,
    championEntry,
    showChampion,
    showLeft,
    showCenter,
    showRight,
    finalsLabel,
  };

  const hasEastWestTabs = isNba || is12Team;

  // 플레이인 토너먼트 전용 렌더링 (NBA 7-10, EuroLeague 7-10, NBL 3-6)
  if (isPlayInStage) {
    return <PlayInBracket bracket={bracket} playerTeamId={playerTeamId} />;
  }

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
            { id: 'LEFT', label: hasEastWestTabs ? '동부' : '좌측' },
            { id: 'CENTER', label: '파이널' },
            { id: 'RIGHT', label: hasEastWestTabs ? '서부' : '우측' },
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
        {is16Team ? (
          <Bracket16Layout
            {...layoutProps}
            isNba={isNba}
            left16R1={left16R1}
            right16R1={right16R1}
            left16R2={left16R2}
            right16R2={right16R2}
            left16CF={left16CF}
            right16CF={right16CF}
          />
        ) : is12Team ? (
          <Bracket12Layout
            {...layoutProps}
            gEastStandings={gEastStandings}
            gWestStandings={gWestStandings}
            gEastR1={gEastR1}
            gWestR1={gWestR1}
            gEastR2={gEastR2}
            gWestR2={gWestR2}
            gEastCF={gEastCF}
            gWestCF={gWestCF}
          />
        ) : is8Team ? (
          <Bracket8Layout
            {...layoutProps}
            eightLeftQF={eightLeftQF}
            eightRightQF={eightRightQF}
            eightLeftSF={eightLeftSF}
            eightRightSF={eightRightSF}
          />
        ) : isSixTeam ? (
          <Bracket6Layout
            {...layoutProps}
            standings={standings}
            sixLeftR1={sixLeftR1}
            sixRightR1={sixRightR1}
            sixLeftR2={sixLeftR2}
            sixRightR2={sixRightR2}
          />
        ) : (
          <Bracket4Layout
            {...layoutProps}
            fourLeftSF={fourLeftSF}
            fourRightSF={fourRightSF}
          />
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
