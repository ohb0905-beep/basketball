import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateLeagueFallbackSvgDataUri } from '../data/logoFallbacks';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  NBA_TEAMS,
  KBL_TEAMS,
  B_LEAGUE_TEAMS,
  NBL_TEAMS,
  EUROLEAGUE_TEAMS,
  NCAA_TEAMS,
  HIGH_SCHOOL_TEAMS,
  U_LEAGUE_TEAMS,
  GLEAGUE_TEAMS,
  ASIAN_NATIONAL_TEAMS,
  ALL_INTERNATIONAL_TEAMS,
  getNationalTeamsForTournament,
  SANGMU_TEAM,
  ALL_TEAMS,
  evolveLeagueTeamRatings,
} from '../data/teams';
import {
  PLAYER_TRAIT_META,
  analyzePositionFit,
  applyAgeAdjustedEventStatChanges,
  applySpecialCampProgram,
  calculateBiomechanicalProfile,
  calculateHeightMismatchPenalty,
  calculateOvr,
  canSwitchToPosition,
  createInitialStats,
  enforceBiomechanicalCaps,
  evaluateAcquiredTraits,
  evaluatePlayerBadges,
  getBiomechanicalGrowthElasticity,
  getBiomechanicalStatCaps,
  getGrowthDnaInfo,
  getPlaystyleInfo,
  getPreviewStatsAndOvrRange,
  getSpecialCampOptions,
  isPlaystyleAllowedForPosition,
  reconcilePlaystyleForPosition,
  rollInitialPotential,
  rollInnateTrait,
  rollPlayerDnaAndPlaystyle,
} from './statCalculator';
import {
  assignPositionBalancedAllLeagueTeams,
  buildAwardRaceTop5,
  calcUnifiedAllStarScore,
  calculateRoleAndMpg,
  calculatePpg,
  calculateSeasonStatGrowth,
  calculateOrganicTrustDelta,
  calculateRecentEfficiencyMomentum,
  calculateTeamContractOfferSalary,
  checkPotentialBreakthrough,
  computeCareerMinutes,
  evaluateFluidSeasonAwards,
  evaluateUnifiedLeagueAwards,
  generateDraftRivals,
  getAwardsByLeague,
  getLeagueBaselineTeamRating,
  getSangmuDischargeContractType,
  isEligibleForLeagueRookieAward,
  selectPositionBalancedAllStars,
  simulateRivalsSeason,
  simulateSeason,
} from './seasonSimulator';
import {
  calculateOffseasonTradeAcceptProb,
  calculateProjectedNbaPick,
  createInitialCombineState,
  determineTeamRolePromise,
  evaluateHighSchoolProspect,
  evaluateTeamScouting,
  evaluateTwoWaySurvival,
  executeDraftResolution,
  generateOffseasonOptions,
} from './draftEngine';
import {
  formatHeaderContractSummary,
  formatSalaryOffer,
  getMilitaryStatusDisplay,
} from '../utils/formatters';
import {
  applyAgingCurve,
  buildHallOfFameEntry,
  checkRetirementEligibility,
  evaluateCareerLegacy,
  getAgingPhaseInfo,
} from './retirementEngine';
import {
  buildCareerRetrospective,
  buildChampionshipChronicle,
  buildFallbackRetrospectiveFromHof,
  buildTeamStints,
  buildTrophyCabinet,
  selectPeakSeason,
} from './retrospectiveEngine';
import {
  buildStoryArcEventById,
  checkEncounterChoiceUnlock,
  rollStoryArcEvent,
} from './storyArcEngine';
import {
  LEGACY_TIER_CATALOG,
  buildHofCompendium,
  checkAndApplyRecordBreaks,
  createInitialRecordBook,
  getLeagueRecordChases,
  syncRecordBookWithHof,
} from './recordBookEngine';
import {
  advancePlayoffRound,
  batchAdvanceEarlyPlayoffRounds,
  calculateKoreaTeamEffectiveRating,
  createLiveFinalGame,
  createPlayoffBracket,
  evaluateRealisticFinalsMvp,
  generateLeagueStandings,
  isInternationalLiveGame,
  resolveClutchPossession,
  resolveConfFinalsGame7InBracket,
  simulateAsianGamesTournament,
  simulateInternationalTournament,
  simulateLiveQuarter,
  skipEntirePlayoffs,
  skipLiveGameToEnd,
} from './playoffEngine';
import {
  AWARD_VOTING_CONFIG,
  INTERNATIONAL_TOURNAMENT_CONFIG,
  LEAGUE_AWARD_QUOTAS,
  canUseProTradeSystem,
  getInternationalTournamentByYear,
  isPersonalCareAllowedInLeague,
} from '../config/balanceConfig';
import {
  ENCOUNTER_SCENARIO_POOL,
  calculateEncounterSuccessChance,
  extractCareerContextTags,
  resolveEncounterChoiceOutcome,
  rollCombinatorialEncounter,
} from './encounterEngine';
import {
  createAgentRetirementAdviceEvent,
  createInternationalCallupEvent,
  createVeteranReinventionEvent,
  rollMidSeasonCrossroadsEvent,
  rollSeasonEvent,
} from '../data/events';
import { migratePersistedPayload } from '../store/saveMigration';
import {
  CareerState,
  GrowthDna,
  PlaystyleArchetype,
  SeasonBoxScore,
} from '../types/game';
import { hasSeasonBottomDock } from '../utils/formatters';

function buildInitialTeamRatingsMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of ALL_TEAMS) {
    map[t.id] = t.rating;
  }
  return map;
}

function createBaseCareer(overrides: Partial<CareerState> = {}): CareerState {
  return {
    id: 'TEST',
    name: '테스트선수',
    jerseyNumber: '23',
    heightCm: 198,
    primaryPos: 'SG',
    secondaryPos: 'SF',
    growthDna: 'STANDARD',
    playstyle: 'ALL_ROUNDER',
    traits: ['IRON_STAMINA'],
    age: 35,
    seasonYear: 2040,
    seasonsPlayed: 15,
    ovr: 86,
    peakOvr: 95,
    potential: 96,
    potentialBreakthroughCount: 0,
    stats: { ins: 85, out: 90, ply: 84, def: 82, reb: 75, phy: 74 },
    lastSeasonDelta: { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 },
    league: 'NBA',
    team: NBA_TEAMS[0],
    contractType: 'NBA_MAX',
    contractYearsLeft: 1,
    annualSalary: 42000,
    careerEarnings: 320000,
    twoWaySeasonsUsed: 0,
    draftPedigreePick: null,
    draftPedigreeRound: null,
    draftPedigreeSeasonsLeft: 0,
    promisedRole: 'ACE_FIRST_OPTION',
    brokenRolePromise: false,
    role: '프랜차이즈 1옵션 에이스',
    coachTrust: 95,
    draftStock: 90,
    trainingFocus: 'BALANCED',
    lastCampYear: 0,
    militaryExempt: true,
    militaryServiceSeasonsLeft: 0,
    previousTeamBeforeMilitary: null,
    isFarewellTour: false,
    farewellTourCompleted: false,
    isOutOfLeagueWarning: false,
    agentAdviceShown: false,
    midSeasonEventTriggeredThisYear: false,
    ovrHistory: [92, 90, 86],
    prospectStars: 4,
    teamRatingsMap: buildInitialTeamRatingsMap(),
    rivals: [],
    seenEventIds: [],
    recentEventCategories: [],
    pendingChainEvent: null,
    seasonPhase: 'OFFSEASON',
    currentStandings: [],
    playoffBracket: null,
    liveGame: null,
    badges: [],
    seasonLogs: [],
    milestones: [],
    careerHighs: {
      points: 54,
      rebounds: 14,
      assists: 13,
      steals: 5,
      blocks: 3,
      pointsContext: '2039 시즌 기록',
    },
    totals: {
      gp: 920,
      points: 21500,
      rebounds: 5200,
      assists: 4800,
      steals: 1200,
      blocks: 450,
      nbaGp: 920,
      nbaPoints: 21500,
      championships: 3,
      nbaChampionships: 3,
      mvps: 2,
      nbaMvps: 2,
      finalsMvps: 2,
      dpoys: 0,
      sixthManAwards: 0,
      mips: 1,
      allLeagueSelections: 7,
      allStars: 9,
      nbaAllStars: 9,
    },
    offseasonLocked: true,
    offseasonOptions: [],
    pendingEvent: null,
    combineState: null,
    draftResult: null,
    retirementReason: null,
    legacyEvaluation: null,
    ...overrides,
  };
}

function createSeasonLog(overrides: Partial<SeasonBoxScore> = {}): SeasonBoxScore {
  return {
    seasonNumber: 1,
    year: 2030,
    age: 25,
    league: 'NBA',
    leagueName: 'NBA',
    teamId: NBA_TEAMS[0].id,
    teamName: NBA_TEAMS[0].name,
    teamShortName: NBA_TEAMS[0].shortName,
    contractType: 'NBA_MAX',
    role: '프랜차이즈 1옵션 에이스',
    ovr: 90,
    gp: 78,
    injuredGamesMissed: 4,
    mpg: 34.5,
    ppg: 26.5,
    rpg: 6.2,
    apg: 5.8,
    spg: 1.6,
    bpg: 0.6,
    fgPct: 49.5,
    tpPct: 39.2,
    wins: 56,
    losses: 26,
    teamRank: 2,
    totalLeagueTeams: 30,
    playoffResult: '컨퍼런스 결승 탈락',
    wonChampionship: false,
    wonMvp: false,
    wonFinalsMvp: false,
    wonDpoy: false,
    wonSixthMan: false,
    wonMip: false,
    wonRookieOfYear: false,
    allStarSelected: true,
    allLeagueTeam: 1,
    singleGameHighPts: 48,
    salaryEarned: 35000,
    headline: '테스트 헤드라인',
    narrativeLog: [],
    ...overrides,
  };
}

test('1. Initial stats, OVR, GrowthDna, PlaystyleArchetype, Innate Trait, and Potential Spectrum (68~96)', () => {
  const preview = getPreviewStatsAndOvrRange('PG', 188);
  assert.ok(preview.minOvr >= 47 && preview.maxOvr <= 62);
  assert.ok(preview.maxOvr > preview.minOvr);

  const lowRng = () => 0.0;
  const highRng = () => 0.999;
  const lowStats = createInitialStats('PG', 188, lowRng);
  const highStats = createInitialStats('PG', 188, highRng);
  const lowOvr = calculateOvr(lowStats, 'PG');
  const highOvr = calculateOvr(highStats, 'PG');

  assert.ok(highOvr > lowOvr, 'High RNG roll should produce higher initial OVR than low RNG roll');
  assert.ok(lowOvr >= 45 && highOvr <= 64);

  const dna1 = rollPlayerDnaAndPlaystyle(lowStats, 'PG', () => 0.05);
  const dna2 = rollPlayerDnaAndPlaystyle(highStats, 'C', () => 0.65);
  assert.equal(dna1.growthDna, 'EARLY_BLOOMER');
  assert.equal(dna2.growthDna, 'IRONMAN');
  assert.equal(dna1.playstyle, 'PLAYMAKER');

  const lowPot = rollInitialPotential(lowOvr, 'STANDARD', 'IRON_STAMINA', lowRng);
  const highPot = rollInitialPotential(highOvr, 'LATE_BLOOMER', 'GLASS_BODY', highRng);
  assert.ok(lowPot >= 66 && lowPot <= 76, `Low potential roll should be ~66-76, got ${lowPot}`);
  assert.ok(highPot >= 90 && highPot <= 96, `High potential roll should reach 90-96, got ${highPot}`);

  const trait = rollInnateTrait('IRONMAN', () => 0.2);
  assert.equal(trait, 'IRON_STAMINA');
});

test('2. Draft Pedigree protects KBL/NBA 1st-round picks from garbage time despite OVR gap', () => {
  const kblTopPickRole = calculateRoleAndMpg(
    {
      ovr: 58,
      team: KBL_TEAMS[0],
      coachTrust: 68,
      secondaryPos: null,
      contractType: 'KBL_ROOKIE',
      league: 'KBL',
      draftPedigreePick: 1,
      draftPedigreeRound: 1,
      draftPedigreeSeasonsLeft: 2,
      seasonLogs: [],
    },
    () => 0.5
  );

  assert.ok(
    kblTopPickRole.mpg >= 22,
    `KBL #1 overall pick must receive starter/core prospect minutes (>= 22 MPG), got ${kblTopPickRole.mpg}`
  );
  assert.equal(kblTopPickRole.role, '주전급 코어 유망주 (1라운드 픽)');

  const playmakerTrustDelta = calculateOrganicTrustDelta({
    pos: 'PG',
    playstyle: 'PLAYMAKER',
    ppg: 8.5,
    rpg: 3.2,
    apg: 8.0,
    spg: 1.5,
    bpg: 0.2,
    mpg: 24.0,
    fgPct: 46.5,
    tpPct: 36.5,
    winRate: 0.54,
    wonDpoy: false,
    wonSixthMan: false,
    wonMvp: false,
  });
  assert.ok(playmakerTrustDelta > 0, 'Playmaker PG with 8.0 APG must gain coach trust even with <10 PPG');

  const centerTrustDelta = calculateOrganicTrustDelta({
    pos: 'C',
    playstyle: 'RIM_PROTECTOR',
    ppg: 7.5,
    rpg: 11.2,
    apg: 1.5,
    spg: 0.6,
    bpg: 2.3,
    mpg: 25.0,
    fgPct: 58.0,
    tpPct: 0,
    winRate: 0.52,
    wonDpoy: false,
    wonSixthMan: false,
    wonMvp: false,
  });
  assert.ok(centerTrustDelta > 0, 'Rim Protector C with 11.2 RPG & 2.3 BPG must gain coach trust');

  const momentum = calculateRecentEfficiencyMomentum(
    [
      createSeasonLog({
        league: 'KBL',
        gp: 40,
        mpg: 15.0,
        ppg: 9.2,
        rpg: 3.5,
        apg: 3.2,
        spg: 1.1,
        bpg: 0.3,
        fgPct: 50.2,
        tpPct: 39.5,
      }),
    ],
    'PG'
  );
  assert.ok(momentum > 3, `Efficient bench player should gain positive rotation momentum, got ${momentum}`);
});

test('3. High School prospect rating (1~5 stars) restricts graduation path offers', () => {
  const oneStarCareer = createBaseCareer({
    age: 20,
    league: 'HIGH_SCHOOL',
    ovr: 52,
    seasonLogs: [
      createSeasonLog({
        league: 'HIGH_SCHOOL',
        ppg: 7.2,
        rpg: 2.5,
        apg: 1.8,
        wonChampionship: false,
        wonMvp: false,
      }),
    ],
  });
  const eval1 = evaluateHighSchoolProspect(oneStarCareer);
  assert.ok(eval1.stars <= 2);

  const hsOptions1 = generateOffseasonOptions(oneStarCareer, () => 0.5);
  assert.ok(hsOptions1.length >= 1 && hsOptions1.length <= 2);
  assert.equal(
    hsOptions1.some(
      (o) =>
        o.targetLeague === 'NCAA' ||
        o.targetLeague === 'B_LEAGUE' ||
        o.targetLeague === 'NBL' ||
        o.targetLeague === 'EUROLEAGUE'
    ),
    false
  );

  const fiveStarCareer = createBaseCareer({
    age: 20,
    league: 'HIGH_SCHOOL',
    ovr: 64,
    seasonLogs: [
      createSeasonLog({
        league: 'HIGH_SCHOOL',
        ppg: 24.5,
        rpg: 8.5,
        apg: 5.2,
        wonChampionship: true,
        wonMvp: true,
      }),
    ],
  });
  const eval5 = evaluateHighSchoolProspect(fiveStarCareer);
  assert.equal(eval5.stars, 5);
  const hsOptions5 = generateOffseasonOptions(fiveStarCareer, () => 0.4);
  assert.ok(hsOptions5.some((o) => o.actionType === 'ENTER_KBL_DRAFT'));
  assert.ok(hsOptions5.some((o) => o.targetLeague === 'NCAA'));
});

test('4. League-Translated Per-36 Scouting prevents 20s prime forced retirement and offers step-down pro contracts', () => {
  const nbaBench25 = createBaseCareer({
    age: 25,
    ovr: 72,
    potential: 78,
    league: 'NBA',
    contractType: 'NBA_STANDARD',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        ovr: 72,
        gp: 42,
        mpg: 8.5,
        ppg: 3.1,
        rpg: 1.5,
        apg: 1.1,
        fgPct: 45.2,
        tpPct: 35.5,
      }),
    ],
  });

  const nbaContender = NBA_TEAMS.find((t) => t.direction === 'CONTENDER') || NBA_TEAMS[0];
  const nbaScout = evaluateTeamScouting(nbaBench25, nbaContender, () => 0.5);
  assert.equal(nbaScout.passesOfferThreshold, false, 'Top NBA contender should not sign OVR 72 bench player');

  const kblScout = evaluateTeamScouting(nbaBench25, KBL_TEAMS[0], () => 0.5);
  assert.equal(
    kblScout.passesOfferThreshold,
    true,
    'KBL team must value a 25yo OVR 72 NBA bench player as an immediate ace/starter'
  );

  const options = generateOffseasonOptions(nbaBench25, () => 0.5);
  assert.equal(
    options.some((o) => o.actionType === 'RETIRE_OUT_OF_LEAGUE'),
    false,
    '25yo OVR 72 player must NEVER be forced into OUT_OF_LEAGUE retirement'
  );
  assert.ok(
    options.some(
      (o) =>
        o.targetLeague === 'KBL' ||
        o.targetLeague === 'B_LEAGUE' ||
        o.targetLeague === 'NBL' ||
        o.targetLeague === 'EUROLEAGUE' ||
        o.targetLeague === 'GLEAGUE'
    ),
    '25yo NBA bench player must receive KBL/B.League/NBL/EuroLeague/G-League step-down offers'
  );
  assert.ok(
    options.some((o) => Boolean(o.promisedRole && o.promisedRoleLabel)),
    'Contract offers must specify a promised role'
  );

  const vetSpecialist = createBaseCareer({
    age: 33,
    ovr: 76,
    potential: 79,
    stats: { ins: 70, out: 84, ply: 75, def: 85, reb: 70, phy: 68 },
    league: 'NBA',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        ovr: 76,
        gp: 65,
        mpg: 18.5,
        ppg: 7.8,
        rpg: 3.4,
        apg: 2.1,
        fgPct: 45.5,
        tpPct: 39.0,
      }),
    ],
  });
  const vetOptions = generateOffseasonOptions(vetSpecialist, () => 0.5);
  assert.ok(
    vetOptions.some((o) => o.contractType === 'NBA_VET_MIN' || o.promisedRole === 'VETERAN_MENTOR'),
    '33yo specialist veteran should receive Veteran Minimum / Mentor offer'
  );
});

test('5. Agent Retirement Advice only triggers on same-league decline and at most once per career', () => {
  const promotedPlayer = createBaseCareer({
    age: 31,
    ovr: 77,
    league: 'NBA',
    agentAdviceShown: false,
    ovrHistory: [75, 77],
    seasonLogs: [
      createSeasonLog({ league: 'KBL', ppg: 22.0, mpg: 33.0 }),
      createSeasonLog({ league: 'NBA', ppg: 6.5, mpg: 16.0 }),
    ],
  });
  assert.equal(
    createAgentRetirementAdviceEvent(promotedPlayer),
    null,
    'League promotion from KBL to NBA must not trigger agent retirement advice'
  );

  const decliningVet = createBaseCareer({
    age: 34,
    ovr: 74,
    league: 'NBA',
    agentAdviceShown: false,
    ovrHistory: [84, 79, 74],
    seasonLogs: [
      createSeasonLog({ league: 'NBA', ppg: 22.0, mpg: 32.0 }),
      createSeasonLog({ league: 'NBA', ppg: 9.0, mpg: 18.0 }),
    ],
  });
  const advice1 = createAgentRetirementAdviceEvent(decliningVet);
  assert.ok(advice1 !== null);
  assert.equal(advice1?.id, 'EVT_AGENT_RETIREMENT_ADVICE');

  const alreadyShownVet = createBaseCareer({
    ...decliningVet,
    agentAdviceShown: true,
  });
  assert.equal(
    createAgentRetirementAdviceEvent(alreadyShownVet),
    null,
    'Agent retirement advice must not repeat once agentAdviceShown is true'
  );
});

test('6. Potential Breakthrough (Pro-Only), Player Traits, Special Camp & Procedural Rivals work organically', () => {
  const breakthroughCareer = createBaseCareer({
    age: 23,
    ovr: 76,
    potential: 77,
    potentialBreakthroughCount: 0,
    league: 'NBA',
    coachTrust: 82,
  });
  const bt = checkPotentialBreakthrough({
    career: breakthroughCareer,
    wonMip: true,
    wonMvp: false,
    wonDpoy: false,
    wonSixthMan: false,
    mpg: 26.0,
    ppg: 19.5,
    fgPct: 50.5,
    nextCoachTrust: 82,
    rng: () => 0.3,
  });
  assert.ok(bt.breakthroughGain >= 1 && bt.breakthroughGain <= 2, 'MIP winner near potential ceiling in pro league breaks through potential limit');

  // Amateur league must NOT trigger potential breakthrough
  const amateurCareer = createBaseCareer({
    age: 19,
    ovr: 64,
    potential: 65,
    potentialBreakthroughCount: 0,
    league: 'HIGH_SCHOOL',
    coachTrust: 90,
  });
  const amateurBt = checkPotentialBreakthrough({
    career: amateurCareer,
    wonMip: true,
    wonMvp: true,
    wonDpoy: false,
    wonSixthMan: false,
    mpg: 32.0,
    ppg: 28.0,
    fgPct: 55.0,
    nextCoachTrust: 90,
    rng: () => 0.1,
  });
  assert.equal(amateurBt.breakthroughGain, 0, 'Amateur leagues must never trigger potential breakthrough');

  const acquired = evaluateAcquiredTraits(
    createBaseCareer({
      traits: ['IRON_STAMINA'],
      stats: { ins: 78, out: 85, ply: 76, def: 75, reb: 70, phy: 75 },
    }),
    createSeasonLog({ tpPct: 41.2, wonSixthMan: true, gp: 60 })
  );
  assert.ok(
    acquired.nextTraits.includes('BENCH_ACE') || acquired.nextTraits.includes('SNIPER')
  );

  const campRes = applySpecialCampProgram(
    createBaseCareer({
      age: 24,
      ovr: 75,
      potential: 80,
      stats: { ins: 75, out: 75, ply: 75, def: 75, reb: 75, phy: 75 },
    }),
    'BULK_UP'
  );
  assert.equal(campRes.nextStats.ins, 77);
  assert.equal(campRes.nextStats.reb, 77);
  assert.equal(campRes.nextStats.out, 74);

  const rivals = generateDraftRivals(
    createBaseCareer({
      seasonYear: 2030,
      ovr: 64,
      primaryPos: 'PG',
    }),
    'KBL',
    KBL_TEAMS[0].id,
    () => 0.4
  );
  assert.equal(rivals.length, 2);
  const simRivals = simulateRivalsSeason(
    rivals,
    2030,
    createSeasonLog({ league: 'KBL', ppg: 16.5 }),
    () => 0.6
  );
  assert.equal(simRivals.updatedRivals.length, 2);
  assert.ok(simRivals.updatedRivals[0].ppg > 0);

  const midEvt = rollMidSeasonCrossroadsEvent(createBaseCareer({ age: 26 }), () => 0.2);
  assert.ok(midEvt.id.startsWith('EVT_'));
});

test('7. Strict Pro-Only Franchise Jersey Retirement & Washed 37yo Forced Retirement', () => {
  const ncaaCareer = createBaseCareer({
    league: 'NCAA',
    team: NCAA_TEAMS[0],
    seasonLogs: [
      createSeasonLog({ seasonNumber: 1, league: 'NCAA', teamId: NCAA_TEAMS[0].id, gp: 36, ppg: 28, wonChampionship: true, wonMvp: true }),
      createSeasonLog({ seasonNumber: 2, league: 'NCAA', teamId: NCAA_TEAMS[0].id, gp: 36, ppg: 30, wonChampionship: true, wonMvp: true }),
    ],
  });
  assert.equal(evaluateCareerLegacy(ncaaCareer).jerseyRetired, false);

  const trueLegendLogs: SeasonBoxScore[] = Array.from({ length: 8 }, (_, i) =>
    createSeasonLog({
      seasonNumber: i + 1,
      year: 2030 + i,
      league: 'NBA',
      teamId: NBA_TEAMS[0].id,
      gp: 80,
      ppg: 26.5,
      wonChampionship: i < 2,
      wonMvp: i < 2,
      allStarSelected: i < 7,
    })
  );
  const trueLegendEval = evaluateCareerLegacy(createBaseCareer({ seasonLogs: trueLegendLogs }));
  assert.equal(trueLegendEval.jerseyRetired, true);

  const poorTwoWay = createBaseCareer({
    age: 24,
    ovr: 68,
    twoWaySeasonsUsed: 1,
    seasonLogs: [
      createSeasonLog({
        gp: 18,
        mpg: 6.0,
        ppg: 2.1,
        rpg: 0.8,
        apg: 0.4,
        spg: 0.1,
        bpg: 0.0,
        fgPct: 36.5,
        tpPct: 26.0,
      }),
    ],
  });
  assert.equal(evaluateTwoWaySurvival(poorTwoWay, 2.1).status, 'WAIVED');

  const washedVeteran = createBaseCareer({
    age: 37,
    ovr: 56,
    potential: 60,
    stats: { ins: 55, out: 58, ply: 56, def: 55, reb: 54, phy: 50 },
    league: 'KBL',
    team: KBL_TEAMS[0],
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'KBL',
        teamId: KBL_TEAMS[0].id,
        ovr: 56,
        gp: 15,
        mpg: 4.5,
        ppg: 1.2,
        rpg: 0.5,
        apg: 0.3,
        fgPct: 35.0,
      }),
    ],
  });
  const faOptions = generateOffseasonOptions(washedVeteran, () => 0.5);
  assert.ok(faOptions.some((o) => o.actionType === 'RETIRE_OUT_OF_LEAGUE'));
});

test('8. Core difficulty formulas (Role/MPG, PPG soft cap, Late Bloomer growth, Aging Curve)', () => {
  const midRng = () => 0.5;
  const superstarPpg = calculatePpg(
    { ins: 96, out: 95 },
    LEAGUE_CONFIG.NBA.ldr,
    36.0,
    23.5,
    midRng
  );
  assert.ok(superstarPpg.rawPpg > 26);
  assert.ok(superstarPpg.ppg > 25.0 && superstarPpg.ppg <= 31.5);

  const baseStats = { ins: 80, out: 85, ply: 82, def: 78, reb: 65, phy: 82 };
  const ironmanAging = applyAgingCurve(33, baseStats, midRng, {
    growthDna: 'IRONMAN',
    careerMinutes: 12000,
  });
  const earlyBloomerAging = applyAgingCurve(33, baseStats, midRng, {
    growthDna: 'EARLY_BLOOMER',
    careerMinutes: 30000,
  });
  assert.ok(ironmanAging.nextStats.phy > earlyBloomerAging.nextStats.phy);

  const lateBloomer26 = calculateSeasonStatGrowth(
    {
      age: 26,
      ovr: 74,
      potential: 88,
      league: 'NBA',
      stats: { ins: 74, out: 74, ply: 74, def: 74, reb: 74, phy: 74 },
      trainingFocus: 'BALANCED',
      growthDna: 'LATE_BLOOMER',
      heightCm: 198,
      primaryPos: 'SG',
    },
    28,
    midRng
  );
  const earlyBloomer26 = calculateSeasonStatGrowth(
    {
      age: 26,
      ovr: 74,
      potential: 88,
      league: 'NBA',
      stats: { ins: 74, out: 74, ply: 74, def: 74, reb: 74, phy: 74 },
      trainingFocus: 'BALANCED',
      growthDna: 'EARLY_BLOOMER',
      heightCm: 198,
      primaryPos: 'SG',
    },
    28,
    midRng
  );
  assert.ok(lateBloomer26.nextStats.ins >= earlyBloomer26.nextStats.ins);

  const riskCalc = calculateProjectedNbaPick({
    ovr: 66,
    draftStock: 35,
    league: 'KBL',
  });
  assert.equal(riskCalc.undraftedRisk, true);

  const elig = checkRetirementEligibility(
    createBaseCareer({
      seasonLogs: [
        createSeasonLog({ wonChampionship: true, wonMvp: true, allStarSelected: true }),
      ],
    })
  );
  assert.equal(elig.canRetireVoluntarily, true);
});

test('9. League-Separated Award Aggregation & Season Team Rank / Playoff Result', () => {
  const logs: SeasonBoxScore[] = [
    createSeasonLog({
      seasonNumber: 1,
      league: 'HIGH_SCHOOL',
      leagueName: '한국 고교농구',
      wonChampionship: true,
      wonMvp: true,
    }),
    createSeasonLog({
      seasonNumber: 2,
      league: 'U_LEAGUE',
      leagueName: '한국 대학농구(U-리그)',
      wonChampionship: true,
      wonMvp: true,
    }),
    createSeasonLog({
      seasonNumber: 3,
      league: 'KBL',
      leagueName: 'KBL 프로농구',
      wonChampionship: true,
      wonMvp: true,
      wonFinalsMvp: true,
    }),
    createSeasonLog({
      seasonNumber: 4,
      league: 'NBA',
      leagueName: 'NBA',
      wonChampionship: false,
      wonMvp: false,
      allStarSelected: true,
    }),
  ];

  const summaries = getAwardsByLeague(logs);
  const nbaSummary = summaries.find((s) => s.league === 'NBA');
  const kblSummary = summaries.find((s) => s.league === 'KBL');
  const hsSummary = summaries.find((s) => s.league === 'HIGH_SCHOOL');

  assert.ok(nbaSummary && kblSummary && hsSummary);
  assert.equal(nbaSummary.championships, 0, 'NBA championships must be 0 even if HS/College/KBL were won');
  assert.equal(nbaSummary.mvps, 0);
  assert.equal(nbaSummary.allStars, 1);
  assert.equal(kblSummary.championships, 1);
  assert.equal(kblSummary.mvps, 1);
  assert.equal(hsSummary.championships, 1);
});

