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
  calculateOvr,
  createInitialStats,
  getPreviewStatsAndOvrRange,
  rollPlayerDnaAndPlaystyle,
} from './statCalculator';
import {
  calculateRoleAndMpg,
  calculatePpg,
  calculateSeasonStatGrowth,
  calculateOrganicTrustDelta,
  calculateRecentEfficiencyMomentum,
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
import { createAgentRetirementAdviceEvent } from '../data/events';
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
    role: '프랜차이즈 1옵션 에이스',
    coachTrust: 95,
    draftStock: 90,
    trainingFocus: 'BALANCED',
    militaryExempt: true,
    militaryServiceSeasonsLeft: 0,
    previousTeamBeforeMilitary: null,
    isFarewellTour: false,
    farewellTourCompleted: false,
    isOutOfLeagueWarning: false,
    ovrHistory: [92, 90, 86],
    prospectStars: 4,
    teamRatingsMap: buildInitialTeamRatingsMap(),
    badges: [],
    seasonLogs: [],
    milestones: [],
    careerHighs: {
      points: 54,
      rebounds: 14,
      assists: 13,
      steals: 5,
      blocks: 3,
      pointsContext: '2039 BOS',
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

test('1. Initial stats, OVR, GrowthDna, and PlaystyleArchetype have randomized variance', () => {
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
});

test('2. Draft Pedigree protects KBL/NBA 1st-round picks from garbage time despite OVR gap', () => {
  // KBL #1 overall pick with OVR 58 joining a KBL team with rating 68
  const kblTopPickRole = calculateRoleAndMpg(
    {
      ovr: 58,
      team: KBL_TEAMS[0], // rating 68
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

  // Position-fair trust: Playmaker PG with 8.5 PPG & 8.0 APG earns positive coach trust
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

  // Rim Protector C with 7.5 PPG, 11.2 RPG, 2.3 BPG earns positive coach trust
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

  // Recent efficiency momentum boosts bench overperformer
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
    false,
    'Low-rated high school player must not receive NCAA D1 or Overseas Pro offers'
  );
  assert.equal(
    hsOptions1.some((o) => o.actionType === 'ENTER_KBL_DRAFT'),
    false,
    'Low-rated high school player without OVR 60+ or Championship/MVP cannot enter KBL early draft'
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
  assert.ok(hsOptions5.some((o) => o.targetLeague === 'OVERSEAS' || o.targetLeague === 'GLEAGUE'));
});

test('4. Team Scouting AI rejects high-OVR player with poor real game stats (1.8 PPG)', () => {
  const benchUnderperformer = createBaseCareer({
    age: 26,
    ovr: 75,
    potential: 77,
    league: 'NBA',
    seasonLogs: [
      createSeasonLog({
        league: 'NBA',
        ovr: 75,
        gp: 22,
        mpg: 5.2,
        ppg: 1.8,
        rpg: 0.9,
        apg: 0.4,
        fgPct: 37.5,
        tpPct: 26.0,
      }),
    ],
  });

  const scoutResult = evaluateTeamScouting(benchUnderperformer, NBA_TEAMS[0], () => 0.5);
  assert.equal(scoutResult.realGameCompetence, false);
  assert.equal(
    scoutResult.passesOfferThreshold,
    false,
    'Player with 75 OVR but 1.8 PPG & 37.5% FG must fail NBA scouting evaluation'
  );
});

test('5. Strict Pro-Only Franchise Jersey Retirement enforces 7+ seasons, 10,000+ pts, and dominant achievements', () => {
  const ncaaCareer = createBaseCareer({
    league: 'NCAA',
    team: NCAA_TEAMS[0],
    seasonLogs: [
      createSeasonLog({ seasonNumber: 1, league: 'NCAA', teamId: NCAA_TEAMS[0].id, gp: 36, ppg: 28, wonChampionship: true, wonMvp: true }),
      createSeasonLog({ seasonNumber: 2, league: 'NCAA', teamId: NCAA_TEAMS[0].id, gp: 36, ppg: 30, wonChampionship: true, wonMvp: true }),
    ],
  });
  const ncaaLegacy = evaluateCareerLegacy(ncaaCareer);
  assert.equal(ncaaLegacy.jerseyRetired, false);

  const shortNbaLogs: SeasonBoxScore[] = Array.from({ length: 5 }, (_, i) =>
    createSeasonLog({
      seasonNumber: i + 1,
      year: 2030 + i,
      league: 'NBA',
      teamId: NBA_TEAMS[0].id,
      gp: 75,
      ppg: 25.0,
      wonChampionship: true,
      wonMvp: true,
      allStarSelected: true,
    })
  );
  const shortNbaCareer = createBaseCareer({ seasonLogs: shortNbaLogs });
  assert.equal(evaluateCareerLegacy(shortNbaCareer).jerseyRetired, false);

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
  const trueLegendCareer = createBaseCareer({ seasonLogs: trueLegendLogs });
  const trueLegendEval = evaluateCareerLegacy(trueLegendCareer);
  assert.equal(trueLegendEval.jerseyRetired, true);
  assert.equal(trueLegendEval.honoredTeam.id, NBA_TEAMS[0].id);
  assert.equal(trueLegendEval.honoredTeamSeasons, 8);
  assert.ok(trueLegendEval.honoredTeamPoints >= 10000);
});

test('6. Two-Way survival & Forced OUT_OF_LEAGUE retirement when 0 offers exist', () => {
  const poorTwoWay = createBaseCareer({
    age: 24,
    ovr: 68,
    twoWaySeasonsUsed: 1,
    seasonLogs: [
      createSeasonLog({
        gp: 18,
        mpg: 6.0,
        ppg: 2.1,
        fgPct: 36.5,
      }),
    ],
  });
  const surv = evaluateTwoWaySurvival(poorTwoWay, 2.1);
  assert.equal(surv.status, 'WAIVED');

  const washedVeteran = createBaseCareer({
    age: 37,
    ovr: 56,
    potential: 60,
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
        ppg: 1.5,
        fgPct: 35.0,
      }),
    ],
  });
  const faOptions = generateOffseasonOptions(washedVeteran, () => 0.5);
  assert.ok(faOptions.some((o) => o.actionType === 'RETIRE_OUT_OF_LEAGUE'));
});

test('7. Dynamic AI team ratings/directions evolve and individualized Aging Curve respects GrowthDna', () => {
  const initialMap = buildInitialTeamRatingsMap();
  const nextMap = evolveLeagueTeamRatings(initialMap, () => 0.99);
  const bosDiff = nextMap[NBA_TEAMS[0].id] - initialMap[NBA_TEAMS[0].id];
  assert.ok(Math.abs(bosDiff) <= 3);

  const dynamicNbaTeams = getTeamsByLeague('NBA', nextMap);
  assert.equal(dynamicNbaTeams.length, 30);

  const decliningVet = createBaseCareer({
    age: 34,
    ovr: 76,
    ovrHistory: [70, 82, 79, 76],
    seasonLogs: [
      createSeasonLog({ ppg: 24.0 }),
      createSeasonLog({ ppg: 10.5 }),
    ],
  });
  const adviceEvt = createAgentRetirementAdviceEvent(decliningVet);
  assert.ok(adviceEvt !== null);
  assert.equal(adviceEvt?.id, 'EVT_AGENT_RETIREMENT_ADVICE');

  // Compare IRONMAN vs EARLY_BLOOMER aging at age 33
  const baseStats = { ins: 80, out: 85, ply: 82, def: 78, reb: 65, phy: 82 };
  const ironmanAging = applyAgingCurve(33, baseStats, () => 0.5, {
    growthDna: 'IRONMAN',
    careerMinutes: 12000,
  });
  const earlyBloomerAging = applyAgingCurve(33, baseStats, () => 0.5, {
    growthDna: 'EARLY_BLOOMER',
    careerMinutes: 30000,
  });
  assert.ok(
    ironmanAging.nextStats.phy > earlyBloomerAging.nextStats.phy,
    'IRONMAN DNA with low mileage must preserve higher PHY at age 33 than high-mileage EARLY_BLOOMER'
  );
});

test('8. Core difficulty formulas (Role/MPG, PPG soft cap, Late Bloomer growth)', () => {
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

  const aged34 = applyAgingCurve(
    34,
    { ins: 80, out: 85, ply: 82, def: 78, reb: 65, phy: 76 },
    midRng
  );
  assert.ok(aged34.delta.phy <= -2);

  const growthAtCap = calculateSeasonStatGrowth(
    {
      age: 20,
      ovr: 62,
      potential: 90,
      league: 'HIGH_SCHOOL',
      stats: { ins: 62, out: 62, ply: 62, def: 62, reb: 62, phy: 62 },
      trainingFocus: 'BALANCED',
      growthDna: 'STANDARD',
    },
    30,
    midRng
  );
  assert.ok(growthAtCap.delta.ins <= 2);

  // Late bloomer at age 26 grows faster than Early Bloomer at age 26
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

  const roleCheck = calculateRoleAndMpg(
    {
      ovr: 72,
      team: NBA_TEAMS[0],
      coachTrust: 50,
      secondaryPos: null,
      contractType: 'TWO_WAY',
      league: 'NBA',
    },
    midRng
  );
  assert.equal(roleCheck.role, '투웨이 콜업 로테이션');
});
