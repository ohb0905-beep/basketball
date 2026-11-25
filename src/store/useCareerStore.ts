'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AGING_RETIREMENT_CONFIG,
  DRAFT_SCOUTING_CONFIG,
  ECONOMY_CONFIG,
  INTERNATIONAL_TOURNAMENT_CONFIG,
  LEAGUE_BALANCE_META,
  ROLE_MPG_CONFIG,
  canUseProTradeSystem,
  clampNum,
  getPersonalCareCostFromConfig,
  isPersonalCareAllowedInLeague,
} from '../config/balanceConfig';
import {
  createSangmuEnlistmentEvent,
  getMilitaryEnlistAgeForLeague,
  rollMidSeasonCrossroadsEvent,
  rollSeasonEventQueue,
} from '../data/events';
import { generateSeasonHeadline } from '../data/headlines';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  ALL_TEAMS,
  evolveLeagueTeamRatings,
  getTeamById,
  getTeamsByLeague,
  HIGH_SCHOOL_TEAMS,
  SANGMU_TEAM,
  selectBestFitTeamForPlayer,
} from '../data/teams';
import {
  calculateOffseasonTradeAcceptProb,
  calculateProjectedNbaPick,
  createInitialCombineState,
  determineTeamRolePromise,
  evaluateHighSchoolProspect,
  executeDraftResolution,
  generateOffseasonOptions,
  ROLE_PROMISE_LABELS,
} from '../engine/draftEngine';
import { resolveEncounterChoiceOutcome } from '../engine/encounterEngine';
import {
  evaluateFreshmanAdaptation,
  isNcaaFreshmanSeason,
} from '../engine/freshmanAdaptation';
import {
  advancePlayoffRound,
  batchAdvanceEarlyPlayoffRounds,
  createLiveFinalGame,
  createPlayoffBracket,
  evaluateRealisticFinalsMvp,
  getLiveGameTournamentType,
  isInternationalLiveGame,
  resolveClutchPossession,
  resolveConfFinalsGame7InBracket,
  simulateInternationalTournament,
  simulateLiveQuarter,
  skipEntirePlayoffs,
} from '../engine/playoffEngine';
import {
  applyRelationshipDelta,
  createInitialRelationships,
  createInitialStoryArcs,
  evaluateNationalTeamRetirement,
  getEffectiveRelationships,
  getEffectiveStoryArcs,
  isNationalTeamEvent,
  syncCareerRelationships,
} from '../engine/progressionEngine';
import { checkEncounterChoiceUnlock } from '../engine/storyArcEngine';
import {
  checkAndApplyRecordBreaks,
  createInitialRecordBook,
  syncRecordBookWithHof,
} from '../engine/recordBookEngine';
import {
  buildHallOfFameEntry,
  checkRetirementEligibility,
  evaluateCareerLegacy,
} from '../engine/retirementEngine';
import {
  calculateRoleAndMpg,
  computeCareerMinutes,
  generateDraftRivals,
  getContractDefaultSalary,
  getSangmuDischargeContractType,
  simulateSeason,
} from '../engine/seasonSimulator';
import {
  applyAgeAdjustedEventStatChanges,
  applySpecialCampProgram,
  calculateOvr,
  canSwitchToPosition,
  createInitialStats,
  enforceBiomechanicalCaps,
  evaluatePlayerBadges,
  getGrowthDnaInfo,
  getPlaystyleInfo,
  getTraitInfo,
  reconcilePlaystyleForPosition,
  rollInitialPotential,
  rollInnateTrait,
  rollPlayerDnaAndPlaystyle,
} from '../engine/statCalculator';
import {
  CareerEvent,
  CareerEventChoice,
  CareerMilestone,
  CareerState,
  SeasonBoxScore,
  ClutchChoiceId,
  ContractType,
  EncounterResolutionResult,
  HallOfFameEntry,
  InternationalTournamentRecord,
  InternationalTournamentType,
  LeagueId,
  LiveGameState,
  LiveTacticId,
  OffseasonOption,
  PersonalCareId,
  PlayerStats,
  Position,
  RecordBookState,
  RecordBreakEvent,
  ResetScope,
  RetirementReason,
  SpecialCampType,
  TeamInfo,
  TrainingFocus,
  TrainingPresetId,
  ViewState,
} from '../types/game';
import { formatCurrencyDetailed } from '../utils/formatters';
import { migratePersistedPayload } from './saveMigration';

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

