'use client';

import React, { useEffect, useState } from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import {
  LEAGUE_BALANCE_META,
  isPersonalCareAllowedInLeague,
} from '../../config/balanceConfig';
import { LEAGUE_CONFIG } from '../../data/leagues';
import {
  getEffectiveCashBalance,
  getPersonalCarePackageCost,
  useCareerStore,
} from '../../store/useCareerStore';
import {
  AwardRaceEntry,
  OffseasonOption,
  PersonalCareId,
  TeamDirection,
} from '../../types/game';
import { Modal } from '../common/Modal';
import { TeamEmblem } from '../common/TeamEmblem';
import { FanReactionFeed } from './FanReactionFeed';
import { LiveGameBroadcast } from './LiveGameBroadcast';
import { PlayoffBracketLadder } from './PlayoffBracketLadder';

function formatSalaryOffer(amountUsd?: number, years?: number): string {
  if (!amountUsd || amountUsd <= 0) {
    return years && years > 0 ? `아마추어 · ${years}년` : '비계약 진로';
  }
  const yearSuffix = years && years > 0 ? ` · ${years}년` : '';
  if (amountUsd >= 1000000) {
    return `$${(amountUsd / 1000000).toFixed(2)}M${yearSuffix}`;
  }
  if (amountUsd >= 1000) {
    return `$${Math.round(amountUsd / 1000).toLocaleString()}K${yearSuffix}`;
  }
  return `$${amountUsd.toLocaleString()}${yearSuffix}`;
}

function formatUsdAmount(amountUsd: number): string {
  if (amountUsd >= 1000000) {
    return `$${(amountUsd / 1000000).toFixed(2)}M`;
  }
  if (amountUsd >= 1000) {
    return `$${Math.round(amountUsd / 1000).toLocaleString()}K`;
  }
  return `$${amountUsd.toLocaleString()}`;
}

function getTeamDirectionLabel(
  direction?: TeamDirection,
  rating?: number
): string {
  if (direction === 'CONTENDER' || (rating && rating >= 84)) return '우승 도전';
  if (direction === 'PLAYOFF_HUNT' || (rating && rating >= 74)) return 'PO 경쟁';
  return '리빌딩';
}

const PERSONAL_CARE_ITEMS: {
  id: PersonalCareId;
  effect: string;
  title: string;
}[] = [
  {
    id: 'BIOMECH_SKILL_LAB',
    effect: '성장 +15% · 노쇠화 완화',
    title: '바이오메카닉스 스킬 랩',
  },
  {
    id: 'REHAB_LOAD_MGMT',
    effect: '부상률 -70% · 컨디션 관리',
    title: '전담 재활 · 로드 매니지먼트',
  },
  {
    id: 'SIGNATURE_SNEAKER_MARKETING',
    effect: '스카우트 주가 +7 · 레거시 보너스',
    title: '시그니처 스니커즈 런칭',
  },
];

const RHYTHM_LABELS = ['전반기', '올스타 브레이크', '후반기', '최종 집계'];