test('10. League Standings, Playoff Ladder Bracket, and Live Quarter-by-Quarter Broadcast', () => {
  const career = createBaseCareer({
    league: 'KBL',
    team: KBL_TEAMS[0],
    ovr: 82,
  });

  const standings = generateLeagueStandings(career, 40, 14, () => 0.5);
  assert.equal(standings.length, KBL_TEAMS.length);
  const myRow = standings.find((r) => r.isPlayerTeam);
  assert.ok(myRow);
  assert.equal(myRow.wins, 40);
  assert.equal(myRow.losses, 14);
  assert.equal(myRow.qualifiedPlayoffs, true);

  let bracket = createPlayoffBracket(career, standings);
  assert.equal(bracket.rounds.length, 1);
  assert.ok(bracket.rounds[0].length >= 2);

  bracket = advancePlayoffRound(bracket, career, standings, () => 0.2);
  assert.ok(bracket.rounds.length >= 1);

  const finishedBracket = skipEntirePlayoffs(bracket, career, standings, () => 0.1);
  assert.ok(finishedBracket.championTeamId !== null);

  // Live Quarter-by-Quarter Broadcast test
  let liveGame = createLiveFinalGame(career, KBL_TEAMS[1], 'ASIAN_GAMES_FINAL');
  assert.equal(liveGame.quarter, 0);
  assert.equal(liveGame.isFinished, false);

  liveGame = simulateLiveQuarter(liveGame, career, 'ACE_HERO', () => 0.6);
  assert.equal(liveGame.quarterLogs.length, 1);
  assert.ok(liveGame.teamScore > 0);

  const skippedLive = skipLiveGameToEnd(liveGame, career, () => 0.7);
  assert.equal(skippedLive.isFinished, true);
  assert.ok(skippedLive.finalOutcome !== undefined);
});

test('11. 4-Axis Combinatorial Random Encounter Engine (48 Scenarios, Zero Duplicates, Category Cooldown)', () => {
  assert.ok(
    ENCOUNTER_SCENARIO_POOL.length >= 48,
    `Expected at least 48 combinatorial scenarios, got ${ENCOUNTER_SCENARIO_POOL.length}`
  );

  const seenIds: string[] = [];
  let recentCats: string[] = [];
  let baseCareer = createBaseCareer({
    age: 24,
    league: 'NBA',
    ovr: 82,
    traits: ['CLUTCH_PERFORMER', 'IRON_STAMINA', 'SNIPER'],
    seasonLogs: [
      createSeasonLog({ ppg: 24.5, fgPct: 50.2 }),
    ],
  });

  const tags = extractCareerContextTags(baseCareer);
  assert.ok(tags.includes('HOT_STREAK') || tags.includes('PRIME_ACE') || tags.includes('CONTRACT_YEAR'));

  for (let i = 0; i < 15; i++) {
    const event = rollCombinatorialEncounter(baseCareer, () => (i * 0.17) % 1);
    const category = event.category;
    assert.equal(
      seenIds.includes(event.id),
      false,
      `Duplicate event ID rolled within same career: ${event.id}`
    );
    if (recentCats.length >= 2) {
      assert.equal(
        recentCats.slice(-2).includes(category),
        false,
        `Category ${category} violated 2-season cooldown`
      );
    }
    seenIds.push(event.id);
    recentCats = [...recentCats.slice(-1), category];
    baseCareer = {
      ...baseCareer,
      seenEventIds: seenIds,
      recentEventCategories: recentCats,
    };
  }
});

test('12. Bidirectional Continuous Biomechanical Physics (168cm C vs 220cm PG vs 180cm PG) & Adjacent Position Switch', () => {
  const shortCenterBio = calculateBiomechanicalProfile(168, 'C');
  const tallPgBio = calculateBiomechanicalProfile(220, 'PG');
  const standardPgBio = calculateBiomechanicalProfile(188, 'PG');
  const standardCenterBio = calculateBiomechanicalProfile(211, 'C');

  // 1) Continuous reachLeverage & centerOfGravityAgility curves
  assert.ok(
    standardCenterBio.reachLeverage > shortCenterBio.reachLeverage,
    '211cm Center must have significantly higher reachLeverage than 168cm Center'
  );
  assert.ok(
    standardPgBio.centerOfGravityAgility > tallPgBio.centerOfGravityAgility,
    '188cm PG must have significantly higher centerOfGravityAgility than 220cm PG'
  );
  assert.ok(
    shortCenterBio.positionalPhysicsStrain > 0.65 && tallPgBio.positionalPhysicsStrain > 0.55,
    'Both extreme height-position mismatches (168cm C and 220cm PG) must exhibit high continuous positionalPhysicsStrain'
  );
  assert.ok(
    tallPgBio.tovRatePenalty > standardPgBio.tovRatePenalty &&
      tallPgBio.staminaDrainMultiplier > standardPgBio.staminaDrainMultiplier,
    '220cm PG must suffer higher turnover rate penalty and stamina drain due to high center of gravity'
  );

  // 2) Continuous diminishing returns elasticity instead of arbitrary hard-deletion
  const highStats = { ins: 82, out: 82, ply: 82, def: 82, reb: 82, phy: 82 };
  const shortCenterElasticity = getBiomechanicalGrowthElasticity(168, 'C', highStats);
  const standardCenterElasticity = getBiomechanicalGrowthElasticity(211, 'C', highStats);
  assert.ok(
    standardCenterElasticity.reb > shortCenterElasticity.reb &&
      standardCenterElasticity.ins > shortCenterElasticity.ins,
    '211cm C must have much higher REB/INS training growth elasticity at high stats than 168cm C'
  );

  const penalty = calculateHeightMismatchPenalty(168, 'C');
  assert.equal(penalty.isSevereMismatch, true);
  assert.ok(penalty.rebMultiplier < 0.7);

  // 3) Real-game efficiency natural selection in scouting (poor FG% & high strain rejected by NBA)
  const inefficientMismatchCenter = createBaseCareer({
    heightCm: 168,
    primaryPos: 'C',
    secondaryPos: null,
    ovr: 68,
    league: 'KBL',
    seasonLogs: [
      createSeasonLog({
        league: 'KBL',
        gp: 36,
        mpg: 22.0,
        ppg: 6.2,
        rpg: 2.1,
        apg: 1.2,
        bpg: 0.1,
        fgPct: 37.5,
        tpPct: 28.0,
      }),
    ],
  });
  const nbaScout = evaluateTeamScouting(inefficientMismatchCenter, NBA_TEAMS[0], () => 0.5);
  assert.equal(
    nbaScout.passesOfferThreshold,
    false,
    '168cm Center with poor paint efficiency & rebounding must be naturally rejected by NBA scouting'
  );

  // Adjacent position switch validation
  const pgToC = canSwitchToPosition('PG', 'C', 185, null);
  assert.equal(pgToC.allowed, false, 'Direct jump from PG to C must be blocked');

  const pgToSg = canSwitchToPosition('PG', 'SG', 185, null);
  assert.equal(pgToSg.allowed, true, 'Adjacent switch from PG to SG at 185cm must be allowed');

  const shortSfToPf = canSwitchToPosition('SF', 'PF', 168, null);
  assert.equal(shortSfToPf.allowed, false, '168cm player must be blocked from switching to PF due to excessive biomechanical strain');
});

test('13. Strict GOAT Legacy Criteria (No Legacy Score Shortcut without NBA MVP>=3, Rings>=3, FMVP>=2)', () => {
  const compilerCareer = createBaseCareer({
    peakOvr: 94,
    totals: {
      gp: 1200,
      points: 32000,
      rebounds: 8000,
      assists: 7000,
      steals: 1800,
      blocks: 600,
      nbaGp: 1100,
      nbaPoints: 29000,
      championships: 6,
      nbaChampionships: 2,
      mvps: 5,
      nbaMvps: 1,
      finalsMvps: 1,
      dpoys: 1,
      sixthManAwards: 0,
      mips: 1,
      allLeagueSelections: 10,
      allStars: 12,
      nbaAllStars: 10,
    },
  });

  const compilerEval = evaluateCareerLegacy(compilerCareer);
  assert.ok(compilerEval.legacyScore >= 9500);
  assert.notEqual(
    compilerEval.tierId,
    'GOAT',
    'High legacyScore alone must NOT grant GOAT without 3 NBA MVPs + 3 NBA Rings + 2 Finals MVPs'
  );
  assert.equal(compilerEval.tierId, 'FIRST_BALLOT_HOF');

  const trueGoatCareer = createBaseCareer({
    peakOvr: 97,
    totals: {
      ...compilerCareer.totals,
      nbaChampionships: 3,
      nbaMvps: 3,
      finalsMvps: 2,
    },
  });
  const trueGoatEval = evaluateCareerLegacy(trueGoatCareer);
  assert.equal(trueGoatEval.tierId, 'GOAT');
});

test('14. Expanded Real League Databases (24 HS, 12 U-League, 24 NCAA, 20 G-League, 30 NBA East/West, 8 Asian National)', () => {
  assert.ok(HIGH_SCHOOL_TEAMS.length >= 24, `Expected >=24 Korean High School teams, got ${HIGH_SCHOOL_TEAMS.length}`);
  assert.ok(U_LEAGUE_TEAMS.length >= 12, `Expected >=12 Korean University teams, got ${U_LEAGUE_TEAMS.length}`);
  assert.ok(NCAA_TEAMS.length >= 24, `Expected >=24 NCAA D1 teams, got ${NCAA_TEAMS.length}`);
  assert.ok(GLEAGUE_TEAMS.length >= 20, `Expected >=20 NBA G-League teams, got ${GLEAGUE_TEAMS.length}`);
  assert.equal(NBA_TEAMS.length, 30, 'NBA must have all 30 franchises');
  const eastTeams = NBA_TEAMS.filter((t) => t.conference === 'EAST');
  const westTeams = NBA_TEAMS.filter((t) => t.conference === 'WEST');
  assert.equal(eastTeams.length, 15, 'NBA Eastern Conference must have 15 teams');
  assert.equal(westTeams.length, 15, 'NBA Western Conference must have 15 teams');
  assert.ok(ASIAN_NATIONAL_TEAMS.length >= 8, 'FIBA Asia national rival pool must have >=8 teams');
});

test('15. Zero Regular-Season Spoilers, Realistic Finals MVP, and Unified Contender Win-Rate Formula', () => {
  const topContender =
    NBA_TEAMS.find((t) => t.rating >= 88) || NBA_TEAMS[0];
  const rookieOnContender = createBaseCareer({
    age: 20,
    ovr: 71,
    potential: 86,
    league: 'NBA',
    team: topContender,
    contractType: 'NBA_STANDARD',
    coachTrust: 55,
    seasonLogs: [],
  });

  const sim = simulateSeason(rookieOnContender, () => 0.5);
  // 1) Regular-season simulation must NEVER pre-spoil championship or Finals MVP
  assert.equal(
    sim.boxScore.wonChampionship,
    false,
    'simulateSeason must never pre-award wonChampionship before playoffs'
  );
  assert.equal(
    sim.boxScore.wonFinalsMvp,
    false,
    'simulateSeason must never pre-award wonFinalsMvp before playoffs'
  );
  assert.ok(
    sim.boxScore.playoffResult === 'PO 진출' || sim.boxScore.playoffResult === 'PO 탈락',
    `Regular season playoffResult must only be PO 진출 or PO 탈락, got ${sim.boxScore.playoffResult}`
  );

  // 2) Unified team win-rate baseline: joining an 88+ contender as a rookie must NOT cause the team to collapse to 24th place
  const baseline = getLeagueBaselineTeamRating('NBA', rookieOnContender.teamRatingsMap);
  assert.ok(baseline >= 74 && baseline <= 88, `Expected NBA average baseline rating in 74..88, got ${baseline}`);
  assert.ok(
    sim.boxScore.wins >= 46 && (sim.boxScore.teamRank ?? 99) <= 12,
    `Top contender (rating ${topContender.rating}) should remain a strong playoff team even with a rookie, got ${sim.boxScore.wins}W (Rank #${sim.boxScore.teamRank})`
  );

  // 3) Realistic Finals MVP: bench player (<24 MPG) must never win Finals MVP; true 1st option ace wins it
  const benchChamp = createBaseCareer({
    ovr: 73,
    team: topContender,
    seasonLogs: [createSeasonLog({ mpg: 15.0, ppg: 7.5, rpg: 2.5, apg: 1.8 })],
  });
  assert.equal(
    evaluateRealisticFinalsMvp(benchChamp, true),
    false,
    'Bench player with 15 MPG must never win Finals MVP'
  );

  const aceChamp = createBaseCareer({
    ovr: 92,
    team: topContender,
    seasonLogs: [createSeasonLog({ mpg: 36.5, ppg: 29.8, rpg: 8.4, apg: 6.5 })],
  });
  assert.equal(
    evaluateRealisticFinalsMvp(aceChamp, true),
    true,
    'Superstar 1st-option ace leading championship team must win Finals MVP'
  );
});

test('16. NBA East/West Conference Standings (1~15 per Conference), 7-10 Play-In & 4-Round Conference Playoff Bracket', () => {
  const nbaCareer = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 88,
  });
  const standings = generateLeagueStandings(nbaCareer, 55, 27, () => 0.5);
  assert.equal(standings.length, 30);

  const eastStandings = standings.filter((s) => s.conference === 'EAST');
  const westStandings = standings.filter((s) => s.conference === 'WEST');
  assert.equal(eastStandings.length, 15);
  assert.equal(westStandings.length, 15);
  assert.equal(eastStandings.filter((s) => s.qualifiedPlayoffs).length, 10, 'NBA East postseason = 6 direct + 4 Play-In');
  assert.equal(westStandings.filter((s) => s.qualifiedPlayoffs).length, 10, 'NBA West postseason = 6 direct + 4 Play-In');
  assert.equal(eastStandings.filter((s) => s.playInQualified).length, 4, 'NBA East Play-In = seeds 7-10');
  assert.equal(westStandings.filter((s) => s.playInQualified).length, 4, 'NBA West Play-In = seeds 7-10');

  // 1) Top-6 direct seed auto-resolves Play-In into playInSeeds and opens Main Playoff R1
  const bracket = createPlayoffBracket(nbaCareer, standings, () => 0.45);
  assert.equal(bracket.stageType, 'MAIN_PLAYOFF');
  assert.ok(bracket.playInSeeds?.east7 && bracket.playInSeeds?.east8);
  assert.equal(bracket.rounds[0].length, 8, 'NBA Main Playoff R1 must have 8 series (4 East + 4 West)');

  const finished = skipEntirePlayoffs(bracket, nbaCareer, standings, () => 0.3);
  assert.equal(finished.stageType, 'MAIN_PLAYOFF');
  assert.equal(finished.rounds.length, 4, 'Completed NBA Main Playoffs must have 4 rounds (R1, Conf Semis, Conf Finals, NBA Finals)');
  assert.equal(finished.rounds[3].length, 1, 'NBA Finals must be a single East Champion vs West Champion series');
  assert.ok(finished.championTeamId !== null);

  // 2) Seed 7-10 player opens in PLAY_IN_ROUND_1 (4 BO1 games) and transitions to MAIN_PLAYOFF
  const piStandings = standings.map((s) => ({
    ...s,
    isPlayerTeam: s.conference === 'EAST' && s.conferenceRank === 8,
  }));
  const piTeam = piStandings.find((s) => s.isPlayerTeam)!.team;
  const piCareer = createBaseCareer({ league: 'NBA', team: piTeam, ovr: 82 });
  const piBracket = createPlayoffBracket(piCareer, piStandings, () => 0.45);
  assert.equal(piBracket.stageType, 'PLAY_IN_ROUND_1', 'NBA 7-10 seed player must enter Play-In Round 1');
  assert.equal(piBracket.rounds[0].length, 4);
  assert.equal(piBracket.rounds[0][0].bestOf, 1);
  const piFinished = skipEntirePlayoffs(piBracket, piCareer, piStandings, () => 0.3);
  assert.equal(piFinished.stageType, 'MAIN_PLAYOFF');
  assert.ok(piFinished.championTeamId !== null);
});

test('17. Asian Games 4-Year Cycle & Full Tournament (Group -> QF -> SF -> Finals) + Multi-Year Trade Request', () => {
  const nonAgYearCareer = createBaseCareer({
    age: 22,
    seasonYear: 2027, // 2027 % 4 !== 2
    ovr: 72,
    militaryExempt: false,
    militaryServiceSeasonsLeft: 0,
  });
  const nonAgEvt = rollSeasonEvent(nonAgYearCareer, () => 0.01);
  assert.notEqual(
    nonAgEvt?.id,
    'EVT_ASIAN_GAMES_GOLD',
    'Asian Games event must NOT trigger on non-Asian-Games years (e.g. 2027)'
  );

  const agYearCareer = createBaseCareer({
    age: 22,
    seasonYear: 2030, // 2030 % 4 === 2
    ovr: 72,
    militaryExempt: false,
    militaryServiceSeasonsLeft: 0,
  });
  const agEvt = rollSeasonEvent(agYearCareer, () => 0.99);
  assert.equal(
    agEvt?.id,
    'EVT_ASIAN_GAMES_GOLD',
    'Asian Games event must trigger on 4-year cycle years (2026, 2030, 2034...)'
  );

  // Tournament simulation when Korea wins QF & SF (low rng favors Korea)
  const winTourney = simulateAsianGamesTournament(agYearCareer, () => 0.1);
  assert.equal(winTourney.reachedFinals, true);
  assert.ok(winTourney.finalOpponent !== null);
  assert.equal(winTourney.matches.length, 5, 'Group Stage (3G) + QF (1G) + SF (1G) = 5 matches before Finals');

  // Tournament simulation when Korea loses in QF or SF (high rng favors opponent)
  const loseTourney = simulateAsianGamesTournament(agYearCareer, () => 0.99);
  assert.equal(loseTourney.reachedFinals, false);
  assert.ok(
    loseTourney.eliminatedStage === 'QUARTERFINAL' ||
      loseTourney.eliminatedStage === 'SEMIFINAL'
  );

  // Multi-year contract offseason options must include REQUEST_TRADE (and block cross-league/draft offers until FA)
  const contractedKblYoung = createBaseCareer({
    age: 22,
    ovr: 70,
    league: 'KBL',
    team: KBL_TEAMS[0],
    contractType: 'KBL_ROOKIE',
    contractYearsLeft: 2,
    totals: {
      ...createBaseCareer().totals,
      nbaGp: 0,
    },
  });
  const multiYearOpts = generateOffseasonOptions(contractedKblYoung, () => 0.5);
  assert.ok(
    multiYearOpts.some((o) => o.actionType === 'REQUEST_TRADE'),
    'Multi-year contracted pro player must have REQUEST_TRADE option in offseason'
  );
  assert.ok(
    !multiYearOpts.some((o) => o.actionType === 'ENTER_NBA_DRAFT'),
    'Multi-year contracted pro player must not enter NBA draft while contract years remain'
  );
  const faKblYoung = { ...contractedKblYoung, contractYearsLeft: 0 };
  const faYoungOpts = generateOffseasonOptions(faKblYoung, () => 0.5);
  assert.ok(
    faYoungOpts.some((o) => o.actionType === 'ENTER_NBA_DRAFT'),
    '22yo KBL FA with 0 NBA GP must be able to challenge NBA Draft'
  );
});

