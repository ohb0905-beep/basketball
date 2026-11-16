import { FAREWELL_TOUR_LOGS } from '../data/events';
import { generateSeasonHeadline, generateSeasonNarrativeLogs } from '../data/headlines';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  AllLeagueTier,
  CareerState,
  ContractType,
  GrowthDna,
  PlayerStats,
  PlaystyleArchetype,
  Position,
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
  injuredGamesMissed: number;
  basePer36: number;
}

export function getContractDefaultSalary(contractType: ContractType, ovr: number = 60): number {
  switch (contractType) {
    case 'AMATEUR':
      return 0;
    case 'MILITARY_SERVICE':
      return 5400; // 군 복무 급여 (연 $5.4K 상당)
    case 'KBL_ROOKIE':
      return 48000;
    case 'KBL_VET':
      return 110000;
    case 'KBL_MAX':
      return 380000 + Math.max(0, ovr - 70) * 25000;
    case 'OVERSEAS_CONTRACT':
      return 260000 + Math.max(0, ovr - 70) * 35000;
    case 'GLEAGUE_EXHIBIT':
    case 'SUMMER_LEAGUE_INVITE':
      return 42500;
    case 'TWO_WAY':
      return 580000;
    case 'NBA_VET_MIN':
      return 2600000;
    case 'NBA_STANDARD':
      return 4800000 + Math.max(0, ovr - 74) * 950000;
    case 'NBA_MAX':
      return 36000000 + Math.max(0, ovr - 85) * 1800000;
    default:
      return 0;
  }
}

/**
 * 직전 시즌 분당 실전 효율(Per-36 Real Efficiency) 모멘텀 계산
 * - 2라운드/언드래프티/벤치 선수가 제한된 출전 시간 동안 효율적인 활약을 펼치면
 *   단순 OVR 차이를 극복하고 로테이션과 주전 자리를 꿰찰 수 있게 해줌
 */
export function calculateRecentEfficiencyMomentum(
  seasonLogs?: SeasonBoxScore[],
  primaryPos: Position = 'SG'
): number {
  if (!seasonLogs || seasonLogs.length === 0) return 0;
  const lastLog = seasonLogs[seasonLogs.length - 1];
  if (lastLog.mpg < 4.0) return 0;

  const scale36 = 36 / Math.max(10, lastLog.mpg);
  const pts36 = lastLog.ppg * scale36;
  const reb36 = lastLog.rpg * scale36;
  const ast36 = lastLog.apg * scale36;
  const stk36 = (lastLog.spg + lastLog.bpg) * scale36;

  // 포지션별 가중 분당 생산성
  const posProd =
    primaryPos === 'PG'
      ? pts36 * 0.42 + ast36 * 1.45 + stk36 * 1.6 + reb36 * 0.35
      : primaryPos === 'C' || primaryPos === 'PF'
      ? pts36 * 0.42 + reb36 * 1.15 + stk36 * 2.1 + ast36 * 0.65
      : pts36 * 0.52 + reb36 * 0.65 + ast36 * 0.85 + stk36 * 1.85;

  const shootingEff = (lastLog.fgPct - 43.5) * 0.35 + (lastLog.tpPct - 33.5) * 0.25;
  const rawMomentum = (posProd - 14.5) * 0.55 + shootingEff;

  return Math.max(-4.5, Math.min(9.5, Number(rawMomentum.toFixed(2))));
}

/**
 * 2. 드래프트 위상(Draft Pedigree) + 구단 육성 기조 + 실전 효율 모멘텀이 결합된 유기적 로테이션(출전 시간) 시스템
 * - KBL 1라운드(특히 1~3순위) 및 NBA 1라운드 지명 신인은 초기 OVR이 팀 평균보다 낮더라도
 *   구단이 미래를 보고 선발한 핵심 자산이므로 가비지 타임(4~8분)에 방치되지 않고
 *   '핵심 유망주 로테이션(20~28분)' 이상으로 우선 기용됨!
 */
