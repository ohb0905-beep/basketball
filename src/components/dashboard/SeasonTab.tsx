'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FastForward,
  Lock,
  Newspaper,
  Play,
  Radio,
  Sparkles,
  Star,
  Swords,
  Trophy,
} from 'lucide-react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import {
  getPersonalCarePackageCost,
  useCareerStore,
} from '../../store/useCareerStore';
import {
  AwardRaceEntry,
  OffseasonOption,
  PersonalCareId,
  TeamDirection,
} from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';
import { LiveGameBroadcast } from './LiveGameBroadcast';

function formatSalaryOffer(amountUsd?: number, years?: number): string {
  if (!amountUsd || amountUsd <= 0) {
    return years && years > 0 ? `학생/아마추어 (${years}년)` : '비계약 진로';
  }
  const yearSuffix = years && years > 0 ? ` (${years}년)` : '';
  if (amountUsd >= 1000000) {
    return `연봉 $${(amountUsd / 1000000).toFixed(2)}M${yearSuffix}`;
  }
  if (amountUsd >= 1000) {
    return `연봉 $${Math.round(amountUsd / 1000).toLocaleString()}K${yearSuffix}`;
  }
  return `연봉 $${amountUsd.toLocaleString()}${yearSuffix}`;
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

function getTeamDirectionBadge(direction?: TeamDirection, rating?: number): {
  label: string;
  className: string;
} {
  if (direction === 'CONTENDER' || (rating && rating >= 84)) {
    return {
      label: '🏆 우승 도전',
      className: 'bg-amber-50 border-amber-200 text-amber-800',
    };
  }
  if (direction === 'PLAYOFF_HUNT' || (rating && rating >= 74)) {
    return {
      label: '🔥 플레이오프 경쟁',
      className: 'bg-orange-50 border-orange-200 text-orange-700',
    };
  }
  return {
    label: '🌱 리빌딩 · 육성 중심',
    className: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
}

const PERSONAL_CARE_ITEMS: {
  id: PersonalCareId;
  badge: string;
  title: string;
  desc: string;
}[] = [
  {
    id: 'BIOMECH_SKILL_LAB',
    badge: '🧬 성장 +15% · 노쇠화 완화',
    title: '전담 바이오메카닉스 & 스킬 랩',
    desc: '다음 시즌 훈련 성장 효율이 15% 상승하고, 30대 이후 에이징 커브 하락폭을 22% 완화해요.',
  },
  {
    id: 'REHAB_LOAD_MGMT',
    badge: '🏥 부상률 -70% · 유리몸 상쇄',
    title: '전담 재활 & 로드 매니지먼트 팀',
    desc: '전담 트레이너가 동행해 시즌 부상 확률과 결장 경기 수를 대폭 줄이고 유리몸 페널티를 막아줘요.',
  },
  {
    id: 'SIGNATURE_SNEAKER_MARKETING',
    badge: '👟 스카우트 주가↑ · 레거시 보너스',
    title: '글로벌 마케팅 & 시그니처 스니커즈 런칭',
    desc: '자신만의 시그니처 농구화를 출시해 주가(+7)를 높이고 은퇴 시 영구 레거시 점수를 추가 획득해요.',
  },
];

const RHYTHM_STAGES = [
  {
    threshold: 25,
    tag: '전반기 흐름',
    text: '전반기 로테이션 경쟁 속에서 출전 시간을 늘리며 팀 전술에 녹아들고 있어요!',
  },
  {
    threshold: 50,
    tag: '올스타 브레이크',
    text: '시즌 반환점인 올스타 브레이크를 지나며 체력과 슛 밸런스를 가다듬고 있어요!',
  },
  {
    threshold: 75,
    tag: '후반기 순위 경쟁',
    text: '후반기 플레이오프 시드 확보를 위해 매 경기 치열한 순위 싸움을 펼치고 있어요!',
  },
];

export function SeasonTab() {
  const career = useCareerStore((s) => s.career);
  const playSeason = useCareerStore((s) => s.playSeason);
  const selectOffseasonOption = useCareerStore((s) => s.selectOffseasonOption);
  const purchasePersonalCare = useCareerStore((s) => s.purchasePersonalCare);
  const triggerMidSeasonCrossroads = useCareerStore((s) => s.triggerMidSeasonCrossroads);
  const requestTrade = useCareerStore((s) => s.requestTrade);
  const advancePlayoffBracketRound = useCareerStore((s) => s.advancePlayoffBracketRound);
  const batchAdvanceEarlyPlayoffs = useCareerStore((s) => s.batchAdvanceEarlyPlayoffs);
  const skipPlayoffsToEnd = useCareerStore((s) => s.skipPlayoffsToEnd);
  const startFinalsLiveBroadcast = useCareerStore((s) => s.startFinalsLiveBroadcast);

  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDetailedBoxAndStandings, setShowDetailedBoxAndStandings] = useState(false);
  const [showFullPlayoffBracket, setShowFullPlayoffBracket] = useState(false);
  const [standingsConfTab, setStandingsConfTab] = useState<'ALL' | 'EAST' | 'WEST'>('ALL');
  const [awardRaceTab, setAwardRaceTab] = useState<'MVP' | 'ROY'>('MVP');
  const [statusMessage, setStatusMessage] = useState(
    '시즌 개막 준비가 끝났어요. 버튼을 눌러 이번 시즌 코트로 나서 보세요!'
  );

  const midSeasonDone = career?.midSeasonEventTriggeredThisYear ?? false;
  const hasPendingEvent = career?.pendingEvent !== null;
  const offseasonLocked = career?.offseasonLocked ?? false;
  const seasonPhase = career?.seasonPhase ?? 'REGULAR_SEASON';

  // 전반기 50% 반환점 모달 선택 완료 후 자동으로 후반기(50% -> 100%) 재개
  useEffect(() => {
    if (
      !isSimulating &&
      progress === 50 &&
      midSeasonDone &&
      !hasPendingEvent &&
      !offseasonLocked
    ) {
      const timer = setTimeout(() => {
        setIsSimulating(true);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isSimulating, progress, midSeasonDone, hasPendingEvent, offseasonLocked]);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 25;
        if (next === 25) {
          setStatusMessage(RHYTHM_STAGES[0].text);
        } else if (next === 50) {
          setStatusMessage(RHYTHM_STAGES[1].text);
        } else if (next === 75) {
          setStatusMessage(RHYTHM_STAGES[2].text);
        } else {
          setStatusMessage('정규시즌 최종전 종료! 시즌 기록과 순위를 집계하고 있어요...');
        }

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
    setStatusMessage(RHYTHM_STAGES[0].text);
    setIsSimulating(true);
  };

  const standings = career.currentStandings || [];
  const filteredStandings =
    career.league === 'NBA' && standingsConfTab !== 'ALL'
      ? standings
          .filter((s) => (s.conference || s.team.conference) === standingsConfTab)
          .sort((a, b) => (a.conferenceRank || a.rank) - (b.conferenceRank || b.rank))
      : standings;

  const bracket = career.playoffBracket;
  const championEntry =
    bracket?.championTeamId
      ? standings.find((s) => s.team.id === bracket.championTeamId)
      : null;

  // 내 소속팀의 현재 플레이오프 시리즈 매치업 추출
  const activeRoundSeries =
    bracket && bracket.rounds.length > 0
      ? bracket.rounds[bracket.currentRound - 1] || bracket.rounds[bracket.rounds.length - 1]
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

  // 이미 종료된 내 소속팀의 이전 라운드 시리즈 요약 추출
  const myCompletedSeriesList = bracket
    ? bracket.rounds
        .flat()
        .filter((m) => m.involvesPlayer && Boolean(m.winnerId))
    : [];

  const canEnterHighStakesLive =
    bracket &&
    !bracket.championTeamId &&
    !bracket.playerEliminated &&
    (bracket.playerReachedFinals ||
      (bracket.league === 'NBA' && bracket.currentRound === 3));

  const activeAwardRace: AwardRaceEntry[] | undefined =
    awardRaceTab === 'ROY' && lastSeason?.royRace
      ? lastSeason.royRace
      : lastSeason?.mvpRace;
  const activeAwardNarrative: string | undefined =
    awardRaceTab === 'ROY' && lastSeason?.royRaceNarrative
      ? lastSeason.royRaceNarrative
      : lastSeason?.mvpRaceNarrative;

  return (
    <div className="space-y-5">
      {/* 0. 실시간 결승전 쿼터별 생중계 모드 */}
      {seasonPhase === 'LIVE_FINAL_BROADCAST' && career.liveGame && (
        <LiveGameBroadcast />
      )}

      {/* 1. 플레이오프 돌입 시: 내 소속팀 현재 시리즈 매치업 포커스 카드 */}
      {bracket && bracket.rounds.length > 0 && seasonPhase !== 'LIVE_FINAL_BROADCAST' && (
        <section
          data-testid="playoff-bracket-section"
          className="bg-white border-2 border-indigo-500 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-600">
                <Swords className="w-4 h-4" />
                <span>{leagueInfo.name} 포스트시즌 토너먼트</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                {championEntry
                  ? `🏆 최종 우승: ${championEntry.team.name} (내 성적: ${bracket.playoffResultLabel})`
                  : bracket.playerReachedFinals
                  ? '🔥 파이널 결승 진출! 실시간 중계로 우승 반지에 도전해 보세요!'
                  : `${myCurrentSeries?.roundLabel || `${bracket.currentRound}라운드`} · 내 소속팀 매치업`}
              </h3>
            </div>
          </div>

          {/* 초반 라운드 일괄 통과 요약 뱃지 */}
          {myCompletedSeriesList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {myCompletedSeriesList.map((s) => {
                const won = s.winnerId === career.team.id;
                const hiW = Math.max(s.higherSeedWins, s.lowerSeedWins);
                const loW = Math.min(s.higherSeedWins, s.lowerSeedWins);
                const opp =
                  s.higherSeed.team.id === career.team.id
                    ? s.lowerSeed.team.shortName
                    : s.higherSeed.team.shortName;
                return (
                  <span
                    key={s.id}
                    className={`px-3 py-1 rounded-xl border text-xs font-extrabold ${
                      won
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {s.roundLabel}: vs {opp} ({hiW}승 {loW}패 {won ? '통과' : '탈락'})
                  </span>
                );
              })}
            </div>
          )}

          {/* 내 소속팀 현재 시리즈 매치업 강조 카드 */}
          {myCurrentSeries && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>
                  {myCurrentSeries.roundLabel} ({myCurrentSeries.bestOf}전 {myCurrentSeries.winsNeeded}선승제)
                </span>
                <span className="text-indigo-600 font-extrabold">
                  {myCurrentSeries.involvesPlayer ? '내 소속팀 시리즈' : '주목 매치업'}
                </span>
              </div>

              <div className="grid grid-cols-3 items-center text-center gap-2">
                <div className="flex flex-col items-center gap-1.5">
                  <TeamEmblem team={myCurrentSeries.higherSeed.team} size="md" />
                  <span className="text-xs font-extrabold text-slate-900 truncate max-w-full">
                    #{myCurrentSeries.higherSeed.conferenceRank || myCurrentSeries.higherSeed.rank}{' '}
                    {myCurrentSeries.higherSeed.team.name}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                    {myCurrentSeries.higherSeedWins} : {myCurrentSeries.lowerSeedWins}
                  </div>
                  <span className="inline-block text-[11px] font-bold text-orange-600">
                    {myCurrentSeries.winnerId
                      ? '시리즈 종료'
                      : '시리즈 진행 중'}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <TeamEmblem team={myCurrentSeries.lowerSeed.team} size="md" />
                  <span className="text-xs font-extrabold text-slate-900 truncate max-w-full">
                    #{myCurrentSeries.lowerSeed.conferenceRank || myCurrentSeries.lowerSeed.rank}{' '}
                    {myCurrentSeries.lowerSeed.team.name}
                  </span>
                </div>
              </div>

              {myCurrentSeries.summaryLog.length > 0 && (
                <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-center">
                  {myCurrentSeries.summaryLog[myCurrentSeries.summaryLog.length - 1]}
                </p>
              )}
            </div>
          )}

          {/* 플레이오프 진행 액션 버튼 (초반 라운드 원클릭 일괄 시뮬레이션 + 파이널/7차전 실시간 중계 입장) */}
          {!bracket.championTeamId && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {!bracket.playerReachedFinals && !bracket.playerEliminated && (
                <button
                  type="button"
                  data-testid="batch-early-playoffs-btn"
                  onClick={batchAdvanceEarlyPlayoffs}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black shadow-xs cursor-pointer transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  초반 라운드(1~2R) 원클릭 일괄 진행
                </button>
              )}

              {!bracket.playerReachedFinals && (
                <button
                  type="button"
                  onClick={advancePlayoffBracketRound}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold cursor-pointer transition-colors"
                >
                  1라운드씩 진행
                </button>
              )}

              {canEnterHighStakesLive && (
                <button
                  type="button"
                  data-testid="enter-live-finals-btn"
                  onClick={startFinalsLiveBroadcast}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-black shadow-xs cursor-pointer transition-colors"
                >
                  <Radio className="w-4 h-4" />
                  {bracket.playerReachedFinals
                    ? '파이널 결승전 실시간 중계 입장하기'
                    : '컨퍼런스 파이널 7차전 실시간 중계 입장'}
                </button>
              )}

              <button
                type="button"
                onClick={skipPlayoffsToEnd}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                <FastForward className="w-3.5 h-3.5" />
                플레이오프 전체 스킵
              </button>
            </div>
          )}

          {/* 전체 대진표 토글 버튼 */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowFullPlayoffBracket((v) => !v)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {showFullPlayoffBracket ? (
                <>
                  전체 토너먼트 대진표 접기 <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  전체 토너먼트 대진표 보기 <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>

            {showFullPlayoffBracket && (
              <div className="mt-3 space-y-3">
                {bracket.rounds.map((seriesList, rIdx) => {
                  const rLabel = seriesList[0]?.roundLabel || `${rIdx + 1}라운드`;
                  return (
                    <div
                      key={rIdx}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                        <span>{rLabel}</span>
                        <span className="text-[11px] text-slate-500">
                          {seriesList.length}개 시리즈
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {seriesList.map((m) => (
                          <div
                            key={m.id}
                            className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                              m.involvesPlayer
                                ? 'bg-orange-50/70 border-orange-400'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 truncate">
                                #{m.higherSeed.conferenceRank || m.higherSeed.rank} {m.higherSeed.team.shortName}
                              </span>
                              <span className="font-mono font-black">{m.higherSeedWins}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 truncate">
                                #{m.lowerSeed.conferenceRank || m.lowerSeed.rank} {m.lowerSeed.team.shortName}
                              </span>
                              <span className="font-mono font-black">{m.lowerSeedWins}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. 오프시즌 에이전트 데스크 (퍼스널 케어 & 에이전시 투자 + 4가지 핵심 구단 오퍼) */}
      {career.offseasonLocked && (
        <section
          data-testid="offseason-agent-desk"
          className="bg-white border-2 border-orange-500 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-orange-600 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  오프시즌 에이전트 데스크
                </span>
                {career.league === 'HIGH_SCHOOL' && career.prospectStars && (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    유망주 {career.prospectStars}성 ({'★'.repeat(career.prospectStars)})
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                {career.isOutOfLeagueWarning
                  ? '⚠️ 영입 오퍼를 제시한 구단이 없어요'
                  : '다음 시즌 함께할 구단과 진로를 선택해 주세요'}
              </h3>
            </div>

            <div className="text-right shrink-0">
              <span className="block text-[10px] font-bold text-slate-400">
                보유 누적 자산
              </span>
              <span className="text-sm font-black text-emerald-700 tabular-nums">
                {formatUsdAmount(career.careerEarnings || 0)}
              </span>
            </div>
          </div>

          {/* 💼 오프시즌 퍼스널 케어 & 에이전시 투자 섹션 */}
          <div
            data-testid="personal-care-desk"
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900">
                  💼 오프시즌 퍼스널 케어 &amp; 에이전시 투자
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  통산 연봉 자산을 투자해 부상 방지, 성장 가속, 시그니처 브랜드 가치를 높여 보세요!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {PERSONAL_CARE_ITEMS.map((item) => {
                const isPurchased = (career.activePersonalCare || []).includes(item.id);
                const cost = getPersonalCarePackageCost(item.id, career.league);
                const canAfford = (career.careerEarnings || 0) >= cost;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isPurchased
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900">
                          {item.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-extrabold">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid={`care-btn-${item.id}`}
                      disabled={isPurchased || !canAfford}
                      onClick={() => purchasePersonalCare(item.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition ${
                        isPurchased
                          ? 'bg-emerald-600 text-white cursor-default'
                          : canAfford
                          ? 'bg-slate-900 hover:bg-orange-600 text-white cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      {isPurchased
                        ? '✓ 이번 시즌 적용 완료'
                        : `투자하기 (${formatUsdAmount(cost)})`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {career.isOutOfLeagueWarning && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                직전 시즌 실전 기록과 나이를 종합한 구단 스카우팅 심사 결과, 새로운 계약 오퍼가 도착하지 않았어요. 공식 은퇴식을 진행해 주세요.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {career.offseasonOptions.map((option: OffseasonOption) => {
              const dirBadge = option.targetTeam
                ? getTeamDirectionBadge(option.targetTeam.direction, option.targetTeam.rating)
                : {
                    label: option.badgeText,
                    className: 'bg-orange-50 border-orange-200 text-orange-700',
                  };
              const roleText = option.promisedRoleLabel || '로테이션 경쟁';
              const salaryText = formatSalaryOffer(option.annualSalary, option.contractYears);

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.locked}
                  onClick={() => selectOffseasonOption(option)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 ${
                    option.locked
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-orange-500 hover:shadow-xs cursor-pointer'
                  }`}
                >
                  {/* ① 구단 엠블럼 */}
                  {option.targetTeam ? (
                    <TeamEmblem team={option.targetTeam} size="md" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-orange-600" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                        {option.title}
                      </span>
                      {option.locked && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          <Lock className="w-3 h-3" /> 잠김
                        </span>
                      )}
                    </div>

                    {/* ② 구단 방향성 뱃지 + ③ 보장 역할 + ④ 연봉 */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                      <span className={`px-2 py-0.5 rounded-md border ${dirBadge.className}`}>
                        {dirBadge.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700">
                        보장 역할: {roleText}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 tabular-nums">
                        {salaryText}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {option.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. 정규시즌 진행 액션 카드 */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <span className="font-extrabold text-orange-600">
                {career.seasonYear}시즌 · {leagueInfo.name}
              </span>
              <span aria-hidden="true">·</span>
              <span>정규 {leagueInfo.games}경기</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {seasonPhase === 'POSTSEASON_BRACKET'
                ? '포스트시즌 토너먼트가 한창 진행 중이에요!'
                : seasonPhase === 'LIVE_FINAL_BROADCAST'
                ? '결승전 실시간 중계에 집중해 주세요!'
                : career.offseasonLocked
                ? '시즌이 종료되었어요. 위 에이전트 데스크에서 다음 진로를 선택해 주세요!'
                : statusMessage}
            </h2>
          </div>

          {!career.offseasonLocked && (
            <button
              type="button"
              disabled={isSimulating}
              onClick={handleStartSeason}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-black text-sm transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              {isSimulating
                ? `시즌 진행 중 (${progress}%)`
                : `${career.seasonYear}시즌 시뮬레이션 시작`}
            </button>
          )}
        </div>

        {/* 시즌 진행 게이지 & 3단계 리듬감 서사 로그 */}
        <div className="space-y-2.5">
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              style={{
                width: `${career.offseasonLocked ? 100 : progress}%`,
              }}
              className="h-full bg-orange-600 rounded-full transition-all duration-150"
            />
          </div>

          {(isSimulating || progress > 0 || career.offseasonLocked) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {RHYTHM_STAGES.map((stage) => {
                const currentProg = career.offseasonLocked ? 100 : progress;
                const reached = currentProg >= stage.threshold;
                return (
                  <div
                    key={stage.tag}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      reached
                        ? 'bg-orange-50/60 border-orange-200 text-slate-800'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-extrabold text-[11px] text-orange-600">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{stage.tag}</span>
                    </div>
                    <p className="text-[11px] mt-0.5 leading-snug line-clamp-2">
                      {stage.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 구단 역할 약속 위반 또는 다년 계약 중 트레이드 요청 배너 */}
        {(career.brokenRolePromise ||
          (career.contractYearsLeft >= 1 &&
            (career.league === 'NBA' ||
              career.league === 'KBL' ||
              career.league === 'OVERSEAS'))) && (
          <div
            className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              career.brokenRolePromise
                ? 'bg-rose-50 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="space-y-0.5">
              <p
                className={`text-xs font-extrabold ${
                  career.brokenRolePromise ? 'text-rose-700' : 'text-slate-800'
                }`}
              >
                {career.brokenRolePromise
                  ? '🚨 구단 역할 보장 약속 위반 감지'
                  : `📋 다년 계약 진행 중 (잔여 ${career.contractYearsLeft}년) · 트레이드 요청 가능`}
              </p>
              <p className="text-xs text-slate-600">
                {career.brokenRolePromise
                  ? '약속받은 출전 시간이 지켜지지 않았어요. 주전 자리가 비어 있는 타 구단으로 트레이드를 요청할 수 있어요.'
                  : '현재 구단의 출전 기회에 만족하지 못한다면 포지션 니즈가 있는 타 구단으로 트레이드를 요청할 수 있어요.'}
              </p>
            </div>
            <button
              type="button"
              onClick={requestTrade}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold shrink-0 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              트레이드 요청
            </button>
          </div>
        )}
      </section>

      {/* 4. 직전 시즌 스포츠 뉴스 헤드라인 & 4대 핵심 스탯 + MVP/신인왕 투표 레이스 TOP 5 보드 */}
      {lastSeason ? (
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          {/* 스포츠 뉴스 헤드라인 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-extrabold text-orange-600 flex items-center gap-1.5">
                <Newspaper className="w-4 h-4" />
                {lastSeason.year}시즌 스포츠 뉴스 헤드라인
              </span>
              <span className="font-bold text-slate-700 tabular-nums">
                정규 {lastSeason.teamRank}위 ({lastSeason.wins}승 {lastSeason.losses}패) · {lastSeason.playoffResult}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {lastSeason.headline}
            </h3>
          </div>

          {/* 4대 핵심 스탯 (PPG / RPG / APG / FG%) */}
          <div className="grid grid-cols-4 gap-2.5 text-center">
            {[
              { label: '평균 득점 (PPG)', val: `${lastSeason.ppg.toFixed(1)}점`, highlight: true },
              { label: '리바운드 (RPG)', val: `${lastSeason.rpg.toFixed(1)}개`, highlight: false },
              { label: '어시스트 (APG)', val: `${lastSeason.apg.toFixed(1)}개`, highlight: false },
              { label: '야투율 (FG%)', val: `${lastSeason.fgPct.toFixed(1)}%`, highlight: true },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200"
              >
                <span className="block text-[10px] sm:text-[11px] font-bold text-slate-500">
                  {stat.label}
                </span>
                <span
                  className={`block text-base sm:text-lg font-black mt-0.5 tabular-nums ${
                    stat.highlight ? 'text-orange-600' : 'text-slate-900'
                  }`}
                >
                  {stat.val}
                </span>
              </div>
            ))}
          </div>

          {/* 🏆 1. MVP & 신인왕(ROY) 투표 레이스 TOP 5 보드 */}
          {activeAwardRace && activeAwardRace.length > 0 && (
            <div
              data-testid="award-race-board"
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    {lastSeason.year}시즌 {lastSeason.leagueName}{' '}
                    {awardRaceTab === 'ROY' && lastSeason.royRace
                      ? '신인왕(ROY) 투표 레이스 TOP 5'
                      : 'MVP 투표 레이스 TOP 5'}
                  </h4>
                </div>

                {lastSeason.royRace && (
                  <div className="inline-flex rounded-xl bg-slate-200/70 p-0.5 text-[11px] font-extrabold">
                    <button
                      type="button"
                      onClick={() => setAwardRaceTab('MVP')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        awardRaceTab === 'MVP'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🏆 MVP 레이스
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwardRaceTab('ROY')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        awardRaceTab === 'ROY'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🌱 신인왕(ROY) 레이스
                    </button>
                  </div>
                )}
              </div>

              {activeAwardNarrative && (
                <p
                  data-testid="award-race-narrative"
                  className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 leading-relaxed"
                >
                  {activeAwardNarrative}
                </p>
              )}

              <div className="space-y-1.5">
                {activeAwardRace.map((entry) => (
                  <div
                    key={`${entry.rank}-${entry.name}`}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      entry.isPlayer
                        ? 'bg-orange-50/90 border-orange-400 font-extrabold text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${
                          entry.rank === 1
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <span className="truncate font-extrabold">
                        {entry.name} ({entry.teamShortName} · {entry.pos})
                      </span>
                      {entry.isPlayer && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-black shrink-0">
                          ME
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <span className="text-[11px] text-slate-600 hidden sm:inline">
                        {entry.ppg.toFixed(1)}점 {entry.rpg.toFixed(1)}리바 {entry.apg.toFixed(1)}도움 ({entry.wins}승 {entry.losses}패)
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 font-black text-[11px]">
                        1위 표 {entry.firstPlaceVoteShare}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 아코디언 토글 버튼: 상세 기록 및 순위표 펼치기 */}
          <button
            type="button"
            onClick={() => setShowDetailedBoxAndStandings((v) => !v)}
            className="w-full py-3 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-extrabold text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            {showDetailedBoxAndStandings ? (
              <>
                상세 기록 및 순위표 접기 <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                상세 기록 및 순위표 펼치기 <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>

          {/* 접기/펼치기 내부: 8칸 상세 박스스코어 + 하이라이트 노트 + 전체 순위표 */}
          {showDetailedBoxAndStandings && (
            <div className="space-y-5 pt-2 border-t border-slate-100">
              {/* 8칸 상세 박스스코어 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                {[
                  {
                    label:
                      lastSeason.injuredGamesMissed > 0
                        ? `출전 (결장 ${lastSeason.injuredGamesMissed}G)`
                        : '출전 경기',
                    val: `${lastSeason.gp}G`,
                  },
                  { label: '평균 출전 시간', val: `${lastSeason.mpg.toFixed(1)}분` },
                  { label: '스틸 / 블록', val: `${lastSeason.spg.toFixed(1)} / ${lastSeason.bpg.toFixed(1)}` },
                  { label: '3점 성공률', val: `${lastSeason.tpPct.toFixed(1)}%` },
                  { label: '시즌 최다 득점', val: `${lastSeason.singleGameHighPts}점` },
                  { label: '시즌 OVR', val: `OVR ${lastSeason.ovr}` },
                  { label: '팀 내 역할', val: lastSeason.role },
                  { label: '팀 최종 성적', val: `${lastSeason.wins}승 ${lastSeason.losses}패` },
                ].map((st) => (
                  <div
                    key={st.label}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <span className="block text-[10px] font-semibold text-slate-500">
                      {st.label}
                    </span>
                    <span className="block text-xs font-extrabold text-slate-900 mt-0.5 tabular-nums truncate">
                      {st.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* 시즌 코트 노트 & 하이라이트 */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  시즌 코트 노트 &amp; 하이라이트
                </h4>
                <ul className="space-y-1.5">
                  {lastSeason.narrativeLog.map((line, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 리그 전체 순위표 */}
              {standings.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold text-slate-800">
                      {lastSeason.year}시즌 {leagueInfo.name} 정규시즌 순위표 ({standings.length}팀)
                    </h4>
                    {career.league === 'NBA' && (
                      <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
                        {(
                          [
                            { id: 'ALL', label: '전체' },
                            { id: 'EAST', label: '동부 (15)' },
                            { id: 'WEST', label: '서부 (15)' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStandingsConfTab(tab.id)}
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              standingsConfTab === tab.id
                                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs tabular-nums">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="border-b border-slate-200 text-slate-500 font-bold">
                          <th className="py-2 px-2.5">순위</th>
                          <th className="py-2 px-2.5">구단명</th>
                          <th className="py-2 px-2.5 text-right">승-패</th>
                          <th className="py-2 px-2.5 text-right">승률</th>
                          <th className="py-2 px-2.5 text-right">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStandings.map((row) => (
                          <tr
                            key={row.team.id}
                            className={
                              row.isPlayerTeam
                                ? 'bg-orange-50/80 font-extrabold text-slate-900'
                                : 'hover:bg-slate-50 text-slate-700'
                            }
                          >
                            <td className="py-2 px-2.5 font-black">
                              {career.league === 'NBA' && standingsConfTab !== 'ALL'
                                ? `${row.conferenceRank || row.rank}위`
                                : `${row.rank}위`}
                            </td>
                            <td className="py-2 px-2.5">
                              <span className="font-bold">{row.team.name}</span>
                              {row.isPlayerTeam && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-black">
                                  MY
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold">
                              {row.wins}-{row.losses}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono">
                              {row.winPct.toFixed(3)}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {row.qualifiedPlayoffs ? (
                                <span className="text-indigo-600 font-bold">PO 진출</span>
                              ) : (
                                <span className="text-slate-400">탈락</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-1.5">
          <p className="text-sm font-extrabold text-slate-800">
            아직 치른 정규시즌 경기가 없어요
          </p>
          <p className="text-xs text-slate-500">
            위의 [시즌 시뮬레이션 시작] 버튼을 눌러 첫 시즌 코트 위에서의 활약을 확인해 보세요!
          </p>
        </section>
      )}
    </div>
  );
}
