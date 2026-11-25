import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENDER_PATH_CONFIG,
  KBL_ROOKIE_CONFIG,
  NBA_ENTRY_CONFIG,
  ROLE_MPG_CONFIG,
} from '../config/balanceConfig';
import { createCoachChanceEvent, rollMidSeasonCrossroadsEvent } from '../data/events';
import { getTeamsByLeague, NBA_TEAMS } from '../data/teams';
import {
  determineTeamRolePromise,
  generateOffseasonOptions,
  isContenderPathEligible,
} from './draftEngine';
import { evaluateFreshmanAdaptation, isNcaaFreshmanSeason } from './freshmanAdaptation';
import { calculateRoleAndMpg } from './seasonSimulator';
import type { CareerState, SeasonBoxScore } from '../types/game';
import { tagPreviewGameVersion } from '../lib/analyticsSchema';

const fixedRng = () => 0.5;

function log(overrides: Partial<SeasonBoxScore> = {}): SeasonBoxScore {
  return {
    seasonNumber: 1,
    year: 2030,
    age: 25,
    league: 'NBA',
    leagueName: 'NBA',
    teamId: NBA_TEAMS[0].id,
    teamName: NBA_TEAMS[0].name,
    teamShortName: NBA_TEAMS[0].shortName,
    contractType: 'NBA_STANDARD',
    role: '프랜차이즈 1옵션 에이스',
    ovr: 86,
    gp: 78,
    injuredGamesMissed: 0,
    mpg: 34,
    ppg: 25,
    rpg: 6,
    apg: 5,
    spg: 1.2,
    bpg: 0.5,
    fgPct: 48,
    tpPct: 37,
    wins: 30,
    losses: 52,
    teamRank: 24,
    totalLeagueTeams: 30,
    playoffResult: 'PO 탈락',
    salaryEarned: 1000000,
    wonChampionship: false,
    wonMvp: false,
    wonFinalsMvp: false,
    wonDpoy: false,
    wonSixthMan: false,
    wonMip: false,
    wonRookieOfYear: false,
    allStarSelected: false,
    allLeagueTeam: null,
    singleGameHighPts: 40,
    headline: '',
    narrativeLog: [],
    ...overrides,
  } as SeasonBoxScore;
}

test('1.1.0-1 고교 가비지 타임 선수에게 코치의 기회가 열리고, 잡으면 그 시즌 로테이션이 보장된다', () => {
  const hsTeam = getTeamsByLeague('HIGH_SCHOOL')[0];
  const career = {
    league: 'HIGH_SCHOOL',
    team: hsTeam,
    role: '가비지 타임 (벤치 끝자리)',
    seasonYear: 2026,
    contractType: 'AMATEUR',
    coachTrust: 50,
    seasonsOnCurrentTeam: 0,
    brokenRolePromise: false,
  } as unknown as CareerState;

  const evt = rollMidSeasonCrossroadsEvent(career, () => 0.01);
  assert.equal(evt.id, 'EVT_MID_HS_COACH_CHANCE_2026');
  assert.ok(evt.choices.some((c) => c.grantRotationThisSeason));

  // 기회를 이미 잡은 시즌에는 다시 나오지 않음
  const again = rollMidSeasonCrossroadsEvent(
    { ...career, coachChanceRotationYear: 2026 } as CareerState,
    () => 0.01
  );
  assert.notEqual(again.id, 'EVT_MID_HS_COACH_CHANCE_2026');
  // 가비지가 아닌 고교 선수에게는 나오지 않음
  const starter = rollMidSeasonCrossroadsEvent(
    { ...career, role: '주전 스타터' } as CareerState,
    () => 0.01
  );
  assert.notEqual(starter.id, 'EVT_MID_HS_COACH_CHANCE_2026');
  assert.equal(createCoachChanceEvent(career).title, '코치의 기회');

  const base = {
    ovr: hsTeam.rating - 14,
    team: hsTeam,
    coachTrust: 40,
    secondaryPos: null,
    contractType: 'AMATEUR',
    league: 'HIGH_SCHOOL',
    seasonLogs: [],
    seasonYear: 2026,
  } as unknown as Parameters<typeof calculateRoleAndMpg>[0];
  const without = calculateRoleAndMpg(base, fixedRng);
  assert.equal(without.role, '가비지 타임 (벤치 끝자리)');
  const withChance = calculateRoleAndMpg({ ...base, coachChanceRotationYear: 2026 }, fixedRng);
  assert.equal(withChance.role, '벤치 로테이션');
  assert.ok(withChance.mpg >= ROLE_MPG_CONFIG.coachChance.minMpg);
  // 다음 시즌에는 효과 없음
  const nextSeason = calculateRoleAndMpg(
    { ...base, seasonYear: 2027, coachChanceRotationYear: 2026 },
    fixedRng
  );
  assert.equal(nextSeason.role, '가비지 타임 (벤치 끝자리)');
});

