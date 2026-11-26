import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_BALANCE_META, PLAYOFF_SERIES_CONFIG } from '../config/balanceConfig';
import { LEAGUE_CONFIG } from '../data/leagues';
import type { CareerState, LeagueId, PlayerStats } from '../types/game';
import { calculateOvr } from './statCalculator';
import type { PlayoffBracketState, PlayoffSeriesMatchup, StandingEntry } from '../types/game';
import { resolveConfFinalsGame7InBracket } from './playoffEngine';
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
