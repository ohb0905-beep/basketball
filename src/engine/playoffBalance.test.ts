import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_BALANCE_META, PLAYOFF_SERIES_CONFIG } from '../config/balanceConfig';
import { LEAGUE_CONFIG } from '../data/leagues';
import type { CareerState, LeagueId, PlayerStats } from '../types/game';
import { calculateOvr } from './statCalculator';
import type { PlayoffBracketState, PlayoffSeriesMatchup, StandingEntry } from '../types/game';
import { resolveConfFinalsGame7InBracket } from './playoffEngine';
import {
  getDecisiveGameContext,
  resolveFinalsLiveGameInBracket,
  simulateFinalsToDecisiveGame,
} from './finalsSeries';
import { mulberry32 } from '../../scripts/seededRandom';
import {
  calculatePlayoffPlayerBonus,
  countExtraSeriesGames,
  getPlayoffSeed,
  getSeriesSeedModifiers,
} from './playoffStrength';

function careerOf(league: LeagueId, stat: number, mpg: number): CareerState {
  const stats: PlayerStats = { ins: stat, out: stat, ply: stat, def: stat, reb: stat, phy: stat };
  return {
    league,
    primaryPos: 'SG',
    heightCm: 192,
    stats,
    traits: [],
    seasonLogs: [{ league, mpg, gp: LEAGUE_CONFIG[league].games, injuredGamesMissed: 0 }],
  } as unknown as CareerState;
}

const ovrOf = (c: CareerState) => calculateOvr(c.stats, c.primaryPos, c.heightCm);

test('PO 선수 보너스: 정규시즌 기여 수준', () => {
  const nba = careerOf('NBA', 98, 34.5);
  assert.equal(ovrOf(nba), 93);
  // 경기당 승률 환산(보너스 × 기울기)으로 비교해 기울기와 무관하게 정규시즌 기여 수준을 유지
  const slope = PLAYOFF_SERIES_CONFIG.gameWinProbSlope;
  const nbaBonus = calculatePlayoffPlayerBonus(nba) * slope;
  assert.ok(nbaBonus >= 0.108 && nbaBonus <= 0.14, `NBA ${nbaBonus}`);

  const kbl = careerOf('KBL', 80, 32.5);
  assert.equal(ovrOf(kbl), 80);
  const kblBonus = calculatePlayoffPlayerBonus(kbl) * slope;
  assert.ok(kblBonus >= 0.108 && kblBonus <= 0.16, `KBL ${kblBonus}`);

  // 기준선 OVR이면 보너스는 사실상 0
  const base = careerOf('NBA', 84, 34.5);
  assert.equal(ovrOf(base), LEAGUE_BALANCE_META.NBA.playerBaselineOvr);
  assert.ok(Math.abs(calculatePlayoffPlayerBonus(base)) <= 0.5);

  const max = calculatePlayoffPlayerBonus(careerOf('NBA', 99, 38));
  assert.ok(max <= PLAYOFF_SERIES_CONFIG.maxPositivePlayerBonus);

  assert.ok(
    calculatePlayoffPlayerBonus(careerOf('NBA', 98, 34)) >
      calculatePlayoffPlayerBonus(careerOf('NBA', 98, 10))
  );
});

function entryOf(id: string, rank: number, conferenceRank?: number): StandingEntry {
  return { rank, conferenceRank, team: { id } } as unknown as StandingEntry;
}

function seriesOf(
  roundNumber: number,
  hi: StandingEntry,
  lo: StandingEntry,
  hiWins = 0,
  loWins = 0,
  winsNeeded = 4
): PlayoffSeriesMatchup {
  return {
    roundNumber,
    winsNeeded,
    higherSeed: hi,
    lowerSeed: lo,
    higherSeedWins: hiWins,
    lowerSeedWins: loWins,
  } as unknown as PlayoffSeriesMatchup;
}

function bracketOf(league: LeagueId, ...rounds: PlayoffSeriesMatchup[][]): PlayoffBracketState {
  return { league, rounds } as unknown as PlayoffBracketState;
}

test('시드 판정', () => {
  assert.equal(getPlayoffSeed(entryOf('a', 9, 3), 'NBA'), 3);
  assert.equal(getPlayoffSeed(entryOf('a', 7), 'EUROLEAGUE'), 7);
  assert.equal(getPlayoffSeed(entryOf('a', 12, 10), 'NBA'), 10);
});