function applyLatestSeasonRecordChecks(
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

function buildRecordBreakToast(
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

function buildTeamTransferRelationships(
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

function dequeueNextPendingEvent(career: CareerState): CareerState {
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

function refreshChampionSeasonHeadline(
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

function finalizeSeasonAndEnterOffseason(career: CareerState): {
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
    settledBase.league === 'HIGH_SCHOOL' &&
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

function applyCompletedLiveGameOutcome(
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

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'orange' | 'emerald' | 'amber' | 'rose' | 'slate';
}

interface CareerStoreState {
  view: ViewState;
  career: CareerState | null;
  hofList: HallOfFameEntry[];
  recordBook: RecordBookState;
  fastSimEnabled: boolean;
  lastPersonalCareIds: PersonalCareId[];
  espnLogos: Record<string, string>;
  espnApiConnected: boolean;
  toast: ToastMessage | null;
  lastEncounterOutcome: EncounterResolutionResult | null;
  hofRetrospectiveId: string | null;

  // Actions
  setView: (view: ViewState) => void;
  openHofRetrospective: (entryId: string) => void;
  closeHofRetrospective: () => void;
  showToast: (title: string, description?: string, tone?: ToastMessage['tone']) => void;
  clearToast: () => void;
  dismissEncounterOutcome: () => void;
  setEspnLogos: (logos: Record<string, string>) => void;
  toggleFastSim: () => void;
  exportSaveJson: () => string;
  importSaveJson: (raw: string) => { ok: boolean; message: string };

  startNewCareer: (params: {
    name: string;
    jerseyNumber: string;
    heightCm: number;
    primaryPos: Position;
    highSchoolTeamId: string;
  }) => void;

  setTrainingFocus: (focus: TrainingFocus) => void;
  applyTrainingPreset: (presetId: TrainingPresetId) => void;
  switchPrimaryPosition: (newPos: Position) => void;
  unlockSecondaryPosition: (secPos: Position) => void;
  runSpecialCamp: (campType: SpecialCampType) => void;
  purchasePersonalCare: (careId: PersonalCareId) => void;
  reapplyLastPersonalCare: () => void;
  requestTrade: () => void;
  declareNationalTeamRetirement: () => void;
  triggerMidSeasonCrossroads: () => void;

  playSeason: () => void;
  advancePlayoffBracketRound: () => void;
  batchAdvanceEarlyPlayoffs: () => void;
  skipPlayoffsToEnd: () => void;
  enterOffseasonFromPlayoffs: () => void;
  startFinalsLiveBroadcast: () => void;
  setLiveGameTactic: (tactic: LiveTacticId) => void;
  playNextLiveQuarter: () => void;
  resolveLiveClutchChoice: (choice: ClutchChoiceId) => void;
  skipLiveGame: () => void;
  closeLiveGameAndReturn: () => void;

  resolveEventChoice: (choice: CareerEventChoice) => void;
  selectOffseasonOption: (option: OffseasonOption) => void;

  // Draft Combine & Live Draft Actions
  runCombineDrill: (drillId: string, label: string, statKey: keyof PlayerStats) => void;
  completeCombineInterview: (answerType: 'CONFIDENT' | 'TEAM_FIRST' | 'ANALYTICAL') => void;
  withdrawFromDraft: () => void;
  proceedToDraftLive: () => void;
  finalizeDraftSigning: (choice: 'NBA_STANDARD' | 'TWO_WAY' | 'GLEAGUE' | 'KBL') => void;

  // Retirement & Reset Actions
  triggerRetirement: (reason: RetirementReason) => void;
  completeRetirementAndReturnHome: () => void;
  resetActiveCareer: () => void;
  recordBookManuallyReset: boolean;
  dismissInternationalSummary: () => void;
  resetRecordBookOnly: () => void;
  resetHallOfFameOnly: () => void;
  resetAllGameData: () => void;
  resetByScope: (scope: ResetScope) => void;
}

function clampStat(val: number): number {
  return Math.max(35, Math.min(99, Math.round(val)));
}

export const useCareerStore = create<CareerStoreState>()(
  persist(
    (set, get) => ({
      view: 'HOME',
      career: null,
      hofList: [], // 초기 100% 공석 (더미 데이터 절대 금지)
      recordBook: createInitialRecordBook(),
      recordBookManuallyReset: false,
      fastSimEnabled: false,
      lastPersonalCareIds: [],
      espnLogos: {},
      espnApiConnected: false,
      toast: null,
      lastEncounterOutcome: null,
      hofRetrospectiveId: null,

      setView: (view) => set({ view, hofRetrospectiveId: null }),
      openHofRetrospective: (entryId) => set({ hofRetrospectiveId: entryId }),
      closeHofRetrospective: () => set({ hofRetrospectiveId: null }),

      showToast: (title, description, tone = 'orange') => {
        const id = `TOAST_${Date.now()}`;
        set({ toast: { id, title, description, tone } });
      },

      clearToast: () => set({ toast: null }),

      dismissEncounterOutcome: () =>
        set((state) => ({
          lastEncounterOutcome: null,
          career:
            state.career &&
            !state.career.pendingEvent &&
            !state.career.liveGame &&
            !state.career.lastInternationalSummary
              ? dequeueNextPendingEvent(state.career)
              : state.career,
        })),

      dismissInternationalSummary: () =>
        set((state) => {
          if (!state.career) return { career: null };
          const cleared: CareerState = {
            ...state.career,
            lastInternationalSummary: null,
          };
          return {
            career:
              !cleared.pendingEvent && !cleared.liveGame
                ? dequeueNextPendingEvent(cleared)
                : cleared,
          };
        }),

      toggleFastSim: () =>
        set((state) => ({
          fastSimEnabled: !state.fastSimEnabled,
        })),

      exportSaveJson: () => {
        const { career, hofList, recordBook, fastSimEnabled, lastPersonalCareIds } =
          get();
        return JSON.stringify(
          {
            app: 'road-to-mvp',
            version: 2,
            exportedAt: new Date().toISOString(),
            career,
            hofList,
            recordBook,
            fastSimEnabled,
            lastPersonalCareIds,
          },
          null,
          2
        );
      },

      importSaveJson: (raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') {
            return {
              ok: false,
              message: '올바른 JSON 백업 파일 형식이 아닙니다.',
            };
          }
          const importedCareer = parsed.career ?? null;
          const importedHof = Array.isArray(parsed.hofList)
            ? parsed.hofList
            : get().hofList;

          if (importedCareer !== null) {
            const validCareer =
              typeof importedCareer === 'object' &&
              typeof importedCareer.id === 'string' &&
              typeof importedCareer.name === 'string' &&
              typeof importedCareer.age === 'number' &&
              typeof importedCareer.seasonYear === 'number' &&
              importedCareer.stats &&
              typeof importedCareer.stats.ins === 'number' &&
              importedCareer.team &&
              typeof importedCareer.team.id === 'string' &&
              importedCareer.totals &&
              typeof importedCareer.totals.gp === 'number';

            if (!validCareer) {
              return {
                ok: false,
                message: '커리어 데이터가 손상되었거나 필수 항목이 누락되었습니다.',
              };
            }
          } else if (!Array.isArray(parsed.hofList)) {
            return {
              ok: false,
              message: '복원할 커리어 또는 명예의 전당 기록이 없습니다.',
            };
          }

          const migrated = migratePersistedPayload({
            career: importedCareer,
            hofList: importedHof,
            recordBook: parsed.recordBook ?? get().recordBook,
          });

          set({
            career: migrated.career,
            hofList: migrated.hofList,
            recordBook: migrated.recordBook,
            recordBookManuallyReset: false,
            fastSimEnabled:
              typeof parsed.fastSimEnabled === 'boolean'
                ? parsed.fastSimEnabled
                : get().fastSimEnabled,
            lastPersonalCareIds: Array.isArray(parsed.lastPersonalCareIds)
              ? parsed.lastPersonalCareIds
              : get().lastPersonalCareIds,
            lastEncounterOutcome: null,
            view: migrated.career
              ? migrated.career.retirementReason
                ? 'RETIREMENT'
                : 'DASHBOARD'
              : 'HOME',
            toast: {
              id: `TOAST_${Date.now()}`,
              title: '세이브 데이터 복원 완료',
              description: migrated.career
                ? `${migrated.career.name} (${migrated.career.seasonYear}시즌) 커리어를 불러왔습니다.`
                : `명예의 전당 기록 ${migrated.hofList.length}건을 복원했습니다.`,
              tone: 'emerald',
            },
          });

          return {
            ok: true,
            message: '백업 데이터를 복원했습니다.',
          };
        } catch {
          return {
            ok: false,
            message: 'JSON 파싱에 실패했습니다. 백업 파일 내용을 확인해 주세요.',
          };
        }
      },

      setEspnLogos: (logos) =>
        set((state) => ({
          espnLogos: { ...state.espnLogos, ...logos },
          espnApiConnected: Object.keys(logos).length > 0,
        })),

      startNewCareer: ({
        name,
        jerseyNumber,
        heightCm,
        primaryPos,
        highSchoolTeamId,
      }) => {
        const hsTeam: TeamInfo =
          HIGH_SCHOOL_TEAMS.find((t) => t.id === highSchoolTeamId) ||
          HIGH_SCHOOL_TEAMS[0];

        const trimmedNum = jerseyNumber.trim();
        const assignedJersey =
          trimmedNum.length > 0
            ? trimmedNum
            : String(Math.floor(Math.random() * 100));

        const initialStats = createInitialStats(primaryPos, heightCm);
        const initialOvr = calculateOvr(initialStats, primaryPos, heightCm);
        const { growthDna, playstyle } = rollPlayerDnaAndPlaystyle(
          initialStats,
          primaryPos
        );
        const innateTrait = rollInnateTrait(growthDna);
        const traitInfo = getTraitInfo(innateTrait);
        const dnaInfo = getGrowthDnaInfo(growthDna);
        const styleInfo = getPlaystyleInfo(playstyle, primaryPos);

        // 잠재력(Potential) 스펙트럼 전면 개방 (68 ~ 96 연속 분포)
        const potential = rollInitialPotential(
          initialOvr,
          growthDna,
          innateTrait
        );

        const initialRatingsMap: Record<string, number> = {};
        for (const t of ALL_TEAMS) {
          initialRatingsMap[t.id] = t.rating;
        }

        const tempCareer = {
          ovr: initialOvr,
          team: hsTeam,
          coachTrust: 32,
          secondaryPos: null,
          contractType: 'AMATEUR' as const,
          league: 'HIGH_SCHOOL' as const,
          stats: initialStats,
          primaryPos,
          growthDna,
          traits: [innateTrait],
        };
        const { role } = calculateRoleAndMpg(tempCareer);

        const newCareer: CareerState = {
          id: `PLAYER_${Date.now()}`,
          name: name.trim(),
          jerseyNumber: assignedJersey,
          heightCm,
          primaryPos,
          secondaryPos: null,
          growthDna,
          playstyle,
          traits: [innateTrait],
          age: 16,
          seasonYear: 2026,
          seasonsPlayed: 0,
          ovr: initialOvr,
          peakOvr: initialOvr,
          ovrHistory: [initialOvr],
          potential,
          potentialBreakthroughCount: 0,
          stats: initialStats,
          lastSeasonDelta: { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 },
          league: 'HIGH_SCHOOL',
          team: hsTeam,
          contractType: 'AMATEUR',
          contractYearsLeft: 3,
          annualSalary: 0,
          careerEarnings: 0, // 프로 통산 누적 연봉 (아마추어 장학금과 엄격히 분리)
          cashBalance: ECONOMY_CONFIG.amateurInitialScholarshipUsd, // 고교 유망주 훈련 장학금($20K) 가용 자산
          twoWaySeasonsUsed: 0,
          draftPedigreePick: null,
          draftPedigreeRound: null,
          draftPedigreeSeasonsLeft: 0,
          promisedRole: 'PROSPECT_DEVELOPMENT',
          brokenRolePromise: false,
          role,
          coachTrust: 32,
          draftStock: 20,
          trainingFocus: 'BALANCED',
          lastCampYear: 0,
          militaryExempt: false,
          militaryServiceSeasonsLeft: 0,
          previousTeamBeforeMilitary: null,
          isFarewellTour: false,
          farewellTourCompleted: false,
          nationalTeamRetired: false,
          nationalTeamRetiredYear: null,
          nationalTeamRetiredAge: null,
          nationalTeamRetirementNote: null,
          isOutOfLeagueWarning: false,
          agentAdviceShown: false,
          midSeasonEventTriggeredThisYear: false,
          lastTradeRumorYear: null,
          seasonsOnCurrentTeam: 0,
          tradeRequestedThisYear: false,
          pendingSeasonSettlement: null,
          seenEventIds: [],
          recentEventCategories: [],
          pendingChainEvent: null,
          seasonPhase: 'REGULAR_SEASON',
          currentStandings: [],
          playoffBracket: null,
          liveGame: null,
          rivals: [],
          teamRatingsMap: initialRatingsMap,
          relationships: createInitialRelationships(32, 15),
          storyArcs: createInitialStoryArcs(),
          badges: evaluatePlayerBadges(
            initialStats,
            null,
            growthDna,
            playstyle,
            [innateTrait],
            primaryPos
          ),
          seasonLogs: [],
          milestones: [
            {
              id: `MS_DEBUT_${Date.now()}`,
              year: 2026,
              age: 16,
              title: `${hsTeam.name} 농구부 입부 (초기 OVR ${initialOvr} · ${dnaInfo.label})`,
              description: `등번호 #${assignedJersey} · ${dnaInfo.label} · ${styleInfo.label} · ${traitInfo.name}`,
              type: 'DEBUT',
              teamName: hsTeam.name,
            },
          ],
          careerHighs: {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            pointsContext: '공식 경기 기록 없음',
          },
          totals: {
            gp: 0,
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            nbaGp: 0,
            nbaPoints: 0,
            championships: 0,
            nbaChampionships: 0,
            mvps: 0,
            nbaMvps: 0,
            finalsMvps: 0,
            dpoys: 0,
            sixthManAwards: 0,
            mips: 0,
            allLeagueSelections: 0,
            allStars: 0,
            nbaAllStars: 0,
          },
          offseasonLocked: false,
          offseasonOptions: [],
          pendingEvent: null,
          combineState: null,
          draftResult: null,
          retirementReason: null,
          legacyEvaluation: null,
        };

        set({
          career: newCareer,
          lastPersonalCareIds: [],
          lastEncounterOutcome: null,
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${hsTeam.name} 입학 완료 · OVR ${initialOvr}`,
            description: `#${assignedJersey} · ${dnaInfo.label} · ${styleInfo.label} · ${traitInfo.name}`,
            tone: 'orange',
          },
        });
      },

      setTrainingFocus: (focus) => {
        const { career } = get();
        if (!career) return;
        set({
          career: {
            ...career,
            trainingFocus: focus,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '중점 훈련 변경',
            description: '다음 시즌 결산 시 선택한 훈련 비중이 반영됩니다.',
            tone: 'emerald',
          },
        });
      },

      applyTrainingPreset: (presetId) => {
        const { career } = get();
        if (!career) return;
        const isBig = career.primaryPos === 'PF' || career.primaryPos === 'C';
        const presetMap: Record<
          TrainingPresetId,
          { focus: TrainingFocus; label: string }
        > = {
          SHOOTING_SPACING: {
            focus: 'OUTSIDE_SHOOTING',
            label: '슈팅 · 스페이싱',
          },
          ALL_AROUND: {
            focus: 'BALANCED',
            label: '올라운드 균형',
          },
          DEFENSE_GLASS: {
            focus: isBig ? 'REBOUND_POST' : 'DEFENSE_LOCKDOWN',
            label: isBig ? '리바운드 · 골밑 수비' : '대인 수비 · 리바운드',
          },
          PHYSICAL_ENGINE: {
            focus: 'PHYSICAL_CONDITIONING',
            label: '체력 · 내구성',
          },
        };
        const picked = presetMap[presetId];
        set({
          career: {
            ...career,
            trainingFocus: picked.focus,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${picked.label} 프리셋 적용`,
            description: '다음 시즌 훈련 계획에 자동 반영됩니다.',
            tone: 'emerald',
          },
        });
      },

      switchPrimaryPosition: (newPos) => {
        const { career } = get();
        if (!career || career.primaryPos === newPos) return;

        const switchCheck = canSwitchToPosition(
          career.primaryPos,
          newPos,
          {
            heightCm: career.heightCm,
            secondaryPos: career.secondaryPos,
          }
        );
        if (!switchCheck.allowed) {
          get().showToast(
            '포지션 전향 불가',
            switchCheck.reason || '인접 포지션 또는 해금된 부포지션으로만 전향할 수 있습니다.',
            'amber'
          );
          return;
        }

        const cappedStats = enforceBiomechanicalCaps(
          career.stats,
          career.heightCm,
          newPos
        );
        const newOvr = calculateOvr(cappedStats, newPos, career.heightCm);
        const newSecondary =
          career.secondaryPos === newPos ? career.primaryPos : career.secondaryPos;
        const nextPlaystyle = reconcilePlaystyleForPosition(
          career.playstyle,
          cappedStats,
          newPos
        );
        const playstyleChanged = nextPlaystyle !== career.playstyle;
        const nextStyleInfo = getPlaystyleInfo(nextPlaystyle, newPos);
        const nextBadges = evaluatePlayerBadges(
          cappedStats,
          newSecondary,
          career.growthDna,
          nextPlaystyle,
          career.traits,
          newPos
        );
        const { role } = calculateRoleAndMpg({
          ...career,
          stats: cappedStats,
          primaryPos: newPos,
          ovr: newOvr,
          secondaryPos: newSecondary,
        });

        set({
          career: {
            ...career,
            stats: cappedStats,
            primaryPos: newPos,
            secondaryPos: newSecondary,
            playstyle: nextPlaystyle,
            badges: nextBadges,
            ovr: newOvr,
            peakOvr: Math.max(career.peakOvr, newOvr),
            role,
            milestones: [
              ...career.milestones,
              {
                id: `MS_POS_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `주포지션 ${newPos} 전향`,
                description: playstyleChanged
                  ? `코칭스태프와 협의해 주포지션을 ${newPos}(으)로 변경하며 플레이 스타일도 ${nextStyleInfo.label}(으)로 재정립했습니다 (OVR ${newOvr}).`
                  : `코칭스태프와 협의해 주포지션을 ${newPos}(으)로 변경했습니다 (OVR ${newOvr}).`,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `주포지션 ${newPos} 전향 완료`,
            description: playstyleChanged
              ? `새 포지션 기준 종합 OVR ${newOvr} · 스타일 ${nextStyleInfo.label}(으)로 재편`
              : `새 포지션 기준 종합 OVR은 ${newOvr}입니다.`,
            tone: 'orange',
          },
        });
      },

      unlockSecondaryPosition: (secPos) => {
        const { career } = get();
        if (!career || career.primaryPos === secPos) return;
        const badges = evaluatePlayerBadges(
          career.stats,
          secPos,
          career.growthDna,
          career.playstyle,
          career.traits,
          career.primaryPos
        );
        const { role } = calculateRoleAndMpg({
          ...career,
          secondaryPos: secPos,
        });

        const syncedDual = syncCareerRelationships(career, undefined, 5);
        set({
          career: {
            ...career,
            secondaryPos: secPos,
            badges,
            role,
            coachTrust: syncedDual.coachTrust,
            relationships: syncedDual.relationships,
            milestones: [
              ...career.milestones,
              {
                id: `MS_DUAL_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `듀얼 포지션 (${career.primaryPos}/${secPos}) 등록`,
                description: '멀티 포지션 소화 능력을 인정받아 팀 내 입지 보너스(+2.5)를 확보했습니다.',
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `부포지션 ${secPos} 해금`,
            description: '멀티 포지션 소화로 출전 시간 확보에 유리해졌습니다.',
            tone: 'emerald',
          },
        });
      },

      runSpecialCamp: (campType) => {
        const { career } = get();
        if (!career) return;
        if (career.lastCampYear === career.seasonYear) {
          get().showToast(
            '이번 시즌 캠프 수료 완료',
            '특별 캠프 및 신체 개조는 시즌당 1회만 참가할 수 있습니다.',
            'amber'
          );
          return;
        }

        const result = applySpecialCampProgram(career, campType);
        const currentCash = getEffectiveCashBalance(career);
        if (currentCash < result.costUsd) {
          get().showToast(
            '보유 자산 부족',
            `필요 비용 ${formatCurrencyDetailed(result.costUsd)} (현재 ${formatCurrencyDetailed(currentCash)})`,
            'amber'
          );
          return;
        }

        const nextOvr = calculateOvr(
          result.nextStats,
          career.primaryPos,
          career.heightCm
        );
        const nextBadges = evaluatePlayerBadges(
          result.nextStats,
          career.secondaryPos,
          career.growthDna,
          career.playstyle,
          career.traits,
          career.primaryPos
        );
        const { role } = calculateRoleAndMpg({
          ...career,
          stats: result.nextStats,
          ovr: nextOvr,
        });

        const isVeteranCamp = career.age >= 31;
        set({
          career: {
            ...career,
            stats: result.nextStats,
            ovr: nextOvr,
            peakOvr: Math.max(career.peakOvr, nextOvr),
            potential: result.nextPotential,
            cashBalance: Math.max(0, currentCash - result.costUsd),
            draftStock: isVeteranCamp
              ? career.draftStock
              : Math.min(100, career.draftStock + 4),
            lastCampYear: career.seasonYear,
            campAgingShield:
              result.grantsAgingShield || Boolean(career.campAgingShield),
            badges: nextBadges,
            role,
            milestones: [
              ...career.milestones,
              {
                id: `MS_CAMP_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: isVeteranCamp
                  ? `베테랑 컨디셔닝 캠프 수료 (${
                      campType === 'LEGEND_SKILL_CAMP'
                        ? '기량 유지·노쇠화 방어'
                        : campType === 'BULK_UP'
                        ? '코어 밸런스 조정'
                        : '체중 감량·기동 유지'
                    })`
                  : `비시즌 특별 캠프 수료 (${
                      campType === 'LEGEND_SKILL_CAMP'
                        ? '엘리트 스킬 캠프'
                        : campType === 'BULK_UP'
                        ? '벌크업 신체 개조'
                        : '린매스업 신체 개조'
                    })`,
                description: result.summary,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: isVeteranCamp ? '베테랑 캠프 수료' : '특별 훈련 캠프 수료',
            description: result.summary,
            tone: 'emerald',
          },
        });
      },

      purchasePersonalCare: (careId) => {
        const { career } = get();
        if (!career) return;

        if (!isPersonalCareAllowedInLeague(careId, career.league)) {
          get().showToast(
            '프로 무대 진출 후 이용 가능',
            '시그니처 스니커즈 및 글로벌 에이전시 마케팅은 프로 입단 이후 계약할 수 있습니다.',
            'amber'
          );
          return;
        }

        const currentCare = career.activePersonalCare || [];
        if (currentCare.includes(careId)) {
          get().showToast(
            '이미 적용된 프로그램',
            '다음 시즌 진행 시 효과가 자동 반영됩니다.',
            'amber'
          );
          return;
        }

        const costUsd = getPersonalCarePackageCost(careId, career.league);
        const currentCash = getEffectiveCashBalance(career);
        if (currentCash < costUsd) {
          get().showToast(
            '보유 자산 부족',
            `필요 비용 ${formatCurrencyDetailed(costUsd)} (현재 ${formatCurrencyDetailed(currentCash)})`,
            'amber'
          );
          return;
        }

        const sneakerCfg = ECONOMY_CONFIG.personalCare.SIGNATURE_SNEAKER_MARKETING;
        const rehabCfg = ECONOMY_CONFIG.personalCare.REHAB_LOAD_MGMT;
        const rehabRiskPct = Math.round((1 - rehabCfg.injuryRiskMultiplier) * 100);
        const rehabGamesPct = Math.round((1 - rehabCfg.injuryGamesMultiplier) * 100);
        const majorRehabPct = Math.round(
          (1 - ROLE_MPG_CONFIG.injury.tiers.major.majorRehabGamesMult) * 100
        );
        const careMeta: Record<
          PersonalCareId,
          { title: string; summary: string; stockBoost: number; popBoost: number; trustBoost: number }
        > = {
          BIOMECH_SKILL_LAB: {
            title: '전담 바이오메카닉스 · 스킬 랩 계약 완료',
            summary:
              '다음 시즌 능력치 성장 효율 +15% 상승 및 30대 노쇠화 완화 보정이 적용됩니다.',
            stockBoost: 3,
            popBoost: 4,
            trustBoost: 3,
          },
          REHAB_LOAD_MGMT: {
            title: '전담 재활 · 로드 매니지먼트 팀 구축',
            summary: `다음 시즌 부상 발생 확률 ${rehabRiskPct}% 감소 및 경미/중등도 결장 ${rehabGamesPct}%·중상 결장 ${majorRehabPct}% 경감이 적용됩니다.`,
            stockBoost: 2,
            popBoost: 2,
            trustBoost: 2,
          },
          SIGNATURE_SNEAKER_MARKETING: {
            title: '글로벌 에이전시 · 시그니처 스니커즈 런칭',
            summary:
              '팬 인지도와 스카우트 주가가 상승하고 은퇴 시 레거시 점수 보너스를 획득합니다.',
            stockBoost: sneakerCfg.stockBoost,
            popBoost: sneakerCfg.fanPopularityBoost,
            trustBoost: 1,
          },
        };

        const meta = careMeta[careId];
        const nextCareIds = [...currentCare, careId];
        const syncedCare = syncCareerRelationships(
          career,
          {
            mediaFan: careId === 'SIGNATURE_SNEAKER_MARKETING' ? 6 : 0,
            frontOffice: careId === 'BIOMECH_SKILL_LAB' ? 3 : 0,
          },
          meta.trustBoost
        );
        set({
          lastPersonalCareIds: nextCareIds,
          career: {
            ...career,
            cashBalance: Math.max(0, currentCash - costUsd),
            activePersonalCare: nextCareIds,
            purchasedPersonalCareCount: (career.purchasedPersonalCareCount || 0) + 1,
            fanPopularity: (career.fanPopularity || 0) + meta.popBoost,
            draftStock: Math.min(100, career.draftStock + meta.stockBoost),
            coachTrust: syncedCare.coachTrust,
            relationships: syncedCare.relationships,
            milestones: [
              ...career.milestones,
              {
                id: `MS_CARE_${careId}_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: meta.title,
                description: meta.summary,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: meta.title,
            description: meta.summary,
            tone: 'emerald',
          },
        });
      },

      reapplyLastPersonalCare: () => {
        const { career, lastPersonalCareIds } = get();
        if (!career || lastPersonalCareIds.length === 0) return;

        const currentCare = career.activePersonalCare || [];
        let cash = getEffectiveCashBalance(career);
        const appliedNow: PersonalCareId[] = [];
        let totalCost = 0;
        let popBoost = 0;
        let stockBoost = 0;
        let trustBoost = 0;

        const sneakerCfg = ECONOMY_CONFIG.personalCare.SIGNATURE_SNEAKER_MARKETING;
        const boostMap: Record<
          PersonalCareId,
          { stock: number; pop: number; trust: number }
        > = {
          BIOMECH_SKILL_LAB: { stock: 3, pop: 4, trust: 3 },
          REHAB_LOAD_MGMT: { stock: 2, pop: 2, trust: 2 },
          SIGNATURE_SNEAKER_MARKETING: {
            stock: sneakerCfg.stockBoost,
            pop: sneakerCfg.fanPopularityBoost,
            trust: 1,
          },
        };

        for (const careId of lastPersonalCareIds) {
          if (currentCare.includes(careId)) continue;
          if (!isPersonalCareAllowedInLeague(careId, career.league)) continue;
          const cost = getPersonalCarePackageCost(careId, career.league);
          if (cash < cost) continue;
          cash -= cost;
          totalCost += cost;
          appliedNow.push(careId);
          popBoost += boostMap[careId].pop;
          stockBoost += boostMap[careId].stock;
          trustBoost += boostMap[careId].trust;
        }

        if (appliedNow.length === 0) {
          get().showToast(
            '재적용 가능한 항목 없음',
            '이미 모두 적용되었거나 보유 자산이 부족합니다.',
            'amber'
          );
          return;
        }

        const nextActive = [...currentCare, ...appliedNow];
        const syncedReapply = syncCareerRelationships(
          career,
          {
            mediaFan: appliedNow.includes('SIGNATURE_SNEAKER_MARKETING') ? 6 : 0,
            frontOffice: appliedNow.includes('BIOMECH_SKILL_LAB') ? 3 : 0,
          },
          trustBoost
        );
        set({
          lastPersonalCareIds: nextActive,
          career: {
            ...career,
            cashBalance: Math.max(0, cash),
            activePersonalCare: nextActive,
            purchasedPersonalCareCount:
              (career.purchasedPersonalCareCount || 0) + appliedNow.length,
            fanPopularity: (career.fanPopularity || 0) + popBoost,
            draftStock: Math.min(100, career.draftStock + stockBoost),
            coachTrust: syncedReapply.coachTrust,
            relationships: syncedReapply.relationships,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `이전 퍼스널 케어 ${appliedNow.length}건 재적용`,
            description: `총 ${formatCurrencyDetailed(totalCost)} 집행 완료`,
            tone: 'emerald',
          },
        });
      },

      requestTrade: () => {
        const { career } = get();
        if (!career) return;

        if (
          !canUseProTradeSystem({
            league: career.league,
            contractType: career.contractType,
            isMilitaryTeam: career.team.isMilitaryTeam,
            teamId: career.team.id,
          })
        ) {
          return;
        }

        if (
          career.seasonPhase &&
          career.seasonPhase !== 'REGULAR_SEASON' &&
          career.seasonPhase !== 'OFFSEASON'
        ) {
          get().showToast(
            '트레이드 요청 불가 시점',
            '포스트시즌 또는 라이브 경기 진행 중에는 트레이드를 요청할 수 없습니다.',
            'amber'
          );
          return;
        }

        if (career.tradeRequestedThisYear) {
          get().showToast(
            '트레이드 요청 완료 상태',
            '구단 프런트와의 트레이드 협상은 시즌당 1회만 시도할 수 있습니다.',
            'amber'
          );
          return;
        }

        const pool = getTeamsByLeague(career.league, career.teamRatingsMap).filter(
          (t) => t.id !== career.team.id
        );
        if (pool.length === 0) return;

        // 연속 승인 확률 산출 (역할 약속 위반/높은 OVR 레버리지/낮은 신뢰도 반영)
        const trCfg = DRAFT_SCOUTING_CONFIG.trade;
        const acceptProb = clampNum(
          trCfg.baseAcceptanceProb +
            (career.brokenRolePromise ? trCfg.brokenPromiseBonus : 0) +
            (career.ovr - career.team.rating) * trCfg.highOvrLeverageSlope +
            (career.coachTrust < 45 ? trCfg.lowTrustBonus : 0),
          0.18,
          0.95
        );

        if (Math.random() >= acceptProb) {
          const nextRejectedTrust = Math.max(
            15,
            career.coachTrust + trCfg.rejectedTrustPenalty
          );
          const syncedRejected = syncCareerRelationships(
            career,
            { frontOffice: -6 },
            nextRejectedTrust - career.coachTrust
          );
          set({
            career: {
              ...career,
              tradeRequestedThisYear: true,
              coachTrust: syncedRejected.coachTrust,
              relationships: syncedRejected.relationships,
            },
            toast: {
              id: `TOAST_${Date.now()}`,
              title: '구단 프런트가 트레이드 요청을 반려했습니다',
              description:
                '현재 계약 조건과 타 구단 매물 상황이 맞지 않아 트레이드가 보류되었습니다.',
              tone: 'amber',
            },
          });
          return;
        }

        const posFitCandidates = pool.filter(
          (t) =>
            t.neededPositions?.includes(career.primaryPos) ||
            (career.secondaryPos
              ? t.neededPositions?.includes(career.secondaryPos)
              : false)
        );
        const candidatePool =
          posFitCandidates.length > 0 ? posFitCandidates : pool;
        const target =
          candidatePool[Math.floor(Math.random() * candidatePool.length)];

        const promise = determineTeamRolePromise(
          career,
          target,
          career.contractType
        );
        const nextTrust =
          promise.promisedRole === 'ACE_FIRST_OPTION'
            ? 66
            : promise.promisedRole === 'STARTER_GUARANTEE'
            ? 58
            : 50;
        const { role } = calculateRoleAndMpg({
          ...career,
          team: target,
          coachTrust: nextTrust,
          promisedRole: promise.promisedRole,
        });
        const transferRelationships = buildTeamTransferRelationships(
          career,
          nextTrust
        );

        set({
          career: {
            ...career,
            team: target,
            seasonsOnCurrentTeam: 0,
            coachTrust: transferRelationships.coachTrust,
            relationships: transferRelationships,
            promisedRole: promise.promisedRole,
            brokenRolePromise: false,
            tradeRequestedThisYear: true,
            role,
            milestones: [
              ...career.milestones,
              {
                id: `MS_TRADE_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `공식 트레이드 이적: ${target.name}`,
                description: `출전 시간과 새로운 역할을 찾아 ${target.name} 구단으로 트레이드 이적했습니다 (${promise.promisedRoleLabel}).`,
                type: 'SPECIAL',
                teamName: target.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${target.name} 트레이드 이적 완료`,
            description: `약속 역할: ${promise.promisedRoleLabel} · 입지: ${role}`,
            tone: 'orange',
          },
        });
      },

      triggerMidSeasonCrossroads: () => {
        const { career } = get();
        if (!career || career.pendingEvent || career.midSeasonEventTriggeredThisYear) {
          return;
        }
        const midEvt = rollMidSeasonCrossroadsEvent(career);
        const isTradeRumor = midEvt.id.startsWith('EVT_MID_TRADE_DEADLINE_');
        set({
          career: {
            ...career,
            midSeasonEventTriggeredThisYear: true,
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
            ? '파이널 결승전 실시간 중계에 입장해 우승에 도전하세요.'
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

        const liveGame = createLiveFinalGame(
          career,
          oppTeam,
          isConfFinalsGame7 ? 'CONF_FINALS_GAME7' : 'LEAGUE_FINALS'
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
        if (!career || !career.liveGame) return;

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
                '파이널 대진표에서 결승전 실시간 중계에 입장해 우승에 도전하세요.',
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

      resolveEventChoice: (choice) => {
        const { career } = get();
        if (!career) return;

        if (choice.triggerRetirement) {
          const legacyEval = evaluateCareerLegacy(career);
          set({
            career: {
              ...career,
              pendingEvent: null,
              retirementReason: choice.triggerRetirement,
              legacyEvaluation: legacyEval,
            },
            lastEncounterOutcome: null,
            view: 'RETIREMENT',
          });
          return;
        }

        const unlockStatus = checkEncounterChoiceUnlock(career, choice);
        if (!unlockStatus.unlocked) {
          get().showToast(
            '전용 분기 조건 미충족',
            unlockStatus.missingSummary || '능력치 또는 특성 조건을 충족해야 선택할 수 있습니다.',
            'amber'
          );
          return;
        }

        const currentCash = getEffectiveCashBalance(career);
        if (choice.cashDelta && choice.cashDelta < 0 && currentCash < Math.abs(choice.cashDelta)) {
          get().showToast(
            '보유 자산 부족',
            `필요 비용 ${formatCurrencyDetailed(Math.abs(choice.cashDelta))} (현재 ${formatCurrencyDetailed(currentCash)})`,
            'amber'
          );
          return;
        }

        const currentEvent = career.pendingEvent;
        const {
          result: outcome,
          nextChainEvent,
          arcAdvance,
        } = resolveEncounterChoiceOutcome(
          career,
          currentEvent || {
            id: 'EVT_GENERIC',
            title: '커리어 이벤트',
            subtitle: '',
            description: '',
            category: 'COACH',
            choices: [choice],
          },
          choice
        );

        const bypassAgeCap = Boolean(
          choice.bypassAgeStatCap || choice.triggerVeteranReinvention
        );
        const ageAdjusted = bypassAgeCap
          ? {
              adjustedChanges: { ...outcome.statChanges },
              suppressedPhysicalCount: 0,
              convertedTrustBonus: 0,
              grantedAgingShield: false,
            }
          : applyAgeAdjustedEventStatChanges(
              career.age,
              career.stats,
              outcome.statChanges
            );
        const rawStats: PlayerStats = { ...career.stats };
        for (const k of Object.keys(
          ageAdjusted.adjustedChanges
        ) as (keyof PlayerStats)[]) {
          const diff = ageAdjusted.adjustedChanges[k] || 0;
          rawStats[k] = clampStat(rawStats[k] + diff);
        }

        const nextPrimary = choice.switchPrimaryPos || career.primaryPos;
        const nextSecondary = choice.unlockSecondaryPos || career.secondaryPos;
        const nextStats = enforceBiomechanicalCaps(
          rawStats,
          career.heightCm,
          nextPrimary
        );
        const nextOvr = calculateOvr(nextStats, nextPrimary, career.heightCm);
        const effectivePotentialDelta =
          career.age >= 31
            ? Math.min(0, outcome.potentialDelta)
            : outcome.potentialDelta;
        const nextPotential = Math.min(
          98,
          Math.max(60, career.potential + effectivePotentialDelta)
        );
        let nextTrust = Math.max(
          10,
          Math.min(
            100,
            career.coachTrust + outcome.trustDelta + ageAdjusted.convertedTrustBonus
          )
        );
        const nextStock = Math.max(
          10,
          Math.min(100, career.draftStock + outcome.draftStockDelta)
        );
        const nextCashBalance = Math.max(0, currentCash + outcome.cashDelta);
        const nextCampAgingShield = Boolean(
          career.campAgingShield || ageAdjusted.grantedAgingShield
        );
        const nextMilitaryExempt =
          career.militaryExempt || Boolean(choice.grantMilitaryExemption);
        const nextMilestones = [...career.milestones];

        let nextLeague = career.league;
        let nextTeam = career.team;
        let nextContractType = career.contractType;
        let nextContractYearsLeft = career.contractYearsLeft;
        let nextAnnualSalary = career.annualSalary;
        let nextMilitaryServiceLeft = career.militaryServiceSeasonsLeft;
        let nextPrevTeam = career.previousTeamBeforeMilitary;
        let nextPromisedRole = career.promisedRole;
        let nextPlaystyle = reconcilePlaystyleForPosition(
          career.playstyle,
          nextStats,
          nextPrimary
        );
        let nextVeteranReinvented = career.veteranReinvented || false;

        if (choice.triggerVeteranReinvention) {
          nextVeteranReinvented = true;
          const isBigPos = nextPrimary === 'PF' || nextPrimary === 'C';
          const candidateStyle = isBigPos
            ? nextStats.out >= 70
              ? 'STRETCH_BIG'
              : 'ALL_ROUNDER'
            : nextStats.ply >= nextStats.out
            ? 'PLAYMAKER'
            : 'THREE_AND_D';
          nextPlaystyle = reconcilePlaystyleForPosition(
            candidateStyle,
            nextStats,
            nextPrimary
          );
          const reinventStyleInfo = getPlaystyleInfo(nextPlaystyle, nextPrimary);
          nextMilestones.push({
            id: `MS_VET_REINVENT_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: '베테랑 플레이 스타일 진화 완료',
            description: `운동능력 저하를 노련한 기술로 극복하며 ${reinventStyleInfo.label} 역할로 재정립했습니다.`,
            type: 'SPECIAL',
            teamName: career.team.name,
          });
        }

        if (choice.grantMilitaryExemption && !career.militaryExempt) {
          nextMilestones.push({
            id: `MS_MILITARY_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: '아시안게임 금메달 · 병역특례 획득',
            description:
              '결승전 활약으로 금메달을 목에 걸며 병역 문제를 해결했습니다.',
            type: 'AWARD',
            teamName: '대한민국 국가대표팀',
          });
        }

        if (choice.enlistSangmu) {
          nextPrevTeam = career.team;
          nextLeague = 'KBL';
          nextTeam = SANGMU_TEAM;
          nextContractType = 'MILITARY_SERVICE';
          nextContractYearsLeft = 2;
          nextAnnualSalary = ECONOMY_CONFIG.sangmuAnnualSalaryUsd;
          nextMilitaryServiceLeft = 2;

          nextMilestones.push({
            id: `MS_SANGMU_ENLIST_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: '국군체육부대 상무 입대 (2시즌 복무)',
            description:
              '문경 상무 농구단에 입대하여 2시즌간 KBL 무대에서 복무합니다.',
            type: 'MILITARY',
            teamName: SANGMU_TEAM.name,
          });
        }

        // 시즌 중반 트레이드 데드라인 구단 협상 판정 (무조건 즉시 이적 폐지 → 시장 가치·약속 위반·계약 기간 기반 협상)
        const veteranNote =
          ageAdjusted.suppressedPhysicalCount > 0
            ? ' (베테랑 구간 보정: 신체 스탯 상승 대신 차기 시즌 노쇠화 방어 버프 및 코칭스태프 신뢰도 +2로 전환)'
            : '';
        let finalOutcome: EncounterResolutionResult = {
          ...outcome,
          narrative: `${outcome.narrative}${veteranNote}`,
          statChanges: ageAdjusted.adjustedChanges,
          potentialDelta: effectivePotentialDelta,
          trustDelta: outcome.trustDelta + ageAdjusted.convertedTrustBonus,
        };
        let nextSeasonsOnTeam = career.seasonsOnCurrentTeam ?? 0;
        let midTradeResult: 'NONE' | 'ACCEPTED' | 'REJECTED' = 'NONE';
        const isMidSeasonTradeAttempt = Boolean(
          choice.negotiateMidSeasonTrade || choice.executeTradeToContender
        );

        if (isMidSeasonTradeAttempt) {
          const trCfg = DRAFT_SCOUTING_CONFIG.trade;
          const acceptProb = clampNum(
            trCfg.baseAcceptanceProb +
              (career.brokenRolePromise ? trCfg.brokenPromiseBonus : 0) +
              (career.ovr - career.team.rating) * trCfg.highOvrLeverageSlope +
              (career.coachTrust < 45 ? trCfg.lowTrustBonus : 0) +
              (career.contractYearsLeft <= 1 ? trCfg.expiringContractBonus : 0),
            0.22,
            0.9
          );
          const acceptPct = Math.round(acceptProb * 100);
          const sameLeagueTeams = getTeamsByLeague(
            career.league,
            career.teamRatingsMap
          ).filter((t) => t.id !== career.team.id);

          if (Math.random() < acceptProb && sameLeagueTeams.length > 0) {
            const contenders = sameLeagueTeams.filter(
              (t) =>
                t.direction === 'CONTENDER' || t.direction === 'PLAYOFF_HUNT'
            );
            const matchingContenders = contenders.filter(
              (t) =>
                t.neededPositions?.includes(career.primaryPos) ||
                (career.secondaryPos
                  ? t.neededPositions?.includes(career.secondaryPos)
                  : false)
            );
            const tradePool =
              matchingContenders.length > 0
                ? matchingContenders
                : contenders.length > 0
                ? contenders
                : sameLeagueTeams;
            const pickedContender =
              tradePool[Math.floor(Math.random() * tradePool.length)];

            if (pickedContender) {
              const oldTeamName = career.team.name;
              nextTeam = pickedContender;
              nextSeasonsOnTeam = 0;
              nextPromisedRole =
                career.ovr >= pickedContender.rating + 2
                  ? 'ACE_FIRST_OPTION'
                  : career.ovr >= pickedContender.rating - 1
                  ? 'STARTER_GUARANTEE'
                  : 'SIXTH_MAN_CORE';
              nextTrust =
                nextPromisedRole === 'ACE_FIRST_OPTION'
                  ? 62
                  : nextPromisedRole === 'STARTER_GUARANTEE'
                  ? 56
                  : 50;
              midTradeResult = 'ACCEPTED';
              nextMilestones.push({
                id: `MS_MID_TRADE_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `트레이드 데드라인 이적: ${pickedContender.name}`,
                description: `${oldTeamName} 프런트와의 협상 끝에 ${pickedContender.name}로 이적했습니다 (${ROLE_PROMISE_LABELS[nextPromisedRole]}).`,
                type: 'SPECIAL',
                teamName: pickedContender.name,
              });
              finalOutcome = {
                ...outcome,
                wasProbabilistic: true,
                successChancePct: acceptPct,
                rolledSuccess: true,
                outcomeTier: 'SUCCESS',
                narrative: `구단 간 트레이드 협상이 타결되었습니다. ${oldTeamName}을 떠나 ${pickedContender.name}에 합류하며 새 팀에서 ${ROLE_PROMISE_LABELS[nextPromisedRole]} 역할을 맡게 됩니다.`,
                trustDelta: nextTrust - career.coachTrust,
              };
            }
          } else {
            midTradeResult = 'REJECTED';
            nextTrust = Math.max(10, career.coachTrust + trCfg.rejectedTrustPenalty);
            finalOutcome = {
              ...outcome,
              wasProbabilistic: true,
              successChancePct: acceptPct,
              rolledSuccess: false,
              outcomeTier: 'FAILURE',
              narrative: `${career.team.shortName} 단장이 상대 구단과의 조건 불일치를 이유로 트레이드 요청을 반려했습니다. 잔여 시즌을 원소속팀에서 치르게 되며 코칭스태프 신뢰도가 하락했습니다.`,
              statChanges: {},
              trustDelta: trCfg.rejectedTrustPenalty,
              draftStockDelta: 0,
            };
          }
        }

        // 4년 주기 국제대회 본선 토너먼트(조별리그 → 8강 → 4강) 및 결승/3·4위전 실시간 라이브 중계 진입
        let nextLiveGame = career.liveGame || null;
        let nextSeasonPhase = career.seasonPhase || 'OFFSEASON';
        let nextSeasonLogs = [...career.seasonLogs];
        let nextInternationalHistory = career.internationalHistory || [];
        let nextInternationalSummary = career.lastInternationalSummary ?? null;
        let nextTotalsForIntl = { ...career.totals };
        let agToastTitle: string | null = null;
        let agToastDesc: string | null = null;
        let agToastTone: ToastMessage['tone'] = 'emerald';

        const requestedTournamentType: InternationalTournamentType | null =
          choice.enterInternationalTournament ||
          (choice.enterAsianGamesTournament || choice.startAsianGamesFinal
            ? 'ASIAN_GAMES'
            : null);
        const requestedTournamentYear =
          choice.internationalTournamentYear ?? career.seasonYear;

        if (requestedTournamentType) {
          const tourney = simulateInternationalTournament(
            career,
            requestedTournamentType
          );
          const tourneyCfg = INTERNATIONAL_TOURNAMENT_CONFIG[requestedTournamentType];
          const matchSummaries = tourney.matches.map(
            (m) =>
              `${m.stageLabel} 대한민국 ${m.korScore}:${m.oppScore} ${m.opponentName} (${
                m.won ? '승' : '패'
              } · ${m.playerPts}점 ${m.playerReb}리바운드 ${m.playerAst}도움)`
          );

          if (nextSeasonLogs.length > 0) {
            const lastIdx = nextSeasonLogs.length - 1;
            nextSeasonLogs[lastIdx] = {
              ...nextSeasonLogs[lastIdx],
              narrativeLog: [
                tourney.summaryHeadline,
                ...matchSummaries,
                ...nextSeasonLogs[lastIdx].narrativeLog,
              ],
            };
          }

          if (tourney.reachedFinals && tourney.finalOpponent) {
            const liveType =
              requestedTournamentType === 'ASIAN_GAMES'
                ? 'ASIAN_GAMES_FINAL'
                : 'INTERNATIONAL_FINAL';
            nextLiveGame = createLiveFinalGame(
              career,
              tourney.finalOpponent,
              liveType,
              {
                tournamentType: requestedTournamentType,
                tournamentYear: requestedTournamentYear,
                preMatches: tourney.matches,
              }
            );
            nextSeasonPhase = 'LIVE_FINAL_BROADCAST';
            nextMilestones.push({
              id: `MS_INTL_FINAL_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
              year: requestedTournamentYear,
              age: career.age,
              title: `${requestedTournamentYear} ${tourneyCfg.shortName} 결승 진출 (vs ${tourney.finalOpponent.shortName})`,
              description: `${matchSummaries.join(' / ')} · 결승전 실시간 중계에서 금메달에 도전합니다.`,
              type: 'SPECIAL',
              teamName: '대한민국 국가대표팀',
            });
            agToastTitle = `${tourneyCfg.shortName} 결승전 실시간 중계 입장`;
            agToastDesc = tourney.summaryHeadline;
            agToastTone = 'orange';
          } else if (tourney.reachedBronzeMatch && tourney.bronzeOpponent) {
            nextLiveGame = createLiveFinalGame(
              career,
              tourney.bronzeOpponent,
              'INTERNATIONAL_BRONZE',
              {
                tournamentType: requestedTournamentType,
                tournamentYear: requestedTournamentYear,
                preMatches: tourney.matches,
              }
            );
            nextSeasonPhase = 'LIVE_FINAL_BROADCAST';
            nextMilestones.push({
              id: `MS_INTL_BRONZE_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
              year: requestedTournamentYear,
              age: career.age,
              title: `${requestedTournamentYear} ${tourneyCfg.shortName} 3·4위전 진출 (vs ${tourney.bronzeOpponent.shortName})`,
              description: `${matchSummaries.join(' / ')} · 동메달 결정전 실시간 중계에 나섭니다.`,
              type: 'SPECIAL',
              teamName: '대한민국 국가대표팀',
            });
            agToastTitle = `${tourneyCfg.shortName} 동메달 결정전 중계 입장`;
            agToastDesc = tourney.summaryHeadline;
            agToastTone = 'amber';
          } else {
            nextLiveGame = null;
            nextSeasonPhase = 'OFFSEASON';
            const isGroupElim = tourney.eliminatedStage === 'GROUP';
            const totalGames = Math.max(1, tourney.matches.length);
            const elimRecord: InternationalTournamentRecord = {
              id: `INTL_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
              year: requestedTournamentYear,
              age: career.age,
              tournamentType: requestedTournamentType,
              tournamentName: tourneyCfg.name,
              result: isGroupElim ? 'GROUP' : 'QUARTERFINAL',
              wonMvp: false,
              grantedMilitaryExemption: false,
              avgPts: Number(
                (
                  tourney.matches.reduce((s, m) => s + m.playerPts, 0) /
                  totalGames
                ).toFixed(1)
              ),
              avgReb: Number(
                (
                  tourney.matches.reduce((s, m) => s + m.playerReb, 0) /
                  totalGames
                ).toFixed(1)
              ),
              avgAst: Number(
                (
                  tourney.matches.reduce((s, m) => s + m.playerAst, 0) /
                  totalGames
                ).toFixed(1)
              ),
              matches: tourney.matches,
              summaryHeadline: tourney.summaryHeadline,
            };
            nextInternationalHistory = [
              elimRecord,
              ...nextInternationalHistory.filter(
                (r) =>
                  !(
                    r.year === requestedTournamentYear &&
                    r.tournamentType === requestedTournamentType
                  )
              ),
            ];
            nextInternationalSummary = elimRecord;
            nextTotalsForIntl = {
              ...nextTotalsForIntl,
              internationalCaps:
                (nextTotalsForIntl.internationalCaps || 0) + tourney.matches.length,
            };

            nextMilestones.push({
              id: `MS_INTL_${isGroupElim ? 'GROUP' : 'QF'}_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
              year: requestedTournamentYear,
              age: career.age,
              title: `${requestedTournamentYear} ${tourneyCfg.shortName} ${
                isGroupElim ? '조별리그 마감' : '8강 마감'
              }`,
              description: `${matchSummaries.join(' / ')} · ${tourney.summaryHeadline}`,
              type: requestedTournamentType === 'ASIAN_GAMES' ? 'MILITARY' : 'SPECIAL',
              teamName: '대한민국 국가대표팀',
            });
            agToastTitle = `${tourneyCfg.shortName} ${
              isGroupElim ? '조별리그 탈락' : '8강 탈락'
            }`;
            agToastDesc = tourney.summaryHeadline;
            agToastTone = 'amber';
          }
        }

        const resolvedPendingChain =
          nextChainEvent ||
          (career.pendingChainEvent &&
          currentEvent &&
          career.pendingChainEvent.id === currentEvent.id
            ? null
            : career.pendingChainEvent || null);

        const didChangeTeamInEvent = Boolean(
          choice.enlistSangmu || midTradeResult === 'ACCEPTED'
        );
        const nextRelationships = didChangeTeamInEvent
          ? buildTeamTransferRelationships(
              career,
              choice.enlistSangmu ? 55 : nextTrust
            )
          : applyRelationshipDelta(
              getEffectiveRelationships(career),
              outcome.relationshipChanges,
              nextTrust - career.coachTrust
            );
        // 감독 신뢰도 단일 진실 소스 동기화
        nextTrust = nextRelationships.coachTrust;

        const nextRole = didChangeTeamInEvent
          ? calculateRoleAndMpg({
              ...career,
              ovr: nextOvr,
              stats: nextStats,
              primaryPos: nextPrimary,
              secondaryPos: nextSecondary,
              league: nextLeague,
              team: nextTeam,
              contractType: nextContractType,
              coachTrust: nextTrust,
              promisedRole: nextPromisedRole,
            }).role
          : choice.grantRotationThisSeason && career.role.includes('가비지')
          ? '벤치 로테이션'
          : career.role;

        const nextStoryArcs = getEffectiveStoryArcs(career);
        if (arcAdvance) {
          const prevArc = nextStoryArcs[arcAdvance.arcId];
          nextStoryArcs[arcAdvance.arcId] = {
            ...prevArc,
            stage: Math.max(prevArc.stage, arcAdvance.nextStage),
            completed: Boolean(
              arcAdvance.completed || arcAdvance.nextStage >= prevArc.maxStage
            ),
            lastTriggeredYear: career.seasonYear,
            branchTag: arcAdvance.branchTag || prevArc.branchTag,
            summary: arcAdvance.summary,
          };
          if (arcAdvance.completed) {
            nextMilestones.push({
              id: `MS_ARC_${arcAdvance.arcId}_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: `스토리 아크 완결 · ${prevArc.title}`,
              description: arcAdvance.summary,
              type: 'SPECIAL',
              teamName: nextTeam.name,
            });
          }
        }

        let updatedBase: CareerState = {
          ...career,
          primaryPos: nextPrimary,
          secondaryPos: nextSecondary,
          playstyle: nextPlaystyle,
          veteranReinvented: nextVeteranReinvented,
          veteranReinventionOffered:
            career.veteranReinventionOffered ||
            career.pendingEvent?.id === 'EVT_VETERAN_REINVENTION',
          stats: nextStats,
          ovr: nextOvr,
          peakOvr: Math.max(career.peakOvr, nextOvr),
          potential: nextPotential,
          coachTrust: nextTrust,
          draftStock: nextStock,
          cashBalance: nextCashBalance,
          campAgingShield: nextCampAgingShield,
          relationships: nextRelationships,
          storyArcs: nextStoryArcs,
          league: nextLeague,
          team: nextTeam,
          role: nextRole,
          contractType: nextContractType,
          contractYearsLeft: nextContractYearsLeft,
          annualSalary: nextAnnualSalary,
          promisedRole: nextPromisedRole,
          brokenRolePromise:
            didChangeTeamInEvent ? false : career.brokenRolePromise,
          seasonsOnCurrentTeam:
            choice.enlistSangmu ? 0 : nextSeasonsOnTeam,
          tradeRequestedThisYear:
            career.tradeRequestedThisYear || isMidSeasonTradeAttempt,
          coachChanceRotationYear: choice.grantRotationThisSeason
            ? career.seasonYear
            : career.coachChanceRotationYear ?? null,
          agentAdviceShown:
            career.agentAdviceShown || Boolean(choice.markAgentAdviceDismissed),
          militaryExempt: nextMilitaryExempt,
          militaryServiceSeasonsLeft: nextMilitaryServiceLeft,
          previousTeamBeforeMilitary: nextPrevTeam,
          pendingChainEvent: resolvedPendingChain,
          liveGame: nextLiveGame,
          seasonPhase: nextSeasonPhase,
          seasonLogs: nextSeasonLogs,
          internationalHistory: nextInternationalHistory,
          lastInternationalSummary: nextInternationalSummary,
          totals: nextTotalsForIntl,
          badges: evaluatePlayerBadges(
            nextStats,
            nextSecondary,
            career.growthDna,
            nextPlaystyle,
            career.traits,
            nextPrimary
          ),
          milestones: nextMilestones,
          pendingEvent: null,
        };

        // 입대 직전 마지막 특례 대회를 고사하거나 8강 탈락으로 즉시 오프시즌에 복귀한 경우 상무 입대 영장 연계
        const wasInternationalCallup = Boolean(
          currentEvent &&
            (currentEvent.id === 'EVT_ASIAN_GAMES_GOLD' ||
              currentEvent.id.startsWith('EVT_INTL_'))
        );
        if (
          wasInternationalCallup &&
          !nextLiveGame &&
          !updatedBase.militaryExempt &&
          updatedBase.militaryServiceSeasonsLeft === 0 &&
          updatedBase.age >= getMilitaryEnlistAgeForLeague(updatedBase.league)
        ) {
          updatedBase.pendingEvent = createSangmuEnlistmentEvent(updatedBase);
          updatedBase.pendingEventQueue = [];
        }

        const isInternationalAction = Boolean(requestedTournamentType);
        // 국제대회 액션이 요약 모달 없이 바로 끝난 경우(혹은 결과 모달을 띄우지 않는 경우) 대기 큐 선두 이벤트를 즉시 활성화
        if (
          isInternationalAction &&
          !nextLiveGame &&
          !updatedBase.pendingEvent &&
          !updatedBase.lastInternationalSummary
        ) {
          updatedBase = dequeueNextPendingEvent(updatedBase);
        }

        const refreshedOptions = updatedBase.offseasonLocked
          ? generateOffseasonOptions(updatedBase)
          : [];

        const outcomeTone: ToastMessage['tone'] = agToastTitle
          ? agToastTone
          : finalOutcome.outcomeTier === 'CRITICAL_SUCCESS'
          ? 'orange'
          : finalOutcome.outcomeTier === 'FAILURE'
          ? 'rose'
          : 'emerald';

        set({
          career: {
            ...updatedBase,
            offseasonOptions: refreshedOptions,
          },
          lastEncounterOutcome: isInternationalAction ? null : finalOutcome,
          toast: {
            id: `TOAST_${Date.now()}`,
            title:
              agToastTitle ||
              (choice.triggerVeteranReinvention
                ? '베테랑 플레이 스타일 진화 완료'
                : choice.enlistSangmu
                ? '국군체육부대 상무 입대'
                : midTradeResult === 'ACCEPTED'
                ? `${nextTeam.name} 트레이드 협상 타결`
                : midTradeResult === 'REJECTED'
                ? '구단 프런트가 트레이드 요청을 반려했습니다'
                : finalOutcome.outcomeTier === 'CRITICAL_SUCCESS'
                ? '대성공 · 기대 이상의 결과'
                : finalOutcome.outcomeTier === 'FAILURE'
                ? '판정 실패 · 리스크 발생'
                : '선택 결과 반영 완료'),
            description: agToastDesc || finalOutcome.narrative,
            tone: outcomeTone,
          },
        });
      },

      selectOffseasonOption: (option) => {
        const { career } = get();
        if (!career || option.locked) return;

        if (option.actionType === 'RETIRE_VOLUNTARY') {
          get().triggerRetirement('VOLUNTARY_HONOR');
          return;
        }
        if (option.actionType === 'RETIRE_AGE_40') {
          get().triggerRetirement('AGE_40_MANDATORY');
          return;
        }
        if (option.actionType === 'RETIRE_OUT_OF_LEAGUE') {
          get().triggerRetirement('OUT_OF_LEAGUE');
          return;
        }

        if (option.actionType === 'START_FAREWELL_TOUR') {
          set({
            career: {
              ...career,
              isFarewellTour: true,
              contractType: option.contractType ?? career.contractType,
              contractYearsLeft: 1,
              annualSalary:
                option.annualSalary !== undefined
                  ? option.annualSalary
                  : career.annualSalary,
              isOutOfLeagueWarning: false,
              offseasonLocked: false,
              offseasonOptions: [],
              seasonPhase: 'REGULAR_SEASON',
              playoffBracket: null,
              liveGame: null,
              tradeRequestedThisYear: false,
              midSeasonEventTriggeredThisYear: false,
              lastInternationalSummary: null,
              milestones: [
                ...career.milestones,
                {
                  id: `MS_TOUR_${Date.now()}`,
                  year: career.seasonYear,
                  age: career.age,
                  title: '공식 은퇴 투어 선언',
                  description: `${career.team.name}에서의 마지막 시즌 고별 투어를 시작했습니다.`,
                  type: 'TOUR',
                  teamName: career.team.name,
                },
              ],
            },
            toast: {
              id: `TOAST_${Date.now()}`,
              title: '공식 은퇴 투어 시즌 시작',
              description: '이번 시즌을 마치면 은퇴식과 영구결번 심사가 열립니다.',
              tone: 'amber',
            },
          });
          return;
        }

        if (option.actionType === 'RETURN_KBL_FAREWELL' && option.targetTeam) {
          const returnTrust = 60;
          const returnRel = buildTeamTransferRelationships(career, returnTrust);
          const { role } = calculateRoleAndMpg({
            ...career,
            league: 'KBL',
            team: option.targetTeam,
            contractType: 'KBL_VET',
            coachTrust: returnTrust,
          });
          set({
            career: {
              ...career,
              league: 'KBL',
              team: option.targetTeam,
              contractType: 'KBL_VET',
              contractYearsLeft: 1,
              annualSalary: getContractDefaultSalary('KBL_VET', career.ovr),
              role,
              seasonsOnCurrentTeam: 0,
              coachTrust: returnRel.coachTrust,
              relationships: returnRel,
              brokenRolePromise: false,
              isFarewellTour: true,
              isOutOfLeagueWarning: false,
              offseasonLocked: false,
              offseasonOptions: [],
              pendingEventQueue: [],
              seasonPhase: 'REGULAR_SEASON',
              playoffBracket: null,
              liveGame: null,
              tradeRequestedThisYear: false,
              midSeasonEventTriggeredThisYear: false,
              lastInternationalSummary: null,
              milestones: [
                ...career.milestones,
                {
                  id: `MS_KBL_RETURN_${Date.now()}`,
                  year: career.seasonYear,
                  age: career.age,
                  title: `${option.targetTeam.name} 복귀 · 고별 투어 선언`,
                  description:
                    '국내 팬들 앞에서 현역 마지막 시즌을 치르기로 결정했습니다.',
                  type: 'TOUR',
                  teamName: option.targetTeam.name,
                },
              ],
            },
            toast: {
              id: `TOAST_${Date.now()}`,
              title: `${option.targetTeam.name} 합류 완료`,
              description: '현역 마지막 시즌을 시작합니다.',
              tone: 'amber',
            },
          });
          return;
        }

        if (option.actionType === 'ENTER_NBA_DRAFT') {
          const combineState = createInitialCombineState(career);
          set({
            career: {
              ...career,
              combineState,
              draftResult: null,
            },
            view: 'DRAFT_COMBINE',
          });
          return;
        }

        if (option.actionType === 'ENTER_KBL_DRAFT') {
          const draftResult = executeDraftResolution(career, 'KBL');
          set({
            career: {
              ...career,
              draftResult,
            },
            view: 'DRAFT_LIVE',
          });
          return;
        }

        const rawNextTeam = option.targetTeam || career.team;
        const nextTeam =
          getTeamById(rawNextTeam.id, career.teamRatingsMap) || rawNextTeam;
        const nextLeague = option.targetLeague;

        // 오프시즌 계약 중 트레이드 요청 협상 판정
        if (option.actionType === 'REQUEST_TRADE' && option.targetTeam) {
          if (career.tradeRequestedThisYear) {
            get().showToast(
              '트레이드 요청 불가',
              '이번 오프시즌 트레이드 요청이 이미 반려되었습니다. 소속팀 잔류 탭에서 시즌을 진행해 주세요.',
              'amber'
            );
            return;
          }

          const acceptProb =
            option.contenderPath && typeof option.tradeAcceptChancePct === 'number'
              ? option.tradeAcceptChancePct / 100
              : calculateOffseasonTradeAcceptProb(
                  career,
                  nextTeam,
                  option.scoutingScore ?? 70
                );
          if (Math.random() >= acceptProb) {
            const trCfg = DRAFT_SCOUTING_CONFIG.trade;
            const nextRejectedTrust = Math.max(
              15,
              career.coachTrust + trCfg.rejectedTrustPenalty
            );
            const syncedOffseasonReject = syncCareerRelationships(
              career,
              { frontOffice: -6 },
              nextRejectedTrust - career.coachTrust
            );
            const lockedOptions = career.offseasonOptions.map((opt) =>
              opt.actionType === 'REQUEST_TRADE'
                ? {
                    ...opt,
                    locked: true,
                    lockReason: '이번 오프시즌 트레이드 요청이 이미 반려되었습니다.',
                  }
                : opt
            );
            set({
              career: {
                ...career,
                tradeRequestedThisYear: true,
                coachTrust: syncedOffseasonReject.coachTrust,
                relationships: syncedOffseasonReject.relationships,
                offseasonOptions: lockedOptions,
              },
              toast: option.contenderPath
                ? {
                    id: `TOAST_${Date.now()}`,
                    title: `${nextTeam.shortName} 우승 도전 이적이 무산되었습니다`,
                    description: '이번 오프시즌 이적 요청이 반려되었습니다. 남은 선택지에서 다음 시즌을 준비하세요.',
                    tone: 'amber',
                  }
                : {
                    id: `TOAST_${Date.now()}`,
                    title: `${career.team.shortName} 구단이 트레이드 요청을 반려했습니다`,
                    description: `${nextTeam.shortName}와의 패키지 협상이 결렬되었습니다. 소속팀 잔류 탭에서 기존 계약을 이어가세요.`,
                    tone: 'amber',
                  },
            });
            return;
          }
        }

        const isTeamChanged = nextTeam.id !== career.team.id;
        const isExistingContractStay =
          Boolean(option.isExistingContract) &&
          !isTeamChanged &&
          career.contractYearsLeft > 0;
        const nextTrust = isTeamChanged ? 54 : career.coachTrust;
        const nextSalary = isExistingContractStay
          ? career.annualSalary
          : option.annualSalary !== undefined
          ? option.annualSalary
          : getContractDefaultSalary(option.contractType, career.ovr);
        const nextContractTypeVal = isExistingContractStay
          ? career.contractType
          : option.contractType;
        const nextContractYearsVal = isExistingContractStay
          ? career.contractYearsLeft
          : option.contractYears;

        const nextPromisedRole =
          option.promisedRole ||
          determineTeamRolePromise(career, nextTeam, nextContractTypeVal)
            .promisedRole;

        const nextPedigreeSeasons = isTeamChanged
          ? 0
          : career.draftPedigreeSeasonsLeft ?? 0;

        // 만약 KBL 또는 NBA에 최초 입단했는데 아직 해당 리그 라이벌이 없다면 절차적 라이벌 생성
        let nextRivals = career.rivals || [];
        if (
          (nextLeague === 'KBL' || nextLeague === 'NBA') &&
          !nextRivals.some((r) => r.league === nextLeague)
        ) {
          const created = generateDraftRivals(
            career,
            nextLeague,
            nextTeam.id
          );
          nextRivals = [...nextRivals, ...created];
        }

        const { role } = calculateRoleAndMpg({
          ovr: career.ovr,
          team: nextTeam,
          coachTrust: nextTrust,
          secondaryPos: career.secondaryPos,
          contractType: nextContractTypeVal,
          league: nextLeague,
          stats: career.stats,
          primaryPos: career.primaryPos,
          growthDna: career.growthDna,
          traits: career.traits,
          promisedRole: nextPromisedRole,
          draftPedigreePick: isTeamChanged ? null : career.draftPedigreePick,
          draftPedigreeRound: isTeamChanged ? null : career.draftPedigreeRound,
          draftPedigreeSeasonsLeft: nextPedigreeSeasons,
          seasonLogs: career.seasonLogs,
        });

        const nextMilestones = [...career.milestones];
        if (isTeamChanged) {
          nextMilestones.push({
            id: `MS_SIGN_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: `${nextTeam.name} (${LEAGUE_CONFIG[nextLeague].shortName}) ${
              option.contenderPath
                ? '우승 도전 이적'
                : option.actionType === 'REQUEST_TRADE'
                ? '트레이드 이적'
                : '계약 체결'
            }`,
            description: `약속 역할 ${ROLE_PROMISE_LABELS[nextPromisedRole]} · ${role} 입지로 새 시즌을 시작합니다.`,
            type: 'SPECIAL',
            teamName: nextTeam.name,
          });
        }

        const toastTitle = isTeamChanged
          ? `${nextTeam.name} ${
              option.actionType === 'REQUEST_TRADE'
                ? '트레이드 이적 완료'
                : '계약 체결'
            }`
          : isExistingContractStay && career.contractYearsLeft > 0
          ? `${nextTeam.name} 기존 계약 유지 · 새 시즌 개막`
          : `${nextTeam.name} 새 시즌 준비 완료`;

        const toastDescription =
          isExistingContractStay && career.contractYearsLeft > 0
            ? `잔여 계약 ${career.contractYearsLeft}년 · ${ROLE_PROMISE_LABELS[nextPromisedRole]}`
            : `약속 역할: ${ROLE_PROMISE_LABELS[nextPromisedRole]}`;

        set({
          career: {
            ...career,
            league: nextLeague,
            team: nextTeam,
            contractType: nextContractTypeVal,
            contractYearsLeft: nextContractYearsVal,
            annualSalary: nextSalary,
            twoWaySeasonsUsed:
              nextContractTypeVal === 'TWO_WAY' && isTeamChanged
                ? 0
                : career.twoWaySeasonsUsed,
            draftPedigreePick: isTeamChanged ? null : career.draftPedigreePick,
            draftPedigreeRound: isTeamChanged ? null : career.draftPedigreeRound,
            draftPedigreeSeasonsLeft: nextPedigreeSeasons,
            promisedRole: nextPromisedRole,
            brokenRolePromise: false,
            lastInternationalSummary: null,
            seasonsOnCurrentTeam: isTeamChanged
              ? 0
              : career.seasonsOnCurrentTeam ?? 0,
            tradeRequestedThisYear: false,
            contenderPathTeamId: option.contenderPath
              ? nextTeam.id
              : isTeamChanged
              ? null
              : career.contenderPathTeamId ?? null,
            rivals: nextRivals,
            coachTrust: nextTrust,
            relationships: isTeamChanged
              ? buildTeamTransferRelationships(career, nextTrust)
              : {
                  ...getEffectiveRelationships(career),
                  coachTrust: nextTrust,
                },
            role,
            isOutOfLeagueWarning: false,
            offseasonLocked: false,
            offseasonOptions: [],
            pendingEventQueue: [],
            seasonPhase: 'REGULAR_SEASON',
            playoffBracket: null,
            liveGame: null,
            milestones: nextMilestones,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: toastTitle,
            description: toastDescription,
            tone: 'orange',
          },
        });
      },

      runCombineDrill: (drillId, label, statKey) => {
        const { career } = get();
        if (!career || !career.combineState) return;
        if (career.combineState.completedDrills.includes(drillId)) return;
        if (career.combineState.completedDrills.length >= 2) return;

        const statVal = career.stats[statKey];
        const gradeBonus = statVal >= 78 ? 6.5 : statVal >= 68 ? 4.0 : 2.0;
        const rawUpdatedStats: PlayerStats = {
          ...career.stats,
          [statKey]: clampStat(career.stats[statKey] + 1),
        };
        const updatedStats = enforceBiomechanicalCaps(
          rawUpdatedStats,
          career.heightCm,
          career.primaryPos
        );
        const actualGain = Math.max(0, updatedStats[statKey] - career.stats[statKey]);
        const prevGains = career.combineState.statGains || {};
        const nextGains: Partial<PlayerStats> = {
          ...prevGains,
          [statKey]: (prevGains[statKey] || 0) + actualGain,
        };
        const updatedOvr = calculateOvr(
          updatedStats,
          career.primaryPos,
          career.heightCm
        );
        const newBonus = career.combineState.combineBonusScore + gradeBonus;

        const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(
          { ...career, ovr: updatedOvr },
          newBonus
        );

        set({
          career: {
            ...career,
            stats: updatedStats,
            ovr: updatedOvr,
            peakOvr: Math.max(career.peakOvr, updatedOvr),
            combineState: {
              ...career.combineState,
              completedDrills: [...career.combineState.completedDrills, drillId],
              combineBonusScore: newBonus,
              projectedPick,
              undraftedRisk,
              statGains: nextGains,
            },
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${label} 측정 완료`,
            description:
              actualGain > 0
                ? `능력치 +${actualGain} 상승 · 예상 지명 ${projectedPick}순위`
                : `신체 상한 도달 · 예상 지명 ${projectedPick}순위`,
            tone: 'emerald',
          },
        });
      },

      completeCombineInterview: (answerType) => {
        const { career } = get();
        if (
          !career ||
          !career.combineState ||
          career.combineState.interviewCompleted
        )
          return;

        const interviewBonus =
          answerType === 'CONFIDENT'
            ? 4.5
            : answerType === 'TEAM_FIRST'
            ? 3.5
            : 4.0;
        const newBonus = career.combineState.combineBonusScore + interviewBonus;
        const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(
          career,
          newBonus
        );

        const syncedInterview = syncCareerRelationships(career, undefined, 4);
        const actualTrustGain = Math.max(
          0,
          syncedInterview.coachTrust - career.coachTrust
        );
        set({
          career: {
            ...career,
            coachTrust: syncedInterview.coachTrust,
            relationships: syncedInterview.relationships,
            combineState: {
              ...career.combineState,
              interviewCompleted: true,
              combineBonusScore: newBonus,
              projectedPick,
              undraftedRisk,
              trustGain: (career.combineState.trustGain || 0) + actualTrustGain,
            },
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '구단 단장단 면접 완료',
            description: `예상 지명 순위가 ${projectedPick}순위로 조정되었습니다.`,
            tone: 'orange',
          },
        });
      },

      withdrawFromDraft: () => {
        const { career } = get();
        if (!career) return;

        // 컴바인 드릴/면접으로 얻은 임시 스탯·신뢰도 상승분 원복 (반복 철회 스탯 파밍 방지)
        const statGains = career.combineState?.statGains || {};
        const trustGain = career.combineState?.trustGain || 0;
        const rolledBackStats: PlayerStats = { ...career.stats };
        let hadStatRollback = false;
        for (const k of Object.keys(statGains) as (keyof PlayerStats)[]) {
          const g = statGains[k] || 0;
          if (g > 0) {
            rolledBackStats[k] = clampStat(rolledBackStats[k] - g);
            hadStatRollback = true;
          }
        }
        const rolledBackOvr = calculateOvr(
          rolledBackStats,
          career.primaryPos,
          career.heightCm
        );
        const rolledBackTrust = clampNum(career.coachTrust - trustGain, 10, 100);
        const rolledBackRelationships = {
          ...getEffectiveRelationships(career),
          coachTrust: rolledBackTrust,
        };
        const rolledBackCareer: CareerState = {
          ...career,
          stats: rolledBackStats,
          ovr: rolledBackOvr,
          coachTrust: rolledBackTrust,
          relationships: rolledBackRelationships,
          combineState: null,
          draftResult: null,
        };

        // NBA 드래프트 신청을 철회해도 오프시즌 에이전트 데스크 선택권(잔류/타 구단 오퍼/KBL 드래프트 등)을 유지!
        const allOptions = generateOffseasonOptions(rolledBackCareer);
        const remainingOptions = allOptions.filter(
          (opt) => opt.actionType !== 'ENTER_NBA_DRAFT'
        );
        const fallbackOptions: OffseasonOption[] =
          remainingOptions.length > 0
            ? remainingOptions
            : [
                {
                  id: 'OPT_WITHDRAW_STAY_FALLBACK',
                  title: `${career.team.name} 복귀 및 1시즌 추가 활약`,
                  subtitle:
                    'NBA 드래프트 참가를 철회하고 소속팀에서 주전으로 한 시즌 더 실전 기량을 증명합니다.',
                  badgeText: '드래프트 철회 · 소속팀 복귀',
                  targetLeague: career.league,
                  targetTeam: career.team,
                  contractType: career.contractType,
                  contractYears: Math.max(1, career.contractYearsLeft || 1),
                  annualSalary: career.annualSalary,
                  actionType: 'STAY_TEAM',
                },
              ];

        const { role } = calculateRoleAndMpg(rolledBackCareer);
        set({
          career: {
            ...rolledBackCareer,
            offseasonLocked: true,
            offseasonOptions: fallbackOptions,
            seasonPhase: 'OFFSEASON',
            role,
          },
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: 'NBA 드래프트 참가 철회 · 에이전트 데스크 복귀',
            description:
              hadStatRollback || trustGain > 0
                ? '컴바인 기간 중 얻은 임시 상승분이 원복되었습니다. 다음 진로를 선택하세요.'
                : '대학 잔류, KBL 드래프트, 타 리그 계약 오퍼 중 다음 진로를 선택하세요.',
            tone: 'amber',
          },
        });
      },

      proceedToDraftLive: () => {
        const { career } = get();
        if (!career) return;
        const draftResult = executeDraftResolution(career, 'NBA');
        set({
          career: {
            ...career,
            hasEnteredNbaDraft: true,
            draftResult,
          },
          view: 'DRAFT_LIVE',
        });
      },

      finalizeDraftSigning: (choice) => {
        const { career } = get();
        if (!career || !career.draftResult) return;

        const dr = career.draftResult;
        let nextLeague = career.league;
        let nextTeam = career.team;
        let nextContractType: ContractType = career.contractType;
        let nextYears = 2;
        let nextPedigreePick: number | null = null;
        let nextPedigreeRound: 1 | 2 | null = null;
        let nextPedigreeSeasons = 0;
        let nextInitialTrust = 50;
        let milestoneTitle = '';
        let milestoneDesc = '';

        if (dr.draftType === 'KBL' && dr.draftedTeam) {
          nextLeague = 'KBL';
          nextTeam = dr.draftedTeam;
          nextContractType = 'KBL_ROOKIE';
          nextYears = 3;
          nextPedigreePick = dr.pickNumber;
          nextPedigreeRound = dr.round;
          nextPedigreeSeasons = dr.round === 1 ? 2 : 1;
          nextInitialTrust =
            dr.pickNumber && dr.pickNumber <= 3
              ? 70
              : dr.round === 1
              ? 62
              : 48;
          milestoneTitle = `KBL 드래프트 전체 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
          milestoneDesc = `${nextTeam.name}의 지명을 받아 프로 무대에 데뷔했습니다.`;
        } else if (choice === 'NBA_STANDARD' && dr.draftedTeam) {
          nextLeague = 'NBA';
          nextTeam = dr.draftedTeam;
          nextContractType = 'NBA_STANDARD';
          nextYears = 4;
          nextPedigreePick = dr.pickNumber;
          nextPedigreeRound = 1;
          nextPedigreeSeasons = 3;
          nextInitialTrust =
            dr.pickNumber && dr.pickNumber <= 14 ? 72 : 64;
          milestoneTitle = `NBA 드래프트 1라운드 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
          milestoneDesc = `${nextTeam.name}와 정식 NBA 루키 계약을 체결했습니다.`;
        } else if (
          choice === 'TWO_WAY' &&
          (dr.draftedTeam || dr.twoWayOfferTeam)
        ) {
          const targetNbaTeam = (dr.draftedTeam || dr.twoWayOfferTeam)!;
          nextLeague = 'NBA';
          nextTeam = targetNbaTeam;
          nextContractType = 'TWO_WAY';
          nextYears = 1;
          nextPedigreePick = dr.pickNumber;
          nextPedigreeRound = dr.round;
          nextPedigreeSeasons = dr.round === 2 ? 1 : 0;
          nextInitialTrust = 48;
          milestoneTitle = dr.pickNumber
            ? `NBA 드래프트 2라운드 ${dr.pickNumber}순위 지명 (${targetNbaTeam.shortName})`
            : `${targetNbaTeam.shortName} 투웨이 계약 체결`;
          milestoneDesc = `${targetNbaTeam.name} 투웨이 로스터에 합류해 정식 계약 승격에 도전합니다.`;
        } else if (choice === 'GLEAGUE') {
          nextLeague = 'GLEAGUE';
          nextTeam = selectBestFitTeamForPlayer(
            'GLEAGUE',
            career.primaryPos,
            career.secondaryPos,
            career.teamRatingsMap
          );
          nextContractType = 'GLEAGUE_EXHIBIT';
          nextYears = 1;
          nextInitialTrust = 54;
          milestoneTitle = `${nextTeam.name} 트라이아웃 합류`;
          milestoneDesc =
            'G리그 쇼케이스에서 실전 경쟁력을 증명하기로 했습니다.';
        } else {
          nextLeague = 'KBL';
          nextTeam = selectBestFitTeamForPlayer(
            'KBL',
            career.primaryPos,
            career.secondaryPos,
            career.teamRatingsMap
          );
          nextContractType = 'KBL_ROOKIE';
          nextYears = 2;
          nextInitialTrust = 55;
          milestoneTitle = `${nextTeam.name} 입단`;
          milestoneDesc =
            'KBL 무대에서 실전 경쟁력을 증명한 뒤 다시 도전합니다.';
        }

        const syncedTeam =
          getTeamById(nextTeam.id, career.teamRatingsMap) || nextTeam;
        const nextSalary = getContractDefaultSalary(
          nextContractType,
          career.ovr
        );
        const promise = determineTeamRolePromise(
          career,
          syncedTeam,
          nextContractType
        );

        // 프로 드래프트 입단 시 동기 라이벌(1~2명) 절차적 생성
        let nextRivals = career.rivals || [];
        if (
          (nextLeague === 'KBL' || nextLeague === 'NBA') &&
          !nextRivals.some((r) => r.league === nextLeague)
        ) {
          const createdRivals = generateDraftRivals(
            career,
            nextLeague,
            syncedTeam.id
          );
          nextRivals = [...nextRivals, ...createdRivals];
        }

        const { role } = calculateRoleAndMpg({
          ovr: career.ovr,
          team: syncedTeam,
          coachTrust: nextInitialTrust,
          secondaryPos: career.secondaryPos,
          contractType: nextContractType,
          league: nextLeague,
          stats: career.stats,
          primaryPos: career.primaryPos,
          growthDna: career.growthDna,
          traits: career.traits,
          promisedRole: promise.promisedRole,
          draftPedigreePick: nextPedigreePick,
          draftPedigreeRound: nextPedigreeRound,
          draftPedigreeSeasonsLeft: nextPedigreeSeasons,
          seasonLogs: career.seasonLogs,
        });

        set({
          career: {
            ...career,
            league: nextLeague,
            team: syncedTeam,
            contractType: nextContractType,
            contractYearsLeft: nextYears,
            annualSalary: nextSalary,
            twoWaySeasonsUsed:
              nextContractType === 'TWO_WAY' ? 0 : career.twoWaySeasonsUsed,
            draftPedigreePick: nextPedigreePick,
            draftPedigreeRound: nextPedigreeRound,
            draftPedigreeSeasonsLeft: nextPedigreeSeasons,
            promisedRole: promise.promisedRole,
            brokenRolePromise: false,
            seasonsOnCurrentTeam: 0,
            tradeRequestedThisYear: false,
            rivals: nextRivals,
            coachTrust: nextInitialTrust,
            relationships: buildTeamTransferRelationships(
              career,
              nextInitialTrust
            ),
            hasEnteredNbaDraft:
              career.hasEnteredNbaDraft || dr.draftType === 'NBA',
            role,
            combineState: null,
            draftResult: null,
            offseasonLocked: false,
            offseasonOptions: [],
            pendingEventQueue: [],
            seasonPhase: 'REGULAR_SEASON',
            playoffBracket: null,
            liveGame: null,
            milestones: [
              ...career.milestones,
              {
                id: `MS_DRAFT_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: milestoneTitle,
                description: milestoneDesc,
                type: 'DRAFT',
                teamName: syncedTeam.name,
              },
            ],
          },
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: milestoneTitle,
            description: `소속 구단: ${syncedTeam.name} · 역할: ${role}`,
            tone: 'orange',
          },
        });
      },

      triggerRetirement: (reason) => {
        const { career } = get();
        if (!career) return;
        const legacyEval = evaluateCareerLegacy(career);
        set({
          career: {
            ...career,
            retirementReason: reason,
            legacyEvaluation: legacyEval,
          },
          view: 'RETIREMENT',
        });
      },

      completeRetirementAndReturnHome: () => {
        const { career, hofList, recordBook, recordBookManuallyReset } = get();
        if (!career) {
          set({ view: 'HOME' });
          return;
        }

        const reason = career.retirementReason || 'VOLUNTARY_HONOR';
        const evaluation =
          career.legacyEvaluation || evaluateCareerLegacy(career);
        const newEntry = buildHallOfFameEntry(
          career,
          reason,
          evaluation,
          recordBook
        );

        const updatedHof = [newEntry, ...hofList].sort(
          (a, b) => b.legacyScore - a.legacyScore
        );
        const syncedRecordBook = syncRecordBookWithHof(
          recordBook,
          recordBookManuallyReset ? [newEntry] : updatedHof,
          null
        );

        set({
          hofList: updatedHof,
          recordBook: syncedRecordBook,
          lastPersonalCareIds: [],
          career: null,
          hofRetrospectiveId: null,
          view: 'HOME',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `#${newEntry.jerseyNumber} ${newEntry.name} 명예의 전당 헌액`,
            description:
              '명예의 전당에서 언제든 커리어 회고 다큐멘터리를 다시 감상할 수 있습니다.',
            tone: 'amber',
          },
        });
      },

      resetActiveCareer: () => {
        set({
          career: null,
          lastPersonalCareIds: [],
          lastEncounterOutcome: null,
          view: 'CREATE',
        });
      },

      resetRecordBookOnly: () => {
        set({
          recordBook: createInitialRecordBook(),
          recordBookManuallyReset: true,
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '역대 기록실 초기화 완료',
            description:
              '경신했던 모든 리그 역대 기록이 초기 기준 기록으로 복원되었습니다.',
            tone: 'emerald',
          },
        });
      },

      declareNationalTeamRetirement: () => {
        const career = get().career;
        if (!career || career.retirementReason || career.nationalTeamRetired) {
          return;
        }

        const evalRes = evaluateNationalTeamRetirement(career);
        const syncedRel = syncCareerRelationships(career, {
          mediaFan: evalRes.mediaFanDelta,
          lockerRoom: evalRes.lockerRoomDelta,
        });

        const currentArcs = getEffectiveStoryArcs(career);
        const natArc = currentArcs.NATIONAL_TORCH_ARC;
        const nextStoryArcs = natArc.completed
          ? currentArcs
          : {
              ...currentArcs,
              NATIONAL_TORCH_ARC: {
                ...natArc,
                summary: `국가대표 은퇴 선언(${career.seasonYear}년 · 만 ${career.age}세)으로 대표팀 세대교체 서사가 마무리되었습니다.`,
              },
            };

        const retirementMilestone: CareerMilestone = {
          id: `MS_NAT_RETIRE_${career.seasonYear}_${career.age}`,
          year: career.seasonYear,
          age: career.age,
          title: '대한민국 국가대표 은퇴 선언',
          description: evalRes.milestoneDescription,
          type: 'SPECIAL',
          teamName: '대한민국 국가대표팀',
        };

        const filteredQueue = (career.pendingEventQueue || []).filter(
          (evt) => !isNationalTeamEvent(evt)
        );
        const pendingWasNat = isNationalTeamEvent(career.pendingEvent);
        const filteredPendingChain = isNationalTeamEvent(career.pendingChainEvent)
          ? null
          : career.pendingChainEvent ?? null;

        let nextCareer: CareerState = {
          ...career,
          nationalTeamRetired: true,
          nationalTeamRetiredYear: career.seasonYear,
          nationalTeamRetiredAge: career.age,
          nationalTeamRetirementNote: evalRes.reactionSummary,
          relationships: syncedRel.relationships,
          coachTrust: syncedRel.coachTrust,
          storyArcs: nextStoryArcs,
          milestones: [...career.milestones, retirementMilestone],
          pendingEvent: pendingWasNat ? null : career.pendingEvent,
          pendingEventQueue: filteredQueue,
          pendingChainEvent: filteredPendingChain,
        };

        if (pendingWasNat) {
          nextCareer = dequeueNextPendingEvent(nextCareer);
        }

        const tone: ToastMessage['tone'] =
          evalRes.tier === 'HONORABLE'
            ? 'emerald'
            : evalRes.tier === 'RESPECTED'
            ? 'amber'
            : 'rose';

        const deltaParts: string[] = [];
        if (evalRes.mediaFanDelta !== 0) {
          deltaParts.push(
            `언론·팬 평판 ${
              evalRes.mediaFanDelta > 0
                ? `+${evalRes.mediaFanDelta}`
                : evalRes.mediaFanDelta
            }`
          );
        }
        if (evalRes.lockerRoomDelta !== 0) {
          deltaParts.push(
            `라커룸 ${
              evalRes.lockerRoomDelta > 0
                ? `+${evalRes.lockerRoomDelta}`
                : evalRes.lockerRoomDelta
            }`
          );
        }

        set({
          career: nextCareer,
          toast: {
            id: `TOAST_${Date.now()}`,
            title: evalRes.reactionTitle,
            description: `${evalRes.reactionSummary}${
              deltaParts.length > 0 ? ` (${deltaParts.join(' · ')})` : ''
            }`,
            tone,
          },
        });
      },

      resetHallOfFameOnly: () => {
        set({
          hofList: [],
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '명예의 전당 초기화 완료',
            description:
              '헌액된 은퇴 선수와 올타임 베스트 5 목록을 모두 비웠습니다.',
            tone: 'emerald',
          },
        });
      },

      resetAllGameData: () => {
        set({
          career: null,
          hofList: [],
          recordBook: createInitialRecordBook(),
          recordBookManuallyReset: false,
          lastPersonalCareIds: [],
          lastEncounterOutcome: null,
          view: 'HOME',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '전체 기록 초기화 완료',
            description:
              '현재 커리어, 명예의 전당, 역대 기록실이 모두 초기 상태로 돌아갔습니다.',
            tone: 'emerald',
          },
        });
      },

      resetByScope: (scope) => {
        if (scope === 'RECORD_BOOK') {
          get().resetRecordBookOnly();
          return;
        }
        if (scope === 'HALL_OF_FAME') {
          get().resetHallOfFameOnly();
          return;
        }
        get().resetAllGameData();
      },
    }),
    {
      name: 'bench-to-mvp-career-storage-v1',
      partialize: (state) => ({
        career: state.career,
        hofList: state.hofList,
        recordBook: state.recordBook,
        recordBookManuallyReset: state.recordBookManuallyReset,
        fastSimEnabled: state.fastSimEnabled,
        lastPersonalCareIds: state.lastPersonalCareIds,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<CareerStoreState>) || {};
        const migrated = migratePersistedPayload({
          career: persisted.career ?? currentState.career,
          hofList: persisted.hofList ?? currentState.hofList,
          recordBook: persisted.recordBook ?? currentState.recordBook,
          skipRecordSync: Boolean(persisted.recordBookManuallyReset),
        });
        return {
          ...currentState,
          ...persisted,
          career: migrated.career,
          hofList: migrated.hofList,
          recordBook: migrated.recordBook,
        };
      },
    }
  )
);