export function SeasonTab() {
  const career = useCareerStore((s) => s.career);
  const playSeason = useCareerStore((s) => s.playSeason);
  const selectOffseasonOption = useCareerStore((s) => s.selectOffseasonOption);
  const purchasePersonalCare = useCareerStore((s) => s.purchasePersonalCare);
  const triggerMidSeasonCrossroads = useCareerStore(
    (s) => s.triggerMidSeasonCrossroads
  );
  const requestTrade = useCareerStore((s) => s.requestTrade);
  const advancePlayoffBracketRound = useCareerStore(
    (s) => s.advancePlayoffBracketRound
  );
  const batchAdvanceEarlyPlayoffs = useCareerStore(
    (s) => s.batchAdvanceEarlyPlayoffs
  );
  const skipPlayoffsToEnd = useCareerStore((s) => s.skipPlayoffsToEnd);
  const enterOffseasonFromPlayoffs = useCareerStore(
    (s) => s.enterOffseasonFromPlayoffs
  );
  const startFinalsLiveBroadcast = useCareerStore(
    (s) => s.startFinalsLiveBroadcast
  );

  const hasEncounterOutcome = useCareerStore(
    (s) => s.lastEncounterOutcome !== null
  );

  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBracketClimbing, setIsBracketClimbing] = useState(false);
  const [showPersonalCareSheet, setShowPersonalCareSheet] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [standingsConfTab, setStandingsConfTab] = useState<
    'ALL' | 'EAST' | 'WEST'
  >('ALL');
  const [awardRaceTab, setAwardRaceTab] = useState<'MVP' | 'ROY'>('MVP');

  const midSeasonDone = career?.midSeasonEventTriggeredThisYear ?? false;
  const hasPendingEvent = career?.pendingEvent !== null;
  const offseasonLocked = career?.offseasonLocked ?? false;
  const seasonPhase = career?.seasonPhase ?? 'REGULAR_SEASON';

  useEffect(() => {
    if (
      !isSimulating &&
      progress === 50 &&
      midSeasonDone &&
      !hasPendingEvent &&
      !hasEncounterOutcome &&
      !offseasonLocked
    ) {
      const timer = setTimeout(() => {
        setIsSimulating(true);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [
    isSimulating,
    progress,
    midSeasonDone,
    hasPendingEvent,
    hasEncounterOutcome,
    offseasonLocked,
  ]);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 25;

        if (next === 50 && !midSeasonDone) {
          clearInterval(interval);
          setTimeout(() => {
            setIsSimulating(false);
            triggerMidSeasonCrossroads();
          }, 140);
          return 50;
        }

        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsSimulating(false);
            setProgress(100);
            playSeason();
          }, 180);
          return 100;
        }
        return next;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [isSimulating, midSeasonDone, playSeason, triggerMidSeasonCrossroads]);

  if (!career) return null;

  const leagueInfo = LEAGUE_CONFIG[career.league];
  const lastSeason =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const handleStartSeason = () => {
    if (isSimulating || career.offseasonLocked) return;
    setProgress(25);
    setIsSimulating(true);
  };

  const standings = career.currentStandings || [];
  const filteredStandings =
    career.league === 'NBA' && standingsConfTab !== 'ALL'
      ? standings
          .filter(
            (s) => (s.conference || s.team.conference) === standingsConfTab
          )
          .sort(
            (a, b) => (a.conferenceRank || a.rank) - (b.conferenceRank || b.rank)
          )
      : standings;

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

  const canEnterHighStakesLive =
    bracket &&
    !bracket.championTeamId &&
    !bracket.playerEliminated &&
    (bracket.playerReachedFinals || Boolean(bracket.pendingConfFinalsGame7));

  const effectiveCash = getEffectiveCashBalance(career);
  const activeCareCount = (career.activePersonalCare || []).length;
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

  const currentRhythmStep =
    progress >= 100
      ? RHYTHM_LABELS[3]
      : progress >= 75
      ? RHYTHM_LABELS[2]
      : progress >= 50
      ? RHYTHM_LABELS[1]
      : RHYTHM_LABELS[0];

  // 하단 플로팅 CTA 도크 표시 여부
  const showRegularSeasonDock =
    !career.offseasonLocked && seasonPhase === 'REGULAR_SEASON';
  const showPlayoffDock =
    Boolean(bracket) && seasonPhase === 'POSTSEASON_BRACKET';

  return (
    <div className="space-y-3">
      {/* 0. 실시간 결승전 생중계 */}
      {seasonPhase === 'LIVE_FINAL_BROADCAST' && career.liveGame && (
        <LiveGameBroadcast />
      )}

      {/* 1. 포스트시즌 토너먼트 카드 */}
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

      {/* 2. 오프시즌 에이전트 데스크 */}
      {career.offseasonLocked && (
        <section
          data-testid="offseason-agent-desk"
          className="t-card space-y-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                오프시즌
                {career.league === 'HIGH_SCHOOL' && career.prospectStars
                  ? ` · 유망주 ${career.prospectStars}성`
                  : ''}
              </span>
              <h2 className="text-[19px] font-bold tracking-[-0.03em] text-[var(--t-g900)] mt-0.5">
                {career.isOutOfLeagueWarning
                  ? '도착한 계약 오퍼가 없어요'
                  : '다음 시즌 진로 선택'}
              </h2>
            </div>
            <span className="text-[13px] font-bold text-[var(--t-ok)] tabular-nums shrink-0">
              {formatUsdAmount(effectiveCash)}
            </span>
          </div>

          {/* 퍼스널 케어 바텀시트 트리거 행 */}
          <button
            type="button"
            onClick={() => setShowPersonalCareSheet(true)}
            className="w-full min-h-[54px] px-4 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-g200)]/70 flex items-center justify-between gap-3 text-left cursor-pointer t-tap"
          >
            <div className="min-w-0">
              <span className="block text-[14px] font-bold text-[var(--t-g900)]">
                퍼스널 케어 · 에이전시 투자
              </span>
              <span className="block text-[12px] text-[var(--t-g500)]">
                {activeCareCount > 0
                  ? `${activeCareCount}개 적용 중`
                  : '성장 효율 · 부상 방지 · 브랜드 투자'}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
          </button>

          {/* 구단 오퍼 리스트 행 */}
          <div className="divide-y divide-[var(--t-g100)] -mx-2">
            {career.offseasonOptions.map((option: OffseasonOption) => {
              const dirLabel = option.targetTeam
                ? getTeamDirectionLabel(
                    option.targetTeam.direction,
                    option.targetTeam.rating
                  )
                : option.badgeText;
              const roleText = option.promisedRoleLabel || '로테이션';
              const salaryText = formatSalaryOffer(
                option.annualSalary,
                option.contractYears
              );

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.locked}
                  onClick={() => selectOffseasonOption(option)}
                  className={`w-full min-h-[72px] px-2.5 py-3 rounded-2xl text-left flex items-center gap-3 t-tap ${
                    option.locked
                      ? 'opacity-45 cursor-not-allowed'
                      : 'hover:bg-[var(--t-g50)] cursor-pointer'
                  }`}
                >
                  {option.targetTeam ? (
                    <TeamEmblem team={option.targetTeam} size="sm" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)] font-bold text-[12px] flex items-center justify-center shrink-0">
                      GO
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-bold text-[var(--t-g900)] truncate">
                        {option.title}
                      </span>
                      {option.locked && (
                        <Lock className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--t-g500)] truncate tabular-nums">
                      {dirLabel} · {roleText} · {salaryText}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. 시즌 진행 게이지 (시뮬레이션 진행 중일 때만 표시) */}
      {(isSimulating || (progress > 0 && progress < 100 && !career.offseasonLocked)) && (
        <section className="t-card space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold text-[var(--t-g900)]">
              {career.seasonYear}시즌 진행 중
            </span>
            <span className="text-[13px] font-bold text-[var(--t-accent)] tabular-nums">
              {currentRhythmStep} · {progress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--t-g100)] overflow-hidden">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-[var(--t-accent)] rounded-full transition-all duration-150"
            />
          </div>
        </section>
      )}

      {/* 역할 보장 위반 시 긴급 트레이드 요청 행 */}
      {career.brokenRolePromise && (
        <section className="t-card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[14px] font-bold text-[var(--t-up)]">
              출전 시간 보장 미이행
            </span>
            <span className="block text-[12px] text-[var(--t-g600)] mt-0.5">
              타 구단으로 트레이드를 요청할 수 있습니다
            </span>
          </div>
          <button
            type="button"
            disabled={Boolean(career.tradeRequestedThisYear)}
            onClick={requestTrade}
            className={`min-h-[40px] px-3.5 rounded-xl text-[13px] font-bold shrink-0 cursor-pointer t-tap ${
              career.tradeRequestedThisYear
                ? 'bg-[var(--t-g100)] text-[var(--t-g400)] cursor-not-allowed'
                : 'bg-[var(--t-up)] text-white'
            }`}
          >
            {career.tradeRequestedThisYear ? '요청 완료' : '트레이드'}
          </button>
        </section>
      )}

      {/* 4. 직전 시즌 요약 + 언론/팬 반응 피드 + MVP/ROY 레이스 */}
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

            {/* 언론 1면 + 팬 커뮤니티 반응 피드 */}
            <FanReactionFeed career={career} season={lastSeason} />

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

      {/* 퍼스널 케어 바텀시트 */}
      <Modal
        open={showPersonalCareSheet}
        title="퍼스널 케어 · 에이전시"
        subtitle={`보유 자산 ${formatUsdAmount(effectiveCash)}`}
        onClose={() => setShowPersonalCareSheet(false)}
        testId="personal-care-desk"
      >
        <div className="divide-y divide-[var(--t-g100)]">
          {PERSONAL_CARE_ITEMS.map((item) => {
            const isPurchased = (career.activePersonalCare || []).includes(
              item.id
            );
            const allowedInLeague = isPersonalCareAllowedInLeague(
              item.id,
              career.league
            );
            const cost = getPersonalCarePackageCost(item.id, career.league);
            const canAfford = effectiveCash >= cost;

            return (
              <div
                key={item.id}
                className="py-3.5 first:pt-1 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[15px] font-bold text-[var(--t-g900)]">
                    {item.title}
                  </div>
                  <div className="text-[12px] text-[var(--t-g500)]">
                    {allowedInLeague ? item.effect : '프로 리그 진출 시 해금'}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`care-btn-${item.id}`}
                  disabled={isPurchased || !allowedInLeague || !canAfford}
                  onClick={() => purchasePersonalCare(item.id)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-[13px] font-bold whitespace-nowrap shrink-0 cursor-pointer t-tap tabular-nums ${
                    isPurchased
                      ? 'bg-[var(--t-ok-soft)] text-[var(--t-ok)] cursor-default'
                      : !allowedInLeague || !canAfford
                      ? 'bg-[var(--t-g100)] text-[var(--t-g400)] cursor-not-allowed'
                      : 'bg-[var(--t-accent)] text-white'
                  }`}
                >
                  {isPurchased
                    ? '적용됨'
                    : !allowedInLeague
                    ? '잠김'
                    : formatUsdAmount(cost)}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* 상세 기록 & 리그 순위표 바텀시트 */}
      <Modal
        open={showDetailSheet && Boolean(lastSeason)}
        title={lastSeason ? `${lastSeason.year}시즌 상세 기록` : ''}
        subtitle={
          lastSeason
            ? `${leagueInfo.name} · ${lastSeason.wins}승 ${lastSeason.losses}패`
            : undefined
        }
        onClose={() => setShowDetailSheet(false)}
      >
        {lastSeason && (
          <div className="space-y-5">
            <div className="divide-y divide-[var(--t-g100)] text-[14px]">
              {[
                {
                  label: '출전 경기',
                  val:
                    lastSeason.injuredGamesMissed > 0
                      ? `${lastSeason.gp}G (결장 ${lastSeason.injuredGamesMissed}G)`
                      : `${lastSeason.gp}G`,
                },
                { label: '평균 출전', val: `${lastSeason.mpg.toFixed(1)}분` },
                {
                  label: '스틸 / 블록',
                  val: `${lastSeason.spg.toFixed(1)} / ${lastSeason.bpg.toFixed(1)}`,
                },
                { label: '3점 성공률', val: `${lastSeason.tpPct.toFixed(1)}%` },
                {
                  label: '시즌 최다 득점',
                  val: `${lastSeason.singleGameHighPts}점`,
                },
                { label: '시즌 OVR / 역할', val: `${lastSeason.ovr} · ${lastSeason.role}` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <span className="text-[var(--t-g600)]">{row.label}</span>
                  <span className="font-bold text-[var(--t-g900)] tabular-nums">
                    {row.val}
                  </span>
                </div>
              ))}
            </div>

            {lastSeason.narrativeLog.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[13px] font-bold text-[var(--t-g600)]">
                  시즌 노트
                </h4>
                <ul className="space-y-1.5 text-[13px] text-[var(--t-g700)]">
                  {lastSeason.narrativeLog.map((line, idx) => (
                    <li
                      key={idx}
                      className="px-3.5 py-2.5 rounded-xl bg-[var(--t-g100)] leading-snug"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {standings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[14px] font-bold text-[var(--t-g900)]">
                    리그 순위표
                  </h4>
                  {career.league === 'NBA' && (
                    <div className="inline-flex rounded-xl bg-[var(--t-g100)] p-0.5 text-[12px] font-semibold">
                      {(
                        [
                          { id: 'ALL', label: '전체' },
                          { id: 'EAST', label: '동부' },
                          { id: 'WEST', label: '서부' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStandingsConfTab(tab.id)}
                          className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                            standingsConfTab === tab.id
                              ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                              : 'text-[var(--t-g500)]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="divide-y divide-[var(--t-g100)] text-[13px] tabular-nums">
                  {filteredStandings.map((row) => (
                    <div
                      key={row.team.id}
                      className={`py-2.5 px-2 rounded-xl flex items-center justify-between gap-2 ${
                        row.isPlayerTeam
                          ? 'bg-[var(--t-accent-soft)] font-bold text-[var(--t-g900)]'
                          : 'text-[var(--t-g700)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 text-center font-bold text-[var(--t-g500)] shrink-0">
                          {career.league === 'NBA' && standingsConfTab !== 'ALL'
                            ? row.conferenceRank || row.rank
                            : row.rank}
                        </span>
                        <span className="truncate">{row.team.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold">
                          {row.wins}-{row.losses}
                        </span>
                        <span
                          className={`text-[11px] font-bold w-8 text-right ${
                            row.qualifiedPlayoffs
                              ? 'text-[var(--t-accent-ink)]'
                              : 'text-[var(--t-g400)]'
                          }`}
                        >
                          {row.qualifiedPlayoffs ? 'PO' : '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 하단 플로팅 CTA 도크 (탭바 바로 위) */}
      {(showRegularSeasonDock || showPlayoffDock) && (
        <div
          className="fixed bottom-[64px] left-0 right-0 z-30 px-4 pt-3 pb-2 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, var(--t-dock-fade) 68%, transparent)',
          }}
        >
          <div className="max-w-[528px] mx-auto pointer-events-auto">
            {showRegularSeasonDock ? (
              <button
                type="button"
                disabled={isSimulating}
                onClick={handleStartSeason}
                className="t-cta"
              >
                {isSimulating
                  ? `${career.seasonYear}시즌 진행 중 (${progress}%)`
                  : `${career.seasonYear}시즌 시작`}
              </button>
            ) : bracket?.championTeamId ? (
              <button
                type="button"
                data-testid="enter-offseason-from-playoffs-btn"
                disabled={isBracketClimbing}
                onClick={enterOffseasonFromPlayoffs}
                className="t-cta"
              >
                {isBracketClimbing ? '우승팀 집계 중...' : '오프시즌으로 이동'}
              </button>
            ) : canEnterHighStakesLive ? (
              <button
                type="button"
                data-testid="enter-live-finals-btn"
                onClick={startFinalsLiveBroadcast}
                className="t-cta"
              >
                {bracket?.playerReachedFinals
                  ? '파이널 실시간 중계 입장'
                  : '컨퍼런스 파이널 7차전 입장'}
              </button>
            ) : (
              <button
                type="button"
                data-testid="batch-early-playoffs-btn"
                onClick={batchAdvanceEarlyPlayoffs}
                className="t-cta"
              >
                포스트시즌 라운드 진행
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
