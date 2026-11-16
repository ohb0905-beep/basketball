import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  NBA_TEAMS,
  KBL_TEAMS,
  NCAA_TEAMS,
  ALL_TEAMS,
  evolveLeagueTeamRatings,
  getTeamsByLeague,
} from '../data/teams';
import {
  applySpecialCampProgram,
  calculateOvr,
  createInitialStats,
  evaluateAcquiredTraits,
  getPreviewStatsAndOvrRange,
  rollInitialPotential,
  rollInnateTrait,
  rollPlayerDnaAndPlaystyle,
} from './statCalculator';
import {
  calculateRoleAndMpg,
  calculatePpg,
  calculateSeasonStatGrowth,
  calculateOrganicTrustDelta,
  calculateRecentEfficiencyMomentum,
  checkPotentialBreakthrough,
  generateDraftRivals,
  simulateRivalsSeason,
} from './seasonSimulator';
import {
  calculateProjectedNbaPick,
  evaluateHighSchoolProspect,
  evaluateTeamScouting,
  evaluateTwoWaySurvival,
  generateOffseasonOptions,
} from './draftEngine';
import {
  applyAgingCurve,
  checkRetirementEligibility,
  evaluateCareerLegacy,
} from './retirementEngine';
import {
  createAgentRetirementAdviceEvent,
  rollMidSeasonCrossroadsEvent,
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
    wonChampionship: false,
    wonMvp: false,
    wonFinalsMvp: false,
    wonDpoy: false,
    wonSixthMan: false,
    wonMip: false,
    wonRookieOfYear: false,
    allStarSelected: true,
    allLeagueTeam: '1ST',
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

test('6. Potential Breakthrough, Player Traits, Special Camp & Procedural Rivals work organically', () => {
  const breakthroughCareer = createBaseCareer({
    age: 23,
    ovr: 76,
    potential: 77,
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
  assert.ok(bt.breakthroughGain >= 2, 'MIP winner near potential ceiling must break through potential limit');

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
  assert.ok(midEvt.id.startsWith('EVT_MID_'));
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