test('18. All 210 Teams Have Official Logo Assets & League-Specific SVG Fallback Generator', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { generateLeagueFallbackSvgDataUri } = await import('../data/logoFallbacks');

  const combined = [...ALL_TEAMS, ...ASIAN_NATIONAL_TEAMS];
  assert.equal(combined.length, 210, 'Total teams across all 9 leagues (201) + Asian National Teams (9) must be 210');

  const seenLogos = new Set<string>();
  for (const team of combined) {
    assert.ok(team.logoUrl && team.logoUrl.length > 0, `Team ${team.id} must have a logoUrl`);
    assert.ok(
      !team.logoUrl.startsWith('data:image/svg+xml'),
      `Team ${team.id} must not use generic inline data URI text crest as primary logoUrl`
    );
    seenLogos.add(team.logoUrl);

    if (team.logoUrl.startsWith('/logos/')) {
      const fullPath = path.join(process.cwd(), 'public', team.logoUrl);
      assert.ok(fs.existsSync(fullPath), `Local logo file must exist for ${team.id}: ${team.logoUrl}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 100, `Local logo file for ${team.id} must be non-empty`);
    }

    // Verify league-specific fallback SVG generator produces valid SVG data URI
    const fallbackUri = generateLeagueFallbackSvgDataUri(team);
    assert.ok(
      fallbackUri.startsWith('data:image/svg+xml;utf8,'),
      `Fallback URI for ${team.id} must be a valid SVG data URI`
    );
    const decoded = decodeURIComponent(fallbackUri.replace('data:image/svg+xml;utf8,', ''));
    assert.ok(decoded.includes('<svg') && decoded.includes('</svg>'), `Decoded SVG for ${team.id} must be valid SVG`);
  }

  assert.equal(seenLogos.size, 210, 'Every single one of the 210 teams must have its own distinct logoUrl');

  for (const gl of GLEAGUE_TEAMS) {
    assert.ok(
      gl.logoUrl?.includes('/nba-development/500/'),
      `G-League team ${gl.id} must use official G-League logo CDN, not parent NBA logo`
    );
  }
});

test('19. MVP/ROY Top 5 Voting Board, Playoff Batch & 4Q Clutch 1-Possession Choice, Personal Care & Veteran Reinvention', () => {
  // 1) MVP & ROY Top 5 Voting Race Board
  const rookieStar = createBaseCareer({
    age: 20,
    ovr: 83,
    potential: 92,
    league: 'NBA',
    team: NBA_TEAMS[0],
    coachTrust: 88,
    seasonLogs: [],
  });
  const sim = simulateSeason(rookieStar, () => 0.45);
  assert.ok(sim.boxScore.mvpRace && sim.boxScore.mvpRace.length === 5, 'MVP race board must have Top 5 entries');
  assert.ok(sim.boxScore.mvpRaceNarrative && sim.boxScore.mvpRaceNarrative.length > 10, 'MVP race must include narrative feedback');
  assert.ok(sim.boxScore.royRace && sim.boxScore.royRace.length === 5, 'Rookie season must generate ROY Top 5 voting race');
  const totalVoteShare = sim.boxScore.mvpRace.reduce((acc, r) => acc + r.firstPlaceVoteShare, 0);
  assert.ok(Math.abs(totalVoteShare - 100) <= 1.0, `Top 5 vote share should sum to ~100%, got ${totalVoteShare}`);

  // 2) Playoff 1~2R Batch Advance & Natural 4Q Clutch (±4pt only, zero score rigging)
  const standings = generateLeagueStandings(rookieStar, 56, 26, () => 0.5);
  const bracket = createPlayoffBracket(rookieStar, standings);
  const batched = batchAdvanceEarlyPlayoffRounds(bracket, rookieStar, standings, () => 0.2);
  assert.ok(
    batched.rounds.length >= 2 || batched.playerEliminated,
    'Batch advance must simulate early playoff rounds in one click'
  );

  // 2a) Blowout after 3Q (20-point lead) must NOT trigger clutch or teleport scores
  const blowoutAfter3Q = {
    ...createLiveFinalGame(rookieStar, NBA_TEAMS[1], 'LEAGUE_FINALS'),
    quarter: 3,
    teamScore: 92,
    oppScore: 68,
  };
  const blowoutFinal = simulateLiveQuarter(blowoutAfter3Q, rookieStar, 'UNSELFISH_PASS', () => 0.5);
  assert.equal(
    blowoutFinal.pendingClutchPossession,
    false,
    'Blowout (>4pt gap) must NOT artificially force Clutch 1-Possession'
  );
  assert.equal(blowoutFinal.isFinished, true);
  assert.ok(
    blowoutFinal.teamScore - blowoutFinal.oppScore >= 10,
    'Blowout lead must be preserved naturally without score rigging'
  );

  // 2b) Natural close game (|diff| <= 4 after 4Q) triggers Clutch 1-Possession with exact point math
  const closeAfter3Q = {
    ...createLiveFinalGame(rookieStar, NBA_TEAMS[1], 'LEAGUE_FINALS'),
    quarter: 3,
    teamScore: 76,
    oppScore: 78,
  };
  let closeQ4 = simulateLiveQuarter(closeAfter3Q, rookieStar, 'ACE_HERO', () => 0.5);
  // Guarantee a deterministic close-game state if rng shifted margin beyond 4
  if (!closeQ4.pendingClutchPossession) {
    closeQ4 = {
      ...closeAfter3Q,
      quarter: 4,
      teamScore: 100,
      oppScore: 102,
      pendingClutchPossession: true,
      clutchScenario: 'TRAILING',
      clutchSituationText: '4Q 14.2초 전 2점 차 열세',
    };
  }
  assert.equal(closeQ4.pendingClutchPossession, true);
  const scoreBeforeClutch = closeQ4.teamScore;
  const oppBeforeClutch = closeQ4.oppScore;
  const resolvedClutch = resolveClutchPossession(closeQ4, rookieStar, 'ISO_WINNER', () => 0.05);
  assert.equal(resolvedClutch.pendingClutchPossession, false);
  const deltaPts = resolvedClutch.teamScore - scoreBeforeClutch;
  assert.ok(
    deltaPts === 0 || deltaPts === 2 || deltaPts === 3,
    `ISO_WINNER must only add realistic basketball points (0, 2, or 3), got +${deltaPts}`
  );
  assert.equal(resolvedClutch.oppScore, oppBeforeClutch, 'Offensive clutch must not fabricate opponent points');

  // 3) Biomech Lab Aging Slowdown & Veteran Reinvention BBIQ/Shooting Protection
  const vetStats = { ins: 82, out: 88, ply: 86, def: 80, reb: 74, phy: 76 };
  const normalAging = applyAgingCurve(35, vetStats, () => 0.8, {
    growthDna: 'STANDARD',
    careerMinutes: 28000,
    hasBiomechLab: false,
    veteranReinvented: false,
  });
  const reinventedAging = applyAgingCurve(35, vetStats, () => 0.8, {
    growthDna: 'STANDARD',
    careerMinutes: 28000,
    hasBiomechLab: true,
    veteranReinvented: true,
  });
  assert.ok(
    reinventedAging.nextStats.out >= normalAging.nextStats.out &&
      reinventedAging.nextStats.ply >= normalAging.nextStats.ply,
    'Biomech Lab + Veteran Reinvention must protect OUT and PLY from aging decline'
  );

  // 4) Veteran Reinvention Event at age 33
  const vet33 = createBaseCareer({
    age: 33,
    ovr: 82,
    stats: { ins: 82, out: 80, ply: 78, def: 78, reb: 75, phy: 72 },
    veteranReinventionOffered: false,
  });
  const vetEvt = createVeteranReinventionEvent(vet33);
  assert.ok(vetEvt !== null);
  assert.equal(vetEvt?.id, 'EVT_VETERAN_REINVENTION');
  assert.equal(vetEvt?.choices.length, 2);
});

test('20. Live Game Realism: Defensive/FT Lead Clutch, Overtime on Tie, and Real 5/6-Foul Foul-Out', () => {
  const starNba = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 90,
    stats: { ins: 88, out: 92, ply: 86, def: 89, reb: 78, phy: 84 },
    seasonLogs: [createSeasonLog({ mpg: 35.0, ppg: 27.5 })],
  });

  // 1) LEADING clutch: LOCKDOWN_STOP (defense) & CLUTCH_FREE_THROWS (ice FT)
  const leadingState = {
    ...createLiveFinalGame(starNba, NBA_TEAMS[1], 'LEAGUE_FINALS'),
    quarter: 4,
    teamScore: 104,
    oppScore: 102,
    pendingClutchPossession: true,
    clutchScenario: 'LEADING' as const,
  };
  const lockdownWin = resolveClutchPossession(leadingState, starNba, 'LOCKDOWN_STOP', () => 0.05);
  assert.equal(lockdownWin.isFinished, true);
  assert.equal(lockdownWin.finalOutcome?.won, true);
  assert.equal(lockdownWin.teamScore, 104);
  assert.equal(lockdownWin.oppScore, 102);

  const ftIce = resolveClutchPossession(leadingState, starNba, 'CLUTCH_FREE_THROWS', () => 0.05);
  assert.equal(ftIce.isFinished, true);
  assert.equal(ftIce.finalOutcome?.won, true);
  assert.equal(ftIce.teamScore, 106, 'Making both clutch free throws should add exactly +2 points');

  // 2) Tie after clutch transitions to Overtime (OT1) instead of ending in a draw
  const trailingBy2 = {
    ...createLiveFinalGame(starNba, NBA_TEAMS[1], 'LEAGUE_FINALS'),
    quarter: 4,
    teamScore: 100,
    oppScore: 102,
    pendingClutchPossession: true,
    clutchScenario: 'TRAILING' as const,
  };
  // Use KICKOUT_ASSIST with high rng? Better: trailing by 3 & 3pt makes tie -> OT, or trailing by 2 & 2pt makes tie -> OT
  const trailingBy3 = {
    ...trailingBy2,
    teamScore: 99,
    oppScore: 102,
  };
  const tiedGoingToOt = resolveClutchPossession(trailingBy3, starNba, 'ISO_WINNER', () => 0.05);
  assert.equal(tiedGoingToOt.teamScore, 102, '3-point game-tying shot down 3 must tie score at 102-102');
  assert.equal(tiedGoingToOt.oppScore, 102);
  assert.equal(tiedGoingToOt.isFinished, false, 'Tied score after clutch must NOT finish game; must proceed to OT');
  const afterOt1 = simulateLiveQuarter(tiedGoingToOt, starNba, 'ACE_HERO', () => 0.25);
  assert.equal(afterOt1.quarter, 5);
  assert.equal(afterOt1.overtimeCount, 1);

  // 3) Real 6-foul foul-out in NBA (5 in KBL) stops player from recording further stats
  const nearFoulOut = {
    ...createLiveFinalGame(starNba, NBA_TEAMS[1], 'LEAGUE_FINALS'),
    quarter: 2,
    teamScore: 52,
    oppScore: 50,
    playerStats: {
      pts: 14,
      reb: 4,
      ast: 3,
      stl: 1,
      blk: 0,
      fgm: 5,
      fga: 10,
      tpm: 2,
      tpa: 4,
      fouls: 6,
      stamina: 72,
    },
    fouledOut: true,
  };
  const q3FouledOut = simulateLiveQuarter(nearFoulOut, starNba, 'ACE_HERO', () => 0.5);
  assert.equal(q3FouledOut.fouledOut, true);
  assert.equal(q3FouledOut.playerStats.pts, 14, 'Fouled-out player must not accumulate any more points');
  assert.equal(q3FouledOut.playerStats.fga, 10, 'Fouled-out player must not attempt any more shots');

  const kblGame = createLiveFinalGame(
    createBaseCareer({ league: 'KBL', team: KBL_TEAMS[0] }),
    KBL_TEAMS[1],
    'LEAGUE_FINALS'
  );
  assert.equal(kblGame.foulLimit, 5, 'KBL foul limit must be 5');
  assert.equal(nearFoulOut.foulLimit, 6, 'NBA foul limit must be 6');
});

test('21. Conf Finals Game 7 Live Broadcast Advances to NBA Finals (Never Prematurely Awards Championship)', () => {
  const nbaStar = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 91,
  });
  const standings = generateLeagueStandings(nbaStar, 58, 24, () => 0.5);
  const eastTeams = standings.filter((s) => s.conference === 'EAST');
  const westTeams = standings.filter((s) => s.conference === 'WEST');
  const playerStanding = standings.find((s) => s.team.id === nbaStar.team.id)!;
  const oppConfStanding =
    (playerStanding.conference === 'EAST' ? eastTeams : westTeams).find(
      (s) => s.team.id !== nbaStar.team.id
    )!;
  const otherConfA = (playerStanding.conference === 'EAST' ? westTeams : eastTeams)[0];
  const otherConfB = (playerStanding.conference === 'EAST' ? westTeams : eastTeams)[1];

  const confFinalsBracket = {
    league: 'NBA' as const,
    year: 2035,
    totalRounds: 4,
    currentRound: 3,
    rounds: [
      [],
      [],
      [
        {
          id: 'R3_S1',
          roundNumber: 3,
          roundLabel: '컨퍼런스 파이널',
          conference: playerStanding.conference,
          bestOf: 7,
          winsNeeded: 4,
          higherSeed: playerStanding,
          lowerSeed: oppConfStanding,
          higherSeedWins: 3,
          lowerSeedWins: 3,
          winnerId: null,
          involvesPlayer: true,
          summaryLog: ['3-3 동률'],
        },
        {
          id: 'R3_S2',
          roundNumber: 3,
          roundLabel: '컨퍼런스 파이널',
          conference: otherConfA.conference,
          bestOf: 7,
          winsNeeded: 4,
          higherSeed: otherConfA,
          lowerSeed: otherConfB,
          higherSeedWins: 4,
          lowerSeedWins: 2,
          winnerId: otherConfA.team.id,
          involvesPlayer: false,
          summaryLog: ['4-2 종료'],
        },
      ],
    ],
    playerEliminated: false,
    playerReachedFinals: false,
    pendingConfFinalsGame7: true,
    championTeamId: null,
    playoffResultLabel: '컨퍼런스 파이널 7차전 (3승 3패)',
  };

  const afterWin = resolveConfFinalsGame7InBracket(
    confFinalsBracket,
    nbaStar,
    standings,
    true,
    '108-104',
    () => 0.4
  );
  assert.equal(afterWin.currentRound, 4, 'Winning Conf Finals Game 7 must advance to Round 4 (NBA Finals)');
  assert.equal(afterWin.playerReachedFinals, true);
  assert.equal(afterWin.pendingConfFinalsGame7, false);
  assert.equal(afterWin.championTeamId, null, 'Winning Conf Finals Game 7 must NOT prematurely award NBA Championship');
  assert.equal(afterWin.rounds[3].length, 1);

  const afterLoss = resolveConfFinalsGame7InBracket(
    confFinalsBracket,
    nbaStar,
    standings,
    false,
    '101-105',
    () => 0.4
  );
  assert.equal(afterLoss.playerEliminated, true);
  assert.equal(afterLoss.playerReachedFinals, false);
  assert.ok(afterLoss.championTeamId !== null, 'Losing Conf Finals Game 7 should resolve the remaining NBA Finals in background');
});

test('22. Unified MVP/ROY Top 5 Fairness (No Bench Forcing) & Non-Scorer High School 5-Star Eligibility', () => {
  // 1) Low-minute NBA bench rookie must NOT be forced into MVP Top 5
  const benchRookie = createBaseCareer({
    age: 20,
    ovr: 67,
    potential: 80,
    league: 'NBA',
    team: NBA_TEAMS[0],
    coachTrust: 40,
    draftPedigreePick: null,
    draftPedigreeRound: null,
    draftPedigreeSeasonsLeft: 0,
    seasonLogs: [],
  });
  const benchSim = simulateSeason(benchRookie, () => 0.5);
  assert.equal(
    benchSim.boxScore.wonMvp,
    false,
    'Low-minute bench player must not win MVP'
  );
  assert.equal(
    benchSim.boxScore.mvpRace?.some((entry) => entry.isPlayer),
    false,
    'Low-minute bench player must NOT be artificially forced into MVP Top 5'
  );
  assert.equal(
    benchSim.boxScore.playerMvpRank,
    null,
    'Bench player outside MVP Top 5 should have null or >5 playerMvpRank'
  );

  // 2) Pass-first elite HS floor general (15.5 PPG, 9.8 APG, 5.2 RPG, 2.6 SPG, MVP + Title) earns 5-star without PPG>=18.5 hard cutoff
  const passFirstHsPg = createBaseCareer({
    age: 19,
    league: 'HIGH_SCHOOL',
    primaryPos: 'PG',
    ovr: 63,
    seasonLogs: [
      createSeasonLog({
        league: 'HIGH_SCHOOL',
        ppg: 15.5,
        rpg: 5.2,
        apg: 9.8,
        spg: 2.6,
        bpg: 0.4,
        wonChampionship: true,
        wonMvp: true,
      }),
    ],
  });
  const passEval = evaluateHighSchoolProspect(passFirstHsPg);
  assert.equal(
    passEval.stars,
    5,
    `Pass-first HS floor general with 15.5/5.2/9.8 + MVP + Title must earn 5-star (got ${passEval.stars}, score ${passEval.score})`
  );
});

test('23. Pro-Only Sneaker Marketing Lock & Superstar Veteran (34yo, 93 OVR) Keeps Ace Role Promise', () => {
  // 1) Global Signature Sneaker Marketing locked in amateur leagues, unlocked in pro leagues
  assert.equal(isPersonalCareAllowedInLeague('SIGNATURE_SNEAKER_MARKETING', 'HIGH_SCHOOL'), false);
  assert.equal(isPersonalCareAllowedInLeague('SIGNATURE_SNEAKER_MARKETING', 'U_LEAGUE'), false);
  assert.equal(isPersonalCareAllowedInLeague('SIGNATURE_SNEAKER_MARKETING', 'NCAA'), false);
  assert.equal(isPersonalCareAllowedInLeague('SIGNATURE_SNEAKER_MARKETING', 'KBL'), true);
  assert.equal(isPersonalCareAllowedInLeague('SIGNATURE_SNEAKER_MARKETING', 'NBA'), true);

  // 2) 34-year-old 93 OVR NBA superstar entering FA must get ACE_FIRST_OPTION (never forced VETERAN_MENTOR)
  const primeVetStar = createBaseCareer({
    age: 34,
    ovr: 93,
    peakOvr: 96,
    potential: 96,
    stats: { ins: 92, out: 95, ply: 91, def: 86, reb: 80, phy: 84 },
    league: 'NBA',
    team: NBA_TEAMS[0],
    contractType: 'NBA_MAX',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        ovr: 93,
        gp: 76,
        mpg: 35.5,
        ppg: 28.4,
        rpg: 7.2,
        apg: 6.8,
        fgPct: 50.8,
        tpPct: 40.2,
        wonMvp: true,
      }),
    ],
  });
  const starOffers = generateOffseasonOptions(primeVetStar, () => 0.5).filter(
    (o) => o.targetLeague === 'NBA' && o.actionType === 'SIGN_TEAM'
  );
  assert.ok(starOffers.length > 0, '34yo 93 OVR superstar must receive NBA FA offers');
  assert.ok(
    starOffers.some((o) => o.promisedRole === 'ACE_FIRST_OPTION'),
    '34yo 93 OVR superstar must be offered ACE_FIRST_OPTION instead of being forced into VETERAN_MENTOR'
  );
});

test('24. Probabilistic Encounter Resolution (Stat Scaling, Critical/Success/Failure & Chain Event Queuing)', () => {
  const lowStatCareer = createBaseCareer({
    league: 'NBA',
    age: 23,
    ovr: 72,
    stats: { ins: 62, out: 58, ply: 60, def: 60, reb: 60, phy: 62 },
  });
  const highStatCareer = createBaseCareer({
    league: 'NBA',
    age: 25,
    ovr: 92,
    stats: { ins: 92, out: 94, ply: 90, def: 88, reb: 84, phy: 88 },
  });

  const evt = rollCombinatorialEncounter(highStatCareer, () => 0.12);
  const riskyChoice = evt.choices.find((c) => Boolean(c.successCheck));
  assert.ok(riskyChoice, 'Combinatorial encounters must include at least one probabilistic HIGH_RISK choice');

  const lowChance = calculateEncounterSuccessChance(lowStatCareer, riskyChoice);
  const highChance = calculateEncounterSuccessChance(highStatCareer, riskyChoice);
  assert.ok(
    highChance > lowChance,
    `High-stat player (${highChance.toFixed(2)}) must have higher success chance than low-stat player (${lowChance.toFixed(2)})`
  );

  // Critical success on very low roll (0.01)
  const critRes = resolveEncounterChoiceOutcome(highStatCareer, evt, riskyChoice, () => 0.01);
  assert.equal(critRes.result.wasProbabilistic, true);
  assert.equal(critRes.result.rolledSuccess, true);
  assert.equal(critRes.result.outcomeTier, 'CRITICAL_SUCCESS');

  // Failure on high roll (0.99)
  const failRes = resolveEncounterChoiceOutcome(lowStatCareer, evt, riskyChoice, () => 0.99);
  assert.equal(failRes.result.wasProbabilistic, true);
  assert.equal(failRes.result.rolledSuccess, false);
  assert.equal(failRes.result.outcomeTier, 'FAILURE');

  // Chain event verification on EVT_COMB_RIV_01 template
  const rivTemplate = ENCOUNTER_SCENARIO_POOL.find((t) => t.id === 'EVT_COMB_RIV_01');
  assert.ok(rivTemplate, 'EVT_COMB_RIV_01 template must exist in pool');
  const rivEvent = {
    id: rivTemplate.id,
    title: rivTemplate.title,
    subtitle: rivTemplate.subtitle,
    description: rivTemplate.description,
    category: rivTemplate.category,
    choices: rivTemplate.choices,
  };
  const rivRisky = rivEvent.choices.find((c) => Boolean(c.successCheck));
  assert.ok(rivRisky, 'EVT_COMB_RIV_01 must have a probabilistic choice with chain follow-ups');
  const rivSuccess = resolveEncounterChoiceOutcome(highStatCareer, rivEvent, rivRisky, () => 0.25);
  assert.ok(rivSuccess.nextChainEvent !== null, 'EVT_COMB_RIV_01 success must queue a next-season chain event');
  assert.ok(rivSuccess.result.chainedNextSeasonTitle, 'Outcome must report chainedNextSeasonTitle');
  const rivFail = resolveEncounterChoiceOutcome(lowStatCareer, rivEvent, rivRisky, () => 0.99);
  assert.ok(rivFail.nextChainEvent !== null, 'EVT_COMB_RIV_01 failure must queue a redemption chain event');
});

test('25. Amateur League Encounter Context Gating (Zero Pro-Only Scenarios for High Schoolers)', () => {
  const PRO_ONLY_CODES = new Set([
    'TAC_04',
    'LCK_03',
    'LCK_04',
    'INJ_01',
    'INJ_04',
    'INJ_05',
    'MED_02',
    'MED_06',
    'OFF_01',
  ]);

  let hsCareer = createBaseCareer({
    age: 17,
    league: 'HIGH_SCHOOL',
    team: HIGH_SCHOOL_TEAMS[0],
    ovr: 62,
    contractType: 'AMATEUR',
    seenEventIds: [],
    recentEventCategories: [],
  });

  for (let i = 0; i < 25; i++) {
    const evt = rollCombinatorialEncounter(hsCareer, () => (i * 0.137) % 1);
    const matchedCode = [...PRO_ONLY_CODES].find((code) => evt.id.includes(code));
    assert.equal(
      matchedCode,
      undefined,
      `Pro-only scenario ${matchedCode} must NOT roll for 17yo HIGH_SCHOOL player (got ${evt.id}: ${evt.title})`
    );
    hsCareer = {
      ...hsCareer,
      seenEventIds: [...(hsCareer.seenEventIds || []), evt.id],
      recentEventCategories: [...(hsCareer.recentEventCategories || []).slice(-1), evt.category],
    };
  }
});

test('26. Live Broadcast Quarter Court Plays Generation & Exact Score Reconciliation (Including Clutch)', () => {
  const nbaStar = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 90,
    stats: { ins: 88, out: 91, ply: 87, def: 85, reb: 79, phy: 84 },
    seasonLogs: [createSeasonLog({ mpg: 35.0, ppg: 26.8 })],
  });

  let live = createLiveFinalGame(nbaStar, NBA_TEAMS[1], 'LEAGUE_FINALS');
  for (let q = 1; q <= 3; q++) {
    live = simulateLiveQuarter(live, nbaStar, 'UNSELFISH_PASS', () => 0.42);
    const qLog = live.quarterLogs[live.quarterLogs.length - 1];
    assert.ok(qLog.plays && qLog.plays.length >= 5, `Q${q} must generate chronological court plays`);
    const sumTeam = qLog.plays.reduce((acc, p) => acc + p.teamDelta, 0);
    const sumOpp = qLog.plays.reduce((acc, p) => acc + p.oppDelta, 0);
    assert.equal(sumTeam, qLog.teamPts, `Q${q} sum(teamDelta) must equal teamPts`);
    assert.equal(sumOpp, qLog.oppPts, `Q${q} sum(oppDelta) must equal oppPts`);
    const lastPlay = qLog.plays[qLog.plays.length - 1];
    assert.equal(lastPlay.teamScoreAfter, live.teamScore, `Q${q} final play teamScoreAfter must equal live.teamScore`);
    assert.equal(lastPlay.oppScoreAfter, live.oppScore, `Q${q} final play oppScoreAfter must equal live.oppScore`);
  }

  // Clutch possession appended play must also reconcile 100% with updated quarter totals
  const q4LogSeed = live.quarterLogs[live.quarterLogs.length - 1];
  const clutchReady = {
    ...live,
    quarter: 4,
    teamScore: 100,
    oppScore: 102,
    pendingClutchPossession: true,
    clutchScenario: 'TRAILING' as const,
    quarterLogs: [
      ...live.quarterLogs,
      {
        ...q4LogSeed,
        quarter: 4,
        label: '4Q',
        teamPts: 24,
        oppPts: 26,
        plays: [
          {
            id: 'Q4_SEED',
            clock: '0:24',
            actor: 'OPPONENT' as const,
            type: 'OPP_SCORE' as const,
            x: 50,
            y: 26,
            teamDelta: 24,
            oppDelta: 26,
            teamScoreAfter: 100,
            oppScoreAfter: 102,
            text: 'seed',
          },
        ],
      },
    ],
  };

  const afterClutch = resolveClutchPossession(clutchReady, nbaStar, 'KICKOUT_ASSIST', () => 0.05);
  const finalQ4Log = afterClutch.quarterLogs[afterClutch.quarterLogs.length - 1];
  assert.ok(finalQ4Log.plays && finalQ4Log.plays.length === 2);
  const clutchPlay = finalQ4Log.plays[finalQ4Log.plays.length - 1];
  assert.equal(clutchPlay.type, 'CLUTCH');
  assert.equal(clutchPlay.teamScoreAfter, afterClutch.teamScore);
  assert.equal(clutchPlay.oppScoreAfter, afterClutch.oppScore);
  assert.equal(
    finalQ4Log.plays.reduce((a, p) => a + p.teamDelta, 0),
    finalQ4Log.teamPts,
    'Sum of 4Q plays including CLUTCH must equal updated 4Q teamPts'
  );
  assert.equal(
    finalQ4Log.plays.reduce((a, p) => a + p.oppDelta, 0),
    finalQ4Log.oppPts,
    'Sum of 4Q plays including CLUTCH must equal updated 4Q oppPts'
  );
});

test('27. Unified MVP Voting Invariant (Vote #1 = 100% MVP Winner, Team Win-Rate Integrated Directly)', () => {
  const hsTeam = HIGH_SCHOOL_TEAMS[0];
  const baseHsCareer = createBaseCareer({
    age: 19,
    league: 'HIGH_SCHOOL',
    team: hsTeam,
    ovr: 64,
    coachTrust: 88,
  });

  // 1) Sub-.500 team record naturally penalizes integrated MVP score compared to top-seed team with identical personal stats
  const weakStandings = generateLeagueStandings(baseHsCareer, 8, 12, () => 0.5);
  const weakBox = createSeasonLog({
    league: 'HIGH_SCHOOL',
    teamId: hsTeam.id,
    teamName: hsTeam.name,
    teamShortName: hsTeam.shortName,
    gp: 20,
    mpg: 32.5,
    ppg: 23.5,
    rpg: 6.2,
    apg: 5.8,
    spg: 1.8,
    bpg: 0.7,
    fgPct: 50.5,
    wins: 8,
    losses: 12,
  });
  const weakRace = buildAwardRaceTop5({
    career: baseHsCareer,
    boxScore: weakBox,
    standings: weakStandings,
    updatedRivals: [],
    isRookieSeason: false,
    rng: () => 0.5,
  });

  const strongStandings = generateLeagueStandings(baseHsCareer, 17, 3, () => 0.5);
  const strongBox = { ...weakBox, wins: 17, losses: 3 };
  const strongRace = buildAwardRaceTop5({
    career: baseHsCareer,
    boxScore: strongBox,
    standings: strongStandings,
    updatedRivals: [],
    isRookieSeason: false,
    rng: () => 0.5,
  });

  const weakPlayerEntry = weakRace.mvpRace.find((e) => e.isPlayer);
  const strongPlayerEntry = strongRace.mvpRace.find((e) => e.isPlayer);
  assert.ok(strongPlayerEntry, 'Top-seed star with 23.5/6.2/5.8 must appear in MVP Top 5');
  if (weakPlayerEntry) {
    assert.ok(
      strongPlayerEntry.awardScore > weakPlayerEntry.awardScore + 15,
      `17-3 team MVP score (${strongPlayerEntry.awardScore}) must be far higher than 8-12 team (${weakPlayerEntry.awardScore})`
    );
  }

  // 2) Single-Source-of-Truth invariant: whenever Vote #1 is the player, playerWonMvp MUST be true (and vice versa)
  const testScenarios = [
    { wins: 8, losses: 12, ppg: 28.0 },
    { wins: 10, losses: 10, ppg: 26.5 },
    { wins: 16, losses: 4, ppg: 24.0 },
    { wins: 18, losses: 2, ppg: 29.5 },
    { wins: 5, losses: 15, ppg: 32.0 },
  ];
  for (const sc of testScenarios) {
    const st = generateLeagueStandings(baseHsCareer, sc.wins, sc.losses, () => 0.5);
    const bx = { ...weakBox, wins: sc.wins, losses: sc.losses, ppg: sc.ppg };
    const race = buildAwardRaceTop5({
      career: baseHsCareer,
      boxScore: bx,
      standings: st,
      updatedRivals: [],
      isRookieSeason: false,
      rng: () => 0.45,
    });
    const isRank1 = race.mvpRace[0]?.isPlayer === true;
    assert.equal(
      race.playerWonMvp,
      isRank1,
      `Invariant broken for ${sc.wins}W-${sc.losses}L (${sc.ppg} PPG): mvpRace[0].isPlayer=${isRank1} but playerWonMvp=${race.playerWonMvp}`
    );
  }
});

test('28. Realistic High School to KBL Direct Entry Draft Pick Distribution (No Guaranteed Pick #1)', () => {
  // 1) Average 3-star HS graduate entering KBL early (OVR 59) should NOT land #1 overall; should be mid/late 1st or 2nd round
  const hs3Star = createBaseCareer({
    age: 19,
    league: 'HIGH_SCHOOL',
    team: HIGH_SCHOOL_TEAMS[0],
    ovr: 59,
    potential: 78,
    prospectStars: 3,
    draftStock: 50,
    seasonLogs: [
      createSeasonLog({ league: 'HIGH_SCHOOL', ppg: 15.2, rpg: 4.5, apg: 3.4 }),
    ],
  });
  const res3Star = executeDraftResolution(hs3Star, 'KBL', () => 0.5);
  assert.ok(
    res3Star.pickNumber >= 6,
    `3-star HS direct entrant (OVR 59) must not get top-5/1st overall pick, got #${res3Star.pickNumber}`
  );

  // 2) Generational 5-star HS prodigy (OVR 66, potential 90, draftStock 86) legitimately competes for Top 1~4
  const hs5Star = createBaseCareer({
    age: 19,
    league: 'HIGH_SCHOOL',
    team: HIGH_SCHOOL_TEAMS[0],
    ovr: 66,
    potential: 90,
    prospectStars: 5,
    draftStock: 86,
    seasonLogs: [
      createSeasonLog({
        league: 'HIGH_SCHOOL',
        ppg: 26.8,
        rpg: 7.4,
        apg: 6.2,
        wonMvp: true,
        wonChampionship: true,
      }),
    ],
  });
  const res5Star = executeDraftResolution(hs5Star, 'KBL', () => 0.5);
  assert.ok(
    res5Star.pickNumber <= 4,
    `5-star generational HS prodigy (OVR 66) should contend for Top 4 in KBL draft, got #${res5Star.pickNumber}`
  );

  // 3) U-League 4-year polished college star (OVR 65) should also pick ahead of raw 3-star HS prospect
  const uLeagueStar = createBaseCareer({
    age: 22,
    league: 'U_LEAGUE',
    team: U_LEAGUE_TEAMS[0],
    ovr: 65,
    potential: 82,
    draftStock: 80,
    seasonLogs: [
      createSeasonLog({ league: 'U_LEAGUE', ppg: 21.5, rpg: 6.0, apg: 5.2, wonMvp: true }),
    ],
  });
  const resCollege = executeDraftResolution(uLeagueStar, 'KBL', () => 0.5);
  assert.ok(
    resCollege.pickNumber < res3Star.pickNumber,
    `Polished U-League star (#${resCollege.pickNumber}) must be drafted ahead of raw 3-star HS prospect (#${res3Star.pickNumber})`
  );
});

test('29. Mid-Season Trade Rumor Tenure Gate, 3-Season Cooldown & GM Negotiation Choice', () => {
  // 1) Year 1 on a new team without broken role promise must NEVER roll trade deadline rumor
  const firstYearPro = createBaseCareer({
    age: 23,
    seasonYear: 2030,
    league: 'KBL',
    team: KBL_TEAMS[0],
    ovr: 76,
    coachTrust: 55,
    seasonsOnCurrentTeam: 1,
    lastTradeRumorYear: null,
    brokenRolePromise: false,
  });
  for (let i = 0; i < 10; i++) {
    const evt = rollMidSeasonCrossroadsEvent(firstYearPro, () => i * 0.09);
    assert.ok(
      !evt.id.startsWith('EVT_MID_TRADE_DEADLINE_'),
      `Trade rumor must not trigger in 1st season on team without brokenRolePromise (got ${evt.id})`
    );
  }

  // 2) Within 3-season cooldown (lastTradeRumorYear = 2029, seasonYear = 2031) must NOT roll trade rumor
  const cooldownPro = createBaseCareer({
    age: 26,
    seasonYear: 2031,
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 82,
    coachTrust: 40,
    seasonsOnCurrentTeam: 3,
    lastTradeRumorYear: 2029,
    brokenRolePromise: true,
  });
  for (let i = 0; i < 10; i++) {
    const evt = rollMidSeasonCrossroadsEvent(cooldownPro, () => i * 0.09);
    assert.ok(
      !evt.id.startsWith('EVT_MID_TRADE_DEADLINE_'),
      `Trade rumor must respect 3-season cooldown (got ${evt.id})`
    );
  }

  // 3) When eligible (brokenRolePromise + cooldown passed + low rng), trade rumor rolls with GM negotiation flag
  const eligiblePro = createBaseCareer({
    age: 26,
    seasonYear: 2033,
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 83,
    coachTrust: 42,
    seasonsOnCurrentTeam: 3,
    lastTradeRumorYear: 2029,
    brokenRolePromise: true,
  });
  const tradeEvt = rollMidSeasonCrossroadsEvent(eligiblePro, () => 0.05);
  assert.ok(
    tradeEvt.id.startsWith('EVT_MID_TRADE_DEADLINE_'),
    `Eligible dissatisfied veteran should roll trade rumor on low rng (got ${tradeEvt.id})`
  );
  const negotiateChoice = tradeEvt.choices.find((c) => c.negotiateMidSeasonTrade);
  assert.ok(
    negotiateChoice,
    'Mid-season trade rumor choice must use negotiateMidSeasonTrade probability flag instead of instant teleport'
  );
});

test('30. Realistic 1-Possession Shooting Map (<=3pts), Zero Quarter-Start Score/Stat Spoiler, Clean Team Names & Offer Copy', () => {
  // 1) Live broadcast court plays: only player single possessions shown on court, shotPoints strictly in 0..3, zero frame-0 score jump, progressive box score
  const nbaStar = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 91,
    stats: { ins: 90, out: 92, ply: 88, def: 86, reb: 80, phy: 85 },
    seasonLogs: [createSeasonLog({ mpg: 36.0, ppg: 28.4 })],
  });

  let live = createLiveFinalGame(nbaStar, NBA_TEAMS[1], 'LEAGUE_FINALS');
  for (let q = 1; q <= 4; q++) {
    const teamBefore = live.teamScore;
    const oppBefore = live.oppScore;
    const statsBefore = { ...live.playerStats };
    live = simulateLiveQuarter(live, nbaStar, 'ACE_HERO', () => 0.35 + q * 0.05);
    const qLog = live.quarterLogs[live.quarterLogs.length - 1];

    assert.equal(qLog.startTeamScore, teamBefore, `Q${q} startTeamScore must match pre-quarter score`);
    assert.equal(qLog.startOppScore, oppBefore, `Q${q} startOppScore must match pre-quarter opp score`);
    assert.equal(qLog.startPlayerStats?.pts, statsBefore.pts, `Q${q} startPlayerStats must snapshot pre-quarter PTS`);

    assert.ok(qLog.plays && qLog.plays.length >= 2, `Q${q} must generate plays`);
    const firstPlay = qLog.plays[0];
    if (firstPlay.showOnCourt) {
      assert.equal(
        firstPlay.teamScoreBefore,
        teamBefore,
        `Q${q} Turn 0 court play must not jump teamScoreBefore prior to shot landing`
      );
      assert.equal(
        firstPlay.oppScoreBefore,
        oppBefore,
        `Q${q} Turn 0 court play must not jump oppScoreBefore prior to shot landing`
      );
    }

    for (const p of qLog.plays) {
      if (p.showOnCourt) {
        assert.ok(
          typeof p.shotPoints === 'number' && p.shotPoints >= 0 && p.shotPoints <= 3,
          `Court play ${p.id} (${p.type}) must have realistic shotPoints in 0..3, got ${p.shotPoints}`
        );
        assert.ok(
          !p.courtBadge || !/\+[4-9]|-\d+/.test(p.courtBadge),
          `Court badge must never show +4..+9 or negative points, got "${p.courtBadge}"`
        );
      }
      assert.ok(p.playerStatsAfter !== undefined, `Play ${p.id} must include progressive playerStatsAfter snapshot`);
    }

    const lastPlay = qLog.plays[qLog.plays.length - 1];
    assert.equal(lastPlay.playerStatsAfter?.pts, live.playerStats.pts, `Q${q} final playerStatsAfter.pts must equal live.playerStats.pts`);
    assert.equal(lastPlay.playerStatsAfter?.ast, live.playerStats.ast, `Q${q} final playerStatsAfter.ast must equal live.playerStats.ast`);
    if (live.isFinished || live.pendingClutchPossession) break;
  }

  // 2) All 12 U-League university names & Sangmu have zero parenthetical mascots
  assert.equal(U_LEAGUE_TEAMS.length, 12);
  for (const uni of U_LEAGUE_TEAMS) {
    assert.ok(
      !uni.name.includes('(') && !uni.name.includes(')'),
      `U-League team name must not contain mascot parentheses, got "${uni.name}"`
    );
  }
  assert.ok(
    !SANGMU_TEAM.name.includes('(') && !SANGMU_TEAM.name.includes(')'),
    `Sangmu team name must not contain parentheses, got "${SANGMU_TEAM.name}"`
  );

  // 3) 5-star high school direct overseas/G-League offer remains available WITHOUT '5성 슈퍼 유망주' or '특별 오퍼' wording
  const hs5StarGrad = createBaseCareer({
    age: 20,
    league: 'HIGH_SCHOOL',
    team: HIGH_SCHOOL_TEAMS[0],
    ovr: 65,
    potential: 91,
    prospectStars: 5,
    draftStock: 86,
    seasonLogs: [
      createSeasonLog({
        league: 'HIGH_SCHOOL',
        ppg: 27.0,
        rpg: 7.5,
        apg: 6.5,
        wonMvp: true,
        wonChampionship: true,
      }),
    ],
  });
  const hsOptions = generateOffseasonOptions(hs5StarGrad, () => 0.4);
  const directProOffer = hsOptions.find(
    (o) =>
      o.id.startsWith('OPT_ROUTE_D_') ||
      o.targetLeague === 'GLEAGUE' ||
      o.targetLeague === 'NBL' ||
      o.targetLeague === 'B_LEAGUE' ||
      o.targetLeague === 'EUROLEAGUE'
  );
  assert.ok(directProOffer, '5-star high school graduate must still receive direct overseas/G-League pro offer');
  for (const opt of hsOptions) {
    assert.ok(
      !opt.title.includes('5성 슈퍼 유망주') && !opt.title.includes('특별 오퍼'),
      `Offseason option title must not include removed label, got "${opt.title}"`
    );
    assert.ok(
      !opt.subtitle.includes('5성 슈퍼 유망주') && !opt.badgeText.includes('5성 슈퍼 유망주'),
      `Offseason option subtitle/badge must not include removed label, got "${opt.badgeText}"`
    );
  }
});

