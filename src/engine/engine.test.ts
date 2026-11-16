import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_CONFIG } from '../data/leagues';
import { NBA_TEAMS, KBL_TEAMS } from '../data/teams';
import { calculateOvr, createInitialStats } from './statCalculator';
import {
  calculateRoleAndMpg,
  calculatePpg,
  calculateSeasonStatGrowth,
} from './seasonSimulator';
import {
  calculateProjectedNbaPick,
  evaluateTwoWaySurvival,
} from './draftEngine';
import {
  applyAgingCurve,
  checkRetirementEligibility,
  evaluateCareerLegacy,
} from './retirementEngine';
import { CareerState } from '../types/game';

test('LEAGUE_CONFIG matches exact difficulty parameters', () => {
  assert.equal(LEAGUE_CONFIG.HIGH_SCHOOL.ldr, 45);
  assert.equal(LEAGUE_CONFIG.HIGH_SCHOOL.growthCap, 60);
  assert.equal(LEAGUE_CONFIG.KBL.ldr, 66);
  assert.equal(LEAGUE_CONFIG.KBL.growthCap, 74);
  assert.equal(LEAGUE_CONFIG.NCAA.ldr, 74);
  assert.equal(LEAGUE_CONFIG.NCAA.growthCap, 79);
  assert.equal(LEAGUE_CONFIG.NBA.ldr, 84);
  assert.equal(LEAGUE_CONFIG.NBA.growthCap, 99);
});

test('Role and MPG formula respects roleIndex thresholds and Two-Way caps', () => {
  const deterministicRng = () => 0.5;

  // Two-Way contract check
  const twoWayRes = calculateRoleAndMpg(
    {
      ovr: 72,
      team: NBA_TEAMS[0],
      coachTrust: 50,
      secondaryPos: null,
      contractType: 'TWO_WAY',
      league: 'NBA',
    },
    deterministicRng
  );
  assert.equal(twoWayRes.role, '투웨이 콜업 로테이션');
  assert.ok(twoWayRes.gp >= 18 && twoWayRes.gp <= 50);
  assert.equal(twoWayRes.mpg, Number((8.5 + (72 - 70) * 1.1).toFixed(1)));

  // Standard contract: garbage time (< -9) vs franchise ace (>= 7)
  const benchRes = calculateRoleAndMpg(
    {
      ovr: 72,
      team: NBA_TEAMS[0], // rating 88 -> 72 - 88 = -16
      coachTrust: 50,
      secondaryPos: null,
      contractType: 'NBA_STANDARD',
      league: 'NBA',
    },
    deterministicRng
  );
  assert.equal(benchRes.role, '가비지 타임 (벤치 끝자리)');
  assert.ok(benchRes.mpg >= 4.0 && benchRes.mpg <= 8.5);

  const aceRes = calculateRoleAndMpg(
    {
      ovr: 94,
      team: NBA_TEAMS[3], // rating 76 -> 94 - 76 = +18
      coachTrust: 80,
      secondaryPos: 'SG',
      contractType: 'NBA_MAX',
      league: 'NBA',
    },
    deterministicRng
  );
  assert.equal(aceRes.role, '프랜차이즈 1옵션 에이스');
  assert.ok(aceRes.mpg >= 33.0 && aceRes.mpg <= 36.8);
});

test('PPG formula enforces LDR defense resistance and 25.0 logarithmic soft cap', () => {
  const midRng = () => 0.5; // rng() * 2.0 - 1.0 === 0

  // OVR 73 KBL scorer entering NBA (LDR 84) on bench rotation (12 mpg, basePer36 12.5)
  const kblToNbaPpg = calculatePpg(
    { ins: 73, out: 73 },
    LEAGUE_CONFIG.NBA.ldr,
    12.0,
    12.5,
    midRng
  );
  assert.ok(kblToNbaPpg.ppg >= 2.0 && kblToNbaPpg.ppg <= 5.5);

  // OVR 95 NBA Superstar (ins 96, out 95) playing 36 mpg as 1st option (basePer36 23.5)
  const superstarPpg = calculatePpg(
    { ins: 96, out: 95 },
    LEAGUE_CONFIG.NBA.ldr,
    36.0,
    23.5,
    midRng
  );
  // rawPpg > 25, so soft cap compresses excess by 0.35
  assert.ok(superstarPpg.rawPpg > 28);
  assert.ok(superstarPpg.ppg > 25.0 && superstarPpg.ppg <= 32.0);
});

