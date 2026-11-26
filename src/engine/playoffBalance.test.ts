import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_BALANCE_META, PLAYOFF_SERIES_CONFIG } from '../config/balanceConfig';
import { LEAGUE_CONFIG } from '../data/leagues';
import type { CareerState, LeagueId, PlayerStats } from '../types/game';
import { calculateOvr } from './statCalculator';
import { calculatePlayoffPlayerBonus } from './playoffStrength';

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
  const nbaBonus = calculatePlayoffPlayerBonus(nba);
  assert.ok(nbaBonus >= 5.4 && nbaBonus <= 7.0, `NBA ${nbaBonus}`);

  const kbl = careerOf('KBL', 80, 32.5);
  assert.equal(ovrOf(kbl), 80);
  const kblBonus = calculatePlayoffPlayerBonus(kbl);
  assert.ok(kblBonus >= 5.4 && kblBonus <= 8.0, `KBL ${kblBonus}`);

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