test('31. 역대 리그 기록실 경신·추격, 명예의 전당 도감, 세이브 마이그레이션 및 하단 도크 상태 검증', () => {
  const initialBook = createInitialRecordBook();
  const totalSlots = Object.values(initialBook).reduce((acc, arr) => acc + arr.length, 0);
  assert.equal(totalSlots, 66, '6 leagues x 7 categories + NBA/KBL/EuroLeague x 8 categories = 66 baseline records');

  const log2032 = createSeasonLog({
    year: 2032,
    league: 'KBL',
    teamName: KBL_TEAMS[0].name,
    gp: 54,
    ppg: 36.2,
    rpg: 14.5,
    apg: 12.1,
    singleGameHighPts: 58,
    wonChampionship: true,
    wonMvp: true,
  });

  const kblSuperstar = createBaseCareer({
    name: '김전설',
    league: 'KBL',
    seasonYear: 2032,
    team: KBL_TEAMS[0],
    seasonLogs: [
      createSeasonLog({
        year: 2030,
        league: 'KBL',
        teamName: KBL_TEAMS[0].name,
        gp: 54,
        ppg: 25.4,
        rpg: 6.2,
        apg: 7.4,
        wonChampionship: true,
        wonMvp: true,
      }),
      createSeasonLog({
        year: 2031,
        league: 'KBL',
        teamName: KBL_TEAMS[0].name,
        gp: 54,
        ppg: 29.8,
        rpg: 6.8,
        apg: 9.2,
        wonChampionship: true,
        wonMvp: true,
      }),
      log2032,
    ],
  });

  const { nextBook, brokenRecords, milestones } = checkAndApplyRecordBreaks(
    initialBook,
    kblSuperstar,
    log2032
  );
  assert.ok(
    brokenRecords.some((b) => b.league === 'KBL' && b.category === 'SEASON_PPG'),
    '36.2 PPG in KBL must break the KBL single-season PPG record'
  );
  assert.ok(
    brokenRecords.some((b) => b.league === 'KBL' && b.category === 'SEASON_APG'),
    '12.1 APG in KBL must break the KBL single-season APG record'
  );
  assert.ok(
    brokenRecords.some((b) => b.league === 'KBL' && b.category === 'SINGLE_GAME_POINTS'),
    '58 PTS single game in KBL must break the KBL single-game points record'
  );
  assert.equal(milestones.length, brokenRecords.length);

  const kblPpgRecord = nextBook.KBL.find((e) => e.category === 'SEASON_PPG');
  assert.equal(kblPpgRecord?.holderName, '김전설');
  assert.equal(kblPpgRecord?.isUserRecord, true);

  // Chase tracker must return records for current league with progress metrics
  const chases = getLeagueRecordChases(nextBook, kblSuperstar, 'KBL');
  assert.equal(chases.length, 8, 'KBL chase tracker returns all 8 league record categories incl. FINALS_MVPS');
  assert.ok(
    chases.every((c) => c.entry.league === 'KBL'),
    'Chase targets must belong to current league'
  );

  // HOF compendium builds unlocked tiers, retired jerseys, and user-broken records
  const legacyReport = evaluateCareerLegacy(kblSuperstar);
  const hofEntry = buildHallOfFameEntry(kblSuperstar, 'VOLUNTARY', legacyReport);
  const compendium = buildHofCompendium([hofEntry], nextBook);
  assert.equal(compendium.totalInductees, 1);
  assert.equal(compendium.totalTiers, LEGACY_TIER_CATALOG.length);
  assert.ok(compendium.tiersUnlocked[hofEntry.legacyTierId] >= 1);
  assert.ok(compendium.userBrokenRecordsCount >= 3);

  // Save migration restores canonical team name and strips legacy mascot suffixes
  const migrated = migratePersistedPayload({
    career: {
      ...kblSuperstar,
      team: {
        ...HIGH_SCHOOL_TEAMS[0],
        name: `${HIGH_SCHOOL_TEAMS[0].name} 백마`,
      },
    },
    hofList: [
      {
        ...hofEntry,
        legacyTitle: '🏆 GOAT (역대 최고 농구 황제)',
        legacyEmoji: '👑',
        iconicTeam: {
          ...U_LEAGUE_TEAMS[0],
          name: `${U_LEAGUE_TEAMS[0].name} (독수리)`,
        },
      },
    ],
  });
  assert.equal(migrated.career?.team.name, HIGH_SCHOOL_TEAMS[0].name);
  assert.equal(migrated.hofList[0].iconicTeam.name, U_LEAGUE_TEAMS[0].name);
  assert.equal(migrated.hofList[0].legacyTitle, '역대 최고 선수 (GOAT)');
  assert.equal(migrated.hofList[0].legacyEmoji, '');
  const migratedSlots = Object.values(migrated.recordBook).reduce((acc, arr) => acc + arr.length, 0);
  assert.equal(migratedSlots, 66);

  // Bottom dock visibility helper stays true during finished playoff bracket
  const finishedPlayoffCareer = createBaseCareer({
    seasonPhase: 'POSTSEASON_BRACKET',
    playoffBracket: {
      league: 'KBL',
      leagueName: 'KBL',
      year: 2032,
      rounds: [],
      currentRoundIdx: 0,
      userTeamId: KBL_TEAMS[0].id,
      userEliminated: true,
      championTeamId: KBL_TEAMS[1].id,
      championTeamName: KBL_TEAMS[1].name,
      userWonChampionship: false,
      userWonFinalsMvp: false,
    },
  });
  assert.equal(
    hasSeasonBottomDock(finishedPlayoffCareer),
    true,
    'POSTSEASON_BRACKET with championTeamId still renders offseason transition dock'
  );
});

test('32. 런타임 UI 메타데이터·배지·코치 조언·은퇴 등급 전면 이모지 제거 검증', () => {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  for (const meta of Object.values(PLAYER_TRAIT_META)) {
    assert.ok(!emojiRegex.test(meta.label), `Trait label contains emoji: ${meta.label}`);
    assert.ok(!emojiRegex.test(meta.badge), `Trait badge contains emoji: ${meta.badge}`);
    assert.ok(!emojiRegex.test(meta.description), `Trait desc contains emoji: ${meta.description}`);
  }

  const dnas: GrowthDna[] = ['EARLY_BLOOMER', 'STANDARD', 'LATE_BLOOMER', 'IRONMAN'];
  for (const dna of dnas) {
    const info = getGrowthDnaInfo(dna);
    assert.ok(!emojiRegex.test(info.label), `DNA label contains emoji: ${info.label}`);
    assert.ok(!emojiRegex.test(info.badge), `DNA badge contains emoji: ${info.badge}`);
    assert.ok(!emojiRegex.test(info.description), `DNA desc contains emoji: ${info.description}`);
  }

  const styles: PlaystyleArchetype[] = [
    'ALL_ROUNDER',
    'SCORER',
    'PLAYMAKER',
    'THREE_AND_D',
    'RIM_PROTECTOR',
  ];
  for (const style of styles) {
    const info = getPlaystyleInfo(style);
    assert.ok(!emojiRegex.test(info.label), `Playstyle label contains emoji: ${info.label}`);
    assert.ok(!emojiRegex.test(info.badge), `Playstyle badge contains emoji: ${info.badge}`);
    assert.ok(!emojiRegex.test(info.description), `Playstyle desc contains emoji: ${info.description}`);
  }

  const sampleCareer = createBaseCareer({
    league: 'NBA',
    stats: {
      out: 92,
      ins: 90,
      ply: 88,
      def: 86,
      reb: 86,
      phy: 88,
    },
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        ppg: 28.5,
        rpg: 7.2,
        apg: 8.4,
        spg: 2.1,
        bpg: 1.4,
        wonMvp: true,
        wonChampionship: true,
      }),
    ],
  });

  for (const camp of getSpecialCampOptions(sampleCareer)) {
    assert.ok(!emojiRegex.test(camp.title), `Camp title contains emoji: ${camp.title}`);
    assert.ok(!emojiRegex.test(camp.subtitle), `Camp subtitle contains emoji: ${camp.subtitle}`);
    assert.ok(!emojiRegex.test(camp.effectText), `Camp effect contains emoji: ${camp.effectText}`);
  }

  const badges = evaluatePlayerBadges(
    sampleCareer.stats,
    sampleCareer.secondaryPos,
    sampleCareer.growthDna,
    sampleCareer.playstyle,
    sampleCareer.traits
  );
  for (const badge of badges) {
    assert.ok(!emojiRegex.test(badge), `Badge contains emoji: ${badge}`);
  }

  const posFit = analyzePositionFit(
    sampleCareer.stats,
    sampleCareer.heightCm,
    sampleCareer.primaryPos,
    sampleCareer.secondaryPos,
    sampleCareer.coachTrust
  );
  assert.ok(!emojiRegex.test(posFit.coachAdvice), `Coach advice contains emoji: ${posFit.coachAdvice}`);

  const legacy = evaluateCareerLegacy(sampleCareer);
  assert.ok(!emojiRegex.test(legacy.tierTitle), `Legacy title contains emoji: ${legacy.tierTitle}`);
  assert.ok(!emojiRegex.test(legacy.tierEmoji), `Legacy badge contains emoji: ${legacy.tierEmoji}`);
  assert.ok(!emojiRegex.test(legacy.biography), `Legacy bio contains emoji: ${legacy.biography}`);

  const hsProspect = evaluateHighSchoolProspect(
    createBaseCareer({
      league: 'HIGH_SCHOOL',
      seasonLogs: [
        createSeasonLog({
          league: 'HIGH_SCHOOL',
          ppg: 28.0,
          rpg: 7.5,
          apg: 6.2,
          wonMvp: true,
          wonChampionship: true,
        }),
      ],
    })
  );
  assert.ok(!emojiRegex.test(hsProspect.summary), `HS prospect summary contains emoji: ${hsProspect.summary}`);
});

test('33. 4년 주기 국제대회, 아시안게임 난이도 완화, NBA/KBL 파이널 MVP 기록실 및 선택 초기화 검증', () => {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  // 1) 4-year international cycle mapping
  assert.equal(getInternationalTournamentByYear(2025), 'ASIA_CUP');
  assert.equal(getInternationalTournamentByYear(2026), 'ASIAN_GAMES');
  assert.equal(getInternationalTournamentByYear(2027), 'FIBA_WORLD_CUP');
  assert.equal(getInternationalTournamentByYear(2028), 'OLYMPICS');

  // 2) National teams pool & zero emojis across all international teams and callup events
  assert.ok(ALL_INTERNATIONAL_TEAMS.length >= 20);
  for (const t of ALL_INTERNATIONAL_TEAMS) {
    assert.ok(!emojiRegex.test(t.name), `National team name contains emoji: ${t.name}`);
    assert.ok(!emojiRegex.test(t.prestige), `National team prestige contains emoji: ${t.prestige}`);
  }
  assert.equal(getNationalTeamsForTournament('ASIAN_GAMES').length, 8);
  assert.equal(getNationalTeamsForTournament('ASIA_CUP').length, 10);
  assert.ok(getNationalTeamsForTournament('FIBA_WORLD_CUP').length >= 16);
  assert.ok(getNationalTeamsForTournament('OLYMPICS').length >= 12);

  const kblAce = createBaseCareer({
    name: '이국대',
    age: 24,
    seasonYear: 2026,
    league: 'KBL',
    team: KBL_TEAMS[0],
    ovr: 77,
    militaryExempt: false,
    stats: { ins: 76, out: 81, ply: 78, def: 75, reb: 70, phy: 78 },
    seasonLogs: [createSeasonLog({ league: 'KBL', mpg: 34.0, ppg: 23.8, rpg: 5.5, apg: 6.2 })],
  });

  // Verify callup event creation for all 4 tournaments has zero emojis and sets enterInternationalTournament
  for (const type of ['ASIA_CUP', 'ASIAN_GAMES', 'FIBA_WORLD_CUP', 'OLYMPICS'] as const) {
    const evt = createInternationalCallupEvent(kblAce, 2026, type);
    assert.ok(!emojiRegex.test(evt.title), `Callup title contains emoji: ${evt.title}`);
    assert.ok(!emojiRegex.test(evt.description), `Callup desc contains emoji: ${evt.description}`);
    assert.ok(
      evt.choices.some((c) => c.enterInternationalTournament === type),
      `Callup event for ${type} must provide enterInternationalTournament choice`
    );
  }

  // Verify rollSeasonEvent triggers Asia Cup (2025), Asian Games (2026), World Cup (2027), Olympics (2028)
  const nbaStarForIntl = createBaseCareer({
    ...kblAce,
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 86,
  });
  const evt2025 = rollSeasonEvent({ ...nbaStarForIntl, seasonYear: 2025 }, () => 0.1);
  assert.equal(evt2025?.id, 'EVT_INTL_ASIA_CUP_2025');
  const evt2026 = rollSeasonEvent({ ...nbaStarForIntl, seasonYear: 2026 }, () => 0.1);
  assert.equal(evt2026?.id, 'EVT_ASIAN_GAMES_GOLD');
  const evt2027 = rollSeasonEvent({ ...nbaStarForIntl, seasonYear: 2027 }, () => 0.1);
  assert.equal(evt2027?.id, 'EVT_INTL_FIBA_WORLD_CUP_2027');
  const evt2028 = rollSeasonEvent({ ...nbaStarForIntl, seasonYear: 2028 }, () => 0.1);
  assert.equal(evt2028?.id, 'EVT_INTL_OLYMPICS_2028');

  // 3) Asian Games difficulty rebalancing: KBL Ace (OVR 77) comfortably competes for Gold
  const korRatingAg = calculateKoreaTeamEffectiveRating(kblAce, 'ASIAN_GAMES');
  assert.ok(
    korRatingAg >= 81,
    `KBL Ace (OVR 77) should lift Korea Asian Games rating to >= 81, got ${korRatingAg}`
  );
  let agFinalsCount = 0;
  let agGoldCount = 0;
  const trials = 160;
  let seed = 1337;
  const detRng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < trials; i++) {
    const res = simulateInternationalTournament(kblAce, 'ASIAN_GAMES', detRng);
    if (res.reachedFinals && res.finalOpponent) {
      agFinalsCount++;
      const liveFinal = createLiveFinalGame(kblAce, res.finalOpponent, 'ASIAN_GAMES_FINAL', {
        tournamentType: 'ASIAN_GAMES',
        preMatches: res.matches,
      });
      const finished = skipLiveGameToEnd(liveFinal, kblAce, detRng);
      if (finished.finalOutcome?.medal === 'GOLD') {
        agGoldCount++;
      }
    }
  }
  const finalsRate = agFinalsCount / trials;
  const goldRate = agGoldCount / trials;
  assert.ok(
    finalsRate >= 0.65,
    `KBL Ace (OVR 77) Asian Games Finals reach rate must be >= 65%, got ${(finalsRate * 100).toFixed(1)}%`
  );
  assert.ok(
    goldRate >= 0.45,
    `KBL Ace (OVR 77) Asian Games Gold rate must be >= 45%, got ${(goldRate * 100).toFixed(1)}%`
  );

  // 4) Bronze match live game flow & Olympic Bronze military exemption
  const olympicOpponents = getNationalTeamsForTournament('OLYMPICS');
  const bronzeLive = createLiveFinalGame(
    nbaStarForIntl,
    olympicOpponents[olympicOpponents.length - 1],
    'INTERNATIONAL_BRONZE',
    { tournamentType: 'OLYMPICS' }
  );
  assert.equal(isInternationalLiveGame(bronzeLive.gameType), true);
  // Simulate deterministic win in Bronze Medal match
  const finishedBronzeWin = skipLiveGameToEnd(
    { ...bronzeLive, teamScore: 95, oppScore: 70, quarter: 3 },
    { ...nbaStarForIntl, ovr: 95, stats: { ins: 95, out: 95, ply: 95, def: 95, reb: 90, phy: 95 } },
    () => 0.1
  );
  assert.equal(finishedBronzeWin.finalOutcome?.medal, 'BRONZE');
  assert.equal(
    finishedBronzeWin.finalOutcome?.grantedMilitaryExemption,
    true,
    'Olympic Bronze medal must grant military exemption'
  );

  // 5) NBA, KBL & EuroLeague FINALS_MVPS record book entries
  const book = createInitialRecordBook();
  assert.ok(book.NBA.some((r) => r.category === 'FINALS_MVPS' && r.value === 6));
  assert.ok(book.KBL.some((r) => r.category === 'FINALS_MVPS' && r.value === 3));
  assert.ok(book.EUROLEAGUE.some((r) => r.category === 'FINALS_MVPS' && r.value === 3));
  for (const lg of ['NCAA', 'U_LEAGUE', 'B_LEAGUE', 'NBL', 'GLEAGUE', 'HIGH_SCHOOL'] as const) {
    assert.ok(
      !book[lg].some((r) => r.category === 'FINALS_MVPS'),
      `${lg} must NOT include FINALS_MVPS record category`
    );
  }

  // Breaking KBL FINALS_MVPS record (4 > 3)
  const kblDynastyLogs = [2028, 2029, 2030, 2031].map((yr) =>
    createSeasonLog({
      year: yr,
      league: 'KBL',
      teamName: KBL_TEAMS[0].name,
      wonChampionship: true,
      wonFinalsMvp: true,
    })
  );
  const kblDynastyCareer = createBaseCareer({
    name: '최파이널',
    league: 'KBL',
    seasonYear: 2031,
    team: KBL_TEAMS[0],
    seasonLogs: kblDynastyLogs,
  });
  const kblFmvpCheck = checkAndApplyRecordBreaks(
    book,
    kblDynastyCareer,
    kblDynastyLogs[kblDynastyLogs.length - 1]
  );
  assert.ok(
    kblFmvpCheck.brokenRecords.some((b) => b.league === 'KBL' && b.category === 'FINALS_MVPS'),
    '4 KBL Finals MVPs must break Yang Dong-geun baseline (3)'
  );

  // 6) Selective Record Reset persistence guard (skipRecordSync = true preserves reset recordBook even with HOF)
  const legacy = evaluateCareerLegacy(kblDynastyCareer);
  const hofWithRecords = buildHallOfFameEntry(kblDynastyCareer, 'VOLUNTARY', legacy);
  assert.equal(hofWithRecords.totals.kblFinalsMvps, 4);

  const syncedBook = syncRecordBookWithHof(createInitialRecordBook(), [hofWithRecords], null);
  assert.equal(
    syncedBook.KBL.find((r) => r.category === 'FINALS_MVPS')?.holderName,
    '최파이널',
    'HOF sync must reflect KBL Finals MVP record when not manually reset'
  );

  const afterManualReset = migratePersistedPayload({
    career: null,
    hofList: [hofWithRecords],
    recordBook: createInitialRecordBook(),
    skipRecordSync: true,
  });
  assert.equal(
    afterManualReset.recordBook.KBL.find((r) => r.category === 'FINALS_MVPS')?.isUserRecord,
    false,
    'Manual record book reset (skipRecordSync=true) must NOT be overwritten by HOF on reload'
  );
  assert.equal(
    afterManualReset.hofList.length,
    1,
    'HOF entries must remain intact when only Record Book is reset'
  );
  assert.ok(INTERNATIONAL_TOURNAMENT_CONFIG.OLYMPICS.militaryExemptionMinMedal === 'BRONZE');
});

