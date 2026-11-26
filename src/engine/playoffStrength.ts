import {
  CareerState,
  LeagueId,
  PlayoffBracketState,
  PlayoffSeriesMatchup,
  StandingEntry,
} from '../types/game';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  LEAGUE_BALANCE_META,
  PLAYOFF_SEED_CONFIG,
  PLAYOFF_SERIES_CONFIG,
  clampNum,
} from '../config/balanceConfig';
import { calculateBiomechanicalProfile, calculateOvr } from './statCalculator';

function estimateFallbackMpgByRole(role?: string): number {
  if (!role) return 26;
  if (role.includes('에이스') || role.includes('1옵션')) return 34;
  if (role.includes('주전') || role.includes('스타터')) return 29;
  if (role.includes('식스맨')) return 22;
  if (role.includes('로테이션')) return 15;
  if (role.includes('벤치') || role.includes('후보')) return 9;
  return 26;
}

/** 플레이어 소속팀에만 더해지는 PO 레이팅 보너스 (OVR·출전·출장률·클러치·신체 부하 반영) */
export function calculatePlayoffPlayerBonus(career: CareerState): number {
  const ovr = calculateOvr(career.stats, career.primaryPos, career.heightCm);
  const baselinePlayerOvr =
    LEAGUE_BALANCE_META[career.league].playerBaselineOvr;
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const clutchBonus = (career.traits || []).includes('CLUTCH_PERFORMER')
    ? PLAYOFF_SERIES_CONFIG.clutchBonus
    : 0;

  // 출전 비중(MPG) 및 시즌 출장률(장기 부상 감쇠) 반영: 벤치·장기 결장자의 과대 기여 및 과도한 부하 페널티 차단
  const latestLog = career.seasonLogs?.[career.seasonLogs.length - 1];
  const hasMatchingLog = Boolean(latestLog && latestLog.league === career.league);
  const playerMpg = hasMatchingLog
    ? latestLog!.mpg
    : estimateFallbackMpgByRole(career.role);
  const mpgWeight = clampNum(
    playerMpg / 32,
    PLAYOFF_SERIES_CONFIG.minMpgWeight,
    PLAYOFF_SERIES_CONFIG.maxMpgWeight
  );

  let gpWeight = 1.0;
  if (hasMatchingLog && latestLog!.injuredGamesMissed > 0) {
    const leagueGames = Math.max(1, LEAGUE_CONFIG[career.league].games);
    const gpRatio = latestLog!.gp / leagueGames;
    gpWeight =
      latestLog!.injurySeverity === 'MAJOR' || gpRatio < 0.55
        ? clampNum(gpRatio / 0.72, 0.2, 1.0)
        : clampNum(gpRatio / 0.78, 0.45, 1.0);
  }
  const availabilityWeight = mpgWeight * gpWeight;

  // 플레이어 보너스: 리그 표준 주전 기준선(playerBaselineOvr) 대비 기여도 × 출전·부상 가중치
  const rawBonus =
    ((ovr - baselinePlayerOvr) * PLAYOFF_SERIES_CONFIG.playerOvrSlope +
      clutchBonus) *
    availabilityWeight;
  return (
    (rawBonus >= 0
      ? clampNum(rawBonus, 0, PLAYOFF_SERIES_CONFIG.maxPositivePlayerBonus)
      : Math.max(PLAYOFF_SERIES_CONFIG.minNegativePlayerBonus, rawBonus * 0.25)) -
    bio.positionalPhysicsStrain *
      PLAYOFF_SERIES_CONFIG.bioStrainWeight *
      availabilityWeight
  );
}

export function getPlayoffSeed(entry: StandingEntry, league: LeagueId): number {
  return league === 'NBA' || league === 'GLEAGUE'
    ? entry.conferenceRank ?? entry.rank
    : entry.rank;
}

/** 앞 라운드 본선 시리즈에서 필요 승수를 넘겨 더 치른 경기 수 */
export function countExtraSeriesGames(
  bracket: PlayoffBracketState,
  teamId: string,
  beforeRound: number
): number {
  let extra = 0;
  for (const s of bracket.rounds.flat()) {
    if (s.roundNumber >= beforeRound || s.isPlayIn) continue;
    if (s.higherSeed.team.id !== teamId && s.lowerSeed.team.id !== teamId) continue;
    extra += s.higherSeedWins + s.lowerSeedWins - s.winsNeeded;
  }
  return extra;
}

/** 시리즈 양 팀의 레이팅 단위 보정값 (0 이하). 플레이어·AI 팀에 똑같이 적용 */
export function getSeriesSeedModifiers(
  bracket: PlayoffBracketState,
  series: PlayoffSeriesMatchup
): { hi: number; lo: number } {
  const cfg = PLAYOFF_SEED_CONFIG;
  const modOf = (entry: StandingEntry) => {
    const fatigue = Math.min(
      cfg.fatigueCap,
      countExtraSeriesGames(bracket, entry.team.id, series.roundNumber) *
        cfg.fatiguePerExtraGame
    );
    const depthStart = cfg.lowSeedDepthStartByLeague[bracket.league];
    const depth =
      depthStart !== undefined &&
      series.roundNumber >= 2 &&
      getPlayoffSeed(entry, bracket.league) >= depthStart
        ? (series.roundNumber - 1) * cfg.lowSeedDepthPerRound
        : 0;
    return 0 - fatigue - depth; // -0 방지
  };
  return { hi: modOf(series.higherSeed), lo: modOf(series.lowerSeed) };
}
