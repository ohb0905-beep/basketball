'use client';

import React, { useEffect, useState } from 'react';
import { ChevronRight, Lock, RotateCcw, X, Zap } from 'lucide-react';
import {
  LEAGUE_BALANCE_META,
  canUseProTradeSystem,
  isPersonalCareAllowedInLeague,
} from '../../config/balanceConfig';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { getLeagueRecordChases } from '../../engine/recordBookEngine';
import {
  FRESHMAN_ADAPTATION_CONFIG,
  describeFreshmanAdaptationGoals,
  isNcaaFreshmanSeason,
} from '../../engine/freshmanAdaptation';
import {
  getEffectiveCashBalance,
  getPersonalCarePackageCost,
  useCareerStore,
} from '../../store/useCareerStore';
import {
  AwardRaceEntry,
  InternationalTournamentRecord,
  OffseasonOption,
  PersonalCareId,
  TeamDirection,
} from '../../types/game';
import {
  formatCurrencyDetailed,
  formatSalaryOffer,
} from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { TeamEmblem } from '../common/TeamEmblem';
import { LiveGameBroadcast } from './LiveGameBroadcast';
import { PlayoffBracketLadder } from './PlayoffBracketLadder';

function getTeamDirectionLabel(
  direction?: TeamDirection,
  rating?: number
): string {
  if (direction === 'CONTENDER' || (rating && rating >= 84)) return '우승 도전';
  if (direction === 'PLAYOFF_HUNT' || (rating && rating >= 74)) return 'PO 경쟁';
  return '리빌딩';
}

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