test('누적 체력', () => {
  const a = entryOf('A', 1, 1);
  const b = entryOf('B', 2, 2);
  const bracket = bracketOf(
    'NBA',
    [seriesOf(1, a, entryOf('X', 8, 8), 4, 3), seriesOf(1, b, entryOf('Y', 7, 7), 4, 0)],
    [seriesOf(2, a, b)]
  );
  assert.equal(countExtraSeriesGames(bracket, 'A', 2), 3);
  assert.equal(countExtraSeriesGames(bracket, 'B', 2), 0);
  const mods = getSeriesSeedModifiers(bracket, bracket.rounds[1][0]);
  assert.ok(Math.abs(mods.hi - -1.05) < 1e-9, `hi ${mods.hi}`);
  assert.equal(mods.lo, 0);
});

test('체력 상한', () => {
  const a = entryOf('A', 1, 1);
  const bracket = bracketOf('NBA', [seriesOf(1, a, entryOf('X', 8, 8), 4, 10)], [seriesOf(2, a, entryOf('B', 2, 2))]);
  // 4-10은 비현실적이지만 추가 경기 10(14 - 4)을 만들기 위한 값
  assert.equal(countExtraSeriesGames(bracket, 'A', 2), 10);
  assert.equal(getSeriesSeedModifiers(bracket, bracket.rounds[1][0]).hi, -2.5);
});

test('하위 시드 뎁스', () => {
  const top = entryOf('T', 1, 1);
  const six = entryOf('S6', 11, 6);
  const nba = (round: number, hi: StandingEntry, lo: StandingEntry) => {
    const s = seriesOf(round, hi, lo);
    return getSeriesSeedModifiers(bracketOf('NBA', [s]), s);
  };
  assert.equal(nba(2, top, six).lo, -0.9);
  assert.equal(nba(3, top, six).lo, -1.8);
  assert.equal(nba(1, entryOf('S5', 9, 5), six).lo, 0);
  assert.equal(nba(1, entryOf('S5', 9, 5), six).hi, 0);
  const ncaa = seriesOf(2, entryOf('N2', 2), entryOf('N7', 7));
  assert.equal(getSeriesSeedModifiers(bracketOf('NCAA', [ncaa]), ncaa).lo, 0);
});

test('보정은 AI에도 똑같이', () => {
  const s = seriesOf(2, entryOf('AI1', 1, 1), entryOf('AI2', 11, 6));
  const bracket = bracketOf('NBA', [s]);
  assert.deepEqual(getSeriesSeedModifiers(bracket, s), { hi: 0, lo: -0.9 });
});

test('컨퍼런스 파이널 7차전 해결 시 AI 시리즈에도 보정 적용', () => {
  const team = (id: string) => ({ id, name: id, shortName: id, rating: 80 });
  const ent = (id: string, seed: number) =>
    ({ rank: seed, conferenceRank: seed, team: team(id) }) as unknown as StandingEntry;
  const a = ent('A', 1);
  const round1 = seriesOf(1, a, ent('X', 8), 4, 14); // A 추가 경기 10 -> -2.5
  const ai = { ...seriesOf(2, a, ent('B', 2)), involvesPlayer: false, winnerId: null, summaryLog: [] };
  const player = {
    ...seriesOf(2, ent('P', 3), ent('Q', 4), 3, 3),
    involvesPlayer: true,
    winnerId: null,
    summaryLog: [],
  };
  const bracket = {
    ...bracketOf('NBA', [round1], [ai, player]),
    currentRound: 2,
    totalRounds: 3,
  } as unknown as PlayoffBracketState;
  const career = { ...careerOf('NBA', 84, 30), team: team('P') } as unknown as CareerState;
  // 동률 레이팅, rng 0.5: 홈 1차전 상위 시드 확률 0.54(무보정) vs 0.49(보정) -> 보정 시 하위 시드가 1차전 승리
  const out = resolveConfFinalsGame7InBracket(bracket, career, [], true, '', () => 0.5);
  assert.match(out.rounds[1][0].summaryLog[0], /^1차전: B 승리/);
});

const finalsTeam = (id: string) => ({ id, name: id, shortName: id, rating: 80 });
const finalsEntry = (id: string, seed: number) =>
  ({ rank: seed, conferenceRank: seed, team: finalsTeam(id) }) as unknown as StandingEntry;

