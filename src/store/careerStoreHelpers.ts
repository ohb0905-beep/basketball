/**
 * 커리어 스토어 공용 헬퍼: 시즌 정산, 라이브 경기 반영, 기록 체크 등 순수 함수
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  INTERNATIONAL_TOURNAMENT_CONFIG,
  clampNum,
  getPersonalCareCostFromConfig,
} from '../config/balanceConfig';
import {
  rollSeasonEventQueue,
} from '../data/events';
import {
  generateSeasonHeadline,
} from '../data/headlines';
import {
  isHighSchoolLeague,
  LEAGUE_CONFIG,
} from '../data/leagues';
import {
  evolveLeagueTeamRatings,
  getTeamById,
  SANGMU_TEAM,
  selectBestFitTeamForPlayer,
} from '../data/teams';
import {
  evaluateHighSchoolProspect,
  generateOffseasonOptions,
} from '../engine/draftEngine';
import {
  getLiveGameTournamentType,
  isInternationalLiveGame,
  resolveConfFinalsGame7InBracket,
} from '../engine/playoffEngine';
import {
  getEffectiveRelationships,
  getEffectiveStoryArcs,
  syncCareerRelationships,
} from '../engine/progressionEngine';
import {
  checkAndApplyRecordBreaks,
} from '../engine/recordBookEngine';
import {
  checkRetirementEligibility,
  evaluateCareerLegacy,
} from '../engine/retirementEngine';
import {
  calculateRoleAndMpg,
  getContractDefaultSalary,
  getSangmuDischargeContractType,
} from '../engine/seasonSimulator';
import {
  CareerState,
  InternationalTournamentRecord,
  LeagueId,
  LiveGameState,
  PersonalCareId,
  RecordBookState,
  RecordBreakEvent,
} from '../types/game';
import type { ToastMessage } from './careerStoreTypes';

export function getPersonalCarePackageCost(
  careId: PersonalCareId,
  league: LeagueId
): number {
  return getPersonalCareCostFromConfig(careId, league);
}

export function getEffectiveCashBalance(career: CareerState): number {
  return career.cashBalance !== undefined
    ? career.cashBalance
    : career.careerEarnings || 0;
}

export function applyLatestSeasonRecordChecks(
  recordBook: RecordBookState,
  career: CareerState
): {
  nextBook: RecordBookState;
  nextCareer: CareerState;
  brokenRecords: RecordBreakEvent[];
} {
  if (!career.seasonLogs || career.seasonLogs.length === 0) {
    return { nextBook: recordBook, nextCareer: career, brokenRecords: [] };
  }
  const latestLog = career.seasonLogs[career.seasonLogs.length - 1];
  const { nextBook, brokenRecords, milestones } = checkAndApplyRecordBreaks(
    recordBook,
    career,
    latestLog
  );
  if (brokenRecords.length === 0) {
    return { nextBook, nextCareer: career, brokenRecords: [] };
  }
  const existingIds = new Set(career.milestones.map((m) => m.id));
  const uniqueMilestones = milestones.filter((m) => !existingIds.has(m.id));
  return {
    nextBook,
    nextCareer: {
      ...career,
      milestones: [...career.milestones, ...uniqueMilestones],
    },
    brokenRecords,
  };
}

export function buildRecordBreakToast(
  brokenRecords: RecordBreakEvent[]
): ToastMessage | null {
  if (brokenRecords.length === 0) return null;
  const first = brokenRecords[0];
  const formattedVal =
    first.unit === '점' || first.unit === '회'
      ? `${first.newValue.toLocaleString()}${first.unit}`
      : `${first.newValue.toFixed(1)} ${first.unit}`;
  const leagueShort = LEAGUE_CONFIG[first.league]?.shortName || first.league;
  return {
    id: `TOAST_REC_${Date.now()}`,
    title:
      brokenRecords.length > 1
        ? `${leagueShort} 역대 신기록 ${brokenRecords.length}개 경신`
        : `${leagueShort} 역대 ${first.label} 신기록`,
    description: `${first.label} ${formattedVal} 달성 (종전 ${first.previousHolder})`,
    tone: 'amber',
  };
}

export function buildTeamTransferRelationships(
  career: CareerState,
  nextCoachTrust: number
) {
  const prevRel = getEffectiveRelationships(career);
  const clampedTrust = clampNum(Math.round(nextCoachTrust), 10, 100);
  return {
    coachTrust: clampedTrust,
    lockerRoom: 52,
    frontOffice: 52,
    mediaFan: prevRel.mediaFan,
  };
}

export function dequeueNextPendingEvent(career: CareerState): CareerState {
  if (career.pendingEvent) return career;
  const queue = career.pendingEventQueue || [];
  if (queue.length === 0) return career;
  const [nextEvt, ...restQueue] = queue;
  const nextSeenIds = [...(career.seenEventIds || [])];
  if (!nextSeenIds.includes(nextEvt.id)) {
    nextSeenIds.push(nextEvt.id);
  }
  const nextRecentCats = [...(career.recentEventCategories || []), nextEvt.category].slice(-6);
  const nextPendingChain =
    career.pendingChainEvent && nextEvt.id === career.pendingChainEvent.id
      ? null
      : career.pendingChainEvent || null;
  return {
    ...career,
    pendingEvent: nextEvt,
    pendingEventQueue: restQueue,
    seenEventIds: nextSeenIds,
    recentEventCategories: nextRecentCats,
    pendingChainEvent: nextPendingChain,
    agentAdviceShown:
      career.agentAdviceShown || nextEvt.id === 'EVT_AGENT_RETIREMENT_ADVICE',
    veteranReinventionOffered:
      career.veteranReinventionOffered || nextEvt.id === 'EVT_VETERAN_REINVENTION',
  };
}

export function refreshChampionSeasonHeadline(
  career: CareerState,
  log: CareerState['seasonLogs'][number]
): string {
  if (!log.wonChampionship) return log.headline;
  const priorMvps = Math.max(0, career.totals.mvps - (log.wonMvp ? 1 : 0));
  return generateSeasonHeadline({
    playerName: career.name,
    teamName: log.teamName,
    teamShortName: log.teamShortName,
    league: log.league,
    leagueName: log.leagueName,
    pos: career.primaryPos,
    role: log.role,
    ppg: log.ppg,
    rpg: log.rpg,
    apg: log.apg,
    spg: log.spg,
    bpg: log.bpg,
    singleGameHighPts: log.singleGameHighPts,
    wonChampionship: true,
    wonMvp: log.wonMvp,
    allStarSelected: log.allStarSelected,
    isFarewellTour: career.isFarewellTour,
    priorMvpsCount: priorMvps,
  });
}

export function finalizeSeasonAndEnterOffseason(career: CareerState): {
  career: CareerState;
  retiredView: boolean;
} {
  const settlement = career.pendingSeasonSettlement;
  const completedSeasonYear = career.seasonYear;
  const nextAge = career.age + 1;
  const nextSeasonYear = career.seasonYear + 1;
  const nextSeasonsPlayed = career.seasonsPlayed + 1;
  let nextContractYearsLeft = Math.max(0, career.contractYearsLeft - 1);
  const nextTwoWaySeasonsUsed =
    career.contractType === 'TWO_WAY'
      ? career.twoWaySeasonsUsed + 1
      : career.twoWaySeasonsUsed;
  const nextPedigreeSeasonsLeft = Math.max(
    0,
    (career.draftPedigreeSeasonsLeft ?? 0) - 1
  );

  const nextRatingsMap = evolveLeagueTeamRatings(career.teamRatingsMap || {});
  let nextTeam = getTeamById(career.team.id, nextRatingsMap) || career.team;
  let nextLeague = career.league;
  let nextContractType = career.contractType;
  let nextAnnualSalary = career.annualSalary;
  let nextMilitaryExempt = career.militaryExempt;
  let nextMilitaryLeft = career.militaryServiceSeasonsLeft;
  let nextPrevTeam = career.previousTeamBeforeMilitary;
  let dischargedThisOffseason = false;
  const newMilestones = [...career.milestones];

  const settledStats = settlement ? settlement.nextStats : career.stats;
  const settledDelta = settlement ? settlement.statDelta : career.lastSeasonDelta;
  const settledOvr = settlement ? settlement.nextOvr : career.ovr;
  const settledPotential = settlement ? settlement.nextPotential : career.potential;
  let settledTrust = settlement ? settlement.nextCoachTrust : career.coachTrust;
  const latestSeasonLog = career.seasonLogs[career.seasonLogs.length - 1];
  const baseSettledStock = settlement ? settlement.nextDraftStock : career.draftStock;
  const champStockBonus = latestSeasonLog?.wonChampionship ? 10 : 0;
  const settledStock = Math.min(100, baseSettledStock + champStockBonus);
  const settledBadges = settlement ? settlement.nextBadges : career.badges;
  const settledTraits = settlement ? settlement.nextTraits : career.traits;
  const settledBrokenPromise = settlement
    ? settlement.brokenRolePromise
    : career.brokenRolePromise;
  let settledRelationships = settlement?.nextRelationships
    ? { ...settlement.nextRelationships, coachTrust: settledTrust }
    : { ...getEffectiveRelationships(career), coachTrust: settledTrust };
  let settledRole = career.role;
  let settledSeasonsOnTeam = career.seasonsOnCurrentTeam ?? 0;

  if (nextMilitaryLeft > 0) {
    nextMilitaryLeft -= 1;
    if (nextMilitaryLeft === 0) {
      dischargedThisOffseason = true;
      nextMilitaryExempt = true;
      const returnTeam =
        (nextPrevTeam && getTeamById(nextPrevTeam.id, nextRatingsMap)) ||
        selectBestFitTeamForPlayer(
          'KBL',
          career.primaryPos,
          career.secondaryPos,
          nextRatingsMap
        );
      nextTeam = returnTeam;
      nextLeague = returnTeam.league;
      nextContractType = getSangmuDischargeContractType(
        returnTeam.league,
        settledOvr
      );
      nextContractYearsLeft = 0;
      nextAnnualSalary = getContractDefaultSalary(nextContractType, settledOvr);
      nextPrevTeam = null;
      settledSeasonsOnTeam = 0;
      settledTrust = 54;
      settledRelationships = buildTeamTransferRelationships(
        { ...career, relationships: settledRelationships },
        settledTrust
      );
      settledRole = calculateRoleAndMpg({
        ...career,
        ovr: settledOvr,
        stats: settledStats,
        league: nextLeague,
        team: nextTeam,
        contractType: nextContractType,
        coachTrust: settledTrust,
      }).role;

      newMilestones.push({
        id: `MS_DISCHARGE_${nextSeasonYear}`,
        year: nextSeasonYear,
        age: nextAge,
        title: '국군체육부대 상무 만기 전역',
        description:
          '2시즌 동안의 상무 복무를 마치고 프로 코트로 복귀했습니다.',
        type: 'MILITARY',
        teamName: SANGMU_TEAM.name,
      });
    }
  }

  const champTeamId = career.playoffBracket?.championTeamId ?? null;
  const currentRivals = career.rivals ?? [];
  const settledRivals =
    champTeamId && currentRivals.length > 0
      ? currentRivals.map((r) =>
          r.league === career.league && r.teamId === champTeamId
            ? { ...r, championships: r.championships + 1 }
            : r
        )
      : career.rivals;

  const settledBase: CareerState = {
    ...career,
    rivals: settledRivals,
    age: nextAge,
    seasonYear: nextSeasonYear,
    seasonsPlayed: nextSeasonsPlayed,
    ovr: settledOvr,
    peakOvr: Math.max(career.peakOvr, settledOvr),
    ovrHistory: [...(career.ovrHistory || [career.ovr]), settledOvr],
    potential: settledPotential,
    potentialBreakthroughCount:
      (career.potentialBreakthroughCount || 0) +
      (settlement?.potentialBreakthroughReason ? 1 : 0),
    stats: settledStats,
    lastSeasonDelta: settledDelta,
    traits: settledTraits,
    league: nextLeague,
    team: nextTeam,
    role: settledRole,
    seasonsOnCurrentTeam: settledSeasonsOnTeam,
    contractType: nextContractType,
    contractYearsLeft: nextContractYearsLeft,
    annualSalary: nextAnnualSalary,
    activePersonalCare: [],
    campAgingShield: false,
    twoWaySeasonsUsed: nextTwoWaySeasonsUsed,
    draftPedigreeSeasonsLeft: nextPedigreeSeasonsLeft,
    brokenRolePromise: dischargedThisOffseason ? false : settledBrokenPromise,
    coachTrust: settledTrust,
    draftStock: settledStock,
    relationships: settledRelationships,
    storyArcs: getEffectiveStoryArcs(career),
    militaryExempt: nextMilitaryExempt,
    militaryServiceSeasonsLeft: nextMilitaryLeft,
    previousTeamBeforeMilitary: nextPrevTeam,
    midSeasonEventTriggeredThisYear: false,
    tradeRequestedThisYear: false,
    teamRatingsMap: nextRatingsMap,
    badges: settledBadges,
    milestones: newMilestones,
    liveGame: null,
    seasonPhase: 'OFFSEASON',
    offseasonLocked: true,
    offseasonOptions: [],
    pendingEvent: null,
    pendingEventQueue: [],
    pendingSeasonSettlement: null,
  };

  if (
    isHighSchoolLeague(settledBase.league) &&
    (settledBase.age >= 19 || settledBase.contractYearsLeft === 0)
  ) {
    const hsEval = evaluateHighSchoolProspect(settledBase);
    settledBase.prospectStars = hsEval.stars;
  }

  if (career.isFarewellTour) {
    const legacyEval = evaluateCareerLegacy(settledBase);
    return {
      career: {
        ...settledBase,
        farewellTourCompleted: true,
        retirementReason: 'LEGEND_FAREWELL_TOUR',
        legacyEvaluation: legacyEval,
      },
      retiredView: true,
    };
  }

  const retirementEligibility = checkRetirementEligibility(settledBase);
  if (retirementEligibility.isMandatoryAge40) {
    const legacyEval = evaluateCareerLegacy(settledBase);
    return {
      career: {
        ...settledBase,
        retirementReason: 'AGE_40_MANDATORY',
        legacyEvaluation: legacyEval,
      },
      retiredView: true,
    };
  }

  const rolledQueue = rollSeasonEventQueue(
    settledBase,
    Math.random,
    completedSeasonYear
  );
  const withQueued = dequeueNextPendingEvent({
    ...settledBase,
    pendingEventQueue: rolledQueue,
  });

  const offseasonOptions = generateOffseasonOptions(withQueued);
  const hasNoActiveOffers =
    offseasonOptions.length === 1 &&
    offseasonOptions[0].actionType === 'RETIRE_OUT_OF_LEAGUE';

  return {
    career: {
      ...withQueued,
      isOutOfLeagueWarning: hasNoActiveOffers,
      offseasonOptions,
    },
    retiredView: false,
  };
}

export function applyCompletedLiveGameOutcome(
  career: CareerState,
  finishedLive: LiveGameState
): CareerState {
  if (!finishedLive.isFinished || !finishedLive.finalOutcome) {
    return { ...career, liveGame: finishedLive };
  }

  const outcome = finishedLive.finalOutcome;
  const ps = finishedLive.playerStats;
  const isIntlLive = isInternationalLiveGame(finishedLive.gameType);
  const liveEventYear = isIntlLive
    ? finishedLive.internationalTournamentYear ?? career.seasonYear
    : career.seasonYear;
  const nextHighs = { ...career.careerHighs };
  // 국제대회 라이브 단일 경기 득점은 리그 커리어하이/역대 기록실과 분리해 오염 방지
  if (!isIntlLive && ps.pts > nextHighs.points) {
    nextHighs.points = ps.pts;
    nextHighs.pointsContext = `${liveEventYear}시즌 ${finishedLive.title}`;
    nextHighs.pointsLeague = career.league;
  }
  if (!isIntlLive) {
    nextHighs.rebounds = Math.max(nextHighs.rebounds, ps.reb);
    nextHighs.assists = Math.max(nextHighs.assists, ps.ast);
    nextHighs.steals = Math.max(nextHighs.steals, ps.stl);
    nextHighs.blocks = Math.max(nextHighs.blocks, ps.blk);
  }

  let nextCareer: CareerState = {
    ...career,
    liveGame: finishedLive,
    careerHighs: nextHighs,
  };

  if (isInternationalLiveGame(finishedLive.gameType)) {
    const tournamentType =
      getLiveGameTournamentType(finishedLive) || 'ASIAN_GAMES';
    const tournamentYear =
      finishedLive.internationalTournamentYear ?? career.seasonYear;
    const tourneyCfg = INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType];
    const preMatches = finishedLive.internationalPreMatches || [];
    const totalGames = preMatches.length + 1;
    const sumPts =
      preMatches.reduce((acc, m) => acc + m.playerPts, 0) + ps.pts;
    const sumReb =
      preMatches.reduce((acc, m) => acc + m.playerReb, 0) + ps.reb;
    const sumAst =
      preMatches.reduce((acc, m) => acc + m.playerAst, 0) + ps.ast;

    const medal =
      outcome.medal ||
      (finishedLive.gameType === 'INTERNATIONAL_BRONZE'
        ? outcome.won
          ? 'BRONZE'
          : 'FOURTH'
        : outcome.won
        ? 'GOLD'
        : 'SILVER');

    const medalLabel =
      medal === 'GOLD'
        ? '금메달'
        : medal === 'SILVER'
        ? '은메달'
        : medal === 'BRONZE'
        ? '동메달'
        : '4위';

    const medalMatchLog = {
      stage: 'SEMIFINAL' as const,
      stageLabel:
        finishedLive.gameType === 'INTERNATIONAL_BRONZE'
          ? '3·4위전 (동메달 결정전)'
          : '결승전',
      opponentName: finishedLive.opponentTeam.shortName,
      korScore: finishedLive.teamScore,
      oppScore: finishedLive.oppScore,
      playerPts: ps.pts,
      playerReb: ps.reb,
      playerAst: ps.ast,
      won: outcome.won,
    };

    const record: InternationalTournamentRecord = {
      id: `INTL_${tournamentType}_${tournamentYear}_${Date.now()}`,
      year: tournamentYear,
      age: career.age,
      tournamentType,
      tournamentName: tourneyCfg.name,
      result: medal,
      wonMvp: Boolean(outcome.wonTournamentMvp),
      grantedMilitaryExemption: Boolean(
        outcome.grantedMilitaryExemption && !career.militaryExempt
      ),
      avgPts: Number((sumPts / totalGames).toFixed(1)),
      avgReb: Number((sumReb / totalGames).toFixed(1)),
      avgAst: Number((sumAst / totalGames).toFixed(1)),
      opponentInMedalGame: finishedLive.opponentTeam.shortName,
      medalGameScore: `${finishedLive.teamScore}-${finishedLive.oppScore}`,
      matches: [...preMatches, medalMatchLog],
      summaryHeadline: outcome.headline,
    };

    const prevMedals = career.totals.internationalMedals || {
      gold: 0,
      silver: 0,
      bronze: 0,
    };
    const nextMedals = {
      gold: prevMedals.gold + (medal === 'GOLD' ? 1 : 0),
      silver: prevMedals.silver + (medal === 'SILVER' ? 1 : 0),
      bronze: prevMedals.bronze + (medal === 'BRONZE' ? 1 : 0),
    };

    const earnedNewExemption = Boolean(
      outcome.grantedMilitaryExemption && !career.militaryExempt
    );
    const stockGain =
      medal === 'GOLD'
        ? 10
        : medal === 'SILVER'
        ? 6
        : medal === 'BRONZE'
        ? 4
        : 1;

    const existingHistory = (career.internationalHistory || []).filter(
      (r) => !(r.year === tournamentYear && r.tournamentType === tournamentType)
    );

    const logs = [...career.seasonLogs];
    if (logs.length > 0) {
      const lastIdx = logs.length - 1;
      logs[lastIdx] = {
        ...logs[lastIdx],
        narrativeLog: [outcome.headline, ...logs[lastIdx].narrativeLog],
      };
    }

    const syncedIntl = syncCareerRelationships(career, {
      mediaFan: medal === 'GOLD' ? 10 : medal === 'SILVER' ? 7 : medal === 'BRONZE' ? 5 : 2,
      lockerRoom: 3,
    });
    const nextTotalsIntl = {
      ...career.totals,
      internationalCaps: (career.totals.internationalCaps || 0) + totalGames,
      internationalMedals: nextMedals,
      internationalMvps:
        (career.totals.internationalMvps || 0) +
        (outcome.wonTournamentMvp ? 1 : 0),
    };

    nextCareer = {
      ...nextCareer,
      militaryExempt: career.militaryExempt || earnedNewExemption,
      draftStock: Math.min(100, career.draftStock + stockGain),
      coachTrust: syncedIntl.coachTrust,
      relationships: syncedIntl.relationships,
      seasonLogs: logs,
      internationalHistory: [record, ...existingHistory],
      lastInternationalSummary: record,
      totals: nextTotalsIntl,
      milestones: [
        ...career.milestones,
        {
          id: `MS_INTL_${tournamentType}_${tournamentYear}_${Date.now()}`,
          year: tournamentYear,
          age: career.age,
          title: `${tournamentYear} ${tourneyCfg.shortName} ${medalLabel}${
            outcome.wonTournamentMvp ? ' · 대회 MVP' : ''
          }${earnedNewExemption ? ' · 병역특례' : ''}`,
          description: outcome.headline,
          type: medal === 'GOLD' || earnedNewExemption ? 'AWARD' : 'SPECIAL',
          teamName: '대한민국 국가대표팀',
        },
      ],
    };
    return nextCareer;
  }

  if (finishedLive.gameType === 'CONF_FINALS_GAME7') {
    const scoreLine = `${finishedLive.playerTeam.shortName} ${finishedLive.teamScore}:${finishedLive.oppScore} ${finishedLive.opponentTeam.shortName}`;
    const updatedBracket = career.playoffBracket
      ? resolveConfFinalsGame7InBracket(
          career.playoffBracket,
          career,
          career.currentStandings || [],
          outcome.won,
          scoreLine
        )
      : null;

    const logs = [...career.seasonLogs];
    if (logs.length > 0) {
      const lastIdx = logs.length - 1;
      logs[lastIdx] = {
        ...logs[lastIdx],
        singleGameHighPts: Math.max(logs[lastIdx].singleGameHighPts, ps.pts),
        playoffResult: updatedBracket
          ? updatedBracket.playoffResultLabel
          : outcome.won
          ? '파이널 진출'
          : '컨퍼런스 파이널 탈락',
        narrativeLog: [outcome.headline, ...logs[lastIdx].narrativeLog],
      };
    }

    const nextMilestones = [...career.milestones];
    if (outcome.won) {
      nextMilestones.push({
        id: `MS_CF_G7_${career.seasonYear}_${Date.now()}`,
        year: career.seasonYear,
        age: career.age,
        title: '컨퍼런스 파이널 7차전 승리 · 파이널 진출',
        description: outcome.headline,
        type: 'SPECIAL',
        teamName: career.team.name,
      });
    }

    return {
      ...nextCareer,
      playoffBracket: updatedBracket,
      seasonLogs: logs,
      milestones: nextMilestones,
    };
  }

  // LEAGUE_FINALS 결과 반영
  const logs = [...career.seasonLogs];
  const nextTotals = { ...career.totals };
  const nextMilestones = [...career.milestones];
  if (logs.length > 0) {
    const lastIdx = logs.length - 1;
    const prevLog = logs[lastIdx];
    const wasChampBefore = prevLog.wonChampionship;
    const wasFmvpBefore = prevLog.wonFinalsMvp;

    if (outcome.won && !wasChampBefore) {
      nextTotals.championships += 1;
      if (prevLog.league === 'NBA') nextTotals.nbaChampionships += 1;
      nextMilestones.push({
        id: `MS_CHAMP_${prevLog.year}_${Date.now()}`,
        year: prevLog.year,
        age: prevLog.age,
        title: `${prevLog.leagueName} 챔피언십 우승${
          outcome.wonFinalsMvp ? ' · 파이널 MVP' : ''
        }`,
        description: outcome.headline,
        type: 'CHAMPIONSHIP',
        teamName: prevLog.teamName,
      });
    } else if (!outcome.won && wasChampBefore) {
      nextTotals.championships = Math.max(0, nextTotals.championships - 1);
      if (prevLog.league === 'NBA') {
        nextTotals.nbaChampionships = Math.max(0, nextTotals.nbaChampionships - 1);
      }
    }

    if (outcome.wonFinalsMvp && !wasFmvpBefore) {
      nextTotals.finalsMvps = (nextTotals.finalsMvps || 0) + 1;
    }

    const updatedLog = {
      ...prevLog,
      singleGameHighPts: Math.max(prevLog.singleGameHighPts, ps.pts),
      wonChampionship: outcome.won,
      wonFinalsMvp: outcome.wonFinalsMvp,
      playoffResult: outcome.won ? '리그 우승' : '파이널 준우승',
      narrativeLog: [outcome.headline, ...prevLog.narrativeLog],
    };
    logs[lastIdx] = outcome.won
      ? {
          ...updatedLog,
          headline: refreshChampionSeasonHeadline(career, updatedLog),
        }
      : updatedLog;
  }

  const updatedBracket = career.playoffBracket
    ? (() => {
        const champTeamId = outcome.won
          ? career.team.id
          : finishedLive.opponentTeam.id;
        const nextRounds = career.playoffBracket.rounds.map((roundList, rIdx) => {
          if (rIdx !== career.playoffBracket!.rounds.length - 1) return roundList;
          return roundList.map((s) => {
            if (!s.involvesPlayer) return s;
            const tiedWins = Math.max(0, s.winsNeeded - 1);
            const hiWon = s.higherSeed.team.id === champTeamId;
            return {
              ...s,
              higherSeedWins: hiWon ? s.winsNeeded : tiedWins,
              lowerSeedWins: hiWon ? tiedWins : s.winsNeeded,
              winnerId: champTeamId,
            };
          });
        });
        return {
          ...career.playoffBracket,
          rounds: nextRounds,
          championTeamId: champTeamId,
          playerEliminated: !outcome.won,
          playoffResultLabel: outcome.won ? '리그 우승' : '파이널 준우승',
        };
      })()
    : null;

  return {
    ...nextCareer,
    seasonLogs: logs,
    totals: nextTotals,
    milestones: nextMilestones,
    playoffBracket: updatedBracket,
  };
}


export function clampStat(val: number): number {
  return Math.max(35, Math.min(99, Math.round(val)));
}
