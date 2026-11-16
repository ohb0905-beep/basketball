import { FAREWELL_TOUR_LOGS } from '../data/events';
import { generateSeasonHeadline, generateSeasonNarrativeLogs } from '../data/headlines';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  CareerState,
  PlayerStats,
  SeasonBoxScore,
  StatDelta,
  TrainingFocus,
} from '../types/game';
import { applyAgingCurve } from './retirementEngine';
import { calculateOvr, evaluatePlayerBadges } from './statCalculator';

export interface RoleAndMpgResult {
  roleIndex: number;
  role: string;
  mpg: number;
  gp: number;
  basePer36: number;
}

/**
 * 3-2. 팀 내 입지(Role) 및 출전 시간(MPG) 산출 공식
 */
export function calculateRoleAndMpg(
  career: Pick<CareerState, 'ovr' | 'team' | 'coachTrust' | 'secondaryPos' | 'contractType' | 'league'>,
  rng: () => number = Math.random
): RoleAndMpgResult {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const dualBonus = career.secondaryPos ? 2.5 : 0;
  const roleIndex =
    career.ovr - career.team.rating + (career.coachTrust - 50) * 0.18 + dualBonus;

  if (career.contractType === 'TWO_WAY') {
    const gp = Math.min(50, Math.round(18 + rng() * 24));
    const role = '투웨이 콜업 로테이션';
    const mpg = Number((8.5 + Math.max(0, (career.ovr - 70) * 1.1)).toFixed(1));
    return {
      roleIndex,
      role,
      mpg,
      gp,
      basePer36: 12.5,
    };
  }

  let role = '가비지 타임 (벤치 끝자리)';
  let mpg = 6.0;
  let gp = leagueConfig.games;
  let basePer36 = 10.5;

  if (roleIndex < -9) {
    role = '가비지 타임 (벤치 끝자리)';
    mpg = Number((4.0 + rng() * 4.5).toFixed(1));
    gp = Math.max(1, Math.round(leagueConfig.games * 0.55));
    basePer36 = 10.5;
  } else if (roleIndex < -3) {
    role = '벤치 로테이션';
    mpg = Number((11.0 + rng() * 5.5).toFixed(1));
    gp = Math.max(1, Math.round(leagueConfig.games * (0.82 + rng() * 0.14)));
    basePer36 = 12.5;
  } else if (roleIndex < 2) {
    role = '핵심 식스맨';
    mpg = Number((18.5 + rng() * 5.5).toFixed(1));
    gp = Math.max(1, Math.round(leagueConfig.games * (0.9 + rng() * 0.1)));
    basePer36 = 15.8;
  } else if (roleIndex < 7) {
    role = '주전 스타터';
    mpg = Number((26.5 + rng() * 5.0).toFixed(1));
    gp = Math.max(1, Math.round(leagueConfig.games * (0.92 + rng() * 0.08)));
    basePer36 = 18.5;
  } else {
    role = '프랜차이즈 1옵션 에이스';
    mpg = Number((33.0 + rng() * 3.8).toFixed(1));
    gp = Math.max(1, Math.round(leagueConfig.games * (0.94 + rng() * 0.06)));
    basePer36 = 23.5;
  }

  return {
    roleIndex,
    role,
    mpg,
    gp,
    basePer36,
  };
}

/**
 * 3-3. 상대 수비 저항치(ldr)와 25득점 소프트캡이 적용된 평균 득점(PPG) 공식
 */
export function calculatePpg(
  stats: Pick<PlayerStats, 'ins' | 'out'>,
  ldr: number,
  mpg: number,
  basePer36: number,
  rng: () => number = Math.random
): { ppg: number; offEdge: number; rawPpg: number } {
  const attackStat = stats.ins * 0.52 + stats.out * 0.48;
  const offEdge = Math.max(0.32, 1.0 + (attackStat - ldr) / 30);
  const rawPpg = (mpg / 36) * basePer36 * offEdge + (rng() * 2.0 - 1.0);
  const finalPpg = rawPpg > 25.0 ? 25.0 + (rawPpg - 25.0) * 0.35 : rawPpg;
  const ppg = Math.max(1.2, Math.min(34.5, Number(finalPpg.toFixed(1))));

  return { ppg, offEdge, rawPpg };
}

/**
 * 3-4. 리그별 성장 상한선(growthCap)이 적용된 시즌 성장 공식 + 30대 에이징 커브 결합
 */