test('34. Taegeukgi Flag Asset, 24 High School Emblems, Farewell Tour Save Recovery & Tone Cleanup', () => {
  const publicDir = path.resolve(process.cwd(), 'public');

  // 1) South Korea national flag (Taegeukgi) in createLiveFinalGame, local SVG asset & fallback
  const taegeukgiPath = path.join(publicDir, 'logos', 'NAT_KOR.svg');
  assert.ok(fs.existsSync(taegeukgiPath), 'public/logos/NAT_KOR.svg must exist');
  const taegeukgiSvg = fs.readFileSync(taegeukgiPath, 'utf8');
  assert.ok(taegeukgiSvg.includes('#CD2E3A') && taegeukgiSvg.includes('#0047A0'));

  const intlCareer = createBaseCareer({ league: 'KBL', team: KBL_TEAMS[0], ovr: 80 });
  const liveIntl = createLiveFinalGame(intlCareer, ASIAN_NATIONAL_TEAMS[0], 'ASIAN_GAMES_FINAL', {
    tournamentType: 'ASIAN_GAMES',
  });
  assert.equal(liveIntl.playerTeam.id, 'KOR_NAT_TEAM');
  assert.equal(liveIntl.playerTeam.logoUrl, '/logos/NAT_KOR.svg');
  const korFallback = decodeURIComponent(generateLeagueFallbackSvgDataUri(liveIntl.playerTeam));
  assert.ok(korFallback.includes('#CD2E3A') && korFallback.includes('#0047A0'));
  assert.ok(!korFallback.includes('KBL PRO') && !korFallback.includes('NBA PRO'));

  // 2) All 30 High School teams have valid local emblem files with zero legacy BASKETBALL CLUB template
  assert.equal(HIGH_SCHOOL_TEAMS.length, 30);
  for (const hs of HIGH_SCHOOL_TEAMS) {
    assert.ok(hs.logoUrl && hs.logoUrl.startsWith('/logos/HS_'), `Missing HS logoUrl for ${hs.id}`);
    const fullPath = path.join(publicDir, hs.logoUrl.replace(/^\//, ''));
    assert.ok(fs.existsSync(fullPath), `Missing HS logo file: ${fullPath}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 300, `HS logo file too small: ${fullPath}`);
    if (fullPath.endsWith('.svg')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(
        !content.includes('BASKETBALL CLUB'),
        `Legacy generic template must be replaced for ${hs.id}`
      );
    }
  }

  // 3) Farewell Tour soft-lock self-healing in save migration & logoUrl sync
  const stuckFarewellCareer = createBaseCareer({
    age: 36,
    isFarewellTour: true,
    offseasonLocked: false,
    offseasonOptions: [],
    seasonPhase: 'OFFSEASON',
    retirementReason: null,
    team: { ...HIGH_SCHOOL_TEAMS[1], logoUrl: '/logos/HS_YONGSAN.svg' },
  });
  const recovered = migratePersistedPayload({
    career: stuckFarewellCareer,
    hofList: [],
    recordBook: createInitialRecordBook(),
  });
  assert.equal(
    recovered.career?.seasonPhase,
    'REGULAR_SEASON',
    'Stuck Farewell Tour save (!offseasonLocked && OFFSEASON) must auto-recover to REGULAR_SEASON'
  );
  assert.equal(recovered.career?.playoffBracket, null);
  assert.equal(recovered.career?.liveGame, null);
  assert.equal(
    recovered.career?.team.logoUrl,
    '/logos/HS_YONGSAN.png',
    'normalizeTeamInfo must refresh updated local emblem extensions on save load'
  );

  // 4) Zero remaining polite endings in ALL_TEAMS prestigeDesc
  for (const t of ALL_TEAMS) {
    assert.ok(
      !/(?:예요|이에요|해요|있어요|돼요|많아요|뛰어나요|펼쳐요)\.$/.test(t.prestigeDesc),
      `Polite ending still present in ${t.id}: ${t.prestigeDesc}`
    );
  }
});

test('35. Incumbent Core Player Re-Signing Protection Prevents Unfair Sixth-Man / Vet-Min Demotion', () => {
  // 1) KBL Contender starter/ace (OVR 76, 33 MPG, trust 84) re-signing must NOT drop to SIXTH_MAN_CORE
  const kblContender = KBL_TEAMS.find((t) => t.rating >= 77) || KBL_TEAMS[0];
  const kblCoreCareer = createBaseCareer({
    age: 26,
    league: 'KBL',
    team: kblContender,
    ovr: 76,
    role: '주전 핵심',
    coachTrust: 84,
    contractType: 'KBL_MAX',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'KBL',
        teamId: kblContender.id,
        teamName: kblContender.name,
        ovr: 76,
        role: '주전 핵심',
        mpg: 33.4,
        ppg: 18.6,
        rpg: 5.2,
        apg: 4.8,
      }),
    ],
  });
  const kblRole = determineTeamRolePromise(kblCoreCareer, kblContender, 'KBL_MAX', {
    isResigning: true,
  });
  assert.ok(
    kblRole.promisedRole === 'ACE_FIRST_OPTION' ||
      kblRole.promisedRole === 'STARTER_GUARANTEE',
    `KBL incumbent core starter must keep starter/ace promise on re-sign, got ${kblRole.promisedRole}`
  );
  const kblOpts = generateOffseasonOptions(kblCoreCareer, () => 0.45);
  const kblResign = kblOpts.find((o) => o.id === 'OPT_RESIGN_CURRENT_TEAM');
  assert.ok(kblResign, 'KBL incumbent core must receive re-sign offer');
  assert.ok(
    kblResign!.promisedRole === 'ACE_FIRST_OPTION' ||
      kblResign!.promisedRole === 'STARTER_GUARANTEE',
    `KBL re-sign option promisedRole must be starter/ace, got ${kblResign!.promisedRole}`
  );

  // 2) NBA 28yo contender starter (OVR 82, 34 MPG, trust 85) re-signing must stay starter/ace, never SIXTH_MAN_CORE
  const nbaContender = NBA_TEAMS.find((t) => t.direction === 'CONTENDER') || NBA_TEAMS[0];
  const nbaCoreCareer = createBaseCareer({
    age: 28,
    league: 'NBA',
    team: nbaContender,
    ovr: 82,
    role: '주전 핵심',
    coachTrust: 85,
    contractType: 'NBA_STANDARD',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        teamId: nbaContender.id,
        teamName: nbaContender.name,
        ovr: 82,
        role: '주전 핵심',
        mpg: 34.2,
        ppg: 21.4,
        rpg: 5.6,
        apg: 5.1,
      }),
    ],
  });
  const nbaRole = determineTeamRolePromise(nbaCoreCareer, nbaContender, 'NBA_STANDARD', {
    isResigning: true,
  });
  assert.ok(
    nbaRole.promisedRole === 'ACE_FIRST_OPTION' ||
      nbaRole.promisedRole === 'STARTER_GUARANTEE',
    `NBA contender incumbent starter must keep starter/ace promise, got ${nbaRole.promisedRole}`
  );
  const nbaOpts = generateOffseasonOptions(nbaCoreCareer, () => 0.4);
  const nbaResign = nbaOpts.find((o) => o.id === 'OPT_RESIGN_CURRENT_TEAM');
  assert.ok(nbaResign, 'NBA contender incumbent starter must receive re-sign offer');
  assert.ok(
    nbaResign!.promisedRole === 'ACE_FIRST_OPTION' ||
      nbaResign!.promisedRole === 'STARTER_GUARANTEE',
    `NBA re-sign promisedRole must not drop to sixth man, got ${nbaResign!.promisedRole}`
  );

  // 3) 33yo NBA superstar/core starter (OVR 84, 34 MPG) must NOT be forced to NBA_VET_MIN / VETERAN_MENTOR
  const nbaVetStar = createBaseCareer({
    age: 33,
    league: 'NBA',
    team: nbaContender,
    ovr: 84,
    role: '팀 에이스',
    coachTrust: 88,
    contractType: 'NBA_MAX',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        teamId: nbaContender.id,
        teamName: nbaContender.name,
        ovr: 84,
        role: '팀 에이스',
        mpg: 34.8,
        ppg: 23.1,
        rpg: 6.2,
        apg: 5.8,
      }),
    ],
  });
  const vetScout = evaluateTeamScouting(nbaVetStar, nbaContender, () => 0.5, true);
  assert.notEqual(
    vetScout.recommendedContract,
    'NBA_VET_MIN',
    '33yo OVR 84 incumbent starter must NOT be downgraded to NBA_VET_MIN'
  );
  const vetOpts = generateOffseasonOptions(nbaVetStar, () => 0.5);
  const vetResign = vetOpts.find((o) => o.id === 'OPT_RESIGN_CURRENT_TEAM');
  assert.ok(vetResign);
  assert.ok(
    vetResign!.promisedRole === 'ACE_FIRST_OPTION' ||
      vetResign!.promisedRole === 'STARTER_GUARANTEE',
    `33yo OVR 84 incumbent ace must keep starter/ace role on re-sign, got ${vetResign!.promisedRole}`
  );
  assert.notEqual(vetResign!.contractType, 'NBA_VET_MIN');
});

test('36. Per-Team Contract Salary Differentiation Across Direction, Role, Interest & Incumbent Bonus', () => {
  const contender =
    NBA_TEAMS.find((t) => t.direction === 'CONTENDER') || {
      ...NBA_TEAMS[0],
      direction: 'CONTENDER' as const,
    };
  const rebuilding =
    NBA_TEAMS.find((t) => t.direction === 'REBUILDING') || {
      ...NBA_TEAMS[NBA_TEAMS.length - 1],
      direction: 'REBUILDING' as const,
    };

  const contenderSalary = calculateTeamContractOfferSalary({
    contractType: 'NBA_STANDARD',
    ovr: 83,
    team: contender,
    promisedRole: 'STARTER_GUARANTEE',
    scoutingScore: 86,
    isResigning: false,
    coachTrust: 80,
    primaryPos: 'SG',
  });
  const rebuildingAceSalary = calculateTeamContractOfferSalary({
    contractType: 'NBA_STANDARD',
    ovr: 83,
    team: rebuilding,
    promisedRole: 'ACE_FIRST_OPTION',
    scoutingScore: 90,
    isResigning: false,
    coachTrust: 80,
    primaryPos: 'SG',
  });
  const incumbentSalary = calculateTeamContractOfferSalary({
    contractType: 'NBA_STANDARD',
    ovr: 83,
    team: contender,
    promisedRole: 'STARTER_GUARANTEE',
    scoutingScore: 86,
    isResigning: true,
    coachTrust: 85,
    primaryPos: 'SG',
  });

  assert.ok(
    rebuildingAceSalary > contenderSalary,
    `Rebuilding Ace offer (${rebuildingAceSalary}) must exceed Contender Starter offer (${contenderSalary})`
  );
  assert.ok(
    incumbentSalary > contenderSalary,
    `Incumbent re-signing offer (${incumbentSalary}) must include loyalty bonus over identical external contender offer (${contenderSalary})`
  );

  // Statutory fixed contracts remain identical across teams
  const vetMinA = calculateTeamContractOfferSalary({
    contractType: 'NBA_VET_MIN',
    ovr: 76,
    team: contender,
    promisedRole: 'VETERAN_MENTOR',
    scoutingScore: 80,
  });
  const vetMinB = calculateTeamContractOfferSalary({
    contractType: 'NBA_VET_MIN',
    ovr: 76,
    team: rebuilding,
    promisedRole: 'STARTER_GUARANTEE',
    scoutingScore: 92,
  });
  assert.equal(vetMinA, vetMinB, 'NBA_VET_MIN statutory salary must stay fixed across teams');

  // Full offseason FA offer list for NBA star has distinct salaries across teams
  const faStar = createBaseCareer({
    age: 27,
    league: 'NBA',
    team: contender,
    ovr: 86,
    role: '팀 에이스',
    coachTrust: 84,
    contractType: 'NBA_STANDARD',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        teamId: contender.id,
        teamName: contender.name,
        ovr: 86,
        role: '팀 에이스',
        mpg: 35.1,
        ppg: 25.4,
        rpg: 6.1,
        apg: 6.3,
      }),
    ],
  });
  const faOptions = generateOffseasonOptions(faStar, () => 0.42);
  const nbaOffers = faOptions.filter(
    (o) => o.targetLeague === 'NBA' && (o.annualSalary || 0) > 0
  );
  assert.ok(nbaOffers.length >= 3, 'NBA FA star must receive at least 3 NBA offers');
  const uniqueNbaSalaries = new Set(nbaOffers.map((o) => o.annualSalary));
  assert.ok(
    uniqueNbaSalaries.size >= 2,
    `NBA FA offers must have differentiated salaries per team, got ${[...uniqueNbaSalaries].join(', ')}`
  );

  // Same check for KBL FA star
  const kblFa = createBaseCareer({
    age: 26,
    league: 'KBL',
    team: KBL_TEAMS[0],
    ovr: 78,
    role: '팀 에이스',
    coachTrust: 82,
    contractType: 'KBL_MAX',
    contractYearsLeft: 0,
    seasonLogs: [
      createSeasonLog({
        league: 'KBL',
        teamId: KBL_TEAMS[0].id,
        teamName: KBL_TEAMS[0].name,
        ovr: 78,
        role: '팀 에이스',
        mpg: 34.0,
        ppg: 20.5,
      }),
    ],
  });
  const kblFaOpts = generateOffseasonOptions(kblFa, () => 0.4);
  const kblOffers = kblFaOpts.filter(
    (o) => o.targetLeague === 'KBL' && (o.annualSalary || 0) > 0
  );
  const uniqueKblSalaries = new Set(kblOffers.map((o) => o.annualSalary));
  assert.ok(
    uniqueKblSalaries.size >= 2,
    `KBL FA offers must have differentiated salaries per team, got ${[...uniqueKblSalaries].join(', ')}`
  );
});

test('37. Three Independent Authentic Overseas Leagues (B.League, NBL, EuroLeague) Structure & Playoffs', () => {
  // 1) Authentic team counts and regular-season schedules
  assert.equal(B_LEAGUE_TEAMS.length, 26, 'B.League B1 2025-26 must have all 26 clubs (East 13 + West 13)');
  assert.equal(NBL_TEAMS.length, 10, 'Australian NBL must have all 10 real clubs');
  assert.equal(EUROLEAGUE_TEAMS.length, 20, 'EuroLeague must have 20 real clubs');
  assert.equal(LEAGUE_CONFIG.B_LEAGUE.gamesPerSeason, 60);
  assert.equal(LEAGUE_CONFIG.NBL.gamesPerSeason, 29);
  assert.equal(LEAGUE_CONFIG.EUROLEAGUE.gamesPerSeason, 38);

  // 2) B.League 8-team playoff: East top 2 + West top 2 + 4 wildcards -> QF BO3 -> SF BO3 -> Finals BO3
  const bLeagueCareer = createBaseCareer({
    age: 25,
    league: 'B_LEAGUE',
    team: B_LEAGUE_TEAMS[0],
    ovr: 76,
    contractType: 'BLEAGUE_CONTRACT',
    seasonLogs: [],
  });
  const bStandings = generateLeagueStandings(bLeagueCareer, 46, 14, () => 0.5);
  assert.equal(bStandings.length, 26);
  assert.equal(bStandings.filter((s) => s.qualifiedPlayoffs).length, 8);
  const bBracket = createPlayoffBracket(bLeagueCareer, bStandings);
  assert.equal(bBracket.stageType, 'MAIN_PLAYOFF');
  assert.equal(bBracket.totalRounds, 3);
  assert.equal(bBracket.rounds[0].length, 4, 'B.League QF must have 4 matchups (8 teams)');
  assert.equal(bBracket.rounds[0][0].bestOf, 3, 'B.League QF must be BO3');
  const bFinished = skipEntirePlayoffs(bBracket, bLeagueCareer, bStandings, () => 0.45);
  assert.equal(bFinished.rounds[1][0].bestOf, 3, 'B.League SF must be BO3');
  assert.equal(bFinished.rounds[2][0].bestOf, 3, 'B.League Finals must be BO3');

  // 3) NBL 6-team Finals: Seeds 1-2 bye, 3-6 2-step Play-In BO1 -> SF BO3 -> Championship Series BO5
  const nblCareer = createBaseCareer({
    age: 25,
    league: 'NBL',
    team: NBL_TEAMS[0],
    ovr: 78,
    contractType: 'NBL_CONTRACT',
    seasonLogs: [],
  });
  const nblStandings = generateLeagueStandings(nblCareer, 22, 7, () => 0.5);
  assert.equal(nblStandings.length, 10);
  assert.equal(nblStandings.filter((s) => s.playInQualified).length, 4, 'NBL seeds 3-6 enter Play-In');
  const nblPiStandings = nblStandings.map((s) => ({ ...s, isPlayerTeam: s.rank === 4 }));
  const nblPiCareer = createBaseCareer({
    ...nblCareer,
    team: nblPiStandings.find((s) => s.isPlayerTeam)!.team,
  });
  const nblBracket = createPlayoffBracket(nblPiCareer, nblPiStandings, () => 0.45);
  assert.equal(nblBracket.stageType, 'PLAY_IN_ROUND_1', 'NBL 3-6 seed must open with 2-step Play-In (3v4 Seeding + 5v6 Qualifier)');
  assert.equal(nblBracket.rounds[0].length, 2);
  assert.equal(nblBracket.rounds[0][0].bestOf, 1);
  const nblFinished = skipEntirePlayoffs(nblBracket, nblPiCareer, nblPiStandings, () => 0.45);
  assert.equal(nblFinished.stageType, 'MAIN_PLAYOFF');
  assert.equal(nblFinished.rounds[0].length, 2, 'NBL Main PO SF must have 2 series');
  assert.equal(nblFinished.rounds[0][0].bestOf, 3, 'NBL SF must be BO3');
  assert.equal(nblFinished.rounds[1][0].bestOf, 5, 'NBL Championship Series must be BO5');

  // 4) EuroLeague: 7-10 Play-In BO1 -> QF BO5 -> Final Four SF BO1 -> Final Four Championship BO1
  const elCareer = createBaseCareer({
    age: 26,
    league: 'EUROLEAGUE',
    team: EUROLEAGUE_TEAMS[0],
    ovr: 82,
    contractType: 'EUROLEAGUE_CONTRACT',
    seasonLogs: [],
  });
  const elStandings = generateLeagueStandings(elCareer, 28, 10, () => 0.5);
  assert.equal(elStandings.length, 20);
  assert.equal(elStandings.filter((s) => s.qualifiedPlayoffs).length, 10, 'EuroLeague postseason = 6 direct + 4 Play-In');
  assert.equal(elStandings.filter((s) => s.playInQualified).length, 4, 'EuroLeague Play-In = seeds 7-10');
  const elPiStandings = elStandings.map((s) => ({ ...s, isPlayerTeam: s.rank === 8 }));
  const elPiCareer = createBaseCareer({
    ...elCareer,
    team: elPiStandings.find((s) => s.isPlayerTeam)!.team,
  });
  const elBracket = createPlayoffBracket(elPiCareer, elPiStandings, () => 0.45);
  assert.equal(elBracket.stageType, 'PLAY_IN_ROUND_1', 'EuroLeague 7-10 seed must open with Play-In');
  assert.equal(elBracket.rounds[0].length, 2, 'EuroLeague Play-In R1 has 7v8 and 9v10');
  assert.equal(elBracket.rounds[0][0].bestOf, 1);
  const elFinished = skipEntirePlayoffs(elBracket, elPiCareer, elPiStandings, () => 0.45);
  assert.equal(elFinished.stageType, 'MAIN_PLAYOFF');
  assert.equal(elFinished.rounds[0].length, 4, 'EuroLeague QF must have 4 series (8 teams)');
  assert.equal(elFinished.rounds[0][0].bestOf, 5, 'EuroLeague QF must be BO5');
  assert.equal(elFinished.rounds[1][0].bestOf, 1, 'EuroLeague Final Four SF must be BO1');
  assert.equal(elFinished.rounds[2][0].bestOf, 1, 'EuroLeague Final Four Finals must be BO1');

  // 5) Separate record books for all 3 overseas leagues
  const book = createInitialRecordBook();
  assert.equal(book.B_LEAGUE.length, 7);
  assert.equal(book.NBL.length, 7);
  assert.equal(book.EUROLEAGUE.length, 8);
  assert.ok(book.EUROLEAGUE.some((r) => r.category === 'FINALS_MVPS'));
});

test('38. 4-Axis Relationships, Multi-Season Story Arcs (6 Core Stats/Traits) & Legacy Save Migration', () => {
  const proCareer = createBaseCareer({
    league: 'NBA',
    seasonYear: 2029,
    seasonsPlayed: 3,
    ovr: 84,
    coachTrust: 82,
    team: NBA_TEAMS[0],
    traits: ['CLUTCH_PERFORMER', 'IRON_STAMINA'],
    stats: { ins: 82, out: 85, ply: 84, def: 80, reb: 72, phy: 82 },
    relationships: { coachTrust: 82, lockerRoom: 80, frontOffice: 78, mediaFan: 80 },
    rivals: [
      {
        id: 'RIV_1',
        name: '박라이벌',
        draftYear: 2027,
        league: 'NBA',
        teamId: NBA_TEAMS[1].id,
        teamName: NBA_TEAMS[1].name,
        teamShortName: NBA_TEAMS[1].shortName,
        pos: 'PG',
        ovr: 83,
        potential: 90,
        ppg: 20.1,
        rpg: 4.5,
        apg: 7.2,
        championships: 0,
        mvps: 0,
        allStars: 1,
        roys: 0,
        lastHeadline: '',
      },
    ],
  });

  // 1) All 4 story arcs x 3 stages have clean journalism copy and an exclusive gated 3rd choice
  const arcIds = [
    'COACH_TACTICS_ARC',
    'RIVAL_DESTINY_ARC',
    'BRAND_EMPIRE_ARC',
    'NATIONAL_TORCH_ARC',
  ] as const;

  for (const arcId of arcIds) {
    for (const stage of [1, 2, 3]) {
      const evt = buildStoryArcEventById(proCareer, arcId, stage);
      assert.equal(evt.arcId, arcId);
      assert.equal(evt.arcStage, stage);
      assert.equal(evt.choices.length, 3);
      assert.equal(evt.choices[2].isExclusiveChoice, true);
      assert.ok(
        !/(?:예요|이에요|해요|있어요|돼요)\.$/.test(evt.description),
        `Arc ${arcId} S${stage} description must use sports journalism tone`
      );
      for (const ch of evt.choices) {
        assert.ok(
          !/(?:예요|이에요|해요|있어요|돼요)\.$/.test(ch.description),
          `Arc ${arcId} S${stage} choice description must use sports journalism tone`
        );
      }
    }
  }

  // 2) Exclusive choice unlock check based on 6 core stats & relationships (no secondary metrics)
  const coachS1 = buildStoryArcEventById(proCareer, 'COACH_TACTICS_ARC', 1);
  const exclusiveChoice = coachS1.choices[2];
  const unlockedRes = checkEncounterChoiceUnlock(proCareer, exclusiveChoice);
  assert.equal(unlockedRes.unlocked, true, 'High-PLY career must unlock Coach S1 exclusive choice');

  const rookieCareer = createBaseCareer({
    league: 'NBA',
    stats: { ins: 65, out: 65, ply: 58, def: 62, reb: 60, phy: 64 },
    relationships: { coachTrust: 50, lockerRoom: 50, frontOffice: 50, mediaFan: 40 },
  });
  const lockedRes = checkEncounterChoiceUnlock(rookieCareer, exclusiveChoice);
  assert.equal(lockedRes.unlocked, false, 'Low-PLY career must NOT unlock Coach S1 exclusive choice');
  assert.ok(lockedRes.missingSummary && lockedRes.missingSummary.includes('패스'));

  // 3) Encounter resolution updates core stats, relationships, and arcAdvance cleanly
  const resolved = resolveEncounterChoiceOutcome(proCareer, coachS1, exclusiveChoice, () => 0.1);
  assert.ok((resolved.result.statChanges?.ply || 0) > 0);
  assert.ok((resolved.result.relationshipChanges?.lockerRoom || 0) > 0);
  assert.equal(resolved.arcAdvance?.arcId, 'COACH_TACTICS_ARC');
  assert.equal(resolved.arcAdvance?.nextStage, 1);
  assert.ok(resolved.result.arcProgressNote);

  // 4) Story arc roller respects cooldown and fires for eligible pro career
  const rolledArc = rollStoryArcEvent(proCareer, () => 0.1);
  assert.ok(rolledArc && rolledArc.arcId, 'rollStoryArcEvent must trigger eligible arc for pro career');

  // 5) Legacy save migration: OVERSEAS -> B_LEAGUE/NBL/EUROLEAGUE, strip removed secondary/tiered fields, keep relationships & storyArcs
  const legacyOverseasCareer = {
    ...createBaseCareer({
      league: 'B_LEAGUE',
      team: { ...EUROLEAGUE_TEAMS[0], league: 'OVERSEAS' as unknown as CareerState['league'] },
      coachTrust: 74,
      relationships: undefined,
      storyArcs: undefined,
      seasonLogs: [
        createSeasonLog({
          league: 'OVERSEAS' as unknown as CareerState['league'],
          leagueName: '해외 프로리그 (유럽/아시아)',
          teamId: 'OVR_REALMADRID',
          teamName: '레알 마드리드 발론세스토',
        }),
      ],
    }),
    league: 'OVERSEAS',
    contractType: 'OVERSEAS_CONTRACT',
    secondaryMetrics: { clutch: 77, mental: 80, condition: 65 },
    tieredBadges: [{ id: 'DEEP_RANGE_SHOOTER', tier: 'GOLD' }],
    badgeTrackers: { highThreeSeasons: 3 },
  } as unknown as CareerState;

  const migrated = migratePersistedPayload({
    career: legacyOverseasCareer,
    hofList: [],
    recordBook: createInitialRecordBook(),
  });
  assert.equal(migrated.career?.league, 'EUROLEAGUE', 'Legacy Real Madrid OVERSEAS save must migrate to EUROLEAGUE');
  assert.equal(migrated.career?.contractType, 'EUROLEAGUE_CONTRACT', 'Legacy OVERSEAS_CONTRACT must migrate to EUROLEAGUE_CONTRACT');
  assert.equal(migrated.career?.seasonLogs[0].league, 'EUROLEAGUE');
  assert.equal(
    'secondaryMetrics' in (migrated.career as unknown as Record<string, unknown>),
    false,
    'Legacy secondaryMetrics must be stripped on migration'
  );
  assert.equal(
    'tieredBadges' in (migrated.career as unknown as Record<string, unknown>),
    false,
    'Legacy tieredBadges must be stripped on migration'
  );
  assert.equal(
    'badgeTrackers' in (migrated.career as unknown as Record<string, unknown>),
    false,
    'Legacy badgeTrackers must be stripped on migration'
  );
  assert.equal(migrated.career?.relationships?.coachTrust, 74, 'Legacy save must sync relationships.coachTrust');
  assert.ok(migrated.career?.storyArcs?.COACH_TACTICS_ARC, 'Legacy save must hydrate all 4 storyArcs');
});

test('39. Authentic League Expansion Across All 9 Leagues (Team Counts, Schedules & Postseason Formats)', () => {
  // Exact real-world team counts
  assert.equal(HIGH_SCHOOL_TEAMS.length, 30);
  assert.equal(U_LEAGUE_TEAMS.length, 12);
  assert.equal(KBL_TEAMS.length, 10);
  assert.equal(B_LEAGUE_TEAMS.length, 26);
  assert.equal(NBL_TEAMS.length, 10);
  assert.equal(EUROLEAGUE_TEAMS.length, 20);
  assert.equal(GLEAGUE_TEAMS.length, 31);
  assert.equal(NCAA_TEAMS.length, 32);
  assert.equal(NBA_TEAMS.length, 30);
  assert.equal(ALL_TEAMS.length, 202, '201 league clubs + 1 Sangmu military club = 202');
  assert.equal(LEAGUE_CONFIG.U_LEAGUE.gamesPerSeason, 16);

  // G League: 31 teams (East 16 / West 15), 12-team conference PO (R1 BO1 -> R2 BO1 w/ 1-2 bye -> CF BO1 -> Finals BO3)
  const gCareer = createBaseCareer({ league: 'GLEAGUE', team: GLEAGUE_TEAMS[0], ovr: 76 });
  const gStandings = generateLeagueStandings(gCareer, 36, 14, () => 0.5);
  assert.equal(gStandings.length, 31);
  assert.equal(gStandings.filter((s) => s.conference === 'EAST').length, 16);
  assert.equal(gStandings.filter((s) => s.conference === 'WEST').length, 15);
  assert.equal(gStandings.filter((s) => s.qualifiedPlayoffs).length, 12);
  const gBracket = createPlayoffBracket(gCareer, gStandings);
  assert.equal(gBracket.totalRounds, 4);
  assert.equal(gBracket.rounds[0].length, 4, 'G League R1 has 4 games (East 3v6, 4v5 + West 3v6, 4v5)');
  assert.equal(gBracket.rounds[0][0].bestOf, 1);
  const gFinished = skipEntirePlayoffs(gBracket, gCareer, gStandings, () => 0.45);
  assert.equal(gFinished.rounds[3][0].bestOf, 3, 'G League Finals must be BO3');

  // NCAA: 32 teams, 16-team Sweet 16 single-elimination BO1
  const ncaaCareer = createBaseCareer({ league: 'NCAA', team: NCAA_TEAMS[0], ovr: 72 });
  const ncaaStandings = generateLeagueStandings(ncaaCareer, 28, 7, () => 0.5);
  assert.equal(ncaaStandings.length, 32);
  assert.equal(ncaaStandings.filter((s) => s.qualifiedPlayoffs).length, 16);
  const ncaaBracket = createPlayoffBracket(ncaaCareer, ncaaStandings);
  assert.equal(ncaaBracket.totalRounds, 4);
  assert.equal(ncaaBracket.rounds[0].length, 8, 'NCAA Sweet 16 must have 8 matchups');
  assert.equal(ncaaBracket.rounds[0][0].bestOf, 1);
  const ncaaFinished = skipEntirePlayoffs(ncaaBracket, ncaaCareer, ncaaStandings, () => 0.45);
  assert.equal(ncaaFinished.rounds.length, 4);
  assert.ok(ncaaFinished.championTeamId);

  // U-League & High School: 8-team single-elimination BO1
  for (const [leagueId, teamObj, wins, losses] of [
    ['U_LEAGUE', U_LEAGUE_TEAMS[0], 13, 3],
    ['HIGH_SCHOOL', HIGH_SCHOOL_TEAMS[0], 24, 6],
  ] as const) {
    const c = createBaseCareer({ league: leagueId, team: teamObj, ovr: 68 });
    const st = generateLeagueStandings(c, wins, losses, () => 0.5);
    assert.equal(st.filter((s) => s.qualifiedPlayoffs).length, 8);
    const br = createPlayoffBracket(c, st);
    assert.equal(br.totalRounds, 3);
    assert.equal(br.rounds[0].length, 4);
    assert.equal(br.rounds[0][0].bestOf, 1);
    const fin = skipEntirePlayoffs(br, c, st, () => 0.45);
    assert.ok(fin.championTeamId);
  }
});

test('40. Position-Aware Encounter Filtering & 15 Guard/Wing/Big Specialized Scenarios', () => {
  // 1) All 15 new scenarios exist and are emoji-free
  const newCodes = [
    'GRD_01', 'GRD_02', 'GRD_03', 'GRD_04', 'GRD_05',
    'WNG_01', 'WNG_02', 'WNG_03', 'WNG_04', 'WNG_05',
    'BIG_01', 'BIG_02', 'BIG_03', 'BIG_04', 'BIG_05',
  ];
  for (const code of newCodes) {
    const found = ENCOUNTER_SCENARIO_POOL.find((s) => s.id === `EVT_COMB_${code}`);
    assert.ok(found, `Missing new position-specialized encounter ${code}`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(found.title + found.description), `${code} must contain zero emojis`);
  }

  // LCK_04 wording is position-neutral
  const lck04 = ENCOUNTER_SCENARIO_POOL.find((s) => s.id === 'EVT_COMB_LCK_04');
  assert.ok(lck04 && !lck04.description.includes('주전 가드와 함께'));

  // 2) 200 rolls for PG must NEVER surface Big-only scenarios (POS_04, POS_05, POS_06, BIG_*)
  const pgCareer = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    primaryPos: 'PG',
    heightCm: 190,
    age: 24,
    ovr: 82,
    storyArcs: {
      COACH_TACTICS_ARC: { stage: 3, completed: true, lastTriggeredYear: 2029, history: [] },
      RIVAL_DESTINY_ARC: { stage: 3, completed: true, lastTriggeredYear: 2029, history: [] },
      BRAND_EMPIRE_ARC: { stage: 3, completed: true, lastTriggeredYear: 2029, history: [] },
      NATIONAL_TORCH_ARC: { stage: 3, completed: true, lastTriggeredYear: 2029, history: [] },
    },
  });
  let pgSeed = 11;
  const pgRng = () => {
    pgSeed = (pgSeed * 16807) % 2147483647;
    return (pgSeed - 1) / 2147483646;
  };
  let guardSpecHits = 0;
  for (let i = 0; i < 200; i++) {
    const evt = rollCombinatorialEncounter(pgCareer, pgRng);
    assert.ok(
      !evt.id.includes('_BIG_') &&
        evt.id !== 'EVT_COMB_POS_04' &&
        evt.id !== 'EVT_COMB_POS_05' &&
        evt.id !== 'EVT_COMB_POS_06',
      `PG must never roll Big-only encounter, got ${evt.id}`
    );
    if (evt.id.includes('_GRD_')) guardSpecHits++;
  }
  assert.ok(guardSpecHits > 0, 'PG must surface guard-specialized encounters');

  // 3) 200 rolls for C must NEVER surface Guard-only or OFF_03 scenarios
  const cCareer = createBaseCareer({
    ...pgCareer,
    primaryPos: 'C',
    heightCm: 213,
  });
  let cSeed = 37;
  const cRng = () => {
    cSeed = (cSeed * 16807) % 2147483647;
    return (cSeed - 1) / 2147483646;
  };
  let bigSpecHits = 0;
  for (let i = 0; i < 200; i++) {
    const evt = rollCombinatorialEncounter(cCareer, cRng);
    assert.ok(
      !evt.id.includes('_GRD_') &&
        !evt.id.includes('_WNG_') &&
        evt.id !== 'EVT_COMB_TAC_03' &&
        evt.id !== 'EVT_COMB_TRN_04' &&
        evt.id !== 'EVT_COMB_OFF_03',
      `Center must never roll Guard/Wing-only encounter, got ${evt.id}`
    );
    if (evt.id.includes('_BIG_')) bigSpecHits++;
  }
  assert.ok(bigSpecHits > 0, 'Center must surface big-man specialized encounters');
});

test('41. Position-Realistic Playstyles, Badges, Sniper 3PA Gate & Save/Switch Reconciliation', () => {
  // 1) 500 rolls per position must strictly stay inside ALLOWED_PLAYSTYLES_BY_POS
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
  let s = 91;
  const rng = () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (const pos of positions) {
    const height = pos === 'PG' ? 188 : pos === 'SG' ? 196 : pos === 'SF' ? 203 : pos === 'PF' ? 208 : 214;
    for (let i = 0; i < 500; i++) {
      const stats = createInitialStats(pos, height, rng);
      const { playstyle } = rollPlayerDnaAndPlaystyle(stats, pos, rng);
      assert.equal(
        isPlaystyleAllowedForPosition(playstyle, pos),
        true,
        `Position ${pos} rolled forbidden playstyle ${playstyle}`
      );
      if (pos === 'PF' || pos === 'C') {
        assert.notEqual(playstyle, 'THREE_AND_D', `${pos} must never be assigned THREE_AND_D`);
      } else {
        assert.notEqual(playstyle, 'RIM_PROTECTOR');
        assert.notEqual(playstyle, 'STRETCH_BIG');
        assert.notEqual(playstyle, 'POST_SCORER');
      }
    }
  }

  // 2) Position switch reconciliation: THREE_AND_D -> STRETCH_BIG when switching to PF/C
  const bigShootingStats = { ins: 76, out: 80, ply: 60, def: 75, reb: 80, phy: 76 };
  assert.equal(reconcilePlaystyleForPosition('THREE_AND_D', bigShootingStats, 'C'), 'STRETCH_BIG');
  assert.equal(reconcilePlaystyleForPosition('THREE_AND_D', bigShootingStats, 'PF'), 'STRETCH_BIG');
  assert.equal(getPlaystyleInfo('THREE_AND_D', 'PG').label, '3&D 가드');
  assert.equal(getPlaystyleInfo('THREE_AND_D', 'SF').label, '3&D 윙');

  // 3) Position-aware badges: Center gets '페인트존 수비수' (def 78~84) & '하이포스트 패싱 허브', Guard gets '퍼리미터 수비수' & '1옵션 볼핸들러'
  const eliteStats = { ins: 86, out: 82, ply: 86, def: 81, reb: 85, phy: 84 };
  const cBadges = evaluatePlayerBadges(eliteStats, null, 'BALANCED', 'STRETCH_BIG', [], 'C');
  assert.ok(cBadges.includes('페인트존 수비수'), `Center must get 페인트존 수비수, got ${cBadges.join(', ')}`);
  assert.ok(cBadges.includes('하이포스트 패싱 허브'), `Center must get 하이포스트 패싱 허브, got ${cBadges.join(', ')}`);
  assert.ok(!cBadges.includes('퍼리미터 수비수'));
  assert.ok(!cBadges.includes('1옵션 볼핸들러'));

  const pgBadges = evaluatePlayerBadges(eliteStats, null, 'BALANCED', 'PLAYMAKER', [], 'PG');
  assert.ok(pgBadges.includes('퍼리미터 수비수'));
  assert.ok(pgBadges.includes('1옵션 볼핸들러'));

  // 4) SNIPER trait requires 3PA volume gate (low-volume 42% 3P% Center does NOT unlock SNIPER)
  const lowVolCenter = createBaseCareer({
    primaryPos: 'C',
    heightCm: 214,
    traits: [],
    stats: { ins: 84, out: 76, ply: 60, def: 82, reb: 86, phy: 80 },
  });
  const lowVolBox = {
    gp: 70, mpg: 32, ppg: 18, rpg: 11, apg: 2.5, spg: 0.7, bpg: 2.1,
    fgPct: 58, tpPct: 42.5, tpa: 0.9, ftPct: 76, singleGameHighPts: 34, injuredGamesMissed: 0,
  };
  const traitsLowVol = evaluateAcquiredTraits(lowVolCenter, lowVolBox, lowVolCenter.stats, []);
  assert.ok(!traitsLowVol.nextTraits.includes('SNIPER'), 'Low 3PA volume center must not acquire SNIPER');

  const highVolBox = { ...lowVolBox, tpa: 4.2 };
  const traitsHighVol = evaluateAcquiredTraits(lowVolCenter, highVolBox, lowVolCenter.stats, []);
  assert.ok(traitsHighVol.nextTraits.includes('SNIPER'), 'High 3PA volume stretch center with >=39.5% 3P% can acquire SNIPER');

  // 5) Legacy save with Center + THREE_AND_D auto-heals on migration
  const brokenCenterSave = createBaseCareer({
    primaryPos: 'C',
    heightCm: 214,
    playstyle: 'THREE_AND_D',
    stats: { ins: 82, out: 78, ply: 62, def: 84, reb: 86, phy: 80 },
    badges: ['3&D 윙', '퍼리미터 수비수'],
  });
  const healed = migratePersistedPayload({
    career: brokenCenterSave,
    hofList: [],
    recordBook: createInitialRecordBook(),
  });
  assert.equal(healed.career?.playstyle, 'STRETCH_BIG');
  assert.ok(healed.career?.badges.includes('페인트존 수비수'));
  assert.ok(!healed.career?.badges.includes('퍼리미터 수비수'));
});

test('42. Multi-Year Contract Blocks Cross-League Offers & Generates Stay + Multi-Team Trade Review Candidates', () => {
  const kblUnderContract = createBaseCareer({
    league: 'KBL',
    team: KBL_TEAMS[0],
    age: 22,
    ovr: 79,
    contractType: 'KBL_MAX',
    contractYearsLeft: 2,
    annualSalary: 520000,
    coachTrust: 75,
    draftStock: 75,
    promisedRole: 'ACE_FIRST_OPTION',
    seasonLogs: [
      {
        seasonNumber: 1,
        year: 2027,
        age: 21,
        league: 'KBL',
        leagueName: 'KBL',
        teamId: KBL_TEAMS[0].id,
        teamName: KBL_TEAMS[0].name,
        teamShortName: KBL_TEAMS[0].shortName,
        contractType: 'KBL_MAX',
        role: '프랜차이즈 1옵션 에이스',
        ovr: 79,
        gp: 54,
        injuredGamesMissed: 0,
        mpg: 33.5,
        ppg: 22.4,
        rpg: 5.1,
        apg: 6.3,
        spg: 1.5,
        bpg: 0.4,
        fgPct: 48.2,
        tpPct: 38.5,
        wins: 38,
        losses: 16,
        teamRank: 2,
        totalLeagueTeams: 10,
        playoffResult: 'PO 4강',
        salaryEarned: 520000,
        wonChampionship: false,
        wonMvp: false,
        wonFinalsMvp: false,
        wonDpoy: false,
        wonSixthMan: false,
        wonMip: false,
        wonRookieOfYear: false,
        allStarSelected: true,
        allLeagueTeam: 1,
        singleGameHighPts: 39,
        headline: 'KBL 정상급 활약',
        narrativeLog: [],
      },
    ],
  });

  const opts = generateOffseasonOptions(kblUnderContract, () => 0.4);
  const stayOpt = opts.find((o) => o.id === 'OPT_STAY_CURRENT_CONTRACT');
  assert.ok(stayOpt, 'Must offer OPT_STAY_CURRENT_CONTRACT when contractYearsLeft > 0');
  assert.equal(stayOpt.isExistingContract, true);
  assert.equal(stayOpt.contractYears, 2);

  // Cross-league offers and NBA draft MUST NOT appear while under multi-year contract
  const crossLeagueSignOpts = opts.filter(
    (o) =>
      o.actionType === 'SIGN_TEAM' ||
      o.actionType === 'ENTER_NBA_DRAFT' ||
      o.targetLeague !== 'KBL'
  );
  assert.equal(
    crossLeagueSignOpts.length,
    0,
    `Must NOT inject cross-league or FA offers while under contract, got: ${crossLeagueSignOpts.map((o) => o.id).join(', ')}`
  );

  // Multi-candidate trade requests (up to 3 distinct teams) with GM acceptance probability
  const tradeOpts = opts.filter((o) => o.actionType === 'REQUEST_TRADE');
  assert.ok(
    tradeOpts.length >= 2 && tradeOpts.length <= 3,
    `Expected 2~3 trade destination candidates, got ${tradeOpts.length}`
  );
  const uniqueTargetIds = new Set(tradeOpts.map((o) => o.targetTeam?.id));
  assert.equal(uniqueTargetIds.size, tradeOpts.length, 'Trade candidates must be distinct teams');
  for (const tOpt of tradeOpts) {
    assert.ok(
      typeof tOpt.tradeAcceptChancePct === 'number' &&
        tOpt.tradeAcceptChancePct >= 18 &&
        tOpt.tradeAcceptChancePct <= 94,
      `Expected valid tradeAcceptChancePct, got ${tOpt.tradeAcceptChancePct}`
    );
    assert.equal(tOpt.isExistingContract, true);
    assert.equal(tOpt.locked, false);
  }

  // When trade was already rejected this offseason, all trade options must be locked
  const rejectedOpts = generateOffseasonOptions(
    { ...kblUnderContract, tradeRequestedThisYear: true },
    () => 0.4
  );
  const lockedTrades = rejectedOpts.filter((o) => o.actionType === 'REQUEST_TRADE');
  assert.ok(lockedTrades.length >= 2);
  assert.ok(lockedTrades.every((o) => o.locked === true));

  // Verify brokenRolePromise significantly increases GM trade acceptance odds
  const normalProb = calculateOffseasonTradeAcceptProb(
    kblUnderContract,
    KBL_TEAMS[1],
    72
  );
  const brokenPromiseProb = calculateOffseasonTradeAcceptProb(
    { ...kblUnderContract, brokenRolePromise: true },
    KBL_TEAMS[1],
    72
  );
  assert.ok(
    brokenPromiseProb > normalProb + 0.15,
    `Broken role promise must boost trade approval odds (${normalProb} -> ${brokenPromiseProb})`
  );
});

test('43. Sangmu Discharge Contract Integrity & NBA Age-28 Military Deferral', () => {
  // 1) All 6 pro leagues map to their proper contract type on Sangmu discharge (zero NBA->B.League bug)
  assert.equal(getSangmuDischargeContractType('NBA', 90), 'NBA_MAX');
  assert.equal(getSangmuDischargeContractType('NBA', 80), 'NBA_STANDARD');
  assert.equal(getSangmuDischargeContractType('NBA', 72), 'NBA_VET_MIN');
  assert.equal(getSangmuDischargeContractType('GLEAGUE', 70), 'GLEAGUE_EXHIBIT');
  assert.equal(getSangmuDischargeContractType('EUROLEAGUE', 82), 'EUROLEAGUE_CONTRACT');
  assert.equal(getSangmuDischargeContractType('NBL', 74), 'NBL_CONTRACT');
  assert.equal(getSangmuDischargeContractType('B_LEAGUE', 72), 'BLEAGUE_CONTRACT');
  assert.equal(getSangmuDischargeContractType('KBL', 80), 'KBL_MAX');
  assert.equal(getSangmuDischargeContractType('KBL', 70), 'KBL_VET');
  assert.equal(getSangmuDischargeContractType('KBL', 62), 'KBL_ROOKIE');

  // 2) KBL player age 27 triggers Sangmu enlistment, NBA player age 27 & 28 deferred until age 29
  const kbl27 = createBaseCareer({
    league: 'KBL',
    team: KBL_TEAMS[0],
    age: 27,
    militaryExempt: false,
    militaryServiceSeasonsLeft: 0,
  });
  const kblEvt = rollSeasonEvent(kbl27, () => 0.99, 2033);
  assert.equal(kblEvt?.id, 'EVT_SANGMU_ENLISTMENT', 'Non-NBA age 27 must enlist');

  const nba27 = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    age: 27,
    ovr: 84,
    militaryExempt: false,
    militaryServiceSeasonsLeft: 0,
  });
  const nba27Evt = rollSeasonEvent(nba27, () => 0.99, 2033);
  assert.notEqual(nba27Evt?.id, 'EVT_SANGMU_ENLISTMENT', 'NBA age 27 must be deferred');

  const nba28 = { ...nba27, age: 28 };
  const nba28Evt = rollSeasonEvent(nba28, () => 0.99, 2035);
  assert.notEqual(nba28Evt?.id, 'EVT_SANGMU_ENLISTMENT', 'NBA age 28 must still be deferred');

  const nba29 = { ...nba27, age: 29 };
  const nba29Evt = rollSeasonEvent(nba29, () => 0.99, 2035);
  assert.equal(nba29Evt?.id, 'EVT_SANGMU_ENLISTMENT', 'NBA age 29 without exemption must enlist');
  assert.ok(nba29Evt?.subtitle.includes('연기 종료'));
});

test('44. High School Age-19 Graduation, Full 4-Year College & NBA Draft Age-22 Cap', () => {
  // 1) High school: age 18 with contractYearsLeft 1 advances; age 19 graduates with university offers
  const hs18 = createBaseCareer({
    league: 'HIGH_SCHOOL',
    team: HIGH_SCHOOL_TEAMS[0],
    age: 18,
    contractType: 'AMATEUR',
    contractYearsLeft: 1,
  });
  const hs18Opts = generateOffseasonOptions(hs18, () => 0.4);
  assert.equal(hs18Opts[0].id, 'OPT_HS_NEXT_GRADE');

  const hs19 = { ...hs18, age: 19, contractYearsLeft: 0, ovr: 68 };
  const hs19Opts = generateOffseasonOptions(hs19, () => 0.4);
  assert.ok(
    hs19Opts.some((o) => o.targetLeague === 'U_LEAGUE'),
    'Age 19 high school graduate must receive U-League offers'
  );

  // 2) College 4-year flow: age 22 with 1 year left can still stay for senior year
  const collegeSenior = createBaseCareer({
    league: 'U_LEAGUE',
    team: U_LEAGUE_TEAMS[0],
    age: 22,
    contractType: 'AMATEUR',
    contractYearsLeft: 1,
  });
  const colOpts = generateOffseasonOptions(collegeSenior, () => 0.4);
  assert.ok(
    colOpts.some((o) => o.id === 'OPT_COLLEGE_STAY'),
    'Age 22 college player with 1 year left must be able to complete 4th year'
  );

  // 3) NBA draft age cap: 22yo KBL FA eligible, 23yo KBL FA blocked from draft & gets NBA FA path when elite
  const kblFa22 = createBaseCareer({
    league: 'KBL',
    team: KBL_TEAMS[0],
    age: 22,
    ovr: 82,
    contractType: 'KBL_MAX',
    contractYearsLeft: 0,
    draftStock: 78,
    totals: {
      ...createBaseCareer().totals,
      nbaGp: 0,
    },
    seasonLogs: [
      {
        seasonNumber: 1, year: 2029, age: 21, league: 'KBL', leagueName: 'KBL',
        teamId: KBL_TEAMS[0].id, teamName: KBL_TEAMS[0].name, teamShortName: KBL_TEAMS[0].shortName,
        contractType: 'KBL_MAX', role: '프랜차이즈 1옵션 에이스', ovr: 82, gp: 54, injuredGamesMissed: 0,
        mpg: 34, ppg: 23.5, rpg: 6.2, apg: 6.5, spg: 1.6, bpg: 0.5, fgPct: 50.1, tpPct: 39.2,
        wins: 40, losses: 14, teamRank: 1, totalLeagueTeams: 10, playoffResult: '리그 우승',
        salaryEarned: 550000, wonChampionship: true, wonMvp: true, wonFinalsMvp: true,
        wonDpoy: false, wonSixthMan: false, wonMip: false, wonRookieOfYear: true,
        allStarSelected: true, allLeagueTeam: 1, singleGameHighPts: 41, headline: 'MVP', narrativeLog: [],
      },
    ],
  });
  const fa22Opts = generateOffseasonOptions(kblFa22, () => 0.4);
  assert.ok(
    fa22Opts.some((o) => o.actionType === 'ENTER_NBA_DRAFT'),
    '22yo KBL FA must remain eligible for NBA draft'
  );

  const kblFa23 = { ...kblFa22, age: 23 };
  const fa23Opts = generateOffseasonOptions(kblFa23, () => 0.4);
  assert.ok(
    !fa23Opts.some((o) => o.actionType === 'ENTER_NBA_DRAFT'),
    '23yo pro FA must NOT enter NBA rookie draft'
  );
  assert.ok(
    fa23Opts.some((o) => o.targetLeague === 'NBA' && o.actionType === 'SIGN_TEAM'),
    'Elite 23yo KBL FA must have direct NBA FA signing pathway'
  );
});

test('45. Rookie of the Year Duplicate Award Prevention Across Pro Leagues', () => {
  const kblSeasonLog = {
    seasonNumber: 1, year: 2027, age: 21, league: 'KBL' as const, leagueName: 'KBL',
    teamId: KBL_TEAMS[0].id, teamName: KBL_TEAMS[0].name, teamShortName: KBL_TEAMS[0].shortName,
    contractType: 'KBL_ROOKIE' as const, role: '주전 스타터', ovr: 76, gp: 54, injuredGamesMissed: 0,
    mpg: 30, ppg: 18, rpg: 4, apg: 5, spg: 1.2, bpg: 0.3, fgPct: 47, tpPct: 37,
    wins: 34, losses: 20, teamRank: 3, totalLeagueTeams: 10, playoffResult: 'PO 4강',
    salaryEarned: 100000, wonChampionship: false, wonMvp: false, wonFinalsMvp: false,
    wonDpoy: false, wonSixthMan: false, wonMip: false, wonRookieOfYear: true,
    allStarSelected: true, allLeagueTeam: 2 as const, singleGameHighPts: 31, headline: 'ROY', narrativeLog: [],
  };

  // Pure rookie in KBL (only amateur HS/college logs) -> eligible
  assert.equal(
    isEligibleForLeagueRookieAward({ league: 'KBL', age: 21, seasonLogs: [] }),
    true
  );

  // KBL veteran moving to B.League / NBL / G League -> NOT eligible for ROY again
  assert.equal(
    isEligibleForLeagueRookieAward({ league: 'B_LEAGUE', age: 24, seasonLogs: [kblSeasonLog] }),
    false
  );
  assert.equal(
    isEligibleForLeagueRookieAward({ league: 'NBL', age: 25, seasonLogs: [kblSeasonLog] }),
    false
  );

  // EuroLeague Rising Star: <= 22 allowed, 23+ blocked
  assert.equal(
    isEligibleForLeagueRookieAward({ league: 'EUROLEAGUE', age: 22, seasonLogs: [kblSeasonLog] }),
    true
  );
  assert.equal(
    isEligibleForLeagueRookieAward({ league: 'EUROLEAGUE', age: 23, seasonLogs: [kblSeasonLog] }),
    false
  );

  // NBA first season: overseas pro veteran IS eligible under real NBA rules
  assert.equal(
    isEligibleForLeagueRookieAward({ league: 'NBA', age: 24, seasonLogs: [kblSeasonLog] }),
    true
  );
});

test('46. Age 40+ Career Extension for Competitive Legends & Guaranteed Contract Protection', () => {
  // 40yo NBA legend maintaining high OVR continues playing
  const legend40 = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    age: 40,
    ovr: 86,
    contractType: 'NBA_STANDARD',
    contractYearsLeft: 0,
  });
  const elig40 = checkRetirementEligibility(legend40);
  assert.equal(elig40.canExtendPast40, true);
  assert.equal(elig40.isMandatoryAge40, false);

  // 40yo severely declined FA without contract -> mandatory retirement
  const declined40 = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    age: 40,
    ovr: 64,
    contractType: 'NBA_VET_MIN',
    contractYearsLeft: 0,
  });
  const eligDeclined40 = checkRetirementEligibility(declined40);
  assert.equal(eligDeclined40.isMandatoryAge40, true);

  // 45yo hard retirement cap applies even with high OVR
  const legend45 = { ...legend40, age: 45 };
  assert.equal(checkRetirementEligibility(legend45).isMandatoryAge40, true);

  // 36yo declined player with active guaranteed multi-year contract is NOT force-waived out of league
  const contractedVet = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    age: 36,
    ovr: 68,
    contractType: 'NBA_STANDARD',
    contractYearsLeft: 2,
  });
  assert.equal(checkRetirementEligibility(contractedVet).isOutOfLeague, false);
});

test('47. Contract Header & Existing-Contract Offer Formatters', () => {
  const proActive = createBaseCareer({
    league: 'KBL',
    team: KBL_TEAMS[0],
    contractType: 'KBL_MAX',
    contractYearsLeft: 2,
    annualSalary: 450000,
  });
  assert.equal(formatHeaderContractSummary(proActive), '$450K · 잔여 2년');
  assert.equal(
    formatHeaderContractSummary({ ...proActive, contractYearsLeft: 0 }),
    'FA 만료'
  );
  assert.equal(
    formatHeaderContractSummary({ ...proActive, militaryServiceSeasonsLeft: 1 }),
    '상무 · 잔여 1년'
  );
  assert.equal(
    formatHeaderContractSummary({
      ...proActive,
      league: 'HIGH_SCHOOL',
      contractType: 'AMATEUR',
      contractYearsLeft: 2,
      annualSalary: 0,
    }),
    '학생 · 고2'
  );
  assert.equal(
    formatHeaderContractSummary({
      ...proActive,
      league: 'U_LEAGUE',
      contractType: 'AMATEUR',
      contractYearsLeft: 1,
      annualSalary: 0,
    }),
    '학생 · 4학년'
  );
  assert.equal(
    formatSalaryOffer(450000, 2, { isExistingContract: true }),
    '기존 계약 $450K · 잔여 2년'
  );
  assert.equal(formatSalaryOffer(450000, 2), '$450K · 2년');
});

test('48. Retirement Retrospective Builder: Team Stints, Peak Season, Championship Chronicle & Trophy Cabinet', () => {
  const bos = NBA_TEAMS[0];
  const lal = NBA_TEAMS[1];
  const kbl = KBL_TEAMS[0];
  const hs = HIGH_SCHOOL_TEAMS[0];

  const logs = [
    createSeasonLog({
      seasonNumber: 1, year: 2026, age: 16, league: 'HIGH_SCHOOL', leagueName: '한국 고교농구',
      teamId: hs.id, teamName: hs.name, teamShortName: hs.shortName, ovr: 58, gp: 24,
      ppg: 20.0, rpg: 6.0, apg: 4.0, wonChampionship: true, wonMvp: false, wonFinalsMvp: false, allStarSelected: false,
    }),
    createSeasonLog({
      seasonNumber: 2, year: 2027, age: 17, league: 'KBL', leagueName: 'KBL',
      teamId: kbl.id, teamName: kbl.name, teamShortName: kbl.shortName, ovr: 74, gp: 54,
      ppg: 17.5, rpg: 5.0, apg: 4.5, wonChampionship: false, wonMvp: false, wonFinalsMvp: false, wonRookieOfYear: true, allStarSelected: true,
    }),
    createSeasonLog({
      seasonNumber: 3, year: 2028, age: 18, league: 'NBA', leagueName: 'NBA',
      teamId: bos.id, teamName: bos.name, teamShortName: bos.shortName, ovr: 86, gp: 80,
      ppg: 22.0, rpg: 6.0, apg: 6.0, wonChampionship: false, wonMvp: false, wonFinalsMvp: false, allStarSelected: true,
    }),
    createSeasonLog({
      seasonNumber: 4, year: 2029, age: 19, league: 'NBA', leagueName: 'NBA',
      teamId: bos.id, teamName: bos.name, teamShortName: bos.shortName, ovr: 95, gp: 82,
      ppg: 31.4, rpg: 8.2, apg: 7.5, wonChampionship: true, wonMvp: true, wonFinalsMvp: true, allStarSelected: true, allLeagueTeam: 1,
    }),
    createSeasonLog({
      seasonNumber: 5, year: 2030, age: 20, league: 'NBA', leagueName: 'NBA',
      teamId: lal.id, teamName: lal.name, teamShortName: lal.shortName, ovr: 92, gp: 78,
      ppg: 26.0, rpg: 7.0, apg: 6.5, wonChampionship: false, wonMvp: false, wonFinalsMvp: false, allStarSelected: true,
    }),
    createSeasonLog({
      seasonNumber: 6, year: 2031, age: 21, league: 'NBA', leagueName: 'NBA',
      teamId: bos.id, teamName: bos.name, teamShortName: bos.shortName, ovr: 91, gp: 76,
      ppg: 24.5, rpg: 6.8, apg: 6.2, wonChampionship: true, wonMvp: false, wonFinalsMvp: true, allStarSelected: true,
    }),
  ];

  const stints = buildTeamStints(logs);
  assert.equal(stints.length, 5, 'Returning to a former team after playing elsewhere must create a distinct stint');
  assert.equal(stints[2].teamId, bos.id);
  assert.equal(stints[2].seasons, 2);
  assert.equal(stints[2].startYear, 2028);
  assert.equal(stints[2].endYear, 2029);
  assert.equal(stints[4].teamId, bos.id);
  assert.equal(stints[4].seasons, 1);

  const retroCareer = createBaseCareer({
    id: 'RETRO_TEST',
    name: '김레전드',
    jerseyNumber: '7',
    age: 38,
    seasonsPlayed: 6,
    league: 'NBA',
    team: bos,
    seasonLogs: logs,
    internationalHistory: [
      {
        id: 'INTL_AG_2030',
        year: 2030,
        age: 20,
        tournamentType: 'ASIAN_GAMES',
        tournamentName: '아시안게임',
        result: 'GOLD',
        avgPts: 26.5,
        avgReb: 7.0,
        avgAst: 6.0,
        wonMvp: true,
        grantedMilitaryExemption: true,
        matches: [],
        summaryHeadline: '아시안게임 금메달',
      },
    ],
  });

  const evalLegacy = evaluateCareerLegacy(retroCareer);
  const recordBook = createInitialRecordBook();
  recordBook.NBA[0] = {
    ...recordBook.NBA[0],
    holderName: retroCareer.name,
    playerId: retroCareer.id,
    teamName: bos.name,
    year: 2029,
    value: 45000,
    isUserRecord: true,
  };

  const retro = buildCareerRetrospective(retroCareer, 'LEGEND_FAREWELL_TOUR', evalLegacy, recordBook);
  assert.equal(retro.peakSeason?.year, 2029, 'Peak season must select the dominant 2029 NBA MVP/FMVP championship season');
  assert.equal(retro.championships.length, 4, 'Championship chronicle must include HS + 2 NBA titles + 1 Asian Games GOLD');
  assert.ok(retro.championships.some((c) => c.isInternational && c.year === 2030));
  assert.ok(retro.trophies.some((t) => t.id === 'CHAMPIONSHIP' && t.count === 3));
  assert.ok(retro.trophies.some((t) => t.id === 'FINALS_MVP' && t.count === 2));
  assert.ok(retro.trophies.some((t) => t.id === 'INTL_MEDAL' && t.count === 1));
  assert.ok(retro.trophies.some((t) => t.id === 'LEAGUE_RECORD' && t.count === 1));
  assert.equal(retro.brokenRecords.length, 1);

  const noChampChronicle = buildChampionshipChronicle([
    createSeasonLog({ wonChampionship: false, playoffResult: '컨퍼런스 결승 탈락', wins: 52, losses: 30 }),
  ]);
  assert.equal(noChampChronicle.championships.length, 0);
  assert.ok(noChampChronicle.bestPlayoffNote?.includes('컨퍼런스 결승 탈락'));

  assert.ok(buildTrophyCabinet(logs).length >= 5);
  assert.equal(selectPeakSeason([]), null);
});

test('49. HallOfFameEntry Persists Retrospective & Legacy HOF Entry Fallback Compatibility', () => {
  const bos = NBA_TEAMS[0];
  const franchiseLogs = Array.from({ length: 10 }, (_, idx) =>
    createSeasonLog({
      seasonNumber: idx + 1,
      year: 2028 + idx,
      age: 20 + idx,
      league: 'NBA',
      leagueName: 'NBA',
      teamId: bos.id,
      teamName: bos.name,
      teamShortName: bos.shortName,
      ovr: 94,
      gp: 80,
      ppg: 27.5,
      rpg: 7.2,
      apg: 6.8,
      wonChampionship: idx < 3,
      wonMvp: idx < 3,
      wonFinalsMvp: idx < 2,
      allStarSelected: true,
    })
  );

  const legendCareer = createBaseCareer({
    id: 'HOF_RETRO_LEGEND',
    name: '이영구',
    jerseyNumber: '24',
    age: 37,
    seasonsPlayed: 10,
    league: 'NBA',
    team: bos,
    seasonLogs: franchiseLogs,
  });
  const evaluation = evaluateCareerLegacy(legendCareer);
  assert.equal(evaluation.jerseyRetired, true, '10-season Boston legend must earn jersey retirement');

  const hofEntry = buildHallOfFameEntry(legendCareer, 'VOLUNTARY_HONOR', evaluation);
  assert.ok(hofEntry.retrospective, 'Newly inducted HallOfFameEntry must include serialized retrospective snapshot');
  assert.equal(hofEntry.retrospective?.jerseyCeremony.jerseyRetired, true);
  assert.equal(hofEntry.retrospective?.stints.length, 1);
  assert.equal(hofEntry.retrospective?.seasons.length, 10);

  const legacyHofWithoutRetro = { ...hofEntry, retrospective: undefined };
  const fallback = buildFallbackRetrospectiveFromHof(legacyHofWithoutRetro);
  assert.equal(fallback.isFallback, true);
  assert.equal(fallback.playerName, '이영구');
  assert.equal(fallback.jerseyCeremony.jerseyRetired, true);
  assert.equal(fallback.stints.length, 1);
  assert.ok(fallback.trophies.length > 0);
});

test('50. Realistic NBA Aging Curve: 28-31 Peak, 32+ Accelerating Decline, No Defense-Stack Immortality', () => {
  const midRng = () => 0.5;
  const peakStats = { ins: 91, out: 92, ply: 90, def: 88, reb: 76, phy: 90 };
  const peakOvr = calculateOvr(peakStats, 'SG', 198);

  // 1) Standard NBA star ages 30 -> 39 with realistic cumulative mileage
  let stdStats = { ...peakStats };
  const stdOvrByAge: Record<number, number> = {};
  let stdMinutes = 20000;
  for (let age = 30; age <= 39; age++) {
    const res = applyAgingCurve(age, stdStats, midRng, {
      growthDna: 'STANDARD',
      careerMinutes: stdMinutes,
      hasBiomechLab: false,
      hasCampAgingShield: false,
      veteranReinvented: false,
    });
    stdStats = res.nextStats;
    stdOvrByAge[age] = calculateOvr(stdStats, 'SG', 198);
    stdMinutes += 2500;
  }

  assert.ok(
    stdOvrByAge[31] <= peakOvr,
    `Age 31 OVR (${stdOvrByAge[31]}) must not inflate above peak (${peakOvr})`
  );
  assert.ok(
    stdOvrByAge[34] < stdOvrByAge[31],
    `Age 34 OVR (${stdOvrByAge[34]}) must clearly decline from age 31 (${stdOvrByAge[31]})`
  );
  assert.ok(
    stdOvrByAge[38] <= stdOvrByAge[34] - 6,
    `Late-30s decline must accelerate: age 34 (${stdOvrByAge[34]}) -> age 38 (${stdOvrByAge[38]})`
  );
  assert.ok(
    stdStats.phy < stdStats.out,
    `Physical athleticism (PHY ${stdStats.phy}) must decline faster than shooting skill (OUT ${stdStats.out})`
  );

  // 2) Max-defense Ironman (IRONMAN + Biomech Lab + Camp Shield) still declines realistically due to 0.58x floor
  let ironStats = { ...peakStats };
  let ironMinutes = 20000;
  for (let age = 30; age <= 39; age++) {
    const res = applyAgingCurve(age, ironStats, midRng, {
      growthDna: 'IRONMAN',
      careerMinutes: ironMinutes,
      hasBiomechLab: true,
      hasCampAgingShield: true,
      veteranReinvented: true,
    });
    ironStats = res.nextStats;
    ironMinutes += 2500;
  }
  const ironOvr39 = calculateOvr(ironStats, 'SG', 198);
  assert.ok(
    ironOvr39 > stdOvrByAge[39],
    `Full-managed Ironman at 39 (${ironOvr39}) should age better than unmanaged Standard (${stdOvrByAge[39]})`
  );
  assert.ok(
    ironOvr39 <= peakOvr - 8,
    `Even max-defense Ironman must meaningfully decline by 39 (peak ${peakOvr} -> age 39 ${ironOvr39})`
  );

  // 3) Aging phase classifier matches progression stages
  assert.equal(getAgingPhaseInfo(22, 'STANDARD', 3000).phaseId, 'GROWTH');
  assert.equal(getAgingPhaseInfo(28, 'STANDARD', 14000).phaseId, 'PRIME');
  assert.equal(getAgingPhaseInfo(31, 'STANDARD', 21000).phaseId, 'VETERAN_MANAGE');
  assert.equal(getAgingPhaseInfo(35, 'STANDARD', 32000).phaseId, 'DECLINE');
});

test('51. Age 31+ Special Camps & Random Encounters Transition to Maintenance & Aging Defense', () => {
  const vet35 = createBaseCareer({
    age: 35,
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 86,
    potential: 92,
    trainingFocus: 'PHYSICAL_CONDITIONING',
    stats: { ins: 84, out: 87, ply: 86, def: 82, reb: 75, phy: 78 },
  });

  // 1) 31+ Special Camp options show veteran maintenance mode
  const campOpts = getSpecialCampOptions(vet35);
  assert.equal(campOpts[0].isVeteranMode, true);
  assert.ok(campOpts[0].effectText.includes('노쇠화'));

  // 2) LEGEND_SKILL_CAMP at 35 grants aging shield, zero potential gain, zero PHY gain
  const skillCamp = applySpecialCampProgram(vet35, 'LEGEND_SKILL_CAMP', () => 0.1);
  assert.equal(skillCamp.grantsAgingShield, true);
  assert.equal(skillCamp.nextPotential, vet35.potential, 'Age 31+ camp must never raise potential');
  assert.equal(skillCamp.nextStats.phy, vet35.stats.phy, 'Age 31+ camp must not boost PHY');
  assert.equal(skillCamp.nextStats.ins, vet35.stats.ins, 'Age 31+ camp must not boost INS');

  // 3) BULK_UP at 35 is zero-sum (+1/+1 vs -1/-1) instead of net +3
  const bulkCamp = applySpecialCampProgram(vet35, 'BULK_UP', () => 0.5);
  const prevSum = Object.values(vet35.stats).reduce((a, b) => a + b, 0);
  const nextSum = Object.values(bulkCamp.nextStats).reduce((a, b) => a + b, 0);
  assert.equal(nextSum, prevSum, 'Age 31+ BULK_UP must be a zero-sum body rebalance');

  // 4) Random Encounter stat filter at age 35 suppresses physical boosts & converts to shield/trust, preserves penalties
  const eventAdj = applyAgeAdjustedEventStatChanges(35, vet35.stats, {
    phy: 2,
    ins: 2,
    out: 2,
    def: -2,
  });
  assert.equal(eventAdj.adjustedChanges.phy, undefined, 'Age 34+ event must suppress positive PHY gain');
  assert.equal(eventAdj.adjustedChanges.ins, undefined, 'Age 34+ event must suppress positive INS gain');
  assert.equal(eventAdj.adjustedChanges.out, 1, 'Age 34+ event caps skill stat (<90) to +1');
  assert.equal(eventAdj.adjustedChanges.def, -2, 'Negative stat penalties must always apply in full');
  assert.equal(eventAdj.grantedAgingShield, true);
  assert.ok(eventAdj.convertedTrustBonus >= 2);
});

test('52. Exact Career Minutes Tracking & Heavy-Mileage Aging / Injury Penalty', () => {
  // Identical GP (800G), completely different MPG (38 MPG iron-starter vs 16 MPG bench)
  const heavyLogs = Array.from({ length: 10 }, (_, idx) =>
    createSeasonLog({
      seasonNumber: idx + 1,
      year: 2026 + idx,
      age: 21 + idx,
      gp: 80,
      mpg: 38.0,
    })
  );
  const lightLogs = Array.from({ length: 10 }, (_, idx) =>
    createSeasonLog({
      seasonNumber: idx + 1,
      year: 2026 + idx,
      age: 21 + idx,
      gp: 80,
      mpg: 16.0,
    })
  );

  const heavyMinutes = computeCareerMinutes({ seasonLogs: heavyLogs });
  const lightMinutes = computeCareerMinutes({ seasonLogs: lightLogs });
  assert.equal(heavyMinutes, 30400);
  assert.equal(lightMinutes, 12800);
  assert.ok(heavyMinutes > lightMinutes * 2);

  // Heavy mileage causes steeper decline at age 33 than low mileage with identical stats/DNA
  const stats = { ins: 86, out: 86, ply: 84, def: 84, reb: 78, phy: 84 };
  const heavyAging = applyAgingCurve(33, stats, () => 0.5, {
    growthDna: 'STANDARD',
    careerMinutes: heavyMinutes,
  });
  const lightAging = applyAgingCurve(33, stats, () => 0.5, {
    growthDna: 'STANDARD',
    careerMinutes: lightMinutes,
  });
  const heavySum = Object.values(heavyAging.nextStats).reduce((a, b) => a + b, 0);
  const lightSum = Object.values(lightAging.nextStats).reduce((a, b) => a + b, 0);
  assert.ok(
    heavySum < lightSum,
    `Heavy-mileage starter (sum ${heavySum}) must experience harsher aging than light-mileage vet (sum ${lightSum})`
  );
});

test('53. Realistic 3-Tier Injuries (30+ Major PHY Aftermath), Position FG%, and Veteran Load Management', () => {
  // 1) 30+ Major Injury triggers long absence (>=38% games) AND permanent PHY aftermath
  const vet35InjuryCareer = createBaseCareer({
    age: 35,
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 86,
    stats: { ins: 84, out: 86, ply: 84, def: 82, reb: 76, phy: 74 },
    totals: {
      gp: 900,
      minutes: 31000,
      points: 18000,
      rebounds: 4500,
      assists: 4000,
      steals: 1000,
      blocks: 400,
      nbaGp: 900,
      nbaPoints: 18000,
      championships: 1,
      nbaChampionships: 1,
      mvps: 0,
      nbaMvps: 0,
      finalsMvps: 0,
      dpoys: 0,
      sixthManAwards: 0,
      mips: 0,
      allLeagueSelections: 3,
      allStars: 5,
      nbaAllStars: 5,
    },
  });

  // Deterministic RNG sequence forcing injury trigger (0.01) -> MAJOR tier (0.01) -> label (0.0) -> mid-range miss (0.5)
  const majorRngSeq = [0.5, 0.5, 0.01, 0.01, 0.0, 0.5, 0.5, 0.5];
  let idx = 0;
  const majorRole = calculateRoleAndMpg(vet35InjuryCareer, () => {
    const v = majorRngSeq[Math.min(idx, majorRngSeq.length - 1)];
    idx += 1;
    return v;
  });
  assert.equal(majorRole.injurySeverity, 'MAJOR');
  assert.ok(majorRole.injuredGamesMissed >= 28, `Major NBA injury must miss >=28G, got ${majorRole.injuredGamesMissed}`);
  assert.equal(majorRole.injuryPermanentPhyPenalty, 3, 'Age 34+ major injury must apply permanent PHY -3 aftermath');
  assert.ok(majorRole.injuryLabel && majorRole.injuryLabel.length > 0);

  // Full season sim applies the permanent PHY penalty and records aftermath in narrative
  let simIdx = 0;
  const majorSim = simulateSeason(vet35InjuryCareer, () => {
    const v = majorRngSeq[Math.min(simIdx, majorRngSeq.length - 1)];
    simIdx += 1;
    return v;
  });
  assert.equal(majorSim.boxScore.injurySeverity, 'MAJOR');
  assert.equal(majorSim.boxScore.injuryPermanentPhyPenalty, 3);
  assert.ok(
    majorSim.boxScore.narrativeLog.some((line) => line.includes('중상 후유증')),
    'Season narrative must explicitly log 30+ major injury aftermath'
  );
  assert.ok(
    majorSim.nextStats.phy <= vet35InjuryCareer.stats.phy - 5,
    `Major injury aftermath + aging must noticeably reduce PHY (${vet35InjuryCareer.stats.phy} -> ${majorSim.nextStats.phy})`
  );

  // 2) Veteran Load Management caps MPG and healthy GP for age 37+ stars
  const vet38Star = createBaseCareer({
    age: 38,
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 92,
    coachTrust: 90,
    growthDna: 'STANDARD',
    traits: ['CLUTCH_PERFORMER'],
    stats: { ins: 88, out: 92, ply: 90, def: 84, reb: 76, phy: 82 },
  });
  // High rng (0.95) avoids injury so we measure healthy load-management caps
  const vet38Role = calculateRoleAndMpg(vet38Star, () => 0.95);
  assert.equal(vet38Role.veteranLoadManaged, true);
  assert.ok(vet38Role.mpg <= 30.5, `Age 38 standard star MPG must be load-managed (<=30.5), got ${vet38Role.mpg}`);
  assert.ok(vet38Role.gp <= 67, `Age 38 standard star healthy GP must be load-managed (<=67/82), got ${vet38Role.gp}`);

  const vet38Ironman = calculateRoleAndMpg(
    { ...vet38Star, growthDna: 'IRONMAN', traits: ['IRON_STAMINA'] },
    () => 0.95
  );
  assert.ok(
    vet38Ironman.mpg > vet38Role.mpg && vet38Ironman.mpg <= 32.0,
    `Age 38 Ironman should receive modest +1.5 MPG allowance (${vet38Ironman.mpg}) while still load-managed`
  );

  // 3) Position-based FG%: Traditional Center shoots significantly higher FG% than Point Guard with same offensive ratings
  const centerCareer = createBaseCareer({
    age: 26,
    league: 'NBA',
    team: NBA_TEAMS[0],
    primaryPos: 'C',
    heightCm: 213,
    playstyle: 'RIM_PROTECTOR',
    ovr: 86,
    stats: { ins: 86, out: 80, ply: 74, def: 86, reb: 90, phy: 84 },
  });
  const pgCareer = createBaseCareer({
    age: 26,
    league: 'NBA',
    team: NBA_TEAMS[0],
    primaryPos: 'PG',
    heightCm: 191,
    playstyle: 'PLAYMAKER',
    ovr: 86,
    stats: { ins: 86, out: 80, ply: 88, def: 80, reb: 64, phy: 84 },
  });
  const cSim = simulateSeason(centerCareer, () => 0.85);
  const pgSim = simulateSeason(pgCareer, () => 0.85);
  assert.ok(
    cSim.boxScore.fgPct >= pgSim.boxScore.fgPct + 6.0,
    `Center FG% (${cSim.boxScore.fgPct}%) must realistically exceed PG FG% (${pgSim.boxScore.fgPct}%) by >=6%p`
  );
  assert.ok(cSim.boxScore.fgPct >= 52.0, `Elite Center FG% should be >=52%, got ${cSim.boxScore.fgPct}%`);
});

test('54. Retirement Championship Chronicle Uses Official Taegeukgi Asset & Repairs Legacy HOF Saves', () => {
  const intlHistory = [
    {
      year: 2030,
      age: 24,
      tournamentType: 'ASIAN_GAMES' as const,
      tournamentName: '아시안게임',
      result: 'GOLD' as const,
      resultLabel: '금메달',
      wonMvp: true,
      avgPts: 22.4,
      avgReb: 5.2,
      avgAst: 6.8,
      militaryExemptionEarned: true,
    },
  ];
  const { championships } = buildChampionshipChronicle([], intlHistory);
  assert.equal(championships.length, 1);
  assert.equal(championships[0].isInternational, true);
  assert.equal(championships[0].teamId, 'KOR_NAT_TEAM');
  assert.equal(championships[0].logoUrl, '/logos/NAT_KOR.svg');

  const flagAssetPath = path.resolve(process.cwd(), 'public/logos/NAT_KOR.svg');
  assert.ok(fs.existsSync(flagAssetPath), 'public/logos/NAT_KOR.svg must exist');

  // Legacy HOF save with nonexistent /logos/kor_flag.svg and missing teamId is auto-repaired on migration
  const careerForHof = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    internationalHistory: intlHistory,
    seasonLogs: [createSeasonLog({ league: 'NBA', wonChampionship: true })],
  });
  const legacyEval = evaluateCareerLegacy(careerForHof);
  const retro = buildCareerRetrospective(careerForHof, 'VOLUNTARY_HONOR', legacyEval);
  const brokenLegacyRetro = {
    ...retro,
    championships: retro.championships.map((c) =>
      c.isInternational
        ? { ...c, teamId: undefined, logoUrl: '/logos/kor_flag.svg' }
        : c
    ),
  };
  const hofEntry = buildHallOfFameEntry(careerForHof, 'VOLUNTARY_HONOR', legacyEval);
  hofEntry.retrospective = brokenLegacyRetro;

  const migrated = migratePersistedPayload({
    career: careerForHof,
    hofList: [hofEntry],
    skipRecordSync: true,
  });

  const repairedHofChamp = migrated.hofList[0].retrospective?.championships.find(
    (c) => c.isInternational
  );
  assert.ok(repairedHofChamp);
  assert.equal(repairedHofChamp.teamId, 'KOR_NAT_TEAM');
  assert.equal(repairedHofChamp.logoUrl, '/logos/NAT_KOR.svg');
});

test('55. Amateur Leagues (High School, U-League, NCAA) & Military Service (Sangmu) Block Broken Role Promise & Trade Requests', () => {
  assert.equal(canUseProTradeSystem({ league: 'HIGH_SCHOOL', contractType: 'AMATEUR' }), false);
  assert.equal(canUseProTradeSystem({ league: 'U_LEAGUE', contractType: 'AMATEUR' }), false);
  assert.equal(canUseProTradeSystem({ league: 'NCAA', contractType: 'AMATEUR' }), false);
  assert.equal(
    canUseProTradeSystem({
      league: 'KBL',
      contractType: 'MILITARY_SERVICE',
      isMilitaryTeam: true,
      teamId: SANGMU_TEAM.id,
    }),
    false
  );
  assert.equal(
    canUseProTradeSystem({
      league: 'KBL',
      contractType: 'KBL_CONTRACT',
      isMilitaryTeam: false,
      teamId: KBL_TEAMS[0].id,
    }),
    true
  );

  // Even with ACE_FIRST_OPTION promise and very low OVR/trust (low MPG), HS/College/Sangmu must never set brokenRolePromise
  const nonProCases = [
    createBaseCareer({
      age: 17,
      league: 'HIGH_SCHOOL',
      team: HIGH_SCHOOL_TEAMS[0],
      contractType: 'AMATEUR',
      promisedRole: 'ACE_FIRST_OPTION',
      coachTrust: 15,
      ovr: 46,
      stats: { ins: 46, out: 46, ply: 46, def: 46, reb: 46, phy: 46 },
    }),
    createBaseCareer({
      age: 20,
      league: 'U_LEAGUE',
      team: U_LEAGUE_TEAMS[0],
      contractType: 'AMATEUR',
      promisedRole: 'STARTER_GUARANTEE',
      coachTrust: 15,
      ovr: 52,
      stats: { ins: 52, out: 52, ply: 52, def: 52, reb: 52, phy: 52 },
    }),
    createBaseCareer({
      age: 20,
      league: 'NCAA',
      team: NCAA_TEAMS[0],
      contractType: 'AMATEUR',
      promisedRole: 'STARTER_GUARANTEE',
      coachTrust: 15,
      ovr: 56,
      stats: { ins: 56, out: 56, ply: 56, def: 56, reb: 56, phy: 56 },
    }),
    createBaseCareer({
      age: 26,
      league: 'KBL',
      team: SANGMU_TEAM,
      contractType: 'MILITARY_SERVICE',
      promisedRole: 'ACE_FIRST_OPTION',
      coachTrust: 15,
      ovr: 60,
      stats: { ins: 60, out: 60, ply: 60, def: 60, reb: 60, phy: 60 },
      seasonsOnCurrentTeam: 3,
      brokenRolePromise: true,
    }),
  ];

  for (const c of nonProCases) {
    const sim = simulateSeason(c, () => 0.8);
    assert.equal(
      sim.brokenRolePromise,
      false,
      `${c.league}/${c.contractType} must never trigger brokenRolePromise`
    );
    assert.ok(
      !sim.boxScore.narrativeLog.some((line) => line.includes('트레이드 요청')),
      `${c.league}/${c.contractType} narrative must never suggest trade request`
    );

    // Mid-season crossroads must never trigger trade deadline rumor for amateur or Sangmu
    const midEvt = rollMidSeasonCrossroadsEvent(
      { ...c, seasonsOnCurrentTeam: 4, brokenRolePromise: true },
      () => 0.01
    );
    assert.ok(
      !midEvt.id.startsWith('EVT_MID_TRADE_DEADLINE'),
      `${c.league}/${c.contractType} must never trigger mid-season trade deadline rumor`
    );

    // Save migration auto-clears any stale brokenRolePromise saved in amateur or Sangmu
    const migrated = migratePersistedPayload({
      career: { ...c, brokenRolePromise: true },
      skipRecordSync: true,
    });
    assert.equal(
      migrated.career?.brokenRolePromise,
      false,
      `${c.league}/${c.contractType} save migration must clear stale brokenRolePromise`
    );
  }
});

test('56. Unified Sports-Documentary Korean Tone (합니다체) & Zero AI Clichés / Biomechanical Jargon', () => {
  const informalRe = /(해요|했어요|돼요|있어요|없어요|이에요|예요|거머쥐었어요|마셨어요|올렸어요|봐요|섰어요|찾아왔어요|보낼까요|택할까요|돌파되었어요|확장되었어요)/;
  const bannedJargonOrClicheRe = /(생체역학|물리적 부하|논란을 종결|마진이 폭등|브루클린 그린룸|과감한 승부수가 완벽하게|살아있는 전설|불꽃 튀는|빛을 발할)/;

  // 1) All encounter scenarios & chain followups
  for (const tpl of ENCOUNTER_SCENARIO_POOL) {
    const texts: string[] = [tpl.title, tpl.subtitle, tpl.description];
    for (const ch of tpl.choices) {
      texts.push(ch.label, ch.description);
      if (ch.successOutcome?.narrative) texts.push(ch.successOutcome.narrative);
      if (ch.failureOutcome?.narrative) texts.push(ch.failureOutcome.narrative);
      const chains = [
        ch.nextChainEvent,
        ch.successOutcome?.nextChainEvent,
        ch.failureOutcome?.nextChainEvent,
      ].filter(Boolean);
      for (const ce of chains) {
        if (!ce) continue;
        texts.push(ce.title, ce.subtitle, ce.description);
        for (const cch of ce.choices) {
          texts.push(cch.label, cch.description);
          if (cch.successOutcome?.narrative) texts.push(cch.successOutcome.narrative);
          if (cch.failureOutcome?.narrative) texts.push(cch.failureOutcome.narrative);
        }
      }
    }
    for (const t of texts) {
      assert.ok(!informalRe.test(t), `Informal Korean found in ${tpl.id}: "${t}"`);
      assert.ok(!bannedJargonOrClicheRe.test(t), `Banned cliché/jargon found in ${tpl.id}: "${t}"`);
    }
  }

  // 2) Position switch error messages
  const nonAdj = canSwitchToPosition('PG', 'C', 190, null);
  assert.equal(nonAdj.allowed, false);
  assert.ok(nonAdj.reason && !informalRe.test(nonAdj.reason));

  const extremeHeight = canSwitchToPosition('SF', 'PF', 170, null);
  if (!extremeHeight.allowed && extremeHeight.reason) {
    assert.ok(!informalRe.test(extremeHeight.reason));
    assert.ok(!bannedJargonOrClicheRe.test(extremeHeight.reason));
  }

  // 3) NBA combine scouting reports across pick ranges
  for (const ovr of [90, 79, 73, 60]) {
    const combine = createInitialCombineState(
      createBaseCareer({
        age: 20,
        league: 'NCAA',
        team: NCAA_TEAMS[0],
        ovr,
        potential: Math.min(95, ovr + 5),
        stats: { ins: ovr, out: ovr, ply: ovr, def: ovr, reb: ovr, phy: ovr },
      })
    );
    assert.ok(!informalRe.test(combine.scoutingReport), `Informal combine copy: ${combine.scoutingReport}`);
    assert.ok(
      !bannedJargonOrClicheRe.test(combine.scoutingReport),
      `Banned combine cliché: ${combine.scoutingReport}`
    );
  }

  // 4) Team descriptions
  for (const team of ALL_TEAMS) {
    assert.ok(!informalRe.test(team.prestigeDesc), `Informal team copy (${team.id}): ${team.prestigeDesc}`);
    assert.ok(
      !bannedJargonOrClicheRe.test(team.prestigeDesc),
      `Banned team cliché (${team.id}): ${team.prestigeDesc}`
    );
  }
});

test('57. 국제대회 연도 정합성·아시안게임 증발 방지·입대 직전 마지막 특례 기회·병역 상태 표시 검증', () => {
  // 1) 아시아컵 소집: 실제 개최 연도 보존 + 병역특례 비대상 안내 + 금메달 획득 시 미면제
  const unexemptAce = createBaseCareer({
    name: '김대표',
    age: 23,
    seasonYear: 2026, // 2025 시즌 종료 후 오프시즌(seasonYear가 이미 +1 된 상태)
    league: 'KBL',
    team: KBL_TEAMS[0],
    ovr: 82,
    militaryExempt: false,
    militaryServiceSeasonsLeft: 0,
    stats: { ins: 84, out: 84, ply: 82, def: 80, reb: 76, phy: 82 },
  });

  const asiaCupEvt = rollSeasonEvent(unexemptAce, () => 0.5, 2025);
  assert.equal(asiaCupEvt?.id, 'EVT_INTL_ASIA_CUP_2025');
  assert.ok(asiaCupEvt?.subtitle.includes('병역특례 비대상'));
  assert.ok(asiaCupEvt?.description.includes('병역특례 비대상'));
  const enterChoice = asiaCupEvt?.choices.find(
    (c) => c.enterInternationalTournament === 'ASIA_CUP'
  );
  assert.equal(enterChoice?.internationalTournamentYear, 2025);

  const asiaCupLive = createLiveFinalGame(
    unexemptAce,
    ASIAN_NATIONAL_TEAMS[0],
    'INTERNATIONAL_FINAL',
    { tournamentType: 'ASIA_CUP', tournamentYear: 2025 }
  );
  assert.equal(asiaCupLive.internationalTournamentYear, 2025);
  assert.ok(
    asiaCupLive.title.startsWith('2025 FIBA 아시아컵'),
    `Expected 2025 tournament year in title, got: ${asiaCupLive.title}`
  );

  // 아시아컵 금메달은 현실 병역법상 특례 비대상
  const finishedAsiaCupGold = skipLiveGameToEnd(
    { ...asiaCupLive, teamScore: 98, oppScore: 68, quarter: 3 },
    { ...unexemptAce, ovr: 95, stats: { ins: 95, out: 95, ply: 95, def: 95, reb: 90, phy: 95 } },
    () => 0.1
  );
  assert.equal(finishedAsiaCupGold.finalOutcome?.medal, 'GOLD');
  assert.equal(finishedAsiaCupGold.finalOutcome?.grantedMilitaryExemption, false);

  // 2) 구버전 세이브에 2025 아시아컵이 2026년으로 잘못 기록되어 있어도 2026 아시안게임이 스킵되지 않아야 함
  const legacyMislabeledSave = createBaseCareer({
    ...unexemptAce,
    age: 24,
    seasonYear: 2027,
    internationalHistory: [
      {
        id: 'INTL_ASIA_CUP_2026_LEGACY',
        year: 2026, // 구버전 버그로 1년 밀린 아시아컵 기록
        age: 23,
        tournamentType: 'ASIA_CUP',
        tournamentName: 'FIBA 아시아컵',
        result: 'SILVER',
        wonMvp: false,
        grantedMilitaryExemption: false,
        avgPts: 21.0,
        avgReb: 5.0,
        avgAst: 6.0,
        matches: [],
        summaryHeadline: '아시아컵 은메달',
      },
    ],
  });
  const agEvtAfterLegacyAsiaCup = rollSeasonEvent(legacyMislabeledSave, () => 0.5, 2026);
  assert.equal(
    agEvtAfterLegacyAsiaCup?.id,
    'EVT_ASIAN_GAMES_GOLD',
    '2026 Asian Games must NOT be skipped when 2026 record belongs to ASIA_CUP'
  );
  assert.ok(agEvtAfterLegacyAsiaCup?.title.startsWith('2026 아시안게임'));
  const agChoice = agEvtAfterLegacyAsiaCup?.choices.find(
    (c) => c.enterInternationalTournament === 'ASIAN_GAMES'
  );
  assert.equal(agChoice?.internationalTournamentYear, 2026);

  // 동일 연도·동일 대회(2026 ASIAN_GAMES) 이미 출전 시에는 재소집 차단
  const alreadyPlayedAg = createBaseCareer({
    ...legacyMislabeledSave,
    internationalHistory: [
      {
        id: 'INTL_ASIAN_GAMES_2026_DONE',
        year: 2026,
        age: 24,
        tournamentType: 'ASIAN_GAMES',
        tournamentName: '아시안게임 남자농구',
        result: 'SILVER',
        wonMvp: false,
        grantedMilitaryExemption: false,
        avgPts: 22.0,
        avgReb: 5.2,
        avgAst: 6.1,
        matches: [],
        summaryHeadline: '아시안게임 은메달',
      },
    ],
  });
  const agDupEvt = rollSeasonEvent(alreadyPlayedAg, () => 0.99, 2026);
  assert.notEqual(agDupEvt?.id, 'EVT_ASIAN_GAMES_GOLD');

  // 아시안게임 금메달은 병역특례 획득
  const agLive = createLiveFinalGame(
    legacyMislabeledSave,
    ASIAN_NATIONAL_TEAMS[0],
    'ASIAN_GAMES_FINAL',
    { tournamentType: 'ASIAN_GAMES', tournamentYear: 2026 }
  );
  const finishedAgGold = skipLiveGameToEnd(
    { ...agLive, teamScore: 99, oppScore: 65, quarter: 3 },
    { ...legacyMislabeledSave, ovr: 95, stats: { ins: 95, out: 95, ply: 95, def: 95, reb: 90, phy: 95 } },
    () => 0.1
  );
  assert.equal(finishedAgGold.finalOutcome?.medal, 'GOLD');
  assert.equal(finishedAgGold.finalOutcome?.grantedMilitaryExemption, true);

  // 3) 입대 직전 마지막 기회 보장: 만 26세(일반) 시즌이 2026 아시안게임 해일 때 상무 영장보다 먼저 소집
  const kblAge26Ending2026 = createBaseCareer({
    ...unexemptAce,
    league: 'KBL',
    age: 27, // 2026 시즌(만 26세) 종료 후 나이가 27세로 올라간 상태
    seasonYear: 2027,
    ovr: 78,
  });
  const lastChanceAg = rollSeasonEvent(kblAge26Ending2026, () => 0.5, 2026);
  assert.equal(
    lastChanceAg?.id,
    'EVT_ASIAN_GAMES_GOLD',
    'KBL player finishing age-26 season in Asian Games year must get last-chance callup before Sangmu'
  );

  // 반면 만 26세 시즌이 비특례 해(2025 아시아컵)라면 즉시 상무 입대 영장 발부
  const nonExemptLastYear = rollSeasonEvent(kblAge26Ending2026, () => 0.5, 2025);
  assert.equal(nonExemptLastYear?.id, 'EVT_SANGMU_ENLISTMENT');

  // NBA 만 28세 시즌 종료(만 29세 전환) + 2028 올림픽 해 -> 올림픽 소집 우선 보장
  const nbaAge28Ending2028 = createBaseCareer({
    ...unexemptAce,
    league: 'NBA',
    team: NBA_TEAMS[0],
    age: 29,
    seasonYear: 2029,
    ovr: 86,
  });
  const lastChanceOlympics = rollSeasonEvent(nbaAge28Ending2028, () => 0.5, 2028);
  assert.equal(
    lastChanceOlympics?.id,
    'EVT_INTL_OLYMPICS_2028',
    'NBA player finishing age-28 season in Olympics year must get last-chance callup before Sangmu'
  );

  // 4) 병역 상태 표시 헬퍼 검증
  assert.equal(getMilitaryStatusDisplay({ ...unexemptAce, age: 25, league: 'KBL' }).tone, 'gold');
  assert.equal(getMilitaryStatusDisplay({ ...unexemptAce, age: 25, league: 'KBL' }).label, '미필 (만 27세)');
  assert.equal(getMilitaryStatusDisplay({ ...unexemptAce, age: 25, league: 'NBA' }).label, '미필 (만 29세)');
  assert.equal(
    getMilitaryStatusDisplay({ ...unexemptAce, militaryServiceSeasonsLeft: 2 }).label,
    '상무 복무 (2시즌)'
  );
  assert.equal(
    getMilitaryStatusDisplay({
      ...unexemptAce,
      militaryExempt: true,
      internationalHistory: [
        {
          id: 'EXEMPT_1',
          year: 2026,
          age: 24,
          tournamentType: 'ASIAN_GAMES',
          tournamentName: '아시안게임 남자농구',
          result: 'GOLD',
          wonMvp: true,
          grantedMilitaryExemption: true,
          avgPts: 24,
          avgReb: 6,
          avgAst: 7,
          matches: [],
          summaryHeadline: '금메달',
        },
      ],
    }).label,
    '병역특례'
  );
  assert.equal(
    getMilitaryStatusDisplay({
      ...unexemptAce,
      militaryExempt: true,
      milestones: [
        {
          id: 'MS_DISCHARGE_2029',
          year: 2029,
          age: 29,
          title: '국군체육부대 상무 만기 전역',
          description: '전역',
          type: 'MILITARY',
          teamName: SANGMU_TEAM.name,
        },
      ],
    }).label,
    '병역필'
  );
});

test('58. 리그 세대교체·결승 다양성, 라이브 결승 득점·FMVP 정합성, NBA 올스타 기준 검증', () => {
  let s = 20261122;
  const detRng = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // 1) 구단 전력 세대교체: 초기 하위권 팀이 20년 내 상위권 반등 가능 & 초기 최강팀 영구 고착 해소
  const sortedNba = [...NBA_TEAMS].sort((a, b) => b.rating - a.rating);
  const topInitId = sortedNba[0].id;
  const bottomInitIds = sortedNba.slice(-6).map((t) => t.id);
  let bottomReachedContender = false;
  let topDroppedBelowPeak = false;
  for (let trial = 0; trial < 5; trial++) {
    let map = buildInitialTeamRatingsMap();
    for (let yr = 0; yr < 20; yr++) {
      map = evolveLeagueTeamRatings(map, detRng);
      if (map[topInitId] <= 86) topDroppedBelowPeak = true;
      if (bottomInitIds.some((id) => map[id] >= 87)) {
        bottomReachedContender = true;
      }
    }
  }
  assert.equal(
    topDroppedBelowPeak,
    true,
    'Initial top NBA team must naturally experience generational decline over 20 seasons'
  );
  assert.equal(
    bottomReachedContender,
    true,
    'Initial bottom-tier NBA teams must be able to rebuild into contenders over 20 seasons'
  );

  // 2) 라이브 결승 득점 정상화 & 평균 주전 FMVP 100% 싹쓸이 방지
  const nbaMidTeam = sortedNba[10];
  const nbaOppTeam = sortedNba[1];
  const avgStarterStats = { ins: 84, out: 84, ply: 84, def: 84, reb: 84, phy: 84 };
  const avgStarterOvr = calculateOvr(avgStarterStats, 'SG', 193);
  const avgStarterCareer = createBaseCareer({
    league: 'NBA',
    team: nbaMidTeam,
    ovr: avgStarterOvr,
    stats: avgStarterStats,
    role: '주전',
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        mpg: 30.0,
        ppg: 16.5,
        rpg: 5.0,
        apg: 4.5,
        spg: 1.1,
        bpg: 0.5,
      }),
    ],
  });
  let totalLivePts = 0;
  let liveWins = 0;
  let liveFmvpWins = 0;
  for (let i = 0; i < 30; i++) {
    const live = createLiveFinalGame(avgStarterCareer, nbaOppTeam, 'LEAGUE_FINALS');
    const done = skipLiveGameToEnd(live, avgStarterCareer, detRng);
    totalLivePts += done.playerStats.pts;
    if (done.finalOutcome?.won) {
      liveWins++;
      if (done.finalOutcome.wonFinalsMvp) liveFmvpWins++;
    }
  }
  const avgLivePts = totalLivePts / 30;
  assert.ok(
    avgLivePts >= 14 && avgLivePts <= 29,
    `Average NBA starter live Finals scoring should be realistic (14~29 pts), got ${avgLivePts.toFixed(1)}`
  );
  if (liveWins >= 5) {
    assert.ok(
      liveFmvpWins < liveWins,
      `Average NBA starter should NOT win 100% of live Finals MVPs (${liveFmvpWins}/${liveWins})`
    );
  }

  // 3) NBA 올스타 기준 현실화: 평균 14~15점 주전은 자동 올스타 불가, 24점+ 스타는 올스타 선정
  const nbaAvgSim = simulateSeason(
    createBaseCareer({
      league: 'NBA',
      team: nbaMidTeam,
      ovr: 82,
      stats: { ins: 82, out: 82, ply: 82, def: 82, reb: 80, phy: 82 },
      role: '주전',
      coachTrust: 70,
    }),
    () => 0.5
  );
  assert.equal(
    nbaAvgSim.boxScore.allStarSelected,
    false,
    `Average NBA starter (${nbaAvgSim.boxScore.ppg} PPG) should not automatically make All-Star`
  );

  const nbaSuperSim = simulateSeason(
    createBaseCareer({
      league: 'NBA',
      team: sortedNba[2],
      ovr: 94,
      stats: { ins: 94, out: 94, ply: 92, def: 90, reb: 86, phy: 92 },
      role: '에이스',
      coachTrust: 90,
    }),
    () => 0.5
  );
  assert.equal(
    nbaSuperSim.boxScore.allStarSelected,
    true,
    `NBA superstar (${nbaSuperSim.boxScore.ppg} PPG) must be selected as All-Star`
  );
});

test('59. 인카운터 트레이드오프 제거 유지, 단순 계약·트레이드 복원 및 구 특수 계약 세이브 자동 변환 검증', () => {
  let seed = 20261123;
  const detRng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // 1) 인카운터에서 BALANCED(트레이드오프) 선택지 및 강제 -1 능력치 페널티 제거 상태 유지 검증
  const testCareerForEnc = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    age: 23,
    ovr: 84,
    cashBalance: 5_000_000,
    coachTrust: 75,
    fame: 65,
  });
  for (let i = 0; i < 60; i++) {
    const evt = rollCombinatorialEncounter(testCareerForEnc, detRng);
    if (!evt) continue;
    for (const ch of evt.choices) {
      assert.notEqual(
        ch.riskTier,
        'BALANCED',
        `Encounter ${evt.id} choice ${ch.id} must not use BALANCED (tradeoff) riskTier`
      );
      assert.equal(
        ch.label.includes('트레이드오프'),
        false,
        `Encounter choice label must not contain '트레이드오프': ${ch.label}`
      );
    }
    const c1 = evt.choices[0];
    assert.equal(c1.riskTier, 'SAFE', 'First encounter choice must be SAFE');
    const c1NegStats = Object.values(c1.statChanges || {}).filter(
      (v) => typeof v === 'number' && v < 0
    );
    assert.equal(
      c1NegStats.length,
      0,
      `First SAFE choice in ${evt.id} must not force opposite-stat -1 tradeoff`
    );
  }

  // 2) 6개 프로 리그 전체(유로리그·NBL 포함) 단일 트레이드 허용, 아마추어·상무는 차단
  assert.equal(canUseProTradeSystem({ league: 'NBA' }), true);
  assert.equal(canUseProTradeSystem({ league: 'GLEAGUE' }), true);
  assert.equal(canUseProTradeSystem({ league: 'KBL' }), true);
  assert.equal(canUseProTradeSystem({ league: 'B_LEAGUE' }), true);
  assert.equal(canUseProTradeSystem({ league: 'EUROLEAGUE' }), true);
  assert.equal(canUseProTradeSystem({ league: 'NBL' }), true);
  assert.equal(canUseProTradeSystem({ league: 'KBL', isMilitaryTeam: true }), false);
  assert.equal(canUseProTradeSystem({ league: 'NCAA' }), false);

  // 3) 유로리그·NBL 다년 계약 시에도 단순 REQUEST_TRADE 생성 + NBA 아웃/바이아웃/상호해지 없음
  const euroCareer = createBaseCareer({
    league: 'EUROLEAGUE',
    team: EUROLEAGUE_TEAMS[0],
    age: 24,
    ovr: 81,
    contractType: 'EUROLEAGUE_CONTRACT',
    contractYearsLeft: 2,
    annualSalary: 1_800_000,
    coachTrust: 70,
  });
  const euroOpts = generateOffseasonOptions(euroCareer, detRng);
  assert.ok(
    euroOpts.filter((o) => o.actionType === 'REQUEST_TRADE').length > 0,
    'EuroLeague active multi-year contract must use unified REQUEST_TRADE options'
  );
  assert.equal(
    euroOpts.some((o) => (o.actionType as string) === 'EXERCISE_NBA_OUT'),
    false,
    'Rolled-back contract system must not emit EXERCISE_NBA_OUT'
  );

  const euroMidEvent = rollMidSeasonCrossroadsEvent(
    { ...euroCareer, coachTrust: 65, role: '주전', brokenRolePromise: true, seasonsOnCurrentTeam: 2 },
    () => 0.01
  );
  assert.ok(
    euroMidEvent.id.startsWith('EVT_MID_TRADE_DEADLINE_'),
    `EuroLeague mid-season crossroads should use standard trade deadline event, got ${euroMidEvent.id}`
  );

  const nblCareer = createBaseCareer({
    league: 'NBL',
    team: NBL_TEAMS[0],
    age: 22,
    ovr: 76,
    contractType: 'NBL_CONTRACT',
    contractYearsLeft: 1,
    annualSalary: 260_000,
    coachTrust: 68,
  });
  const nblOpts = generateOffseasonOptions(nblCareer, detRng);
  assert.ok(
    nblOpts.filter((o) => o.actionType === 'REQUEST_TRADE').length > 0,
    'NBL active multi-year contract must use unified REQUEST_TRADE options'
  );

  // 4) 고교 졸업생에게 NBL 넥스트 스타 미생성 & NBA 슈퍼스타 재계약도 기존 NBA_MAX로 복원
  const eliteHsSenior = createBaseCareer({
    league: 'HIGH_SCHOOL',
    team: HIGH_SCHOOL_TEAMS[0],
    age: 19,
    contractYearsLeft: 0,
    ovr: 68,
    potential: 92,
    stats: { ins: 68, out: 69, ply: 67, def: 66, reb: 65, phy: 70 },
    seasonLogs: [
      createSeasonLog({
        league: 'HIGH_SCHOOL',
        ppg: 26.5,
        rpg: 7.5,
        apg: 6.2,
        awards: ['전국대회 MVP'],
      }),
    ],
  });
  const hsOpts = generateOffseasonOptions(eliteHsSenior, detRng);
  assert.equal(
    hsOpts.some((o) => (o.contractType as string) === 'NBL_NEXT_STARS'),
    false,
    'HS graduate options must not include rolled-back NBL_NEXT_STARS'
  );

  const nbaSuperCareer = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    age: 27,
    ovr: 93,
    contractType: 'NBA_MAX',
    contractYearsLeft: 0,
    coachTrust: 88,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        awards: ['All-NBA 1st Team'],
        ppg: 28.5,
      }),
    ],
  });
  const superOpts = generateOffseasonOptions(nbaSuperCareer, detRng);
  const resignOpt = superOpts.find((o) => o.id === 'OPT_RESIGN_CURRENT_TEAM');
  assert.ok(resignOpt, 'NBA superstar must receive standard incumbent resign offer');
  assert.equal(resignOpt.contractType, 'NBA_MAX');
  assert.equal(resignOpt.contractYears, 3);

  // 5) 구 특수 계약(NBA_SUPERMAX / NBL_NEXT_STARS / 바이아웃·NBA 아웃 옵션) 세이브 자동 변환 검증
  const savedSupermax = {
    career: {
      ...createBaseCareer({
        league: 'NBA',
        team: NBA_TEAMS[1],
        contractYearsLeft: 4,
        ovr: 92,
      }),
      contractType: 'NBA_SUPERMAX' as unknown as CareerState['contractType'],
      isRookieScaleContract: true,
    } as unknown as CareerState,
  };
  const migratedSupermax = migratePersistedPayload(savedSupermax);
  assert.equal(migratedSupermax.career?.contractType, 'NBA_MAX');
  assert.equal(
    'isRookieScaleContract' in ((migratedSupermax.career || {}) as Record<string, unknown>),
    false
  );

  const savedNextStars = {
    career: {
      ...createBaseCareer({
        league: 'NBL',
        team: NBL_TEAMS[0],
        contractYearsLeft: 1,
        ovr: 72,
      }),
      contractType: 'NBL_NEXT_STARS' as unknown as CareerState['contractType'],
      hasNbaOutClause: true,
      buyoutFeeUsd: 500_000,
      offseasonOptions: [
        {
          id: 'OPT_NBA_OUT_DRAFT',
          title: 'NBA 아웃 조항 발동',
          subtitle: '테스트',
          badgeText: 'NBA 아웃',
          targetLeague: 'NBA',
          contractType: 'NBA_STANDARD',
          contractYears: 4,
          actionType: 'EXERCISE_NBA_OUT',
        },
        {
          id: 'OPT_CONTRACT_REQUEST_BUYOUT_NBL_2',
          title: '바이아웃 이적 타진',
          subtitle: '테스트',
          badgeText: '바이아웃',
          targetLeague: 'NBL',
          targetTeam: NBL_TEAMS[1],
          contractType: 'NBL_NEXT_STARS',
          contractYears: 1,
          actionType: 'REQUEST_BUYOUT',
        },
      ],
    } as unknown as CareerState,
  };
  const migratedNextStars = migratePersistedPayload(savedNextStars);
  assert.equal(migratedNextStars.career?.contractType, 'NBL_CONTRACT');
  assert.equal(
    'hasNbaOutClause' in ((migratedNextStars.career || {}) as Record<string, unknown>),
    false
  );
  assert.equal(migratedNextStars.career?.offseasonOptions.length, 1);
  assert.equal(migratedNextStars.career?.offseasonOptions[0].actionType, 'REQUEST_TRADE');
  assert.equal(migratedNextStars.career?.offseasonOptions[0].contractType, 'NBL_CONTRACT');
});

test('60. P0 플레이오프 완결 가드, P1 리그별 정원·포지션 올스타/올리그, 단일 MVP 보장 정책 및 주인공·라이벌·NPC 대칭 풀 검증', async () => {
  // 1) evaluateFluidSeasonAwards는 1단계 중복 MVP/ROY/올스타 컷을 더 이상 산출하지 않음 (단일 진실 소스 보장)
  const nbaStarCareer = createBaseCareer({
    league: 'NBA',
    team: NBA_TEAMS[0],
    ovr: 92,
    stats: { ins: 91, out: 90, ply: 88, def: 86, reb: 84, phy: 88 },
  });
  const auxAwards = evaluateFluidSeasonAwards({
    career: nbaStarCareer,
    role: '에이스 (1옵션)',
    gp: 78,
    mpg: 36.2,
    ppg: 30.5,
    rpg: 8.5,
    apg: 8.0,
    spg: 2.1,
    bpg: 1.4,
    winRate: 0.72,
    rng: () => 0.5,
  });
  assert.equal(auxAwards.wonMvp, false, '1st stage must not compute separate wonMvp');
  assert.equal(auxAwards.wonRookieOfYear, false, '1st stage must not compute separate wonRookieOfYear');
  assert.equal(auxAwards.allStarSelected, false, '1st stage must not compute separate threshold allStarSelected');
  assert.equal(auxAwards.allLeagueTeam, null, '1st stage must not compute separate allLeagueTeam');
  assert.equal(AWARD_VOTING_CONFIG.mvpGuaranteesAllStarAndFirstTeam, true);

  // 2) 리그별 정원(Quota) + 포지션 균형 배분 검증 (NBA 24명 · KBL 12명 · 고교 5명)
  for (const lg of ['NBA', 'KBL', 'HIGH_SCHOOL'] as const) {
    const team =
      lg === 'NBA' ? NBA_TEAMS[0] : lg === 'KBL' ? KBL_TEAMS[0] : HIGH_SCHOOL_TEAMS[0];
    const games = LEAGUE_CONFIG[lg].games;
    const career = createBaseCareer({
      league: lg,
      team,
      ovr: LEAGUE_CONFIG[lg].ldr + 4,
      primaryPos: 'PG',
    });
    const standings = generateLeagueStandings(career, Math.round(games * 0.65), Math.round(games * 0.35), () => 0.5);
    const bx = createSeasonLog({
      league: lg,
      teamId: team.id,
      teamName: team.name,
      teamShortName: team.shortName,
      gp: games,
      mpg: 34.0,
      ppg: 24.0,
      rpg: 5.5,
      apg: 7.5,
      spg: 1.6,
      bpg: 0.5,
      fgPct: 48.0,
      wins: Math.round(games * 0.65),
      losses: Math.round(games * 0.35),
    });
    const unified = evaluateUnifiedLeagueAwards({
      career,
      boxScore: bx,
      standings,
      updatedRivals: [],
      isRookieSeason: false,
      rng: () => 0.45,
    });
    const quota = LEAGUE_AWARD_QUOTAS[lg];
    assert.equal(
      unified.allStarIds.size,
      quota.allStarTotal,
      `${lg} All-Star count (${unified.allStarIds.size}) must strictly equal quota (${quota.allStarTotal})`
    );
    assert.ok(
      unified.allStarGuardCount >= quota.allStarGuards,
      `${lg} guard All-Stars (${unified.allStarGuardCount}) must meet >= ${quota.allStarGuards}`
    );
    assert.ok(
      unified.allStarFrontcourtCount >= quota.allStarFrontcourt,
      `${lg} frontcourt All-Stars (${unified.allStarFrontcourtCount}) must meet >= ${quota.allStarFrontcourt}`
    );
    const firstTeamCount = [...unified.allLeagueTeams.values()].filter((t) => t === 1).length;
    assert.equal(firstTeamCount, 5, `${lg} All-League 1st Team must have exact 5 players`);
    assert.equal(
      unified.allLeagueTeams.size,
      quota.allLeagueTeamCount * 5,
      `${lg} total All-League slots must equal ${quota.allLeagueTeamCount * 5}`
    );
  }

  // 3) 명시적 MVP 보장 정책: 정원 유지(24명·퍼스트팀 5명)하면서 MVP 수상자의 올스타·퍼스트팀 보장
  const nbaQuota = LEAGUE_AWARD_QUOTAS.NBA;
  const syntheticPool = Array.from({ length: 40 }, (_, i) => {
    const pos = (['PG', 'SG', 'SF', 'PF', 'C'] as const)[i % 5];
    return {
      id: `C_${i}`,
      name: `Player ${i}`,
      teamId: `T_${i}`,
      teamShortName: `T${i}`,
      pos,
      isPlayer: i === 0,
      isRookie: false,
      gp: 78,
      mpg: 34,
      ppg: 25 - i * 0.25,
      rpg: pos === 'C' || pos === 'PF' ? 9.5 : 5.0,
      apg: pos === 'PG' ? 8.0 : 4.2,
      spg: 1.2,
      bpg: pos === 'C' ? 1.8 : 0.5,
      fgPct: 48.0,
      wins: 50,
      losses: 32,
      eligible: true,
      mvpScore: 55 - i * 0.5,
      allStarScore: calcUnifiedAllStarScore({
        ppg: 25 - i * 0.25,
        rpg: pos === 'C' || pos === 'PF' ? 9.5 : 5.0,
        apg: pos === 'PG' ? 8.0 : 4.2,
        wins: 50,
        losses: 32,
      }),
      royScore: 30,
    };
  });
  const selAllStars = selectPositionBalancedAllStars(syntheticPool, nbaQuota);
  assert.equal(selAllStars.selectedIds.size, 24);
  const allLeagueMap = assignPositionBalancedAllLeagueTeams(syntheticPool, 3);
  assert.equal(allLeagueMap.size, 15);

  // 4) 주인공·라이벌·NPC 완전 대칭 경쟁 풀: 동일 리그 라이벌이 1위 시드 압도적 성적이면 라이벌이 MVP 1위 + mvps/allStars 동기화
  const rivalTeam = NBA_TEAMS[1];
  const playerTeam = NBA_TEAMS[0];
  const superRival = {
    id: 'RIVAL_DOMINANT',
    name: 'Dominant Rival',
    draftYear: 2028,
    league: 'NBA' as const,
    teamId: rivalTeam.id,
    teamName: rivalTeam.name,
    teamShortName: rivalTeam.shortName,
    pos: 'SF' as const,
    ovr: 96,
    potential: 97,
    ppg: 33.5,
    rpg: 10.4,
    apg: 9.2,
    championships: 0,
    mvps: 0,
    allStars: 0,
    roys: 0,
    lastHeadline: '테스트 라이벌',
  };
  const symCareer = createBaseCareer({
    league: 'NBA',
    team: playerTeam,
    seasonYear: 2030,
    ovr: 87,
    rivals: [superRival],
  });
  const symStandings = generateLeagueStandings(symCareer, 46, 36, () => 0.5).map((s) =>
    s.team.id === rivalTeam.id
      ? { ...s, wins: 68, losses: 14, winPct: Number((68 / 82).toFixed(3)) }
      : s
  );
  symStandings.sort((a, b) => b.winPct - a.winPct);

  // simulateRivalsSeason은 동일 리그 라이벌의 mvps/allStars를 선반영하지 않아야 함
  const preSim = simulateRivalsSeason(
    [superRival],
    2030,
    createSeasonLog({ league: 'NBA', ppg: 22.0 }),
    () => 0.5
  );
  assert.equal(preSim.updatedRivals[0].mvps, 0, 'Same-league rival MVP must be resolved only in unified pool');
  assert.equal(preSim.updatedRivals[0].allStars, 0, 'Same-league rival All-Star must be resolved only in unified pool');

  const symUnified = evaluateUnifiedLeagueAwards({
    career: symCareer,
    boxScore: createSeasonLog({
      league: 'NBA',
      teamId: playerTeam.id,
      teamName: playerTeam.name,
      teamShortName: playerTeam.shortName,
      gp: 78,
      mpg: 34.5,
      ppg: 23.0,
      rpg: 5.5,
      apg: 5.2,
      spg: 1.2,
      bpg: 0.5,
      fgPct: 47.0,
      wins: 46,
      losses: 36,
    }),
    standings: symStandings,
    updatedRivals: [superRival],
    rivalSeasonStats: {
      [superRival.id]: {
        rivalId: superRival.id,
        gp: 80,
        mpg: 36.5,
        ppg: 33.5,
        rpg: 10.4,
        apg: 9.2,
        spg: 2.1,
        bpg: 1.5,
        fgPct: 54.0,
      },
    },
    isRookieSeason: false,
    rng: () => 0.5,
  });
  assert.equal(symUnified.playerWonMvp, false, 'Player must not win MVP when rival dominates');
  assert.equal(symUnified.mvpWinnerId, `RIVAL_${superRival.id}`, 'Dominant rival must win MVP in unified pool');
  assert.equal(symUnified.mvpRace[0].name, superRival.name);
  assert.equal(symUnified.syncedRivals[0].mvps, 1, 'Synced rival mvps must increment by 1');
  assert.equal(symUnified.syncedRivals[0].allStars, 1, 'Synced rival allStars must increment by 1');

  // 5) P0 스토어 가드: 미완결 플레이오프 대진표에서 enterOffseasonFromPlayoffs 호출 시 championTeamId 자동 완결
  const memStore: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => memStore[k] ?? null,
    setItem: (k: string, v: string) => {
      memStore[k] = v;
    },
    removeItem: (k: string) => {
      delete memStore[k];
    },
  };
  const { useCareerStore } = await import('../store/useCareerStore');
  const poStandings = generateLeagueStandings(nbaStarCareer, 52, 30, () => 0.5);
  const unfinishedBracket = {
    ...createPlayoffBracket(nbaStarCareer, poStandings, () => 0.5),
    playerEliminated: true,
    championTeamId: null,
  };
  useCareerStore.setState({
    career: {
      ...nbaStarCareer,
      currentStandings: poStandings,
      playoffBracket: unfinishedBracket,
      seasonLogs: [
        createSeasonLog({
          league: 'NBA',
          teamId: nbaStarCareer.team.id,
          teamName: nbaStarCareer.team.name,
          teamShortName: nbaStarCareer.team.shortName,
          wins: 52,
          losses: 30,
        }),
      ],
      seasonPhase: 'POSTSEASON_BRACKET',
    },
  });
  useCareerStore.getState().enterOffseasonFromPlayoffs();
  const afterOffseason = useCareerStore.getState().career!;
  assert.equal(afterOffseason.seasonPhase, 'OFFSEASON');
  assert.ok(
    afterOffseason.playoffBracket?.championTeamId,
    'enterOffseasonFromPlayoffs must finalize championTeamId before settling offseason'
  );
});

test('61. 상향된 명예의 전당 퍼스트 발롯 기준 검증 (NBA MVP/FMVP 1+, All-NBA 퍼스트 3+, 올스타 10+, 통산 25,000득점)', () => {
  const bos = NBA_TEAMS[0];
  const baseTotals = {
    gp: 900,
    points: 20000,
    rebounds: 5000,
    assists: 4000,
    steals: 1000,
    blocks: 400,
    nbaGp: 900,
    nbaPoints: 20000,
    championships: 2,
    nbaChampionships: 2,
    mvps: 0,
    nbaMvps: 0,
    finalsMvps: 0,
    dpoys: 0,
    sixthManAwards: 0,
    mips: 0,
    allLeagueSelections: 2,
    allStars: 9,
    nbaAllStars: 9,
  };

  // 1) 구 기준(올스타 9회, NBA 24,999득점, 우승 2회, All-NBA 퍼스트 2회)은 이제 퍼스트 발롯 미달 -> NBA_ALL_STAR
  const nearMissLogs = [
    createSeasonLog({ league: 'NBA', teamId: bos.id, teamName: bos.name, allLeagueTeam: 1, allStarSelected: true, wonChampionship: true }),
    createSeasonLog({ league: 'NBA', teamId: bos.id, teamName: bos.name, allLeagueTeam: 1, allStarSelected: true, wonChampionship: true }),
  ];
  const nearMissCareer = createBaseCareer({
    league: 'NBA',
    team: bos,
    seasonLogs: nearMissLogs,
    totals: {
      ...baseTotals,
      nbaPoints: 24999,
      points: 24999,
      nbaAllStars: 9,
      allStars: 9,
    },
  });
  assert.equal(
    evaluateCareerLegacy(nearMissCareer).tierId,
    'NBA_ALL_STAR',
    '9 All-Stars, 24,999 NBA points, 2 rings, and 2 All-NBA 1st teams must NOT reach First Ballot HOF'
  );

  // 2) KBL MVP·파이널 MVP는 NBA 퍼스트 발롯 조건으로 인정되지 않아야 함
  const kblOnlyCareer = createBaseCareer({
    league: 'KBL',
    team: KBL_TEAMS[0],
    seasonLogs: [
      createSeasonLog({
        league: 'KBL',
        teamId: KBL_TEAMS[0].id,
        teamName: KBL_TEAMS[0].name,
        wonMvp: true,
        wonChampionship: true,
        wonFinalsMvp: true,
        allLeagueTeam: 1,
        allStarSelected: true,
      }),
    ],
    totals: {
      ...baseTotals,
      nbaGp: 0,
      nbaPoints: 0,
      nbaChampionships: 0,
      nbaMvps: 0,
      nbaAllStars: 0,
      mvps: 3,
      finalsMvps: 2,
      championships: 3,
    },
  });
  assert.notEqual(
    evaluateCareerLegacy(kblOnlyCareer).tierId,
    'FIRST_BALLOT_HOF',
    'KBL Finals MVP must not trigger NBA First Ballot HOF'
  );

  // 3) 조건 A: NBA 정규시즌 MVP 1회
  const mvpCareer = createBaseCareer({
    league: 'NBA',
    team: bos,
    seasonLogs: [createSeasonLog({ league: 'NBA', teamId: bos.id, teamName: bos.name, wonMvp: true })],
    totals: { ...baseTotals, nbaPoints: 12000, nbaAllStars: 4, nbaChampionships: 0, nbaMvps: 1, mvps: 1 },
  });
  assert.equal(evaluateCareerLegacy(mvpCareer).tierId, 'FIRST_BALLOT_HOF');

  // 4) 조건 B: NBA 파이널 MVP 1회
  const fmvpCareer = createBaseCareer({
    league: 'NBA',
    team: bos,
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        teamId: bos.id,
        teamName: bos.name,
        wonChampionship: true,
        wonFinalsMvp: true,
      }),
    ],
    totals: { ...baseTotals, nbaPoints: 11000, nbaAllStars: 3, nbaChampionships: 1, finalsMvps: 1 },
  });
  assert.equal(evaluateCareerLegacy(fmvpCareer).tierId, 'FIRST_BALLOT_HOF');

  // 5) 조건 C: All-NBA 퍼스트 팀 3회 이상
  const allNbaFirst3Logs = [0, 1, 2].map((idx) =>
    createSeasonLog({
      seasonNumber: idx + 1,
      year: 2028 + idx,
      league: 'NBA',
      teamId: bos.id,
      teamName: bos.name,
      allLeagueTeam: 1,
      allStarSelected: true,
    })
  );
  const allNbaFirstCareer = createBaseCareer({
    league: 'NBA',
    team: bos,
    seasonLogs: allNbaFirst3Logs,
    totals: { ...baseTotals, nbaPoints: 14000, nbaAllStars: 5, nbaChampionships: 0, allLeagueSelections: 3 },
  });
  assert.equal(evaluateCareerLegacy(allNbaFirstCareer).tierId, 'FIRST_BALLOT_HOF');

  // 6) 조건 D: NBA 올스타 10회 이상
  const tenAllStarCareer = createBaseCareer({
    league: 'NBA',
    team: bos,
    seasonLogs: [createSeasonLog({ league: 'NBA', teamId: bos.id, teamName: bos.name, allStarSelected: true })],
    totals: { ...baseTotals, nbaPoints: 18000, nbaAllStars: 10, allStars: 10, nbaChampionships: 0 },
  });
  assert.equal(evaluateCareerLegacy(tenAllStarCareer).tierId, 'FIRST_BALLOT_HOF');

  // 7) 조건 E: NBA 통산 25,000득점 돌파
  const scorerCareer = createBaseCareer({
    league: 'NBA',
    team: bos,
    seasonLogs: [createSeasonLog({ league: 'NBA', teamId: bos.id, teamName: bos.name })],
    totals: { ...baseTotals, nbaPoints: 25000, points: 25000, nbaAllStars: 5, nbaChampionships: 0 },
  });
  assert.equal(evaluateCareerLegacy(scorerCareer).tierId, 'FIRST_BALLOT_HOF');

  // 8) 등급 도감 설명 동기화 확인
  const hofCatalog = LEGACY_TIER_CATALOG.find((t) => t.id === 'FIRST_BALLOT_HOF');
  assert.ok(hofCatalog?.criteria.includes('25,000'));
  assert.ok(hofCatalog?.criteria.includes('10회'));
  assert.ok(hofCatalog?.criteria.includes('퍼스트'));
});

