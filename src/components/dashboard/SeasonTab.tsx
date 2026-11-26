'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import {
  canUseProTradeSystem,
} from '../../config/balanceConfig';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { getLeagueRecordChases } from '../../engine/recordBookEngine';
import {
  getDecisiveGameContext,
  getPlayerFinalsSeries,
} from '../../engine/finalsSeries';
import {
  FRESHMAN_ADAPTATION_CONFIG,
  describeFreshmanAdaptationGoals,
  isNcaaFreshmanSeason,
} from '../../engine/freshmanAdaptation';
import {
  useCareerStore,
} from '../../store/useCareerStore';
import { LiveGameBroadcast } from './LiveGameBroadcast';
import { PostseasonCard } from './season/PostseasonCard';
import { InternationalSummaryCard } from './season/InternationalSummaryCard';
import { OffseasonAgentDesk } from './season/OffseasonAgentDesk';
import { LastSeasonSummary } from './season/LastSeasonSummary';
import { PersonalCareSheet } from './season/PersonalCareSheet';
import { SeasonDetailSheet } from './season/SeasonDetailSheet';

const RHYTHM_LABELS = ['전반기', '올스타 브레이크', '후반기', '최종 집계'];

export function SeasonTab() {
  const career = useCareerStore((s) => s.career);
  const recordBook = useCareerStore((s) => s.recordBook);
  const fastSimEnabled = useCareerStore((s) => s.fastSimEnabled);
  const toggleFastSim = useCareerStore((s) => s.toggleFastSim);
  const playSeason = useCareerStore((s) => s.playSeason);
  const triggerMidSeasonCrossroads = useCareerStore(
    (s) => s.triggerMidSeasonCrossroads
  );
  const requestTrade = useCareerStore((s) => s.requestTrade);
  const batchAdvanceEarlyPlayoffs = useCareerStore(
    (s) => s.batchAdvanceEarlyPlayoffs
  );
  const enterOffseasonFromPlayoffs = useCareerStore(
    (s) => s.enterOffseasonFromPlayoffs
  );
  const startFinalsLiveBroadcast = useCareerStore(
    (s) => s.startFinalsLiveBroadcast
  );
  const advanceFinalsToDecisiveGame = useCareerStore(
    (s) => s.advanceFinalsToDecisiveGame
  );

  const hasEncounterOutcome = useCareerStore(
    (s) => s.lastEncounterOutcome !== null
  );

  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBracketClimbing, setIsBracketClimbing] = useState(false);
  const [showPersonalCareSheet, setShowPersonalCareSheet] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

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

    // 업데이터는 순수하게 유지 (StrictMode에서 두 번 불려도 부수효과가 없도록). 시즌 중간·끝 처리는 아래 effect가 합니다.
    const cap = midSeasonDone ? 100 : 50;
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 25, cap));
    }, 180);

    return () => clearInterval(interval);
  }, [isSimulating, midSeasonDone]);

  useEffect(() => {
    if (!isSimulating) return;

    if (progress === 50 && !midSeasonDone) {
      const timer = setTimeout(() => {
        setIsSimulating(false);
        triggerMidSeasonCrossroads();
      }, 140);
      return () => clearTimeout(timer);
    }

    if (progress >= 100) {
      const timer = setTimeout(() => {
        setIsSimulating(false);
        setProgress(100);
        playSeason();
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isSimulating, progress, midSeasonDone, playSeason, triggerMidSeasonCrossroads]);

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

  const bracket = career.playoffBracket;

  const finalsOpen =
    bracket && !bracket.championTeamId && !bracket.playerEliminated;
  // 결승 진출 직후에는 시리즈 시작, 결정전 대기 중이면 라이브 중계 입장
  const canStartFinalsSeries =
    finalsOpen && bracket.playerReachedFinals && !bracket.pendingFinalsLiveGame;
  const canEnterHighStakesLive =
    finalsOpen &&
    (bracket.playerReachedFinals
      ? Boolean(bracket.pendingFinalsLiveGame)
      : Boolean(bracket.pendingConfFinalsGame7));
  const finalsSeries = bracket ? getPlayerFinalsSeries(bracket) : null;
  const finalsGameNo = finalsSeries
    ? getDecisiveGameContext(finalsSeries, career.team.id)?.gameNo ?? 1
    : 1;
  // 단판 결승은 결정전 대기 없이 바로 라이브 중계로 들어갑니다.
  const isSingleGameFinals = finalsSeries?.bestOf === 1;
  const enterSingleGameFinals = () => {
    advanceFinalsToDecisiveGame();
    startFinalsLiveBroadcast();
  };

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
      <PostseasonCard career={career} isBracketClimbing={isBracketClimbing} setIsBracketClimbing={setIsBracketClimbing} />

      {/* 1.5 국제대회 결과 요약 카드 */}
      <InternationalSummaryCard career={career} />

      {/* 2. 오프시즌 에이전트 데스크 */}
      <OffseasonAgentDesk career={career} setShowPersonalCareSheet={setShowPersonalCareSheet} />

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
      <LastSeasonSummary career={career} setShowDetailSheet={setShowDetailSheet} />

      {/* 퍼스널 케어 바텀시트 */}
      <PersonalCareSheet career={career} showPersonalCareSheet={showPersonalCareSheet} setShowPersonalCareSheet={setShowPersonalCareSheet} />

      {/* 상세 기록 & 리그 순위표 바텀시트 */}
      <SeasonDetailSheet career={career} showDetailSheet={showDetailSheet} setShowDetailSheet={setShowDetailSheet} />

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
            ) : canStartFinalsSeries ? (
              <button
                type="button"
                data-testid="start-finals-series-btn"
                onClick={isSingleGameFinals ? enterSingleGameFinals : advanceFinalsToDecisiveGame}
                className="t-cta"
              >
                {isSingleGameFinals ? '파이널 실시간 중계 입장' : '파이널 시리즈 시작'}
              </button>
            ) : canEnterHighStakesLive ? (
              <button
                type="button"
                data-testid="enter-live-finals-btn"
                onClick={startFinalsLiveBroadcast}
                className="t-cta"
              >
                {bracket?.playerReachedFinals
                  ? `파이널 ${finalsGameNo}차전 실시간 중계 입장`
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