export function calculateSeasonStatGrowth(
  career: Pick<CareerState, 'age' | 'ovr' | 'potential' | 'league' | 'stats' | 'trainingFocus'>,
  mpg: number,
  rng: () => number = Math.random
): { nextStats: PlayerStats; delta: StatDelta } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const prev = career.stats;

  // 만 28세 이하: 성장 구간
  if (career.age <= 28) {
    const ptFactor = mpg >= 25 ? 1.25 : mpg >= 15 ? 0.95 : 0.55;
    const capPenalty = career.ovr >= leagueConfig.growthCap ? 0.28 : 1.0;
    const potPenalty = career.ovr >= career.potential ? 0.25 : 1.0;

    // 나이별 기초 성장 계수 (어릴수록 잠재 흡수력이 빠름)
    const ageMultiplier = career.age <= 21 ? 1.25 : career.age <= 24 ? 1.05 : 0.78;
    const baseGain = 2.6 * ptFactor * capPenalty * potPenalty * ageMultiplier;

    const focusWeights: Record<TrainingFocus, Partial<Record<keyof PlayerStats, number>>> = {
      INSIDE_SCORING: { ins: 1.85, phy: 1.15, reb: 1.05, out: 0.7, ply: 0.75, def: 0.75 },
      OUTSIDE_SHOOTING: { out: 1.9, ply: 1.15, ins: 0.8, def: 0.7, reb: 0.65, phy: 0.75 },
      PLAYMAKING: { ply: 1.9, out: 1.15, ins: 0.85, def: 0.8, phy: 0.8, reb: 0.6 },
      DEFENSE_LOCKDOWN: { def: 1.9, phy: 1.25, reb: 1.05, ins: 0.7, out: 0.7, ply: 0.7 },
      REBOUND_POST: { reb: 1.9, ins: 1.25, phy: 1.15, def: 1.0, out: 0.55, ply: 0.6 },
      PHYSICAL_CONDITIONING: { phy: 1.95, def: 1.15, reb: 1.1, ins: 1.05, out: 0.65, ply: 0.7 },
      BALANCED: { ins: 1.05, out: 1.05, ply: 1.05, def: 1.05, reb: 1.05, phy: 1.05 },
    };

    const fw = focusWeights[career.trainingFocus];
    const keys: (keyof PlayerStats)[] = ['ins', 'out', 'ply', 'def', 'reb', 'phy'];
    const nextStats: PlayerStats = { ...prev };
    const delta: StatDelta = { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 };

    for (const k of keys) {
      const w = fw[k] ?? 1.0;
      const rawStep = baseGain * w * (0.75 + rng() * 0.5);
      const gain = Math.max(0, Math.round(rawStep));
      const updated = Math.min(99, prev[k] + gain);
      nextStats[k] = updated;
      delta[k] = updated - prev[k];
    }

    return { nextStats, delta };
  }

  // 만 29세: 전성기 유지 구간 (미세 성장 +1 ~ 0)
  if (career.age === 29) {
    const nextStats: PlayerStats = { ...prev };
    const delta: StatDelta = { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 };
    if (career.ovr < leagueConfig.growthCap) {
      const bonusKey: keyof PlayerStats =
        career.trainingFocus === 'OUTSIDE_SHOOTING'
          ? 'out'
          : career.trainingFocus === 'PLAYMAKING'
          ? 'ply'
          : 'ins';
      if (nextStats[bonusKey] < 99) {
        nextStats[bonusKey] += 1;
        delta[bonusKey] = 1;
      }
    }
    return { nextStats, delta };
  }

  // 만 30세 이상: retirementEngine의 에이징 커브(노쇠화) 수식 적용
  return applyAgingCurve(career.age, prev, rng);
}

export interface SimulatedSeasonResult {
  boxScore: SeasonBoxScore;
  nextStats: PlayerStats;
  statDelta: StatDelta;
  nextOvr: number;
  nextCoachTrust: number;
  nextDraftStock: number;
  nextBadges: string[];
}

/**
 * 한 시즌 전체 시뮬레이션 실행
 */