function finalsOf(league: LeagueId, hiWins: number, loWins: number, bestOf = 7) {
  const series = {
    ...seriesOf(1, finalsEntry('P', 1), finalsEntry('Q', 2), hiWins, loWins, (bestOf + 1) / 2),
    bestOf,
    involvesPlayer: true,
    winnerId: null,
    summaryLog: [],
  } as unknown as PlayoffSeriesMatchup;
  const bracket = {
    ...bracketOf(league, [series]),
    currentRound: 1,
    totalRounds: 1,
    championTeamId: null,
  } as unknown as PlayoffBracketState;
  const career = { ...careerOf(league, 84, 30), team: finalsTeam('P') } as unknown as CareerState;
  return { series, bracket, career };
}

test('결정전 판정', () => {
  const ctx = (hi: number, lo: number, bestOf = 7) =>
    getDecisiveGameContext(finalsOf('NBA', hi, lo, bestOf).series, 'P');
  assert.deepEqual(ctx(3, 2), { gameNo: 6, playerWins: 3, oppWins: 2, kind: 'CLINCH' });
  assert.equal(ctx(2, 3)?.kind, 'ELIMINATION');
  assert.deepEqual(ctx(3, 3), { gameNo: 7, playerWins: 3, oppWins: 3, kind: 'WINNER_TAKES_ALL' });
  assert.equal(ctx(2, 2), null);
  assert.deepEqual(ctx(0, 0, 1), { gameNo: 1, playerWins: 0, oppWins: 0, kind: 'WINNER_TAKES_ALL' });
});

test('결정전까지 시뮬', () => {
  const rng = mulberry32(20261126);
  for (let i = 0; i < 50; i++) {
    const { bracket, career } = finalsOf('NBA', 0, 0);
    const out = simulateFinalsToDecisiveGame(bracket, career, rng);
    const s = out.rounds[0][0];
    assert.equal(out.pendingFinalsLiveGame, true);
    assert.equal(out.championTeamId, null);
    assert.ok(getDecisiveGameContext(s, 'P'));
    assert.ok(s.higherSeedWins < 4 && s.lowerSeedWins < 4);
  }
});

test('라이브 승리 후 시리즈 계속', () => {
  const { bracket, career } = finalsOf('NBA', 2, 3);
  const out = resolveFinalsLiveGameInBracket({ ...bracket, pendingFinalsLiveGame: true }, career, [], true, '100-90');
  const s = out.bracket.rounds[0][0];
  assert.equal(out.seriesFinished, false);
  assert.equal(out.bracket.pendingFinalsLiveGame, true);
  assert.equal(s.higherSeedWins, 3);
  assert.equal(s.lowerSeedWins, 3);
  assert.equal(getDecisiveGameContext(s, 'P')?.gameNo, 7);
});

test('라이브로 우승 확정', () => {
  const { bracket, career } = finalsOf('NBA', 3, 2);
  const out = resolveFinalsLiveGameInBracket({ ...bracket, pendingFinalsLiveGame: true }, career, [], true, '100-90');
  assert.equal(out.seriesFinished, true);
  assert.equal(out.bracket.championTeamId, career.team.id);
  assert.equal(out.bracket.playoffResultLabel, '리그 우승');
  assert.equal(out.bracket.pendingFinalsLiveGame, false);
  assert.match(out.bracket.rounds[0][0].summaryLog.at(-1)!, /^6차전 실시간 중계: /);
});

test('라이브 패배로 탈락', () => {
  const { bracket, career } = finalsOf('NBA', 2, 3);
  const out = resolveFinalsLiveGameInBracket({ ...bracket, pendingFinalsLiveGame: true }, career, [], false, '90-100');
  assert.equal(out.seriesFinished, true);
  assert.equal(out.bracket.championTeamId, 'Q');
  assert.equal(out.bracket.playerEliminated, true);
  assert.equal(out.bracket.playoffResultLabel, '파이널 준우승');
});

test('legacy 단판 결정', () => {
  const { bracket, career } = finalsOf('NBA', 0, 0);
  const out = resolveFinalsLiveGameInBracket(bracket, career, [], true, '100-90');
  const s = out.bracket.rounds[0][0];
  assert.equal(out.seriesFinished, true);
  assert.equal(out.bracket.championTeamId, 'P');
  assert.equal(s.higherSeedWins, 4);
  assert.equal(s.lowerSeedWins, 3);
});

test('단판 결승', () => {
  const { bracket, career } = finalsOf('EUROLEAGUE', 0, 0, 1);
  const out = simulateFinalsToDecisiveGame(bracket, career, () => 0.5);
  const s = out.rounds[0][0];
  assert.equal(out.pendingFinalsLiveGame, true);
  assert.equal(s.higherSeedWins, 0);
  assert.equal(s.lowerSeedWins, 0);
  assert.equal(s.winnerId, null);
});
