import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  NBA_TEAMS,
  KBL_TEAMS,
  NCAA_TEAMS,
  HIGH_SCHOOL_TEAMS,
  U_LEAGUE_TEAMS,
  GLEAGUE_TEAMS,
  ASIAN_NATIONAL_TEAMS,
  SANGMU_TEAM,
  ALL_TEAMS,
} from '../data/teams';
import {
  applySpecialCampProgram,
  calculateBiomechanicalProfile,
  calculateHeightMismatchPenalty,
  calculateOvr,
  canSwitchToPosition,
  createInitialStats,
  enforceBiomechanicalCaps,
  evaluateAcquiredTraits,
  getBiomechanicalGrowthElasticity,
  getBiomechanicalStatCaps,
  getPreviewStatsAndOvrRange,
  rollInitialPotential,
  rollInnateTrait,
  rollPlayerDnaAndPlaystyle,
} from './statCalculator';
import {
  buildAwardRaceTop5,
  calculateRoleAndMpg,
  calculatePpg,
  calculateSeasonStatGrowth,
  calculateOrganicTrustDelta,
  calculateRecentEfficiencyMomentum,
  checkPotentialBreakthrough,
  generateDraftRivals,
  getAwardsByLeague,
  getLeagueBaselineTeamRating,
  simulateRivalsSeason,
  simulateSeason,
} from './seasonSimulator';
import {
  calculateProjectedNbaPick,
  evaluateHighSchoolProspect,
  evaluateTeamScouting,
  evaluateTwoWaySurvival,
  executeDraftResolution,
  generateOffseasonOptions,
} from './draftEngine';
import {
  applyAgingCurve,
  checkRetirementEligibility,
  evaluateCareerLegacy,
} from './retirementEngine';
import {
  advancePlayoffRound,
  batchAdvanceEarlyPlayoffRounds,
  createLiveFinalGame,
  createPlayoffBracket,
  evaluateRealisticFinalsMvp,
  generateLeagueStandings,
  resolveClutchPossession,
  resolveConfFinalsGame7InBracket,
  simulateAsianGamesTournament,
  simulateLiveQuarter,
  skipEntirePlayoffs,
  skipLiveGameToEnd,
} from './playoffEngine';
import { isPersonalCareAllowedInLeague } from '../config/balanceConfig';
import {
  ENCOUNTER_SCENARIO_POOL,
  calculateEncounterSuccessChance,
  extractCareerContextTags,
  resolveEncounterChoiceOutcome,
  rollCombinatorialEncounter,
} from './encounterEngine';
import {
  createAgentRetirementAdviceEvent,
  createVeteranReinventionEvent,
  rollMidSeasonCrossroadsEvent,
  rollSeasonEvent,
} from '../data/events';
import { CareerState, SeasonBoxScore } from '../types/game';

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
    hsOptions1.some((o) => o.targetLeague === 'NCAA' || o.targetLeague === 'OVERSEAS'),
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
        o.targetLeague === 'OVERSEAS' ||
        o.targetLeague === 'GLEAGUE'
    ),
    '25yo NBA bench player must receive KBL/Overseas/G-League step-down offers'
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

test('16. NBA East/West Conference Standings (1~15 per Conference) & 4-Round Conference Playoff Bracket', () => {
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
  assert.equal(eastStandings.filter((s) => s.qualifiedPlayoffs).length, 8);
  assert.equal(westStandings.filter((s) => s.qualifiedPlayoffs).length, 8);

  const bracket = createPlayoffBracket(nbaCareer, standings);
  assert.equal(bracket.rounds[0].length, 8, 'NBA Round 1 must have 8 series (4 East + 4 West)');
  assert.equal(
    bracket.rounds[0].filter((m) => m.conference === 'EAST').length,
    4
  );
  assert.equal(
    bracket.rounds[0].filter((m) => m.conference === 'WEST').length,
    4
  );

  const finished = skipEntirePlayoffs(bracket, nbaCareer, standings, () => 0.3);
  assert.equal(finished.rounds.length, 4, 'Completed NBA Playoffs must have 4 rounds (R1, Conf Semis, Conf Finals, NBA Finals)');
  assert.equal(finished.rounds[3].length, 1, 'NBA Finals must be a single East Champion vs West Champion series');
  assert.ok(finished.championTeamId !== null);
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

  // Multi-year contract offseason options must include REQUEST_TRADE + NBA Draft entry for <=24yo KBL pro
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
    multiYearOpts.some((o) => o.actionType === 'ENTER_NBA_DRAFT'),
    '22yo KBL pro with 0 NBA GP must be able to challenge NBA Draft'
  );
});

test('18. All 135 Teams Have Official Crawled Logo Assets & League-Specific SVG Fallback Generator', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { generateLeagueFallbackSvgDataUri } = await import('../data/logoFallbacks');

  const combined = [...ALL_TEAMS, ...ASIAN_NATIONAL_TEAMS];
  assert.equal(combined.length, 135, 'Total teams across all leagues + Asian National Teams must be 135');

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
      assert.ok(fs.existsSync(fullPath), `Local crawled logo file must exist for ${team.id}: ${team.logoUrl}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 100, `Local crawled logo file for ${team.id} must be non-empty`);
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

  assert.equal(seenLogos.size, 135, 'Every single one of the 135 teams must have its own distinct official logoUrl');

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
      o.targetLeague === 'OVERSEAS'
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