export function simulateSeason(
  career: CareerState,
  rng: () => number = Math.random
): SimulatedSeasonResult {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const { role, mpg, gp, basePer36, roleIndex } = calculateRoleAndMpg(career, rng);
  const { ppg, offEdge } = calculatePpg(career.stats, leagueConfig.ldr, mpg, basePer36, rng);

  // 리바운드(RPG), 어시스트(APG), 스틸(SPG), 블록(BPG) 산출
  const rebEdge = Math.max(0.35, 1.0 + (career.stats.reb - leagueConfig.ldr) / 34);
  const plyEdge = Math.max(0.35, 1.0 + (career.stats.ply - leagueConfig.ldr) / 34);
  const defEdge = Math.max(0.35, 1.0 + (career.stats.def - leagueConfig.ldr) / 36);

  const posRebBase =
    career.primaryPos === 'C'
      ? 10.6
      : career.primaryPos === 'PF'
      ? 8.8
      : career.primaryPos === 'SF'
      ? 6.2
      : career.primaryPos === 'SG'
      ? 4.4
      : 3.8;

  const posAstBase =
    career.primaryPos === 'PG'
      ? 8.4
      : career.primaryPos === 'SG'
      ? 4.6
      : career.primaryPos === 'SF'
      ? 4.2
      : career.primaryPos === 'PF'
      ? 3.1
      : 2.8;

  const rpg = Math.max(
    0.8,
    Math.min(16.5, Number(((mpg / 36) * posRebBase * rebEdge + (rng() * 1.0 - 0.5)).toFixed(1)))
  );
  const apg = Math.max(
    0.5,
    Math.min(13.2, Number(((mpg / 36) * posAstBase * plyEdge + (rng() * 0.9 - 0.45)).toFixed(1)))
  );
  const spg = Math.max(
    0.2,
    Math.min(3.1, Number(((mpg / 36) * 1.55 * defEdge + (rng() * 0.3 - 0.15)).toFixed(1)))
  );
  const posBlkMult =
    career.primaryPos === 'C' ? 2.2 : career.primaryPos === 'PF' ? 1.55 : 0.65;
  const bpg = Math.max(
    0.1,
    Math.min(3.6, Number(((mpg / 36) * posBlkMult * defEdge + (rng() * 0.25 - 0.1)).toFixed(1)))
  );

  // 야투율 및 3점 성공률
  const fgPct = Number(
    Math.max(36.5, Math.min(64.5, 42.5 + (offEdge - 1.0) * 11.5 + rng() * 3.0)).toFixed(1)
  );
  const outEdge = (career.stats.out - leagueConfig.ldr) / 35;
  const tpPct = Number(
    Math.max(25.0, Math.min(46.8, 33.5 + outEdge * 9.5 + rng() * 2.5)).toFixed(1)
  );

  // 단일 경기 최다 득점(커리어하이 판정용)
  const burstFactor = 1.65 + rng() * 0.55;
  const singleGameHighPts = Math.max(
    Math.ceil(ppg + 4),
    Math.min(72, Math.round(ppg * burstFactor + (career.stats.out >= 82 ? 5 : 2)))
  );

  // 구단 승패 및 우승/어워드 판정
  const playerWinContribution =
    roleIndex >= 2 ? (career.ovr - leagueConfig.ldr) * 0.45 : (career.ovr - leagueConfig.ldr) * 0.15;
  const teamStrengthScore = career.team.rating - leagueConfig.ldr + playerWinContribution;
  const winRate = Math.max(0.22, Math.min(0.82, 0.5 + teamStrengthScore * 0.018 + (rng() * 0.1 - 0.05)));
  const wins = Math.round(leagueConfig.games * winRate);
  const losses = leagueConfig.games - wins;

  // 올스타, MVP, 우승 판정
  const perfScore = ppg + rpg * 0.65 + apg * 0.85;
  const allStarThreshold = career.league === 'NBA' ? 27.5 : 22.5;
  const mvpThreshold = career.league === 'NBA' ? 36.5 : 29.0;

  const allStarSelected =
    gp >= Math.round(leagueConfig.games * 0.65) && perfScore >= allStarThreshold;
  const wonMvp =
    allStarSelected &&
    perfScore >= mvpThreshold &&
    winRate >= 0.56;
  const wonChampionship =
    winRate >= 0.62 && rng() < (winRate >= 0.72 ? 0.52 : 0.28);
  const wonRookieOfYear =
    career.seasonsPlayed === 0 && ppg >= 14.5 && mpg >= 22.0;

  const headlineCtx = {
    playerName: career.name,
    teamName: career.team.name,
    teamShortName: career.team.shortName,
    league: career.league,
    leagueName: leagueConfig.shortName,
    pos: career.primaryPos,
    role,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    singleGameHighPts,
    wonChampionship,
    wonMvp,
    allStarSelected,
    isFarewellTour: career.isFarewellTour,
  };

  const headline = generateSeasonHeadline(headlineCtx);
  const narrativeLog = generateSeasonNarrativeLogs(headlineCtx, FAREWELL_TOUR_LOGS);

  const boxScore: SeasonBoxScore = {
    seasonNumber: career.seasonsPlayed + 1,
    year: career.seasonYear,
    age: career.age,
    league: career.league,
    leagueName: leagueConfig.shortName,
    teamId: career.team.id,
    teamName: career.team.name,
    teamShortName: career.team.shortName,
    contractType: career.contractType,
    role,
    ovr: career.ovr,
    gp,
    mpg,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    fgPct,
    tpPct,
    wins,
    losses,
    wonChampionship,
    wonMvp,
    wonRookieOfYear,
    allStarSelected,
    singleGameHighPts,
    headline,
    narrativeLog,
    isFarewellTour: career.isFarewellTour,
  };

  // 능력치 성장/노쇠화 적용
  const { nextStats, delta: statDelta } = calculateSeasonStatGrowth(career, mpg, rng);
  const nextOvr = calculateOvr(nextStats, career.primaryPos);

  // 감독 신뢰도 및 드래프트 주가 갱신
  const trustChange =
    ppg >= 18 ? 8 : ppg >= 10 ? 5 : ppg >= 6 ? 2 : -2;
  const nextCoachTrust = Math.max(15, Math.min(100, career.coachTrust + trustChange));

  const stockBoost =
    (ppg * 1.15 + rpg * 0.45 + apg * 0.55) * leagueConfig.prestige +
    (wonChampionship ? 12 : 0) +
    (wonMvp ? 15 : 0);
  const nextDraftStock = Math.max(
    10,
    Math.min(100, Math.round(career.draftStock * 0.45 + stockBoost))
  );

  const nextBadges = evaluatePlayerBadges(nextStats, career.secondaryPos);

  return {
    boxScore,
    nextStats,
    statDelta,
    nextOvr,
    nextCoachTrust,
    nextDraftStock,
    nextBadges,
  };
}