export function calculateRoleAndMpg(
  career: Pick<
    CareerState,
    'ovr' | 'team' | 'coachTrust' | 'secondaryPos' | 'contractType' | 'league'
  > & {
    stats?: Pick<PlayerStats, 'phy'>;
    primaryPos?: Position;
    growthDna?: GrowthDna;
    draftPedigreePick?: number | null;
    draftPedigreeRound?: 1 | 2 | null;
    draftPedigreeSeasonsLeft?: number;
    seasonLogs?: SeasonBoxScore[];
  },
  rng: () => number = Math.random
): RoleAndMpgResult {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const dualBonus = career.secondaryPos ? 2.5 : 0;

  // 1) 구단 육성 기조 보정: 리빌딩(REBUILDING) 구단은 젊은 유망주에게 더 많은 출전 기회를 부여
  const teamDirection = career.team.direction || 'PLAYOFF_HUNT';
  const rebuildingYouthBoost =
    teamDirection === 'REBUILDING'
      ? 3.5
      : teamDirection === 'CONTENDER'
      ? -1.0
      : 1.0;

  // 2) 포지션 니즈 적합도 보정: 구단의 보강 필요 포지션과 일치하면 로테이션 진입이 수월함
  const needed = career.team.neededPositions || [];
  const posNeedBoost =
    career.primaryPos && needed.includes(career.primaryPos)
      ? 2.8
      : career.secondaryPos && needed.includes(career.secondaryPos)
      ? 1.5
      : 0;

  // 3) 입단 위상(Draft Pedigree) 보정: KBL 1라운드 / NBA 1라운드 신인은 초기 OVR 차이를 보정받음
  const pedigreeSeasonsLeft = career.draftPedigreeSeasonsLeft ?? 0;
  const pick = career.draftPedigreePick ?? null;
  const round = career.draftPedigreeRound ?? null;
  const isFirstRoundPedigree =
    pedigreeSeasonsLeft > 0 &&
    round === 1 &&
    (career.league === 'KBL' || career.league === 'NBA');

  let pedigreeBonus = 0;
  if (isFirstRoundPedigree && pick !== null) {
    if (career.league === 'KBL') {
      // KBL 1~3순위 로터리 신인은 구단 간판 유망주 대우 (+11 ~ +15 보정)
      pedigreeBonus = pick <= 3 ? 14.5 : pick <= 6 ? 11.5 : 9.0;
    } else if (career.league === 'NBA') {
      // NBA 1라운드 로터리(1~14순위) 및 1라운더(15~30순위) 육성 프리미엄
      pedigreeBonus = pick <= 5 ? 15.0 : pick <= 14 ? 12.0 : 9.0;
    }
  } else if (pedigreeSeasonsLeft > 0 && round === 2) {
    pedigreeBonus = 3.5;
  }

  // 4) 직전 시즌 분당 실전 효율 모멘텀 (2라운더/언드래프티도 효율이 좋으면 출전시간 급상승)
  const efficiencyMomentum = calculateRecentEfficiencyMomentum(
    career.seasonLogs,
    career.primaryPos || 'SG'
  );

  // 기본 OVR 차이를 완충(0.85배)하고 신뢰도·육성기조·드래프트위상·실전효율을 유기적으로 합산
  const rawOvrDiff = career.ovr - career.team.rating;
  const roleIndex = Number(
    (
      rawOvrDiff +
      (career.coachTrust - 50) * 0.22 +
      dualBonus +
      rebuildingYouthBoost * (pedigreeSeasonsLeft > 0 ? 1.0 : 0.35) +
      posNeedBoost * (pedigreeSeasonsLeft > 0 || (career.seasonLogs && career.seasonLogs.length > 0) ? 1.0 : 0) +
      pedigreeBonus +
      efficiencyMomentum
    ).toFixed(2)
  );

  if (career.contractType === 'TWO_WAY') {
    const gp = Math.min(50, Math.round(18 + rng() * 24));
    const role = '투웨이 콜업 로테이션';
    const effBoostMpg = Math.max(0, efficiencyMomentum * 0.9);
    const mpg = Number(
      Math.min(24.5, 8.5 + Math.max(0, (career.ovr - 70) * 1.1) + effBoostMpg).toFixed(1)
    );
    return {
      roleIndex,
      role,
      mpg,
      gp,
      injuredGamesMissed: 0,
      basePer36: 12.8,
    };
  }

  let role = '가비지 타임 (벤치 끝자리)';
  let mpg = 6.0;
  let healthyGp = leagueConfig.games;
  let basePer36 = 10.0;

  // ★ 핵심: KBL 1라운드 / NBA 1라운드 신인은 초기 OVR이 낮더라도 절대 가비지 타임에 빠지지 않고
  // 최소 '핵심 유망주 로테이션 (20~28분)'으로 우선 기용됨!
  if (isFirstRoundPedigree && roleIndex < 7 && rawOvrDiff < 2) {
    const isTopLottery = pick !== null && (career.league === 'KBL' ? pick <= 3 : pick <= 10);
    role = isTopLottery ? '주전급 코어 유망주 (1라운드 픽)' : '핵심 유망주 로테이션 (1라운드 픽)';
    const minMpg = isTopLottery ? 23.5 : 20.0;
    const maxMpg = isTopLottery ? 28.0 : 25.5;
    mpg = Number((minMpg + rng() * (maxMpg - minMpg)).toFixed(1));
    healthyGp = Math.max(1, Math.round(leagueConfig.games * (0.9 + rng() * 0.1)));
    basePer36 = isTopLottery ? 16.5 : 14.8;
  } else if (roleIndex < -9) {
    role = '가비지 타임 (벤치 끝자리)';
    mpg = Number((4.0 + rng() * 4.5).toFixed(1));
    healthyGp = Math.max(1, Math.round(leagueConfig.games * 0.55));
    basePer36 = 10.0;
  } else if (roleIndex < -3) {
    role = '벤치 로테이션';
    mpg = Number((11.0 + rng() * 5.5).toFixed(1));
    healthyGp = Math.max(1, Math.round(leagueConfig.games * (0.82 + rng() * 0.14)));
    basePer36 = 12.4;
  } else if (roleIndex < 2) {
    role = '핵심 식스맨';
    mpg = Number((18.5 + rng() * 5.5).toFixed(1));
    healthyGp = Math.max(1, Math.round(leagueConfig.games * (0.9 + rng() * 0.1)));
    basePer36 = 15.2;
  } else if (roleIndex < 7) {
    role = '주전 스타터';
    mpg = Number((26.5 + rng() * 5.0).toFixed(1));
    healthyGp = Math.max(1, Math.round(leagueConfig.games * (0.92 + rng() * 0.08)));
    basePer36 = 18.2;
  } else {
    role = '프랜차이즈 1옵션 에이스';
    mpg = Number((33.0 + rng() * 3.8).toFixed(1));
    healthyGp = Math.max(1, Math.round(leagueConfig.games * (0.94 + rng() * 0.06)));
    basePer36 = 22.8;
  }

  // 부상 리스크 계산: PHY가 낮거나(< 62) 출전시간이 과다할 때 잔부상 결장 발생 (철강왕 DNA는 부상 확률 대폭 감소)
  const phy = career.stats?.phy ?? 65;
  const dna = career.growthDna || 'STANDARD';
  let injuredGamesMissed = 0;
  const lowPhyRisk = phy < 60 ? 0.24 : phy < 68 ? 0.12 : 0.04;
  const highMpgRisk = mpg >= 33.5 ? 0.14 : mpg >= 29.0 ? 0.06 : 0;
  const dnaInjuryMult = dna === 'IRONMAN' ? 0.45 : 1.0;

  if (rng() < (lowPhyRisk + highMpgRisk) * dnaInjuryMult) {
    const maxMiss = Math.max(3, Math.round(leagueConfig.games * 0.28));
    injuredGamesMissed = Math.max(2, Math.min(maxMiss, Math.round(3 + rng() * (maxMiss - 2))));
  }

  const gp = Math.max(1, healthyGp - injuredGamesMissed);

  return {
    roleIndex,
    role,
    mpg,
    gp,
    injuredGamesMissed,
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
  const diff = attackStat - ldr;
  const offEdge =
    diff >= 0
      ? Math.max(0.28, 1.0 + diff / 33)
      : Math.max(0.28, 1.0 + diff / 26);

  const rawPpg = (mpg / 36) * basePer36 * offEdge + (rng() * 1.8 - 0.9);
  const finalPpg = rawPpg > 25.0 ? 25.0 + (rawPpg - 25.0) * 0.35 : rawPpg;
  const ppg = Math.max(1.2, Math.min(34.5, Number(finalPpg.toFixed(1))));

  return { ppg, offEdge, rawPpg };
}

/**
 * 3-4. 선수 고유 성장 곡선 DNA(조숙형/표준형/대기만성형/철강왕)가 반영된 시즌 성장 및 에이징 수식
 */
export function calculateSeasonStatGrowth(
  career: Pick<CareerState, 'age' | 'ovr' | 'potential' | 'league' | 'stats' | 'trainingFocus'> & {
    growthDna?: GrowthDna;
    totals?: CareerState['totals'];
  },
  mpg: number,
  rng: () => number = Math.random,
  injuredGamesMissed: number = 0
): { nextStats: PlayerStats; delta: StatDelta } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const prev = career.stats;
  const dna: GrowthDna = career.growthDna || 'STANDARD';

  // DNA별 성장 상한 연령 (대기만성형은 만 29세까지 성장 지속, 조숙형은 만 25세 이후 완숙)
  const maxGrowthAge =
    dna === 'LATE_BLOOMER' ? 29 : dna === 'EARLY_BLOOMER' ? 26 : 27;

  if (career.age <= maxGrowthAge) {
    const ptFactor = mpg >= 24 ? 1.15 : mpg >= 15 ? 0.92 : 0.52;
    const capPenalty =
      career.ovr >= leagueConfig.growthCap
        ? 0.20
        : career.ovr >= leagueConfig.growthCap - 2
        ? 0.55
        : 1.0;
    const potPenalty =
      career.ovr >= career.potential
        ? 0.15
        : career.ovr >= career.potential - 3
        ? 0.50
        : 1.0;

    // 고능력치(OVR 80+) 진입 시 슈퍼스타 벽(High-OVR Diminishing Returns)
    const highOvrWall =
      career.ovr >= 88
        ? 0.38
        : career.ovr >= 83
        ? 0.58
        : career.ovr >= 78
        ? 0.78
        : 1.0;

    const injuryFactor = injuredGamesMissed >= 10 ? 0.65 : injuredGamesMissed > 0 ? 0.85 : 1.0;

    // DNA별 나이대 성장 곡선 차별화
    let ageMultiplier = 0.85;
    if (dna === 'EARLY_BLOOMER') {
      ageMultiplier = career.age <= 21 ? 1.32 : career.age <= 24 ? 1.05 : 0.62;
    } else if (dna === 'LATE_BLOOMER') {
      ageMultiplier = career.age <= 21 ? 0.92 : career.age <= 26 ? 1.12 : 0.95;
    } else {
      ageMultiplier = career.age <= 20 ? 1.12 : career.age <= 23 ? 0.96 : 0.74;
    }

    const baseGain =
      1.72 * ptFactor * capPenalty * potPenalty * highOvrWall * injuryFactor * ageMultiplier;

    const focusWeights: Record<TrainingFocus, Partial<Record<keyof PlayerStats, number>>> = {
      INSIDE_SCORING: { ins: 1.75, phy: 1.1, reb: 1.0, out: 0.65, ply: 0.7, def: 0.7 },
      OUTSIDE_SHOOTING: { out: 1.8, ply: 1.1, ins: 0.75, def: 0.65, reb: 0.6, phy: 0.7 },
      PLAYMAKING: { ply: 1.8, out: 1.1, ins: 0.8, def: 0.75, phy: 0.75, reb: 0.55 },
      DEFENSE_LOCKDOWN: { def: 1.8, phy: 1.2, reb: 1.0, ins: 0.65, out: 0.65, ply: 0.65 },
      REBOUND_POST: { reb: 1.8, ins: 1.2, phy: 1.1, def: 0.95, out: 0.5, ply: 0.55 },
      PHYSICAL_CONDITIONING: { phy: 1.85, def: 1.1, reb: 1.05, ins: 0.95, out: 0.6, ply: 0.65 },
      BALANCED: { ins: 1.0, out: 1.0, ply: 1.0, def: 1.0, reb: 1.0, phy: 1.0 },
    };

    const fw = focusWeights[career.trainingFocus];
    const keys: (keyof PlayerStats)[] = ['ins', 'out', 'ply', 'def', 'reb', 'phy'];
    const nextStats: PlayerStats = { ...prev };
    const delta: StatDelta = { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 };

    for (const k of keys) {
      const w = fw[k] ?? 1.0;
      const rawStep = baseGain * w * (0.65 + rng() * 0.55);
      const gain = Math.max(0, Math.round(rawStep));
      const updated = Math.min(99, prev[k] + gain);
      nextStats[k] = updated;
      delta[k] = updated - prev[k];
    }

    return { nextStats, delta };
  }

  // 전성기 완숙 구간 (개인별 노쇠화 시작 직전)
  const primeEndAge =
    dna === 'IRONMAN' ? 31 : dna === 'LATE_BLOOMER' ? 30 : dna === 'EARLY_BLOOMER' ? 28 : 29;

  if (career.age <= primeEndAge) {
    const nextStats: PlayerStats = { ...prev };
    const delta: StatDelta = { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 };
    if (career.ovr < leagueConfig.growthCap && career.ovr < career.potential && rng() < 0.58) {
      const bonusKey: keyof PlayerStats =
        career.trainingFocus === 'OUTSIDE_SHOOTING'
          ? 'out'
          : career.trainingFocus === 'PLAYMAKING'
          ? 'ply'
          : career.trainingFocus === 'DEFENSE_LOCKDOWN'
          ? 'def'
          : 'ins';
      if (nextStats[bonusKey] < 99) {
        nextStats[bonusKey] += 1;
        delta[bonusKey] = 1;
      }
    }
    return { nextStats, delta };
  }

  // 개체별 차등 에이징 커브(노쇠화) 수식 적용
  const careerMinutes = career.totals ? career.totals.gp * 24 : 15000;
  return applyAgingCurve(career.age, prev, rng, {
    growthDna: dna,
    careerMinutes,
  });
}