test('NBA Draft projectedPick and Two-Way survival logic work accurately', () => {
  const riskCalc = calculateProjectedNbaPick({
    ovr: 66,
    draftStock: 35,
    league: 'KBL',
  });
  assert.equal(riskCalc.undraftedRisk, true);
  assert.ok(riskCalc.projectedPick > 58);

  const lotteryCalc = calculateProjectedNbaPick({
    ovr: 79,
    draftStock: 85,
    league: 'NCAA',
  });
  assert.equal(lotteryCalc.undraftedRisk, false);
  assert.ok(lotteryCalc.projectedPick <= 14);

  const mockCareer = {
    ovr: 75,
    twoWaySeasonsUsed: 1,
  } as CareerState;
  const survPromoted = evaluateTwoWaySurvival(mockCareer, 7.2);
  assert.equal(survPromoted.status, 'PROMOTED');

  const survWaived = evaluateTwoWaySurvival(
    { ovr: 71, twoWaySeasonsUsed: 2 } as CareerState,
    5.4
  );
  assert.equal(survWaived.status, 'WAIVED');
});

test('Aging curve and retirement eligibility evaluate properly', () => {
  const initial = createInitialStats('PG', 188);
  const ovr = calculateOvr(initial, 'PG');
  assert.ok(ovr >= 45 && ovr <= 65);

  const aged34 = applyAgingCurve(
    34,
    { ins: 80, out: 85, ply: 82, def: 78, reb: 65, phy: 76 },
    () => 0.5
  );
  assert.ok(aged34.delta.phy <= -3 && aged34.delta.phy >= -5);
  assert.ok(aged34.delta.ins <= -1);

  const growthAtCap = calculateSeasonStatGrowth(
    {
      age: 20,
      ovr: 62, // above HIGH_SCHOOL growthCap (60)
      potential: 90,
      league: 'HIGH_SCHOOL',
      stats: { ins: 62, out: 62, ply: 62, def: 62, reb: 62, phy: 62 },
      trainingFocus: 'BALANCED',
    },
    30,
    () => 0.5
  );
  // Growth should be heavily damped by capPenalty = 0.28
  assert.ok(growthAtCap.delta.ins <= 2);

  const dummyCareer: CareerState = {
    id: 'TEST',
    name: '테스트레전드',
    jerseyNumber: '23',
    heightCm: 198,
    primaryPos: 'SG',
    secondaryPos: 'SF',
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
    twoWaySeasonsUsed: 0,
    role: '프랜차이즈 1옵션 에이스',
    coachTrust: 95,
    draftStock: 90,
    trainingFocus: 'BALANCED',
    militaryExempt: true,
    isFarewellTour: false,
    farewellTourCompleted: false,
    isOutOfLeagueWarning: false,
    badges: [],
    seasonLogs: [
      {
        seasonNumber: 1,
        year: 2039,
        age: 34,
        league: 'NBA',
        leagueName: 'NBA',
        teamId: NBA_TEAMS[0].id,
        teamName: NBA_TEAMS[0].name,
        teamShortName: NBA_TEAMS[0].shortName,
        contractType: 'NBA_MAX',
        role: '프랜차이즈 1옵션 에이스',
        ovr: 92,
        gp: 80,
        mpg: 35.2,
        ppg: 28.4,
        rpg: 6.5,
        apg: 6.1,
        spg: 1.8,
        bpg: 0.7,
        fgPct: 51.2,
        tpPct: 40.5,
        wins: 60,
        losses: 22,
        wonChampionship: true,
        wonMvp: true,
        wonRookieOfYear: false,
        allStarSelected: true,
        singleGameHighPts: 54,
        headline: '테스트 헤드라인',
        narrativeLog: [],
      },
    ],
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
  };

  const elig = checkRetirementEligibility(dummyCareer);
  assert.equal(elig.canRetireVoluntarily, true);
  assert.equal(elig.canDeclareFarewellTour, true);
  assert.equal(elig.isOutOfLeague, false);

  const legacy = evaluateCareerLegacy(dummyCareer);
  assert.equal(legacy.jerseyRetired, true);
  assert.equal(legacy.tierId, 'GOAT');
  assert.ok(legacy.honoredTeam.id === KBL_TEAMS[0].id || legacy.honoredTeam.id === NBA_TEAMS[0].id);
});