test('1.1.0-2 NCAA 신입 적응 목표는 첫 NCAA 시즌에만 열리고 달성 수만큼 주가 보너스를 준다', () => {
  assert.equal(isNcaaFreshmanSeason({ league: 'NCAA', seasonLogs: [] }), true);
  assert.equal(
    isNcaaFreshmanSeason({ league: 'NCAA', seasonLogs: [log({ league: 'NCAA' })] }),
    false
  );
  assert.equal(isNcaaFreshmanSeason({ league: 'U_LEAGUE', seasonLogs: [] }), false);

  const both = evaluateFreshmanAdaptation({ mpg: 22, playerRoyRank: 2, wonRookieOfYear: false });
  assert.equal(both.achievedCount, 2);
  assert.ok(both.draftStockBonus > 2 * 3 - 1);
  const roy = evaluateFreshmanAdaptation({ mpg: 9, playerRoyRank: null, wonRookieOfYear: true });
  assert.equal(roy.goals.find((g) => g.id === 'ROY_RACE')?.achieved, true);
  assert.equal(roy.goals.find((g) => g.id === 'ROTATION')?.achieved, false);
  const none = evaluateFreshmanAdaptation({ mpg: 8, playerRoyRank: null, wonRookieOfYear: false });
  assert.equal(none.achievedCount, 0);
  assert.equal(none.draftStockBonus, 0);
});

test('1.1.0-3 NBA 루키는 같은 조건의 3년차보다 출전 시간이 적고, 신규 입성 시 에이스 약속을 받기 어렵다', () => {
  const team = [...NBA_TEAMS].sort((a, b) => a.rating - b.rating)[0];
  const base = {
    ovr: team.rating + 2,
    team,
    coachTrust: 60,
    secondaryPos: null,
    contractType: 'NBA_STANDARD',
    league: 'NBA',
    primaryPos: 'SG',
  } as unknown as Parameters<typeof calculateRoleAndMpg>[0];
  const rookie = calculateRoleAndMpg({ ...base, seasonLogs: [] }, fixedRng);
  const vet = calculateRoleAndMpg(
    { ...base, seasonLogs: [log({ mpg: 0 }), log({ mpg: 0 }), log({ mpg: 0 })] },
    fixedRng
  );
  assert.ok(rookie.mpg < vet.mpg, `rookie ${rookie.mpg} < vet ${vet.mpg}`);
  assert.equal(NBA_ENTRY_CONFIG.adaptationPenaltyBySeason.length, 3);

  const newcomerPromise = determineTeamRolePromise(
    { ovr: team.rating + 4, age: 23, potential: 90, seasonLogs: [log({ league: 'GLEAGUE' })] },
    team,
    'NBA_STANDARD',
    { isResigning: false }
  );
  assert.notEqual(newcomerPromise.promisedRole, 'ACE_FIRST_OPTION');
  const vetPromise = determineTeamRolePromise(
    { ovr: team.rating + 4, age: 27, potential: 90, seasonLogs: [log()] },
    team,
    'NBA_STANDARD',
    { isResigning: false }
  );
  assert.equal(vetPromise.promisedRole, 'ACE_FIRST_OPTION');
});

test('1.1.0-4 KBL 신인 적응 페널티는 프로 경력 없는 신인에게만 적용된다', () => {
  const team = getTeamsByLeague('KBL').filter((t) => !t.isMilitaryTeam)[0];
  const base = {
    ovr: team.rating - 2,
    team,
    coachTrust: 62,
    secondaryPos: null,
    contractType: 'KBL_ROOKIE',
    league: 'KBL',
    primaryPos: 'SG',
  } as unknown as Parameters<typeof calculateRoleAndMpg>[0];
  const rookie = calculateRoleAndMpg({ ...base, seasonLogs: [log({ league: 'U_LEAGUE', mpg: 0 })] }, fixedRng);
  const returnee = calculateRoleAndMpg(
    { ...base, seasonLogs: [log({ league: 'NBA', mpg: 0 })] },
    fixedRng
  );
  assert.ok(rookie.mpg < returnee.mpg, `rookie ${rookie.mpg} < returnee ${returnee.mpg}`);
  assert.ok(KBL_ROOKIE_CONFIG.adaptationPenaltyBySeason[0] > 0);
});