/**
 * 포지션 및 플레이 성향에 맞춘 실전 공헌 효율 기반 감독 신뢰도 변화 산출
 * - 단순 득점(ppg >= 18) 하드코딩을 폐기하고, 출전 시간 대비 야투율/3점 효율/어시스트/리바운드/스틸·블록 수비 기여를 공정하게 평가
 */
export function calculateOrganicTrustDelta(params: {
  pos: Position;
  playstyle?: PlaystyleArchetype;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  tpPct: number;
  winRate: number;
  wonDpoy: boolean;
  wonSixthMan: boolean;
  wonMvp: boolean;
}): number {
  const { pos, playstyle, mpg, ppg, rpg, apg, spg, bpg, fgPct, tpPct, winRate, wonDpoy, wonSixthMan, wonMvp } =
    params;

  const scale36 = 36 / Math.max(10, mpg);
  const pts36 = ppg * scale36;
  const reb36 = rpg * scale36;
  const ast36 = apg * scale36;
  const stk36 = (spg + bpg) * scale36;

  // 슈팅 효율 점수
  const effScore = (fgPct - 43.0) * 0.35 + (tpPct - 33.0) * 0.25;

  // 포지션 및 플레이 성향별 실전 공헌 지수
  let roleContribution = 0;
  if (playstyle === 'PLAYMAKER' || pos === 'PG') {
    roleContribution = ast36 * 1.45 + pts36 * 0.42 + stk36 * 1.65 + reb36 * 0.35;
  } else if (playstyle === 'RIM_PROTECTOR' || pos === 'C' || pos === 'PF') {
    roleContribution = reb36 * 1.2 + stk36 * 2.25 + pts36 * 0.42 + ast36 * 0.65;
  } else if (playstyle === 'THREE_AND_D') {
    roleContribution = stk36 * 2.15 + (tpPct - 34.0) * 0.8 + pts36 * 0.48 + reb36 * 0.55;
  } else {
    roleContribution = pts36 * 0.55 + reb36 * 0.65 + ast36 * 0.85 + stk36 * 1.75;
  }

  const totalImpact =
    roleContribution +
    effScore +
    (winRate - 0.48) * 14 +
    (wonDpoy || wonSixthMan || wonMvp ? 6 : 0);

  if (totalImpact >= 22.0) return 9;
  if (totalImpact >= 17.5) return 6;
  if (totalImpact >= 13.5) return 4;
  if (totalImpact >= 10.0) return 2;
  if (totalImpact >= 7.5) return 0;
  return -3;
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
 * 한 시즌 전체 시뮬레이션 실행 (개인 타이틀 확대, 수비 공정성, 부상 리스크, 연봉 정산, 실전 효율 신뢰도 반영)
 */
export function simulateSeason(
  career: CareerState,
  rng: () => number = Math.random
): SimulatedSeasonResult {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const { role, mpg, gp, injuredGamesMissed, basePer36, roleIndex } = calculateRoleAndMpg(
    career,
    rng
  );
  const { ppg, offEdge } = calculatePpg(career.stats, leagueConfig.ldr, mpg, basePer36, rng);

  // 리바운드(RPG), 어시스트(APG), 스틸(SPG), 블록(BPG) 산출
  const rebEdge = Math.max(0.35, 1.0 + (career.stats.reb - leagueConfig.ldr) / 34);
  const plyEdge = Math.max(0.35, 1.0 + (career.stats.ply - leagueConfig.ldr) / 34);
  const defEdge = Math.max(0.35, 1.0 + (career.stats.def - leagueConfig.ldr) / 34);

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
    career.primaryPos === 'C' ? 2.25 : career.primaryPos === 'PF' ? 1.55 : 0.65;
  const bpg = Math.max(
    0.1,
    Math.min(3.8, Number(((mpg / 36) * posBlkMult * defEdge + (rng() * 0.25 - 0.1)).toFixed(1)))
  );

  // 야투율 및 3점 성공률
  const fgPct = Number(
    Math.max(35.0, Math.min(64.5, 42.0 + (offEdge - 1.0) * 11.5 + rng() * 3.0)).toFixed(1)
  );
  const outEdge = (career.stats.out - leagueConfig.ldr) / 35;
  const tpPct = Number(
    Math.max(24.0, Math.min(46.5, 33.0 + outEdge * 9.5 + rng() * 2.5)).toFixed(1)
  );

  // 단일 경기 최다 득점(커리어하이 판정용)
  const burstFactor = 1.62 + rng() * 0.52;
  const singleGameHighPts = Math.max(
    Math.ceil(ppg + 4),
    Math.min(72, Math.round(ppg * burstFactor + (career.stats.out >= 84 ? 5 : 2)))
  );

  // 구단 승패 판정 (공수 기여도 모두 반영)
  const defContribution = (career.stats.def - leagueConfig.ldr) * 0.15;
  const playerWinContribution =
    roleIndex >= 2
      ? (career.ovr - leagueConfig.ldr) * 0.42 + defContribution
      : (career.ovr - leagueConfig.ldr) * 0.14;
  const teamStrengthScore = career.team.rating - leagueConfig.ldr + playerWinContribution;
  const winRate = Math.max(
    0.2,
    Math.min(0.82, 0.48 + teamStrengthScore * 0.018 + (rng() * 0.1 - 0.05))
  );
  const wins = Math.round(leagueConfig.games * winRate);
  const losses = leagueConfig.games - wins;

  // 포지션 공정성(수비 스탯 spg, bpg, def 및 팀 승률)이 반영된 종합 임팩트 지수
  const defenseImpact =
    spg * 2.6 + bpg * 2.8 + Math.max(0, career.stats.def - leagueConfig.ldr) * 0.22;
  const perfScore =
    ppg +
    rpg * 0.72 +
    apg * 0.9 +
    defenseImpact +
    Math.max(0, winRate - 0.5) * 12;

  const minGamesForAwards = Math.round(leagueConfig.games * 0.68);
  const eligibleForMajorAwards = gp >= minGamesForAwards;

  const allStarThreshold = career.league === 'NBA' ? 31.5 : 25.5;
  const mvpThreshold = career.league === 'NBA' ? 42.5 : 33.5;

  const allStarSelected = eligibleForMajorAwards && perfScore >= allStarThreshold;
  const wonMvp =
    allStarSelected && perfScore >= mvpThreshold && winRate >= 0.58;

  // 올-리그 팀 (퍼스트 / 세컨드 / 서드 팀) 선정
  let allLeagueTeam: AllLeagueTier = null;
  if (eligibleForMajorAwards) {
    if (perfScore >= mvpThreshold - 2.0) {
      allLeagueTeam = 1;
    } else if (perfScore >= allStarThreshold + 3.5) {
      allLeagueTeam = 2;
    } else if (perfScore >= allStarThreshold) {
      allLeagueTeam = 3;
    }
  }

  // 올해의 수비수(DPOY): 수비력(DEF)과 스틸/블록 및 팀 승률이 뛰어난 선수에게 수여
  const dpoyScore =
    career.stats.def * 0.55 +
    spg * 7.5 +
    bpg * 8.5 +
    rpg * 0.8 +
    winRate * 15;
  const dpoyThreshold = career.league === 'NBA' ? 76.5 : 67.5;
  const wonDpoy =
    eligibleForMajorAwards &&
    career.stats.def >= leagueConfig.ldr + 4 &&
    dpoyScore >= dpoyThreshold &&
    winRate >= 0.52;

  // 올해의 식스맨상(6MOY): 식스맨/벤치 로테이션 역할에서 높은 득점과 효율을 기록했을 때
  const isBenchRole = role.includes('식스맨') || role.includes('로테이션');
  const sixthManThreshold = career.league === 'NBA' ? 14.5 : 11.5;
  const wonSixthMan =
    eligibleForMajorAwards &&
    isBenchRole &&
    !role.includes('투웨이') &&
    ppg >= sixthManThreshold &&
    winRate >= 0.48;

  // 기량발전상(MIP): 직전 시즌 대비 동일/상위 리그에서 평균 득점 +5.5 이상 상승
  const prevLog =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;
  const wonMip =
    eligibleForMajorAwards &&
    prevLog !== null &&
    prevLog.league === career.league &&
    ppg - prevLog.ppg >= 5.5 &&
    ppg >= 14.0;

  // 우승 및 파이널 MVP(FMVP) 판정
  const wonChampionship =
    winRate >= 0.63 && rng() < (winRate >= 0.73 ? 0.48 : 0.24);
  const wonFinalsMvp =
    wonChampionship &&
    (role.includes('에이스') || (role.includes('스타터') && perfScore >= allStarThreshold));

  const wonRookieOfYear =
    career.seasonsPlayed === 0 && eligibleForMajorAwards && ppg >= 14.5 && mpg >= 22.0;

  const salaryEarned =
    career.annualSalary > 0
      ? career.annualSalary
      : getContractDefaultSalary(career.contractType, career.ovr);

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

  if (injuredGamesMissed > 0) {
    narrativeLog.push(
      `🩺 시즌 중 컨디션 저하와 잔부상이 겹치며 ${injuredGamesMissed}경기에 결장해 아쉬움을 남겼어요.`
    );
  }
  if (wonDpoy) {
    narrativeLog.push(
      `🛡️ 질식 수비와 림 프로텍팅을 인정받아 ${leagueConfig.shortName} 올해의 수비수(DPOY) 트로피를 거머쥐었어요!`
    );
  }
  if (wonSixthMan) {
    narrativeLog.push(
      `⚡ 벤치에서 코트 분위기를 뒤바꾸는 맹활약으로 올해의 식스맨상(6MOY)을 수상했어요!`
    );
  }
  if (wonMip) {
    narrativeLog.push(
      `📈 지난 시즌 대비 눈부신 스텝업을 이뤄내며 기량발전상(MIP)의 주인공이 되었어요!`
    );
  }
  if (wonFinalsMvp) {
    narrativeLog.push(
      `👑 챔피언십 시리즈에서 가장 빛난 별로 선정되어 파이널 MVP(FMVP)까지 석권했어요!`
    );
  }
  if (allLeagueTeam) {
    narrativeLog.push(
      `🏅 시즌 베스트 라인업인 올-${leagueConfig.shortName} ${
        allLeagueTeam === 1 ? '퍼스트' : allLeagueTeam === 2 ? '세컨드' : '서드'
      } 팀에 이름을 올렸어요!`
    );
  }

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
    injuredGamesMissed,
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
    salaryEarned,
    wonChampionship,
    wonMvp,
    wonFinalsMvp,
    wonDpoy,
    wonSixthMan,
    wonMip,
    wonRookieOfYear,
    allStarSelected,
    allLeagueTeam,
    singleGameHighPts,
    headline,
    narrativeLog,
    isFarewellTour: career.isFarewellTour,
  };

  // 능력치 성장/노쇠화 적용
  const { nextStats, delta: statDelta } = calculateSeasonStatGrowth(
    career,
    mpg,
    rng,
    injuredGamesMissed
  );
  const nextOvr = calculateOvr(nextStats, career.primaryPos);

  // 포지션 및 플레이 성향별 실전 공헌 효율 기반 감독 신뢰도 변화
  const trustChange = calculateOrganicTrustDelta({
    pos: career.primaryPos,
    playstyle: career.playstyle,
    mpg,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    fgPct,
    tpPct,
    winRate,
    wonDpoy,
    wonSixthMan,
    wonMvp,
  });
  const nextCoachTrust = Math.max(15, Math.min(100, career.coachTrust + trustChange));

  const stockBoost =
    (ppg * 1.05 + rpg * 0.42 + apg * 0.5 + (spg + bpg) * 1.2) * leagueConfig.prestige +
    (wonChampionship ? 10 : 0) +
    (wonMvp ? 14 : 0) +
    (wonDpoy ? 8 : 0);
  const nextDraftStock = Math.max(
    10,
    Math.min(100, Math.round(career.draftStock * 0.42 + stockBoost))
  );

  const nextBadges = evaluatePlayerBadges(
    nextStats,
    career.secondaryPos,
    career.growthDna,
    career.playstyle
  );

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
