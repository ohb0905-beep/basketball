/**
 * 정규시즌 · 플레이오프 · 결승 라이브 중계 액션
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  ECONOMY_CONFIG,
  LEAGUE_BALANCE_META,
} from '../../config/balanceConfig';
import {
  COACH_CHANCE_EVENT_ID_PREFIX,
  createSangmuEnlistmentEvent,
  getMilitaryEnlistAgeForLeague,
  rollMidSeasonCrossroadsEvent,
} from '../../data/events';
import {
  evaluateFreshmanAdaptation,
  isNcaaFreshmanSeason,
} from '../../engine/freshmanAdaptation';
import {
  advancePlayoffRound,
  batchAdvanceEarlyPlayoffRounds,
  createPlayoffBracket,
  evaluateRealisticFinalsMvp,
  skipEntirePlayoffs,
} from '../../engine/playoffEngine';
import {
  createLiveFinalGame,
  resolveClutchPossession,
  simulateLiveQuarter,
} from '../../engine/liveGameEngine';
import { isInternationalLiveGame } from '../../engine/internationalEngine';
import {
  getDecisiveGameContext,
  getPlayerFinalsSeries,
  simulateFinalsToDecisiveGame,
} from '../../engine/finalsSeries';
import {
  computeCareerMinutes,
  simulateSeason,
} from '../../engine/seasonSimulator';
import {
  CareerState,
  SeasonBoxScore,
  ClutchChoiceId,
  TeamInfo,
} from '../../types/game';
import {
  getEffectiveCashBalance,
  applyLatestSeasonRecordChecks,
  buildRecordBreakToast,
  dequeueNextPendingEvent,
  refreshChampionSeasonHeadline,
  finalizeSeasonAndEnterOffseason,
  applyCompletedLiveGameOutcome,
} from '../careerStoreHelpers';
import type {
  CareerStoreGet,
  CareerStoreSet,
  CareerStoreState,
  ToastMessage,
} from '../careerStoreTypes';

export type SeasonActions = Pick<CareerStoreState, 'triggerMidSeasonCrossroads' | 'playSeason' | 'advancePlayoffBracketRound' | 'batchAdvanceEarlyPlayoffs' | 'enterOffseasonFromPlayoffs' | 'skipPlayoffsToEnd' | 'advanceFinalsToDecisiveGame' | 'startFinalsLiveBroadcast' | 'setLiveGameTactic' | 'playNextLiveQuarter' | 'resolveLiveClutchChoice' | 'skipLiveGame' | 'closeLiveGameAndReturn'>;

export function createSeasonActions(
  set: CareerStoreSet,
  get: CareerStoreGet
): SeasonActions {
  return {
    triggerMidSeasonCrossroads: () => {
      const { career } = get();
      if (!career || career.pendingEvent || career.midSeasonEventTriggeredThisYear) {
        return;
      }
      const midEvt = rollMidSeasonCrossroadsEvent(career);
      const isTradeRumor = midEvt.id.startsWith('EVT_MID_TRADE_DEADLINE_');
      const isCoachChance = midEvt.id.startsWith(COACH_CHANCE_EVENT_ID_PREFIX);
      set({
        career: {
          ...career,
          midSeasonEventTriggeredThisYear: true,
          coachChanceOfferedYear: isCoachChance
            ? career.seasonYear
            : career.coachChanceOfferedYear ?? null,
          lastTradeRumorYear: isTradeRumor
            ? career.seasonYear
            : career.lastTradeRumorYear ?? null,
          pendingEvent: midEvt,
        },
      });
    },

    playSeason: () => {
      const { career } = get();
      if (
        !career ||
        career.offseasonLocked ||
        (career.seasonPhase && career.seasonPhase !== 'REGULAR_SEASON')
      ) {
        return;
      }

      const sim = simulateSeason(career);
      const freshmanAdaptation = isNcaaFreshmanSeason(career)
        ? evaluateFreshmanAdaptation(sim.boxScore)
        : null;
      const bs: SeasonBoxScore = freshmanAdaptation
        ? { ...sim.boxScore, freshmanAdaptation }
        : sim.boxScore;

      const seasonPts = Math.round(bs.ppg * bs.gp);
      const seasonReb = Math.round(bs.rpg * bs.gp);
      const seasonAst = Math.round(bs.apg * bs.gp);
      const seasonStl = Math.round(bs.spg * bs.gp);
      const seasonBlk = Math.round(bs.bpg * bs.gp);

      const isNba = career.league === 'NBA';
      const isPro = LEAGUE_BALANCE_META[career.league].isPro;
      const seasonMinutesPlayed = Math.round(bs.gp * bs.mpg);
      const nextTotals = {
        ...career.totals,
        gp: career.totals.gp + bs.gp,
        minutes: computeCareerMinutes(career) + seasonMinutesPlayed,
        points: career.totals.points + seasonPts,
        rebounds: career.totals.rebounds + seasonReb,
        assists: career.totals.assists + seasonAst,
        steals: career.totals.steals + seasonStl,
        blocks: career.totals.blocks + seasonBlk,
        nbaGp: career.totals.nbaGp + (isNba ? bs.gp : 0),
        nbaPoints: career.totals.nbaPoints + (isNba ? seasonPts : 0),
        championships:
          career.totals.championships + (bs.wonChampionship ? 1 : 0),
        nbaChampionships:
          career.totals.nbaChampionships +
          (isNba && bs.wonChampionship ? 1 : 0),
        mvps: career.totals.mvps + (bs.wonMvp ? 1 : 0),
        nbaMvps: career.totals.nbaMvps + (isNba && bs.wonMvp ? 1 : 0),
        finalsMvps:
          (career.totals.finalsMvps || 0) + (bs.wonFinalsMvp ? 1 : 0),
        dpoys: (career.totals.dpoys || 0) + (bs.wonDpoy ? 1 : 0),
        sixthManAwards:
          (career.totals.sixthManAwards || 0) + (bs.wonSixthMan ? 1 : 0),
        mips: (career.totals.mips || 0) + (bs.wonMip ? 1 : 0),
        allLeagueSelections:
          (career.totals.allLeagueSelections || 0) +
          (bs.allLeagueTeam ? 1 : 0),
        allStars: career.totals.allStars + (bs.allStarSelected ? 1 : 0),
        nbaAllStars:
          career.totals.nbaAllStars + (isNba && bs.allStarSelected ? 1 : 0),
      };

      const nextHighs = { ...career.careerHighs };
      if (bs.singleGameHighPts > nextHighs.points) {
        nextHighs.points = bs.singleGameHighPts;
        nextHighs.pointsContext = `${bs.year}시즌 ${bs.teamShortName} (${bs.leagueName})`;
        nextHighs.pointsLeague = bs.league;
      }
      nextHighs.rebounds = Math.max(
        nextHighs.rebounds,
        Math.round(bs.rpg * 1.85 + 2)
      );
      nextHighs.assists = Math.max(
        nextHighs.assists,
        Math.round(bs.apg * 1.9 + 2)
      );
      nextHighs.steals = Math.max(
        nextHighs.steals,
        Math.min(10, Math.round(bs.spg * 2.8 + 1))
      );
      nextHighs.blocks = Math.max(
        nextHighs.blocks,
        Math.min(11, Math.round(bs.bpg * 2.9 + 1))
      );

      const newMilestones = [...career.milestones];
      if (bs.wonMvp) {
        newMilestones.push({
          id: `MS_MVP_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title: `${bs.leagueName} 정규시즌 MVP 수상`,
          description: `평균 ${bs.ppg}점 · ${bs.rpg}리바운드 · ${bs.apg}도움으로 정규시즌 MVP에 선정되었습니다.`,
          type: 'AWARD',
          teamName: bs.teamName,
        });
      }
      if (freshmanAdaptation && freshmanAdaptation.achievedCount > 0) {
        newMilestones.push({
          id: `MS_FRESHMAN_ADAPT_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title:
            freshmanAdaptation.achievedCount === freshmanAdaptation.goals.length
              ? 'NCAA 신입 적응 완벽 달성'
              : 'NCAA 신입 적응 목표 달성',
          description: `${freshmanAdaptation.goals
            .filter((g) => g.achieved)
            .map((g) => g.label)
            .join(', ')} · 스카우트 주가 +${freshmanAdaptation.draftStockBonus}`,
          type: 'SPECIAL',
          teamName: bs.teamName,
        });
      }
      if (bs.wonDpoy) {
        newMilestones.push({
          id: `MS_DPOY_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title: `${bs.leagueName} 올해의 수비수(DPOY) 수상`,
          description: `평균 ${bs.spg}스틸 · ${bs.bpg}블록의 수비력으로 DPOY를 수상했습니다.`,
          type: 'AWARD',
          teamName: bs.teamName,
        });
      }
      if (bs.wonSixthMan) {
        newMilestones.push({
          id: `MS_6MOY_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title: `${bs.leagueName} 올해의 식스맨상(6MOY) 수상`,
          description: `벤치 에이스로 평균 ${bs.ppg}점을 기록하며 올해의 식스맨에 선정되었습니다.`,
          type: 'AWARD',
          teamName: bs.teamName,
        });
      }
      if (bs.wonMip) {
        newMilestones.push({
          id: `MS_MIP_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title: `${bs.leagueName} 기량발전상(MIP) 수상`,
          description: `비시즌 성장으로 리그 최고 기량발전상을 수상했습니다.`,
          type: 'AWARD',
          teamName: bs.teamName,
        });
      }
      if (sim.potentialBreakthroughReason) {
        newMilestones.push({
          id: `MS_BREAKTHROUGH_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title: '성장 한계 돌파',
          description: sim.potentialBreakthroughReason,
          type: 'SPECIAL',
          teamName: bs.teamName,
        });
      }
      if (bs.singleGameHighPts >= 40) {
        newMilestones.push({
          id: `MS_40PTS_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title: `단일 경기 ${bs.singleGameHighPts}득점 기록`,
          description: `${bs.leagueName} 경기에서 한 경기 ${bs.singleGameHighPts}득점을 올리며 팀 공격을 이끌었습니다.`,
          type: 'RECORD',
          teamName: bs.teamName,
        });
      }
      if (bs.injurySeverity === 'MAJOR') {
        newMilestones.push({
          id: `MS_MAJOR_INJ_${bs.year}`,
          year: bs.year,
          age: bs.age,
          title: `장기 중상 (${bs.injuryLabel || '중상'}) · ${bs.injuredGamesMissed}경기 결장`,
          description:
            bs.injuryPermanentPhyPenalty && bs.injuryPermanentPhyPenalty > 0
              ? `시즌 중 장기 결장을 겪었으며 30대 이후 중상 후유증(PHY -${bs.injuryPermanentPhyPenalty}${
                  bs.age >= 34 ? ', DEF -1' : ''
                })이 남았습니다.`
              : `시즌 중 ${bs.injuredGamesMissed}경기에 결장하며 긴 재활을 거쳤습니다.`,
          type: 'INJURY',
          teamName: bs.teamName,
        });
      }

      const nextCareerEarnings = isPro
        ? (career.careerEarnings || 0) + bs.salaryEarned
        : career.careerEarnings || 0;
      const nextCashBalance = isPro
        ? getEffectiveCashBalance(career) +
          Math.round(bs.salaryEarned * ECONOMY_CONFIG.proNetCashRatio)
        : getEffectiveCashBalance(career) + ECONOMY_CONFIG.amateurAnnualStipendUsd;

      let initialBracket = createPlayoffBracket(
        career,
        sim.standings,
        Math.random,
        { simulateForNonPlayer: true }
      );
      const qualifiedForPlayoffs =
        !initialBracket.playerEliminated && initialBracket.rounds.length > 0;
      // 플레이어 팀이 PO 진출에 실패했더라도 리그 최종 우승팀을 확정해 대진표 및 라이벌 우승 기록 정합성 유지
      if (
        !qualifiedForPlayoffs &&
        initialBracket.rounds.length > 0 &&
        !initialBracket.championTeamId
      ) {
        initialBracket = skipEntirePlayoffs(initialBracket, career, sim.standings);
      }

      const postRegularSeasonCareer: CareerState = {
        ...career,
        careerEarnings: nextCareerEarnings,
        cashBalance: nextCashBalance,
        seasonsOnCurrentTeam: (career.seasonsOnCurrentTeam ?? 0) + 1,
        role: bs.role,
        currentStandings: sim.standings,
        playoffBracket: initialBracket,
        liveGame: null,
        rivals: sim.updatedRivals,
        seasonLogs: [...career.seasonLogs, bs],
        milestones: newMilestones,
        careerHighs: nextHighs,
        totals: nextTotals,
        pendingSeasonSettlement: {
          nextStats: sim.nextStats,
          statDelta: sim.statDelta,
          nextOvr: sim.nextOvr,
          nextPotential: sim.nextPotential,
          potentialBreakthroughReason: sim.potentialBreakthroughReason,
          nextCoachTrust: sim.nextCoachTrust,
          nextDraftStock: freshmanAdaptation
            ? Math.min(100, sim.nextDraftStock + freshmanAdaptation.draftStockBonus)
            : sim.nextDraftStock,
          nextBadges: sim.nextBadges,
          nextTraits: sim.nextTraits,
          brokenRolePromise: sim.brokenRolePromise,
          nextRelationships: sim.nextRelationships,
        },
        seasonPhase: qualifiedForPlayoffs ? 'POSTSEASON_BRACKET' : 'OFFSEASON',
        offseasonLocked: false,
        offseasonOptions: [],
        pendingEvent: null,
      };

      const checked = applyLatestSeasonRecordChecks(
        get().recordBook,
        postRegularSeasonCareer
      );
      const recToast = buildRecordBreakToast(checked.brokenRecords);

      // 플레이오프 진출 시: 현재 연도/나이/능력치를 유지한 채 포스트시즌 먼저 진행 (종료 후 정산!)
      if (qualifiedForPlayoffs) {
        set({
          recordBook: checked.nextBook,
          career: checked.nextCareer,
          ...(recToast ? { toast: recToast } : {}),
        });
        return;
      }

      // 플레이오프 탈락 시: 즉시 시즌 정산 및 오프시즌 진입
      const preservedCare =
        (checked.nextCareer.activePersonalCare || []).length > 0
          ? checked.nextCareer.activePersonalCare
          : get().lastPersonalCareIds;
      const finalized = finalizeSeasonAndEnterOffseason(checked.nextCareer);
      set({
        recordBook: checked.nextBook,
        lastPersonalCareIds: preservedCare,
        career: finalized.career,
        ...(finalized.retiredView ? { view: 'RETIREMENT' as const } : {}),
        ...(recToast ? { toast: recToast } : {}),
      });
    },

    advancePlayoffBracketRound: () => {
      const { career } = get();
      if (!career || !career.playoffBracket) return;

      const standings = career.currentStandings || [];
      let updatedBracket = advancePlayoffRound(
        career.playoffBracket,
        career,
        standings
      );

      // 내 팀 탈락 시 남은 라운드 자동 완결 (대진표 고속 애니메이션으로 우승팀까지 표시)
      if (updatedBracket.playerEliminated && !updatedBracket.championTeamId) {
        updatedBracket = skipEntirePlayoffs(updatedBracket, career, standings);
      }

      const logs = [...career.seasonLogs];
      const nextTotals = { ...career.totals };
      const nextMilestones = [...career.milestones];

      if (logs.length > 0) {
        const lastIdx = logs.length - 1;
        const prevLog = logs[lastIdx];
        const wonChamp =
          Boolean(updatedBracket.championTeamId) &&
          updatedBracket.championTeamId === prevLog.teamId;
        const wonFmvp = wonChamp
          ? evaluateRealisticFinalsMvp(career, wonChamp)
          : false;

        if (wonChamp && !prevLog.wonChampionship) {
          nextTotals.championships += 1;
          if (prevLog.league === 'NBA') nextTotals.nbaChampionships += 1;
          if (wonFmvp) {
            nextTotals.finalsMvps = (nextTotals.finalsMvps || 0) + 1;
          }
          nextMilestones.push({
            id: `MS_CHAMP_${prevLog.year}_${Date.now()}`,
            year: prevLog.year,
            age: prevLog.age,
            title: `${prevLog.leagueName} 챔피언십 우승${
              wonFmvp ? ' · 파이널 MVP' : ''
            }`,
            description: `${prevLog.teamName} 소속으로 포스트시즌 정상에 올랐습니다.`,
            type: 'CHAMPIONSHIP',
            teamName: prevLog.teamName,
          });
        }

        const updatedLog = {
          ...prevLog,
          playoffResult: updatedBracket.playoffResultLabel,
          wonChampionship: wonChamp || prevLog.wonChampionship,
          wonFinalsMvp: wonFmvp || prevLog.wonFinalsMvp,
        };
        logs[lastIdx] = updatedLog.wonChampionship
          ? {
              ...updatedLog,
              headline: refreshChampionSeasonHeadline(career, updatedLog),
            }
          : updatedLog;
      }

      const nextCareerState: CareerState = {
        ...career,
        playoffBracket: updatedBracket,
        seasonLogs: logs,
        totals: nextTotals,
        milestones: nextMilestones,
        seasonPhase: 'POSTSEASON_BRACKET',
      };

      const checked = applyLatestSeasonRecordChecks(
        get().recordBook,
        nextCareerState
      );
      const recToast = buildRecordBreakToast(checked.brokenRecords);
      set({
        recordBook: checked.nextBook,
        career: checked.nextCareer,
        ...(recToast ? { toast: recToast } : {}),
      });
    },

    batchAdvanceEarlyPlayoffs: () => {
      const { career } = get();
      if (!career || !career.playoffBracket) return;

      const standings = career.currentStandings || [];
      let updatedBracket = batchAdvanceEarlyPlayoffRounds(
        career.playoffBracket,
        career,
        standings
      );

      // 내 팀 탈락 시 남은 라운드 자동 완결 (대진표 고속 애니메이션으로 우승팀까지 표시)
      if (updatedBracket.playerEliminated && !updatedBracket.championTeamId) {
        updatedBracket = skipEntirePlayoffs(updatedBracket, career, standings);
      }

      const logs = [...career.seasonLogs];
      if (logs.length > 0) {
        const lastIdx = logs.length - 1;
        logs[lastIdx] = {
          ...logs[lastIdx],
          playoffResult: updatedBracket.playoffResultLabel,
        };
      }

      const nextCareerState: CareerState = {
        ...career,
        playoffBracket: updatedBracket,
        seasonLogs: logs,
        seasonPhase: 'POSTSEASON_BRACKET',
      };

      const champTeam = updatedBracket.championTeamId
        ? standings.find((s) => s.team.id === updatedBracket.championTeamId)?.team
        : null;

      const toastPayload: ToastMessage = {
        id: `TOAST_${Date.now()}`,
        title: updatedBracket.playerReachedFinals
          ? '파이널 진출 확정'
          : updatedBracket.pendingConfFinalsGame7
          ? '컨퍼런스 파이널 3승 3패 · 7차전 성사'
          : updatedBracket.playerEliminated
          ? `포스트시즌 종료 · ${updatedBracket.playoffResultLabel}`
          : '플레이오프 라운드 진행 완료',
        description: updatedBracket.playerReachedFinals
          ? '파이널 대진표에서 시리즈를 시작해 우승에 도전하세요.'
          : updatedBracket.pendingConfFinalsGame7
          ? '컨퍼런스 파이널 7차전 실시간 중계에 입장하세요.'
          : champTeam
          ? `남은 라운드 자동 진행 완료 · 최종 우승 ${champTeam.shortName}`
          : '대진표에서 시리즈 결과를 확인하세요.',
        tone:
          updatedBracket.playerReachedFinals || updatedBracket.pendingConfFinalsGame7
            ? 'orange'
            : 'slate',
      };

      set({
        career: nextCareerState,
        toast: toastPayload,
      });
    },

    enterOffseasonFromPlayoffs: () => {
      const { career, recordBook, lastPersonalCareIds } = get();
      if (!career) return;

      // 안전 가드: 미완결 플레이오프 대진표가 남아 있으면 최종 우승팀 확정 후 오프시즌 정산
      let careerToSettle = career;
      if (
        career.playoffBracket &&
        career.playoffBracket.rounds.length > 0 &&
        !career.playoffBracket.championTeamId
      ) {
        const standings = career.currentStandings || [];
        const finishedBracket = skipEntirePlayoffs(
          career.playoffBracket,
          career,
          standings
        );
        const logs = [...career.seasonLogs];
        const nextTotals = { ...career.totals };
        const nextMilestones = [...career.milestones];
        if (logs.length > 0) {
          const lastIdx = logs.length - 1;
          const prevLog = logs[lastIdx];
          const wonChamp =
            Boolean(finishedBracket.championTeamId) &&
            finishedBracket.championTeamId === prevLog.teamId;
          const wonFmvp = wonChamp
            ? evaluateRealisticFinalsMvp(career, wonChamp)
            : false;
          if (wonChamp && !prevLog.wonChampionship) {
            nextTotals.championships += 1;
            if (prevLog.league === 'NBA') nextTotals.nbaChampionships += 1;
            if (wonFmvp) {
              nextTotals.finalsMvps = (nextTotals.finalsMvps || 0) + 1;
            }
            nextMilestones.push({
              id: `MS_CHAMP_${prevLog.year}_${Date.now()}`,
              year: prevLog.year,
              age: prevLog.age,
              title: `${prevLog.leagueName} 챔피언십 우승${
                wonFmvp ? ' · 파이널 MVP' : ''
              }`,
              description: `${prevLog.teamName} 소속으로 포스트시즌 정상에 올랐습니다.`,
              type: 'CHAMPIONSHIP',
              teamName: prevLog.teamName,
            });
          }
          const updatedLog = {
            ...prevLog,
            playoffResult: finishedBracket.playoffResultLabel,
            wonChampionship: wonChamp || prevLog.wonChampionship,
            wonFinalsMvp: wonFmvp || prevLog.wonFinalsMvp,
          };
          logs[lastIdx] = updatedLog.wonChampionship
            ? {
                ...updatedLog,
                headline: refreshChampionSeasonHeadline(career, updatedLog),
              }
            : updatedLog;
        }
        careerToSettle = {
          ...career,
          playoffBracket: finishedBracket,
          seasonLogs: logs,
          totals: nextTotals,
          milestones: nextMilestones,
        };
      }

      const checked = applyLatestSeasonRecordChecks(recordBook, careerToSettle);
      const preservedCare =
        (checked.nextCareer.activePersonalCare || []).length > 0
          ? checked.nextCareer.activePersonalCare
          : lastPersonalCareIds;
      const finalized = finalizeSeasonAndEnterOffseason(checked.nextCareer);
      const recToast = buildRecordBreakToast(checked.brokenRecords);
      set({
        recordBook: checked.nextBook,
        lastPersonalCareIds: preservedCare,
        career: finalized.career,
        ...(finalized.retiredView ? { view: 'RETIREMENT' as const } : {}),
        ...(recToast ? { toast: recToast } : {}),
      });
    },

    skipPlayoffsToEnd: () => {
      const { career } = get();
      if (!career || !career.playoffBracket) return;

      const standings = career.currentStandings || [];
      const finishedBracket = {
        ...skipEntirePlayoffs(career.playoffBracket, career, standings),
        pendingFinalsLiveGame: false,
      };

      const logs = [...career.seasonLogs];
      const nextTotals = { ...career.totals };
      const nextMilestones = [...career.milestones];

      if (logs.length > 0) {
        const lastIdx = logs.length - 1;
        const prevLog = logs[lastIdx];
        const wonChamp =
          Boolean(finishedBracket.championTeamId) &&
          finishedBracket.championTeamId === prevLog.teamId;
        const wonFmvp = wonChamp
          ? evaluateRealisticFinalsMvp(career, wonChamp)
          : false;
        const wasChampBefore = prevLog.wonChampionship;

        if (wonChamp && !wasChampBefore) {
          nextTotals.championships += 1;
          if (prevLog.league === 'NBA') nextTotals.nbaChampionships += 1;
          if (wonFmvp) {
            nextTotals.finalsMvps = (nextTotals.finalsMvps || 0) + 1;
          }
          nextMilestones.push({
            id: `MS_CHAMP_${prevLog.year}_${Date.now()}`,
            year: prevLog.year,
            age: prevLog.age,
            title: `${prevLog.leagueName} 챔피언십 우승${
              wonFmvp ? ' · 파이널 MVP' : ''
            }`,
            description: `${prevLog.teamName} 소속으로 포스트시즌 정상에 올랐습니다.`,
            type: 'CHAMPIONSHIP',
            teamName: prevLog.teamName,
          });
        } else if (!wonChamp && wasChampBefore) {
          nextTotals.championships = Math.max(0, nextTotals.championships - 1);
          if (prevLog.league === 'NBA') {
            nextTotals.nbaChampionships = Math.max(
              0,
              nextTotals.nbaChampionships - 1
            );
          }
        }

        const updatedLog = {
          ...prevLog,
          playoffResult: finishedBracket.playoffResultLabel,
          wonChampionship: wonChamp,
          wonFinalsMvp: wonFmvp,
        };
        logs[lastIdx] = updatedLog.wonChampionship
          ? {
              ...updatedLog,
              headline: refreshChampionSeasonHeadline(career, updatedLog),
            }
          : updatedLog;
      }

      const preFinalCareer: CareerState = {
        ...career,
        playoffBracket: finishedBracket,
        seasonLogs: logs,
        totals: nextTotals,
        milestones: nextMilestones,
      };
      const checked = applyLatestSeasonRecordChecks(
        get().recordBook,
        preFinalCareer
      );
      const preservedCare =
        (checked.nextCareer.activePersonalCare || []).length > 0
          ? checked.nextCareer.activePersonalCare
          : get().lastPersonalCareIds;
      const finalized = finalizeSeasonAndEnterOffseason(checked.nextCareer);
      const recToast = buildRecordBreakToast(checked.brokenRecords);

      set({
        recordBook: checked.nextBook,
        lastPersonalCareIds: preservedCare,
        career: finalized.career,
        ...(finalized.retiredView ? { view: 'RETIREMENT' as const } : {}),
        toast: recToast || {
          id: `TOAST_${Date.now()}`,
          title: `포스트시즌 종료 · ${finishedBracket.playoffResultLabel}`,
          description: '시즌이 정산되었습니다. 다음 시즌 진로를 선택하세요.',
          tone:
            finishedBracket.playoffResultLabel === '리그 우승'
              ? 'amber'
              : 'slate',
        },
      });
    },

    advanceFinalsToDecisiveGame: () => {
      const { career } = get();
      const bracket = career?.playoffBracket;
      if (
        !career ||
        !bracket ||
        !bracket.playerReachedFinals ||
        bracket.pendingFinalsLiveGame ||
        bracket.championTeamId
      ) {
        return;
      }
      set({
        career: {
          ...career,
          playoffBracket: simulateFinalsToDecisiveGame(bracket, career),
        },
      });
    },

    startFinalsLiveBroadcast: () => {
      const { career } = get();
      if (!career || !career.playoffBracket) return;

      const bracket = career.playoffBracket;
      const currentSeriesList = bracket.rounds[bracket.currentRound - 1] || [];
      const playerSeries =
        currentSeriesList.find((s) => s.involvesPlayer) || currentSeriesList[0];

      const oppTeam: TeamInfo = playerSeries
        ? playerSeries.higherSeed.team.id === career.team.id
          ? playerSeries.lowerSeed.team
          : playerSeries.higherSeed.team
        : career.team;

      // 컨퍼런스 파이널 7차전은 실제로 3승 3패(pendingConfFinalsGame7)에 도달했을 때만 진입!
      const isConfFinalsGame7 =
        Boolean(bracket.pendingConfFinalsGame7) && !bracket.playerReachedFinals;

      const finalsSeries = bracket.pendingFinalsLiveGame
        ? getPlayerFinalsSeries(bracket)
        : null;
      const finalsContext = finalsSeries
        ? getDecisiveGameContext(finalsSeries, career.team.id) ?? undefined
        : undefined;
      const liveGame = createLiveFinalGame(
        career,
        oppTeam,
        isConfFinalsGame7 ? 'CONF_FINALS_GAME7' : 'LEAGUE_FINALS',
        { finalsContext }
      );
      set({
        career: {
          ...career,
          liveGame,
          seasonPhase: 'LIVE_FINAL_BROADCAST',
        },
      });
    },

    setLiveGameTactic: (tactic) => {
      const { career } = get();
      if (!career || !career.liveGame) return;
      set({
        career: {
          ...career,
          liveGame: {
            ...career.liveGame,
            currentTactic: tactic,
          },
        },
      });
    },

    playNextLiveQuarter: () => {
      const { career } = get();
      // 끝난 경기에 다시 반영하면 결승 시리즈 다음 결정전까지 같은 결과가 들어갑니다.
      if (!career || !career.liveGame || career.liveGame.isFinished) return;

      const nextLive = simulateLiveQuarter(
        career.liveGame,
        career,
        career.liveGame.currentTactic
      );

      const nextCareer = applyCompletedLiveGameOutcome(career, nextLive);
      set({ career: nextCareer });
    },

    resolveLiveClutchChoice: (choice) => {
      const { career } = get();
      if (!career || !career.liveGame || !career.liveGame.pendingClutchPossession) {
        return;
      }

      const nextLive = resolveClutchPossession(career.liveGame, career, choice);
      const nextCareer = applyCompletedLiveGameOutcome(career, nextLive);

      const toastTitle = !nextLive.isFinished
        ? '연장전(OT) 돌입'
        : nextLive.finalOutcome?.won
        ? '클러치 포제션 승리'
        : '클러치 포제션 패배';

      set({
        career: nextCareer,
        toast: {
          id: `TOAST_${Date.now()}`,
          title: toastTitle,
          description:
            nextLive.clutchSituationText || nextLive.finalOutcome?.headline,
          tone: !nextLive.isFinished
            ? 'orange'
            : nextLive.finalOutcome?.won
            ? 'orange'
            : 'amber',
        },
      });
    },

    skipLiveGame: () => {
      const { career } = get();
      if (!career || !career.liveGame) return;

      let guard = 0;
      while (
        get().career?.liveGame &&
        !get().career?.liveGame?.isFinished &&
        guard < 12
      ) {
        const curr = get().career!;
        const lg = curr.liveGame!;
        if (lg.pendingClutchPossession) {
          const smartChoice: ClutchChoiceId =
            lg.clutchScenario === 'LEADING'
              ? curr.stats.def >= curr.stats.out
                ? 'LOCKDOWN_STOP'
                : 'CLUTCH_FREE_THROWS'
              : curr.stats.ply >= Math.max(curr.stats.ins, curr.stats.out) + 5
              ? 'KICKOUT_ASSIST'
              : 'ISO_WINNER';
          get().resolveLiveClutchChoice(smartChoice);
        } else {
          get().playNextLiveQuarter();
        }
        guard++;
      }

      const latestCareer = get().career;
      if (latestCareer?.liveGame) {
        set({
          career: {
            ...latestCareer,
            liveGame: {
              ...latestCareer.liveGame,
              wasSkipped: true,
            },
          },
        });
      }
    },

    closeLiveGameAndReturn: () => {
      const { career } = get();
      if (!career) return;

      const finishedType = career.liveGame?.gameType;

      // 1) 국제대회 결승전 / 3·4위전 종료 -> 이미 오프시즌 상태이므로 오프시즌 복귀
      //    입대 직전 마지막 특례 대회에서 면제에 실패한 경우 상무 입대 영장 즉시 연계
      if (finishedType && isInternationalLiveGame(finishedType)) {
        const needsImmediateEnlistment =
          !career.militaryExempt &&
          career.militaryServiceSeasonsLeft === 0 &&
          career.age >= getMilitaryEnlistAgeForLeague(career.league);
        const baseReturned: CareerState = {
          ...career,
          liveGame: null,
          seasonPhase: 'OFFSEASON',
          pendingEvent: needsImmediateEnlistment
            ? createSangmuEnlistmentEvent(career)
            : career.pendingEvent,
          pendingEventQueue: needsImmediateEnlistment
            ? []
            : career.pendingEventQueue,
        };
        const nextReturned =
          !needsImmediateEnlistment &&
          !baseReturned.pendingEvent &&
          !baseReturned.lastInternationalSummary
            ? dequeueNextPendingEvent(baseReturned)
            : baseReturned;
        set({ career: nextReturned });
        return;
      }

      // 2) 컨퍼런스 파이널 7차전 승리 -> NBA 파이널 대진표(POSTSEASON_BRACKET)로 복귀
      if (
        finishedType === 'CONF_FINALS_GAME7' &&
        career.playoffBracket &&
        !career.playoffBracket.championTeamId &&
        !career.playoffBracket.playerEliminated
      ) {
        set({
          career: {
            ...career,
            liveGame: null,
            seasonPhase: 'POSTSEASON_BRACKET',
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: 'NBA 파이널 진출 확정',
            description:
              '파이널 대진표에서 시리즈를 시작해 우승에 도전하세요.',
            tone: 'orange',
          },
        });
        return;
      }

      // 2-b) 컨퍼런스 파이널 7차전 패배 -> 남은 NBA 파이널 자동 완결 후 대진표로 복귀
      if (
        finishedType === 'CONF_FINALS_GAME7' &&
        career.playoffBracket &&
        career.playoffBracket.playerEliminated &&
        !career.playoffBracket.championTeamId
      ) {
        const resolvedBracket = skipEntirePlayoffs(
          career.playoffBracket,
          career,
          career.currentStandings || []
        );
        set({
          career: {
            ...career,
            playoffBracket: resolvedBracket,
            liveGame: null,
            seasonPhase: 'POSTSEASON_BRACKET',
          },
        });
        return;
      }

      // 2-c) 파이널 결정전이 끝났지만 시리즈가 계속되면 대진표로 복귀
      if (
        finishedType === 'LEAGUE_FINALS' &&
        career.liveGame?.isFinished &&
        career.playoffBracket &&
        !career.playoffBracket.championTeamId
      ) {
        const finalsSeries = getPlayerFinalsSeries(career.playoffBracket);
        const next = finalsSeries
          ? getDecisiveGameContext(finalsSeries, career.team.id)
          : null;
        set({
          career: {
            ...career,
            liveGame: null,
            seasonPhase: 'POSTSEASON_BRACKET',
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '파이널 시리즈 계속',
            description: next
              ? `시리즈 ${next.playerWins}승 ${next.oppWins}패 — ${next.gameNo}차전 결정전이 기다리고 있습니다.`
              : undefined,
            tone: 'orange',
          },
        });
        return;
      }

      // 3) 파이널 종료 -> 시즌 최종 정산 및 오프시즌 진입
      if (career.pendingSeasonSettlement || !career.offseasonLocked) {
        const checked = applyLatestSeasonRecordChecks(get().recordBook, {
          ...career,
          liveGame: null,
        });
        const preservedCare =
          (checked.nextCareer.activePersonalCare || []).length > 0
            ? checked.nextCareer.activePersonalCare
            : get().lastPersonalCareIds;
        const finalized = finalizeSeasonAndEnterOffseason(checked.nextCareer);
        const recToast = buildRecordBreakToast(checked.brokenRecords);
        set({
          recordBook: checked.nextBook,
          lastPersonalCareIds: preservedCare,
          career: finalized.career,
          ...(finalized.retiredView ? { view: 'RETIREMENT' as const } : {}),
          ...(recToast ? { toast: recToast } : {}),
        });
        return;
      }

      set({
        career: {
          ...career,
          liveGame: null,
          seasonPhase: 'OFFSEASON',
        },
      });
    },
  };
}