test('1.1.0-5 PO 2년 연속 실패한 NBA 에이스에게 우승 도전팀 이적 카드가 열리고 2옵션 출전 상한이 적용된다', () => {
  const weak = [...NBA_TEAMS]
    .filter((t) => t.direction !== 'CONTENDER')
    .sort((a, b) => a.rating - b.rating)[0];
  const logs = [
    log({ year: 2030, teamId: weak.id }),
    log({ year: 2031, teamId: weak.id }),
  ];
  const elig = {
    league: 'NBA',
    team: weak,
    contractType: 'NBA_STANDARD',
    age: 27,
    seasonLogs: logs,
    role: '프랜차이즈 1옵션 에이스',
  } as unknown as CareerState;
  assert.equal(isContenderPathEligible(elig), true);
  assert.equal(
    isContenderPathEligible({
      ...elig,
      seasonLogs: [logs[0], { ...logs[1], playoffResult: '1R 탈락' }],
    } as CareerState),
    false
  );
  assert.equal(
    isContenderPathEligible({ ...elig, seasonLogs: [logs[1]] } as CareerState),
    false
  );
  assert.equal(
    isContenderPathEligible({ ...elig, age: CONTENDER_PATH_CONFIG.maxAge + 1 } as CareerState),
    false
  );

  const contender = getTeamsByLeague('NBA').find((t) => t.direction === 'CONTENDER')!;
  const base = {
    ovr: contender.rating + 8,
    team: contender,
    coachTrust: 80,
    secondaryPos: 'SF',
    contractType: 'NBA_STANDARD',
    league: 'NBA',
    primaryPos: 'SG',
    seasonLogs: [log({ mpg: 0 }), log({ mpg: 0 }), log({ mpg: 0 })],
    promisedRole: 'ACE_FIRST_OPTION',
  } as unknown as Parameters<typeof calculateRoleAndMpg>[0];
  const free = calculateRoleAndMpg(base, fixedRng);
  const secondOption = calculateRoleAndMpg(
    { ...base, contenderPathTeamId: contender.id, seasonsOnCurrentTeam: 0 },
    fixedRng
  );
  assert.ok(secondOption.mpg <= CONTENDER_PATH_CONFIG.secondOptionMaxMpg);
  assert.ok(secondOption.mpg <= free.mpg);
  const afterTwo = calculateRoleAndMpg(
    { ...base, contenderPathTeamId: contender.id, seasonsOnCurrentTeam: 2 },
    fixedRng
  );
  assert.equal(afterTwo.mpg, free.mpg);
});

test('1.1.0-6 우승 도전팀 이적 카드가 오프시즌 선택지에 포함된다', async () => {
  const { useCareerStore } = await import('../store/useCareerStore');
  const store = useCareerStore.getState();
  store.resetAllGameData();
  store.startNewCareer({
    name: '테스트',
    jerseyNumber: '7',
    heightCm: 192,
    primaryPos: 'SG',
    highSchoolTeamId: 'HS_SAMIL',
  });
  const seed = useCareerStore.getState().career!;
  const weak = [...NBA_TEAMS]
    .filter((t) => t.direction !== 'CONTENDER')
    .sort((a, b) => a.rating - b.rating)[0];
  const career: CareerState = {
    ...seed,
    league: 'NBA',
    team: weak,
    age: 27,
    ovr: 88,
    contractType: 'NBA_STANDARD',
    contractYearsLeft: 2,
    role: '프랜차이즈 1옵션 에이스',
    seasonLogs: [
      log({ year: 2030, teamId: weak.id }),
      log({ year: 2031, teamId: weak.id }),
    ],
  };
  const options = generateOffseasonOptions(career, fixedRng);
  const contenderOptions = options.filter((o) => o.contenderPath);
  assert.ok(contenderOptions.length >= 2, `contender options ${contenderOptions.length}`);
  assert.ok(contenderOptions.length <= CONTENDER_PATH_CONFIG.maxOffers);
  for (const o of contenderOptions) {
    assert.equal(o.targetTeam?.direction, 'CONTENDER');
    assert.equal(o.actionType, 'REQUEST_TRADE');
    assert.ok((o.tradeAcceptChancePct ?? 0) > 0);
  }
  store.resetAllGameData();
});

test('1.1.0-7 미리보기 배포 이벤트는 game_version에 -preview가 붙어 정식 통계와 분리된다', () => {
  assert.equal(tagPreviewGameVersion('1.1.0', 'preview'), '1.1.0-preview');
  assert.equal(tagPreviewGameVersion('1.1.0-preview', 'preview'), '1.1.0-preview');
  assert.equal(tagPreviewGameVersion(null, 'preview'), 'unknown-preview');
  assert.equal(tagPreviewGameVersion('1.1.0', 'production'), '1.1.0');
  assert.equal(tagPreviewGameVersion('1.1.0', undefined), '1.1.0');
});