const PERSONAL_CARE_ITEMS: {
  id: PersonalCareId;
  effect: string;
  title: string;
}[] = [
  {
    id: 'BIOMECH_SKILL_LAB',
    effect: '성장 +15% · 노쇠화 -15% 완화',
    title: '바이오메카닉스 스킬 랩',
  },
  {
    id: 'REHAB_LOAD_MGMT',
    effect: '부상률 -48% · 결장 기간 단축',
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
  const recordBook = useCareerStore((s) => s.recordBook);
  const fastSimEnabled = useCareerStore((s) => s.fastSimEnabled);
  const lastPersonalCareIds = useCareerStore((s) => s.lastPersonalCareIds);
  const toggleFastSim = useCareerStore((s) => s.toggleFastSim);
  const playSeason = useCareerStore((s) => s.playSeason);
  const selectOffseasonOption = useCareerStore((s) => s.selectOffseasonOption);
  const purchasePersonalCare = useCareerStore((s) => s.purchasePersonalCare);
  const reapplyLastPersonalCare = useCareerStore(
    (s) => s.reapplyLastPersonalCare
  );
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
  const dismissInternationalSummary = useCareerStore(
    (s) => s.dismissInternationalSummary
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
  const [offseasonTab, setOffseasonTab] = useState<'STAY' | 'TRADE'>('STAY');

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
      if (fastSimEnabled) {
        const timer = setTimeout(() => {
          setProgress(100);
          playSeason();
        }, 40);
        return () => clearTimeout(timer);
      }
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
    fastSimEnabled,
    playSeason,
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
    if (fastSimEnabled) {
      if (!midSeasonDone) {
        setProgress(50);
        triggerMidSeasonCrossroads();
      } else {
        setProgress(100);
        playSeason();
      }
      return;
    }
    setProgress(25);
    setIsSimulating(true);
  };

  const standings = career.currentStandings || [];
  const hasConferenceStandings =
    career.league === 'NBA' ||
    career.league === 'GLEAGUE' ||
    career.league === 'B_LEAGUE';
  const filteredStandings =
    hasConferenceStandings && standingsConfTab !== 'ALL'
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
  const pendingReapplyCareIds = lastPersonalCareIds.filter(
    (id) =>
      !(career.activePersonalCare || []).includes(id) &&
      isPersonalCareAllowedInLeague(id, career.league)
  );
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

  const leagueChases = getLeagueRecordChases(recordBook, career, career.league);
  const featuredChase =
    leagueChases
      .filter((c) => !c.isAlreadyHolder && c.progressPct >= 55)
      .sort((a, b) => b.progressPct - a.progressPct)[0] ||
    leagueChases.find((c) => c.isAlreadyHolder) ||
    null;

  const currentRhythmStep =
    progress >= 100
      ? RHYTHM_LABELS[3]
      : progress >= 75
      ? RHYTHM_LABELS[2]
      : progress >= 50
      ? RHYTHM_LABELS[1]
      : RHYTHM_LABELS[0];

  // 다년 프로 계약 잔여 중 여부 판정 ('소속팀 잔류' vs '트레이드 요청' 2탭 분리)
  const isProLeague = LEAGUE_BALANCE_META[career.league].isPro;
  const stayOption = career.offseasonOptions.find(
    (o) => o.id === 'OPT_STAY_CURRENT_CONTRACT' && o.actionType === 'STAY_TEAM'
  );
  const contenderPathOptions = career.offseasonOptions.filter(
    (o) => o.contenderPath
  );
  const tradeOptions = career.offseasonOptions.filter(
    (o) => o.actionType === 'REQUEST_TRADE' && !o.contenderPath
  );
  const auxiliaryContractOptions = career.offseasonOptions.filter(
    (o) =>
      o.id !== 'OPT_STAY_CURRENT_CONTRACT' &&
      o.actionType !== 'REQUEST_TRADE'
  );
  const listedOffseasonOptions = career.offseasonOptions.filter(
    (o) => !o.contenderPath
  );
  const isUnderActiveProContract =
    isProLeague &&
    career.contractYearsLeft > 0 &&
    career.militaryServiceSeasonsLeft === 0 &&
    career.contractType !== 'TWO_WAY' &&
    Boolean(stayOption);
  const activeContractTab: 'STAY' | 'TRADE' =
    tradeOptions.length === 0 ? 'STAY' : offseasonTab;

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

      {/* 1.5 국제대회 결과 요약 카드 */}
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

      {/* 2. 오프시즌 에이전트 데스크 */}
      {career.offseasonLocked && (
        <section
          data-testid="offseason-agent-desk"
          className="t-card space-y-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                {isUnderActiveProContract
                  ? `오프시즌 · 기존 계약 잔여 ${career.contractYearsLeft}년`
                  : isProLeague &&
                    career.contractYearsLeft === 0 &&
                    career.militaryServiceSeasonsLeft === 0
                  ? '오프시즌 · FA 계약 만료'
                  : '오프시즌'}
                {career.league === 'HIGH_SCHOOL' && career.prospectStars
                  ? ` · 유망주 ${career.prospectStars}성`
                  : ''}
              </span>
              <h2 className="text-[19px] font-bold tracking-[-0.03em] text-[var(--t-g900)] mt-0.5">
                {career.isOutOfLeagueWarning
                  ? '도착한 계약 오퍼가 없습니다'
                  : isUnderActiveProContract
                  ? activeContractTab === 'STAY'
                    ? '현 소속팀 잔류 · 시즌 준비'
                    : '계약 중 트레이드 요청'
                  : isProLeague &&
                    career.contractYearsLeft === 0 &&
                    career.militaryServiceSeasonsLeft === 0
                  ? 'FA 시장 · 계약 협상'
                  : '다음 시즌 진로 선택'}
              </h2>
            </div>
            <span className="text-[13px] font-bold text-[var(--t-ok)] tabular-nums shrink-0">
              {formatCurrencyDetailed(effectiveCash)}
            </span>
          </div>

          {/* 퍼스널 케어 바텀시트 트리거 + 원탭 재적용 */}
          <div className="space-y-2">
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

            {pendingReapplyCareIds.length > 0 && (
              <button
                type="button"
                data-testid="reapply-personal-care-btn"
                onClick={reapplyLastPersonalCare}
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)] text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer t-tap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  이전 시즌 퍼스널 케어 {pendingReapplyCareIds.length}건 원탭 재적용
                </span>
              </button>
            )}
          </div>

          {/* 우승 도전팀 이적 요청 (PO 연속 실패 NBA 에이스 전용) */}
          {contenderPathOptions.length > 0 && (
            <div
              data-testid="contender-path-card"
              className="p-4 rounded-2xl bg-[var(--t-accent-soft)] space-y-3"
            >
              <div className="space-y-1">
                <span className="block text-[12px] font-bold text-[var(--t-accent-ink)]">
                  우승 도전팀 이적 요청
                </span>
                <p className="text-[13px] text-[var(--t-g700)] leading-relaxed">
                  {career.team.shortName}에서 플레이오프에 연속으로 실패했습니다. 우승 도전팀으로 옮기면
                  2옵션 주전으로 뛰게 되어 출전 시간과 MVP 기회는 줄지만 반지에 가까워집니다.
                  요청은 오프시즌에 한 번만 할 수 있습니다.
                </p>
              </div>
              <div className="divide-y divide-[var(--t-g200)]/60 -mx-1.5">
                {contenderPathOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    data-testid="contender-path-option"
                    disabled={option.locked}
                    onClick={() => selectOffseasonOption(option)}
                    className={`w-full min-h-[64px] px-1.5 py-2.5 text-left flex items-center gap-3 t-tap ${
                      option.locked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {option.targetTeam && <TeamEmblem team={option.targetTeam} size="sm" />}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="block text-[15px] font-bold text-[var(--t-g900)] truncate">
                        {option.targetTeam?.name ?? option.title}
                      </span>
                      <span className="block text-[12px] text-[var(--t-g600)] truncate tabular-nums">
                        {option.locked
                          ? option.lockReason
                          : option.isExistingContract
                          ? `수락 예상 ${option.tradeAcceptChancePct ?? 0}% · 2옵션 주전 · 잔여 계약 승계`
                          : `수락 예상 ${option.tradeAcceptChancePct ?? 0}% · 2옵션 주전 · ${formatSalaryOffer(
                              option.annualSalary,
                              option.contractYears
                            )}`}
                      </span>
                    </div>
                    {option.locked ? (
                      <Lock className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 다년 계약 잔여 중: '소속팀 잔류' | '트레이드 요청' 전용 2탭 */}
          {isUnderActiveProContract && stayOption ? (
            <div className="space-y-3">
              {tradeOptions.length > 0 && (
                <div
                  data-testid="offseason-contract-tabs"
                  className="grid grid-cols-2 rounded-2xl bg-[var(--t-g100)] p-1 text-[13px] font-bold"
                >
                  <button
                    type="button"
                    data-testid="offseason-tab-stay"
                    onClick={() => setOffseasonTab('STAY')}
                    className={`min-h-[40px] rounded-xl transition cursor-pointer ${
                      activeContractTab === 'STAY'
                        ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                        : 'text-[var(--t-g500)] hover:text-[var(--t-g800)]'
                    }`}
                  >
                    현 소속팀 잔류
                  </button>
                  <button
                    type="button"
                    data-testid="offseason-tab-trade"
                    onClick={() => setOffseasonTab('TRADE')}
                    className={`min-h-[40px] rounded-xl transition cursor-pointer ${
                      activeContractTab === 'TRADE'
                        ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                        : 'text-[var(--t-g500)] hover:text-[var(--t-g800)]'
                    }`}
                  >
                    트레이드 요청
                    {career.tradeRequestedThisYear
                      ? ' (반려)'
                      : ` (${tradeOptions.length})`}
                  </button>
                </div>
              )}

              {activeContractTab === 'STAY' ? (
                <div
                  data-testid="offseason-stay-panel"
                  className="space-y-3"
                >
                  <div className="p-4 rounded-2xl bg-[var(--t-g100)] space-y-3">
                    <div className="flex items-center gap-3">
                      <TeamEmblem team={career.team} size="md" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-[var(--t-accent-ink)]">
                          기존 계약 유지 · 재계약 없음
                        </span>
                        <span className="block text-[16px] font-bold text-[var(--t-g900)] truncate">
                          {career.team.name}
                        </span>
                        <span className="block text-[12px] text-[var(--t-g600)] tabular-nums mt-0.5">
                          연 {formatCurrencyDetailed(career.annualSalary)} · 잔여{' '}
                          {career.contractYearsLeft}년 ·{' '}
                          {stayOption.promisedRoleLabel || '로테이션'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[12px] text-[var(--t-g600)] leading-relaxed">
                      남은 계약 기간 동안 타 구단 FA 협상 없이 기존 조건으로 다음
                      시즌을 이어갑니다.
                    </p>

                    <button
                      type="button"
                      data-testid="confirm-stay-contract-btn"
                      onClick={() => {
                        setOffseasonTab('STAY');
                        selectOffseasonOption(stayOption);
                      }}
                      className="t-cta w-full"
                    >
                      잔여 계약으로 다음 시즌 시작 (잔여 {career.contractYearsLeft}년)
                    </button>
                  </div>

                  {auxiliaryContractOptions.length > 0 && (
                    <div className="divide-y divide-[var(--t-g100)] border-t border-[var(--t-g100)] pt-1 -mx-2">
                      {auxiliaryContractOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => selectOffseasonOption(option)}
                          className="w-full min-h-[64px] px-2.5 py-2.5 rounded-2xl text-left flex items-center justify-between gap-3 hover:bg-[var(--t-g50)] cursor-pointer t-tap"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <span className="block text-[14px] font-bold text-[var(--t-g900)] truncate">
                              {option.title}
                            </span>
                            <span className="block text-[12px] text-[var(--t-g500)] truncate">
                              {option.subtitle}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  data-testid="offseason-trade-panel"
                  className="space-y-3"
                >
                  <p className="text-[12px] text-[var(--t-g600)] bg-[var(--t-g100)] rounded-2xl px-3.5 py-2.5 leading-relaxed">
                    {career.tradeRequestedThisYear
                      ? '이번 오프시즌 트레이드 요청이 구단에 의해 반려되었습니다. 현 소속팀 잔류 탭에서 기존 계약으로 시즌을 시작해 주세요.'
                      : '원하는 행선지 구단을 선택해 프런트에 트레이드를 요청합니다. 구단 심사 결과에 따라 성사되거나 반려될 수 있습니다 (오프시즌 1회).'}
                  </p>

                  <div className="divide-y divide-[var(--t-g100)] -mx-2">
                    {tradeOptions.map((option: OffseasonOption) => {
                      const dirLabel = option.targetTeam
                        ? getTeamDirectionLabel(
                            option.targetTeam.direction,
                            option.targetTeam.rating
                          )
                        : option.badgeText;
                      const roleText = option.promisedRoleLabel || '로테이션';
                      const chanceText =
                        option.tradeAcceptChancePct !== undefined
                          ? `승인 예상 ${option.tradeAcceptChancePct}%`
                          : '구단 심사';

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
                              TR
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
                              {dirLabel} · {roleText} · {chanceText}
                            </p>
                          </div>

                          <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 계약 만료(FA) / 아마추어 / 투웨이 / 상무: 오퍼 리스트 행 */
            <div className="divide-y divide-[var(--t-g100)] -mx-2">
              {listedOffseasonOptions.map((option: OffseasonOption) => {
                const dirLabel = option.targetTeam
                  ? getTeamDirectionLabel(
                      option.targetTeam.direction,
                      option.targetTeam.rating
                    )
                  : option.badgeText;
                const roleText = option.promisedRoleLabel || '로테이션';
                const salaryText = formatSalaryOffer(
                  option.annualSalary,
                  option.contractYears,
                  { isExistingContract: option.isExistingContract }
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
          )}
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

      {/* 시즌 진행 옵션 바 (빠른 진행 토글) */}
      {showRegularSeasonDock && (
        <section className="t-card py-3 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Zap
              className={`w-4 h-4 shrink-0 ${
                fastSimEnabled ? 'text-[var(--t-accent)]' : 'text-[var(--t-g400)]'
              }`}
            />
            <div className="min-w-0">
              <span className="block text-[13px] font-bold text-[var(--t-g900)]">
                빠른 시즌 진행
              </span>
              <span className="block text-[11px] text-[var(--t-g500)] truncate">
                중간 분기점만 정지하고 대기 연출 생략
              </span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={fastSimEnabled}
            data-testid="fast-sim-toggle"
            onClick={toggleFastSim}
            className={`min-h-[44px] px-1 flex items-center cursor-pointer shrink-0`}
            aria-label="빠른 시즌 진행 전환"
          >
            <span
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                fastSimEnabled ? 'bg-[var(--t-accent)] justify-end' : 'bg-[var(--t-g200)] justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
            </span>
          </button>
        </section>
      )}

      {/* 역대 리그 기록 추격 카드 */}
      {featuredChase && seasonPhase !== 'LIVE_FINAL_BROADCAST' && (
        <section
          data-testid="record-chase-card"
          className="t-card space-y-2.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
              {leagueInfo.shortName} 역대 기록{' '}
              {featuredChase.isAlreadyHolder ? '보유 중' : '추격'}
            </span>
            <span className="text-[12px] font-bold text-[var(--t-g500)] tabular-nums">
              {featuredChase.progressPct}%
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[15px] font-bold text-[var(--t-g900)] truncate">
              {featuredChase.entry.label}
            </span>
            <span className="text-[13px] font-bold text-[var(--t-g900)] tabular-nums shrink-0">
              {featuredChase.entry.unit === '점' || featuredChase.entry.unit === '회'
                ? `${featuredChase.currentValue.toLocaleString()} / ${featuredChase.entry.value.toLocaleString()}${featuredChase.entry.unit}`
                : `${featuredChase.currentValue.toFixed(1)} / ${featuredChase.entry.value.toFixed(1)} ${featuredChase.entry.unit}`}
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-[var(--t-g100)] overflow-hidden">
            <div
              style={{ width: `${featuredChase.progressPct}%` }}
              className={`h-full rounded-full transition-all duration-300 ${
                featuredChase.isAlreadyHolder
                  ? 'bg-[var(--t-gold)]'
                  : 'bg-[var(--t-accent)]'
              }`}
            />
          </div>

          <p className="text-[12px] text-[var(--t-g500)] truncate">
            {featuredChase.isAlreadyHolder
              ? `${featuredChase.entry.year}년 수립 · 리그 역대 1위 보유`
              : `역대 1위 ${featuredChase.entry.holderName} (${featuredChase.entry.teamName}, ${featuredChase.entry.year})`}
          </p>
        </section>
      )}

      {/* NCAA 신입 적응 목표 (NCAA 첫 시즌 진행 전 / 직후 결과) */}
      {isNcaaFreshmanSeason(career) &&
        !career.offseasonLocked &&
        seasonPhase === 'REGULAR_SEASON' && (
          <section data-testid="freshman-goal-card" className="t-card space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                NCAA 신입 적응
              </span>
              <span className="text-[12px] font-semibold text-[var(--t-g500)]">
                목표당 스카우트 주가 +{FRESHMAN_ADAPTATION_CONFIG.stockBonusPerGoal}
              </span>
            </div>
            <ul className="space-y-1.5">
              {describeFreshmanAdaptationGoals().map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-2 text-[14px] font-semibold text-[var(--t-g900)]"
                >
                  <span className="w-4 h-4 rounded-full border-2 border-[var(--t-g300)] shrink-0" />
                  {g.label}
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-[var(--t-g500)]">
              시즌이 끝나면 신인왕 레이스 순위와 함께 결과가 공개됩니다.
            </p>
          </section>
        )}
      {lastSeason?.freshmanAdaptation && (
          <section data-testid="freshman-goal-result" className="t-card space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                NCAA 신입 적응 결과
              </span>
              <span className="text-[12px] font-bold text-[var(--t-g700)] tabular-nums">
                {lastSeason.freshmanAdaptation.achievedCount}/
                {lastSeason.freshmanAdaptation.goals.length} 달성
                {lastSeason.freshmanAdaptation.draftStockBonus > 0
                  ? ` · 주가 +${lastSeason.freshmanAdaptation.draftStockBonus}`
                  : ''}
              </span>
            </div>
            <ul className="space-y-1.5">
              {lastSeason.freshmanAdaptation.goals.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2">
                  <span
                    className={`flex items-center gap-2 text-[14px] font-semibold ${
                      g.achieved ? 'text-[var(--t-g900)]' : 'text-[var(--t-g500)]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full shrink-0 ${
                        g.achieved
                          ? 'bg-[var(--t-accent)]'
                          : 'border-2 border-[var(--t-g300)]'
                      }`}
                    />
                    {g.label}
                  </span>
                  <span className="text-[12px] text-[var(--t-g500)] tabular-nums shrink-0">
                    {g.detail}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

      {/* 역할 보장 위반 시 긴급 트레이드 요청 행 (프로 비군인 계약 전용) */}
      {career.brokenRolePromise &&
        canUseProTradeSystem({
          league: career.league,
          contractType: career.contractType,
          isMilitaryTeam: career.team.isMilitaryTeam,
          teamId: career.team.id,
        }) && (
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
            className={`min-h-[44px] px-4 rounded-xl text-[13px] font-bold shrink-0 cursor-pointer t-tap ${
              career.tradeRequestedThisYear
                ? 'bg-[var(--t-g100)] text-[var(--t-g400)] cursor-not-allowed'
                : 'bg-[var(--t-up)] text-white'
            }`}
          >
            {career.tradeRequestedThisYear ? '요청 완료' : '트레이드'}
          </button>
        </section>
      )}

      {/* 4. 직전 시즌 요약 + MVP/ROY 레이스 */}
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

      {/* 퍼스널 케어 바텀시트 */}
      <Modal
        open={showPersonalCareSheet}
        title="퍼스널 케어 · 에이전시"
        subtitle={`보유 자산 ${formatCurrencyDetailed(effectiveCash)}`}
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
                  className={`min-h-[44px] px-4 rounded-xl text-[13px] font-bold whitespace-nowrap shrink-0 cursor-pointer t-tap tabular-nums ${
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
                    : formatCurrencyDetailed(cost)}
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
                      ? `${lastSeason.gp}G (${
                          lastSeason.injurySeverity === 'MAJOR'
                            ? '장기 중상'
                            : lastSeason.injurySeverity === 'MODERATE'
                            ? '중등도 부상'
                            : '경미한 부상'
                        }${lastSeason.injuryLabel ? ` · ${lastSeason.injuryLabel}` : ''} ${
                          lastSeason.injuredGamesMissed
                        }G 결장)`
                      : `${lastSeason.gp}G`,
                },
                ...(lastSeason.injuryPermanentPhyPenalty &&
                lastSeason.injuryPermanentPhyPenalty > 0
                  ? [
                      {
                        label: '중상 후유증',
                        val: `PHY -${lastSeason.injuryPermanentPhyPenalty}${
                          lastSeason.age >= 34 ? ', DEF -1' : ''
                        } 영구 저하`,
                      },
                    ]
                  : []),
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
                  {hasConferenceStandings && (
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
                          {hasConferenceStandings && standingsConfTab !== 'ALL'
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
                            row.playInQualified
                              ? 'text-[var(--t-gold)]'
                              : row.qualifiedPlayoffs
                              ? 'text-[var(--t-accent-ink)]'
                              : 'text-[var(--t-g400)]'
                          }`}
                        >
                          {row.playInQualified
                            ? 'PI'
                            : row.qualifiedPlayoffs
                            ? 'PO'
                            : '-'}
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
                {bracket?.stageType === 'PLAY_IN_ROUND_1' ||
                bracket?.stageType === 'PLAY_IN_DECIDER'
                  ? '플레이인 토너먼트 진행'
                  : '포스트시즌 라운드 진행'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
