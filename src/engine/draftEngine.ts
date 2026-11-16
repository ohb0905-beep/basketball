import { LEAGUE_CONFIG } from '../data/leagues';
import {
  getTeamsByLeague,
  SANGMU_TEAM,
  selectBestFitTeamForPlayer,
} from '../data/teams';
import {
  CareerState,
  CombineState,
  ContractType,
  OffseasonOption,
  RolePromiseType,
  TeamInfo,
} from '../types/game';
import { checkRetirementEligibility } from './retirementEngine';
import { getContractDefaultSalary } from './seasonSimulator';

export interface HighSchoolProspectEvaluation {
  stars: 1 | 2 | 3 | 4 | 5;
  compositeScore: number;
  avgPpg: number;
  avgRpg: number;
  avgApg: number;
  championships: number;
  mvps: number;
  summary: string;
}

export const ROLE_PROMISE_LABELS: Record<RolePromiseType, string> = {
  ACE_FIRST_OPTION: '🌟 1옵션 에이스 보장 (30분+ 권장)',
  STARTER_GUARANTEE: '🏀 주전 스타터 보장 (24분+ 권장)',
  SIXTH_MAN_CORE: '⚡ 핵심 식스맨 & 클러치조',
  PROSPECT_DEVELOPMENT: '🌱 코어 유망주 집중 육성',
  VETERAN_MENTOR: '🎖️ 베테랑 라커룸 리더 & 롤플레이어',
};

/**
 * 구단 기조, 전력 격차, 선수 나이를 종합해 구단이 제시하는 역할 약속(Role Promise) 결정
 */
export function determineTeamRolePromise(
  career: Pick<CareerState, 'ovr' | 'age' | 'potential'>,
  targetTeam: TeamInfo,
  contractType: ContractType
): { promisedRole: RolePromiseType; promisedRoleLabel: string } {
  const gap = career.ovr - targetTeam.rating;
  const dir = targetTeam.direction || 'PLAYOFF_HUNT';

  let promisedRole: RolePromiseType = 'SIXTH_MAN_CORE';
  if (contractType === 'NBA_VET_MIN' || contractType === 'KBL_VET' || career.age >= 33) {
    promisedRole = gap >= 2 ? 'STARTER_GUARANTEE' : 'VETERAN_MENTOR';
  } else if (gap >= 4 || (dir === 'REBUILDING' && gap >= 0)) {
    promisedRole = 'ACE_FIRST_OPTION';
  } else if (gap >= -1 || (dir === 'REBUILDING' && career.age <= 24)) {
    promisedRole =
      career.age <= 22 && gap < 0 ? 'PROSPECT_DEVELOPMENT' : 'STARTER_GUARANTEE';
  } else if (career.age <= 22 && dir === 'REBUILDING') {
    promisedRole = 'PROSPECT_DEVELOPMENT';
  } else {
    promisedRole = 'SIXTH_MAN_CORE';
  }

  return {
    promisedRole,
    promisedRoleLabel: ROLE_PROMISE_LABELS[promisedRole],
  };
}

/**
 * 고교 3년 누적 기록, 수상, OVR, 잠재력을 종합 평가하여 유망주 스카우팅 등급(1성~5성) 산출
 */
export function evaluateHighSchoolProspect(
  career: CareerState
): HighSchoolProspectEvaluation {
  const hsLogs = career.seasonLogs.filter((l) => l.league === 'HIGH_SCHOOL');
  const totalGp = hsLogs.reduce((acc, l) => acc + l.gp, 0);
  const avgPpg =
    totalGp > 0
      ? Number(
          (hsLogs.reduce((acc, l) => acc + l.ppg * l.gp, 0) / totalGp).toFixed(1)
        )
      : 0;
  const avgRpg =
    totalGp > 0
      ? Number(
          (hsLogs.reduce((acc, l) => acc + l.rpg * l.gp, 0) / totalGp).toFixed(1)
        )
      : 0;
  const avgApg =
    totalGp > 0
      ? Number(
          (hsLogs.reduce((acc, l) => acc + l.apg * l.gp, 0) / totalGp).toFixed(1)
        )
      : 0;
  const avgStk =
    totalGp > 0
      ? Number(
          (
            hsLogs.reduce((acc, l) => acc + (l.spg + l.bpg) * l.gp, 0) / totalGp
          ).toFixed(1)
        )
      : 0;
  const championships = hsLogs.filter((l) => l.wonChampionship).length;
  const mvps = hsLogs.filter((l) => l.wonMvp || l.wonDpoy).length;

  const compositeScore = Number(
    (
      (career.ovr - LEAGUE_CONFIG.HIGH_SCHOOL.ldr) * 3.0 +
      avgPpg * 1.65 +
      avgRpg * 0.85 +
      avgApg * 1.15 +
      avgStk * 2.2 +
      championships * 8 +
      mvps * 10
    ).toFixed(1)
  );

  let stars: 1 | 2 | 3 | 4 | 5 = 1;
  if (compositeScore >= 80 && avgPpg >= 18.5) {
    stars = 5;
  } else if (compositeScore >= 62 && avgPpg >= 14.5) {
    stars = 4;
  } else if (compositeScore >= 44 || championships >= 1 || mvps >= 1) {
    stars = 3;
  } else if (compositeScore >= 26 || avgPpg >= 8.5) {
    stars = 2;
  }

  const starLabels: Record<number, string> = {
    5: '⭐⭐⭐⭐⭐ (5성급 초고교급 글로벌 유망주)',
    4: '⭐⭐⭐⭐ (4성급 전국구 톱클래스 유망주)',
    3: '⭐⭐⭐ (3성급 대학/얼리 드래프트 유망주)',
    2: '⭐⭐ (2성급 성장형 고교 유망주)',
    1: '⭐ (1성급 원석 유망주)',
  };

  return {
    stars,
    compositeScore,
    avgPpg,
    avgRpg,
    avgApg,
    championships,
    mvps,
    summary: `${starLabels[stars]} · 고교 평균 ${avgPpg}점 ${avgRpg}리바운드 ${avgApg}도움`,
  };
}

export interface ScoutingEvaluationResult {
  scoutingScore: number;
  realGameCompetence: boolean;
  positionFitBonus: number;
  passesOfferThreshold: boolean;
  recommendedContract: ContractType;
  promisedRole: RolePromiseType;
  promisedRoleLabel: string;
  rejectionReason?: string;
}

/**
 * 다차원 구단 스카우팅 AI 엔진 (리그 수준 환산 League Translation & Per-36 효율 모델)
 * - 상위 리그(NBA 등)에서 짧은 출전 시간으로 볼륨 스탯이 낮았더라도,
 *   하위 리그(KBL, 해외, G리그) 구단은 리그 수비 저항(LDR) 환산 비율과 OVR 우위를 반영해 즉시 전력감으로 높이 평가함!
 * - 반면 동일/상위 리그(특히 NBA) 구단은 실제 코트 위 Per-36 효율과 최소 실전 기여도를 냉정하게 검증함.
 */
export function evaluateTeamScouting(
  career: CareerState,
  targetTeam: TeamInfo,
  rng: () => number = Math.random
): ScoutingEvaluationResult {
  const recentLogs = career.seasonLogs.slice(-2);
  const lastLog = recentLogs.length > 0 ? recentLogs[recentLogs.length - 1] : null;
  const prevLog = recentLogs.length > 1 ? recentLogs[0] : null;

  const currentLeagueCfg = LEAGUE_CONFIG[career.league];
  const targetLeagueCfg = LEAGUE_CONFIG[targetTeam.league];

  // ① 리그 수준 환산(League Translation) 계수
  // 상위 리그(예: NBA LDR 84)에서 하위 리그(예: KBL LDR 65)로 내려갈 때 실전 가치를 대폭 가산
  const ldrRatio = Math.pow(currentLeagueCfg.ldr / targetLeagueCfg.ldr, 1.45);
  const isSteppingDownLeague = currentLeagueCfg.ldr >= targetLeagueCfg.ldr + 6;

  // ② 직전 1~2시즌 실전 볼륨 + Per-36 생산성 + 슈팅 효율을 리그 환산 비율과 결합
  let realGameCompetence = true;
  let translatedPerfScore = 13.5;

  if (lastLog) {
    const calcRawImpact = (log: typeof lastLog) =>
      log.ppg * 1.12 +
      log.rpg * 0.75 +
      log.apg * 0.95 +
      (log.spg + log.bpg) * 2.15;

    const calcPer36Impact = (log: typeof lastLog) => {
      const scale36 = 36 / Math.max(10.5, log.mpg);
      return calcRawImpact(log) * scale36 * 0.52;
    };

    const lastCombined = calcRawImpact(lastLog) * 0.58 + calcPer36Impact(lastLog) * 0.42;
    const prevCombined = prevLog
      ? calcRawImpact(prevLog) * 0.58 + calcPer36Impact(prevLog) * 0.42
      : lastCombined;
    const weightedImpact = prevLog
      ? lastCombined * 0.72 + prevCombined * 0.28
      : lastCombined;

    const shootingEfficiency =
      (lastLog.fgPct - 43.0) * 0.42 + (lastLog.tpPct - 33.0) * 0.3;

    // 타겟 리그 수준으로 환산된 실전 기대치
    translatedPerfScore =
      (weightedImpact * ldrRatio + shootingEfficiency) *
      (0.78 + currentLeagueCfg.prestige * 0.28);

    // 동일하거나 더 높은 리그로 지원할 때는 직전 시즌 실전 효율과 기여도가 기준 미달이면 탈락
    // 단, 상위 리그(NBA 등)에서 하위 리그(KBL/해외/G리그)로 내려갈 때는 OVR이 타겟 리그 기준을 충족하면 실전 경쟁력을 인정!
    const ovrEdgeOverTargetLeague = career.ovr - targetLeagueCfg.ldr;
    const effectiveCompetenceIndex =
      weightedImpact * ldrRatio +
      shootingEfficiency * 1.15 +
      (isSteppingDownLeague ? Math.max(0, ovrEdgeOverTargetLeague * 1.4) : 0);

    const minCompetenceRequired =
      targetTeam.league === 'NBA'
        ? 10.5
        : targetTeam.league === 'GLEAGUE' || targetTeam.league === 'OVERSEAS'
        ? 7.8
        : 6.5;

    if (effectiveCompetenceIndex < minCompetenceRequired) {
      realGameCompetence = false;
    }
  }

  // ③ 나이, 잠재력, 성장 DNA 및 구단 전술 스타일(preferredStyle) 개성 반영
  const teamDirection = targetTeam.direction || 'PLAYOFF_HUNT';
  const preferredStyle = targetTeam.preferredStyle || 'BALANCED';
  const dna = career.growthDna || 'STANDARD';
  const traits = career.traits || [];

  const dnaBonus =
    dna === 'LATE_BLOOMER' && career.age >= 23 && career.age <= 29
      ? 4.0
      : dna === 'EARLY_BLOOMER' && career.age <= 22
      ? 3.5
      : dna === 'IRONMAN' && career.age >= 30
      ? 4.5
      : 0;

  // 구단 선호 전술 스타일별 선수 스탯 궁합 보너스
  let tacticalStyleBonus = 0;
  if (preferredStyle === 'PACE_AND_SPACE') {
    tacticalStyleBonus =
      (career.stats.out - targetLeagueCfg.ldr) * 0.28 +
      (career.stats.ply - targetLeagueCfg.ldr) * 0.18 +
      (traits.includes('SNIPER') ? 3.5 : 0);
  } else if (preferredStyle === 'DEFENSE_GRIT') {
    tacticalStyleBonus =
      (career.stats.def - targetLeagueCfg.ldr) * 0.32 +
      (career.stats.reb - targetLeagueCfg.ldr) * 0.2 +
      (traits.includes('IRON_STAMINA') ? 2.5 : 0);
  } else if (preferredStyle === 'HALF_COURT') {
    tacticalStyleBonus =
      (career.stats.ins - targetLeagueCfg.ldr) * 0.25 +
      (career.stats.ply - targetLeagueCfg.ldr) * 0.25 +
      (traits.includes('CLUTCH_PERFORMER') ? 3.0 : 0);
  }

  let agePotentialScore = dnaBonus + tacticalStyleBonus;
  if (teamDirection === 'REBUILDING') {
    agePotentialScore +=
      career.age <= 25
        ? (career.potential - targetLeagueCfg.ldr) * 0.55 + (26 - career.age) * 1.8
        : -(career.age - 26) * 2.1;
  } else if (teamDirection === 'CONTENDER') {
    agePotentialScore +=
      (career.stats.def - targetLeagueCfg.ldr) * 0.35 +
      (career.stats.out - targetLeagueCfg.ldr) * 0.32 -
      Math.max(0, career.age - (dna === 'IRONMAN' ? 35 : 33)) * 2.4;
  } else {
    agePotentialScore +=
      (career.potential - targetLeagueCfg.ldr) * 0.35 -
      Math.max(0, career.age - (dna === 'IRONMAN' ? 34 : 32)) * 1.9;
  }

  // ④ 구단 보강 포지션 니즈 적합도
  const needed = targetTeam.neededPositions || [];
  const positionFitBonus =
    needed.includes(career.primaryPos)
      ? 6.5
      : career.secondaryPos && needed.includes(career.secondaryPos)
      ? 3.8
      : -1.0;

  const scoutVariance = (rng() - 0.5) * 4.0;
  const relativeGap = career.ovr - targetTeam.rating;

  const rawScoutingScore =
    60 +
    relativeGap * 1.35 +
    translatedPerfScore * 1.05 +
    agePotentialScore +
    positionFitBonus +
    scoutVariance -
    (realGameCompetence ? 0 : 22);

  const scoutingScore = Number(
    Math.max(10, Math.min(99, rawScoutingScore)).toFixed(1)
  );

  // 동적 오퍼 커트라인 (구단 전력과 리그 위상에 비례)
  const baseLeagueBar =
    targetTeam.league === 'NBA'
      ? 64
      : targetTeam.league === 'OVERSEAS' || targetTeam.league === 'GLEAGUE'
      ? 55
      : 51;
  const directionOffset =
    teamDirection === 'CONTENDER' ? 6 : teamDirection === 'PLAYOFF_HUNT' ? 3 : -1;
  const threshold = baseLeagueBar + directionOffset;

  // 만 34세 이상 노장이 타겟 리그 기준에 크게 미달하고 환산 생산성도 낮으면 탈락
  const veteranDeclineGap = career.ovr - targetLeagueCfg.ldr;
  if (career.age >= 34 && veteranDeclineGap <= -7 && translatedPerfScore < 9.0) {
    realGameCompetence = false;
  }

  const passesOfferThreshold = realGameCompetence && scoutingScore >= threshold;

  let recommendedContract: ContractType = 'FREE_AGENT';
  if (targetTeam.league === 'NBA') {
    if (scoutingScore >= 84 && relativeGap >= 3) {
      recommendedContract = 'NBA_MAX';
    } else if (scoutingScore >= 68) {
      recommendedContract = career.age >= 32 ? 'NBA_VET_MIN' : 'NBA_STANDARD';
    } else {
      recommendedContract = career.age >= 31 ? 'NBA_VET_MIN' : 'TWO_WAY';
    }
  } else if (targetTeam.league === 'KBL') {
    recommendedContract =
      scoutingScore >= 66
        ? 'KBL_MAX'
        : career.age >= 31
        ? 'KBL_VET'
        : 'KBL_ROOKIE';
  } else if (targetTeam.league === 'OVERSEAS') {
    recommendedContract = 'OVERSEAS_CONTRACT';
  } else if (targetTeam.league === 'GLEAGUE') {
    recommendedContract = 'GLEAGUE_EXHIBIT';
  } else {
    recommendedContract = 'AMATEUR';
  }

  const { promisedRole, promisedRoleLabel } = determineTeamRolePromise(
    career,
    targetTeam,
    recommendedContract
  );

  return {
    scoutingScore,
    realGameCompetence,
    positionFitBonus,
    passesOfferThreshold,
    recommendedContract,
    promisedRole,
    promisedRoleLabel,
    rejectionReason: !realGameCompetence
      ? '직전 시즌 리그 환산 Per-36 생산성 및 실전 효율 기준 미달'
      : scoutingScore < threshold
      ? `구단 스카우팅 기준 점수(${threshold}점) 미달 (현재 ${scoutingScore}점)`
      : undefined,
  };
}

/**
 * NBA 드래프트 예상 지명 순위 공식 (실전 성적 및 리그 수준 환산 반영)
 */
export function calculateProjectedNbaPick(
  career: Pick<CareerState, 'ovr' | 'draftStock' | 'league'> & {
    seasonLogs?: CareerState['seasonLogs'];
  },
  combineBonus: number = 0
): { nbaReadyScore: number; projectedPick: number; undraftedRisk: boolean } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const lastLog =
    career.seasonLogs && career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const per36Pts = lastLog ? (lastLog.ppg * 36) / Math.max(10, lastLog.mpg) : 14;
  const lowPerfPenalty =
    lastLog && per36Pts < 10.5 && lastLog.mpg < 12.0 ? -12 : 0;

  const nbaReadyScore =
    (career.ovr - (LEAGUE_CONFIG.NBA.ldr - 16)) * 3.5 +
    career.draftStock * leagueConfig.prestige * 0.45 +
    combineBonus +
    lowPerfPenalty;
  const rawPick = Math.round(75 - nbaReadyScore);
  const projectedPick = Math.max(1, Math.min(75, rawPick));
  const undraftedRisk = projectedPick > 58;

  return {
    nbaReadyScore: Number(nbaReadyScore.toFixed(2)),
    projectedPick,
    undraftedRisk,
  };
}

/**
 * 시카고 드래프트 컴바인 초기 상태 생성
 */
export function createInitialCombineState(career: CareerState): CombineState {
  const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(career, 0);
  let scoutingReport = '';

  if (projectedPick <= 14) {
    scoutingReport =
      'NBA 스카우트들이 로터리 픽(1~14순위) 즉시 전력감으로 극찬하고 있어요! 브루클린 그린룸 초청장이 도착했어요.';
  } else if (projectedPick <= 30) {
    scoutingReport =
      '1라운드 지명권(15~30순위) 내에 안정적으로 이름을 올렸어요. 컴바인 워크아웃에서 순위를 더 끌어올려 봐요!';
  } else if (projectedPick <= 58) {
    scoutingReport =
      '2라운드 지명(31~58순위)이 유력해요. 컴바인 드릴과 단장 면접에서 깊은 인상을 남기면 1라운드 진입도 가능해요!';
  } else {
    scoutingReport =
      '현재 예상 순위가 58순위 밖이라 언드래프티 위험이 높아요! 스카우팅 평가가 기준에 미달하면 드래프트 낙방 후 투웨이 오퍼조차 받지 못할 수 있으니 신중히 결정하세요.';
  }

  return {
    completedDrills: [],
    interviewCompleted: false,
    combineBonusScore: 0,
    projectedPick,
    scoutingReport,
    undraftedRisk,
  };
}

/**
 * 드래프트 본 무대 결과 산출 (NBA / KBL)
 */
export function executeDraftResolution(
  career: CareerState,
  draftType: 'NBA' | 'KBL',
  rng: () => number = Math.random
): {
  draftType: 'NBA' | 'KBL';
  pickNumber: number | null;
  round: 1 | 2 | null;
  draftedTeam: TeamInfo | null;
  twoWayOfferTeam: TeamInfo | null;
  scoutingGrade: number;
} {
  if (draftType === 'KBL') {
    const kblTeams = getTeamsByLeague('KBL', career.teamRatingsMap);
    const kblScore =
      (career.ovr - (LEAGUE_CONFIG.KBL.ldr - 12)) * 2.2 + career.draftStock * 0.25;
    const rawPick = Math.round(22 - kblScore + (rng() * 3 - 1.5));
    const pickNumber = Math.max(1, Math.min(20, rawPick));
    const round: 1 | 2 = pickNumber <= 10 ? 1 : 2;

    const sortedByRatingAsc = [...kblTeams].sort((a, b) => a.rating - b.rating);
    const candidateWindow =
      pickNumber <= 4 ? sortedByRatingAsc.slice(0, 4) : sortedByRatingAsc;
    const posFitCandidates = candidateWindow.filter((t) =>
      t.neededPositions?.includes(career.primaryPos)
    );
    const pool = posFitCandidates.length > 0 ? posFitCandidates : candidateWindow;
    const draftedTeam =
      pool[Math.floor(rng() * pool.length)] || sortedByRatingAsc[0];

    return {
      draftType: 'KBL',
      pickNumber,
      round,
      draftedTeam,
      twoWayOfferTeam: null,
      scoutingGrade: Math.round(55 + kblScore),
    };
  }

  const nbaTeams = getTeamsByLeague('NBA', career.teamRatingsMap);
  const bonus = career.combineState?.combineBonusScore ?? 0;
  const { projectedPick } = calculateProjectedNbaPick(career, bonus);
  const variance = Math.round(rng() * 4 - 2);
  const finalPickCalc = Math.max(1, projectedPick + variance);

  const evaluatedNba = nbaTeams
    .map((team) => ({
      team,
      eval: evaluateTeamScouting(career, team, rng),
    }))
    .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

  const topScouting = evaluatedNba[0];

  if (finalPickCalc > 60) {
    const qualifiesForUndraftedTwoWay =
      topScouting.eval.realGameCompetence && topScouting.eval.scoutingScore >= 62;

    return {
      draftType: 'NBA',
      pickNumber: null,
      round: null,
      draftedTeam: null,
      twoWayOfferTeam: qualifiesForUndraftedTwoWay ? topScouting.team : null,
      scoutingGrade: topScouting.eval.scoutingScore,
    };
  }

  const round: 1 | 2 = finalPickCalc <= 30 ? 1 : 2;
  const sortedByRatingAsc = [...nbaTeams].sort((a, b) => a.rating - b.rating);
  const bucketIndex = Math.min(
    sortedByRatingAsc.length - 1,
    Math.max(0, Math.floor(((finalPickCalc - 1) / 60) * sortedByRatingAsc.length))
  );
  const windowTeams = sortedByRatingAsc.slice(
    Math.max(0, bucketIndex - 2),
    Math.min(sortedByRatingAsc.length, bucketIndex + 3)
  );
  const fitTeam = windowTeams.find((t) =>
    t.neededPositions?.includes(career.primaryPos)
  );
  const draftedTeam =
    fitTeam ||
    windowTeams[Math.floor(rng() * windowTeams.length)] ||
    sortedByRatingAsc[bucketIndex];

  return {
    draftType: 'NBA',
    pickNumber: finalPickCalc,
    round,
    draftedTeam,
    twoWayOfferTeam: round === 2 ? draftedTeam : null,
    scoutingGrade: topScouting.eval.scoutingScore,
  };
}

/**
 * 투웨이 계약 생존 및 방출 심사 (Per-36 실전 생산성, 슈팅 효율, 수비 기여, 구단 로스터 필요도 종합)
 */
export function evaluateTwoWaySurvival(
  career: CareerState,
  lastSeasonPpg: number,
  rng: () => number = Math.random
): {
  status: 'PROMOTED' | 'RETAINED_YEAR_2' | 'WAIVED';
  message: string;
} {
  const lastLog =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const mpg = lastLog ? lastLog.mpg : 12.0;
  const fgPct = lastLog ? lastLog.fgPct : 44.0;
  const scale36 = 36 / Math.max(10, mpg);
  const per36Impact = lastLog
    ? (lastSeasonPpg +
        lastLog.rpg * 0.75 +
        lastLog.apg * 0.95 +
        (lastLog.spg + lastLog.bpg) * 2.2) *
      scale36
    : 18.0;

  const teamScout = evaluateTeamScouting(career, career.team, rng);

  // Per-36 생산성과 효율, 구단 포지션 필요도를 종합해 정식 보장 계약 승격 심사
  const promotionEfficiencyScore =
    per36Impact * 0.85 +
    (fgPct - 41.0) * 0.8 +
    teamScout.positionFitBonus * 0.6;

  if (promotionEfficiencyScore >= 21.5 && mpg >= 9.5 && teamScout.realGameCompetence) {
    return {
      status: 'PROMOTED',
      message: `🎉 축하해요! 투웨이 계약 신분으로 36분 환산 종합 공헌도 ${per36Impact.toFixed(
        1
      )}(평균 ${lastSeasonPpg.toFixed(1)}점, FG ${fgPct}%)의 고효율 활약을 펼쳐 NBA 정식 보장 계약(Standard Contract) 승격 오퍼를 받았어요!`,
    };
  }

  if (
    career.twoWaySeasonsUsed < 2 &&
    promotionEfficiencyScore >= 14.5 &&
    teamScout.realGameCompetence
  ) {
    return {
      status: 'RETAINED_YEAR_2',
      message: `투웨이 1년 차 시즌이 끝났어요. 정식 계약 승격에는 조금 못 미쳤지만, 분당 실전 효율과 잠재력을 인정받아 2년 차 투웨이 연장 기회를 얻었어요!`,
    };
  }

  return {
    status: 'WAIVED',
    message: `⚠️ 투웨이 계약 기간 동안 NBA 로테이션 진입 기준을 충족하지 못해 구단으로부터 웨이버 방출(Waived) 통보를 받았어요. 에이전트가 G리그·해외·KBL 구단들의 재기 오퍼를 탐색해요.`,
  };
}

/**
 * 동적 구단 생태계, 리그 수준 환산(League Translation), 베테랑 최저연봉, 구단 역할 약속(Role Promise)이 반영된 오프시즌 선택지 생성
 */
export function generateOffseasonOptions(
  career: CareerState,
  rng: () => number = Math.random
): OffseasonOption[] {
  const options: OffseasonOption[] = [];
  const lastLog = career.seasonLogs[career.seasonLogs.length - 1];
  const lastPpg = lastLog ? lastLog.ppg : 0;

  const {
    canRetireVoluntarily,
    canDeclareFarewellTour,
    isOutOfLeague,
  } = checkRetirementEligibility(career);

  const uLeagueTeams = getTeamsByLeague('U_LEAGUE', career.teamRatingsMap);
  const kblTeams = getTeamsByLeague('KBL', career.teamRatingsMap);
  const ncaaTeams = getTeamsByLeague('NCAA', career.teamRatingsMap);
  const overseasTeams = getTeamsByLeague('OVERSEAS', career.teamRatingsMap);
  const gleagueTeams = getTeamsByLeague('GLEAGUE', career.teamRatingsMap);
  const nbaTeams = getTeamsByLeague('NBA', career.teamRatingsMap);

  // [특수 Case 0] 국군체육부대(상무) 복무 중인 경우
  if (career.militaryServiceSeasonsLeft > 0) {
    options.push({
      id: 'OPT_SANGMU_CONTINUE',
      title: `🫡 ${SANGMU_TEAM.name} 잔여 군 복무 진행 (${career.militaryServiceSeasonsLeft}시즌 남음)`,
      subtitle: '국군체육부대 상무 소속으로 남은 복무 기간 동안 성실히 경기에 출전해요.',
      badgeText: '병역 복무 중',
      targetLeague: 'KBL',
      targetTeam: SANGMU_TEAM,
      contractType: 'MILITARY_SERVICE',
      contractYears: career.militaryServiceSeasonsLeft,
      annualSalary: 5400,
      promisedRole: 'STARTER_GUARANTEE',
      promisedRoleLabel: ROLE_PROMISE_LABELS.STARTER_GUARANTEE,
      actionType: 'STAY_TEAM',
    });
    return options;
  }

  // [Case 1] 고교 농구 재학 및 졸업 (만 20세 고교 졸업 시 유망주 평가에 따른 제한적 오퍼)
  if (career.league === 'HIGH_SCHOOL') {
    if (career.age < 20) {
      options.push({
        id: 'OPT_HS_NEXT_GRADE',
        title: `🏫 ${career.team.name} 다음 학년 진급`,
        subtitle: '고교 무대에서 주전 입지와 전국대회 우승에 도전하며 유망주 스카우트 평점을 높여요.',
        badgeText: '고교 재학',
        targetLeague: 'HIGH_SCHOOL',
        targetTeam: career.team,
        contractType: 'AMATEUR',
        contractYears: 1,
        annualSalary: 0,
        promisedRole: 'STARTER_GUARANTEE',
        promisedRoleLabel: ROLE_PROMISE_LABELS.STARTER_GUARANTEE,
        actionType: 'STAY_TEAM',
      });
      return options;
    }

    const prospect = evaluateHighSchoolProspect(career);

    // 1) 국내 대학(U-리그): 포지션 니즈와 유망주 등급에 부합하는 1~2개 대학만 스카우트 오퍼 제시
    const eligibleUniversities = uLeagueTeams
      .filter((uni) => {
        if (uni.direction === 'CONTENDER') {
          return prospect.stars >= 3;
        }
        return true;
      })
      .sort((a, b) => {
        const aFit = a.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        const bFit = b.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        return bFit - aFit || (rng() - 0.5);
      });

    const offeredUniversities = eligibleUniversities.slice(
      0,
      prospect.stars >= 3 ? 2 : 1
    );

    for (const uni of offeredUniversities) {
      const promise = determineTeamRolePromise(career, uni, 'AMATEUR');
      options.push({
        id: `OPT_ROUTE_A_${uni.id}`,
        title: `🎓 ${uni.name} 스카우트 입학 제의 (${prospect.stars}성 유망주 전형)`,
        subtitle: `${uni.prestigeDesc} · [${promise.promisedRoleLabel}] (${prospect.summary})`,
        badgeText: '한국 대학 오퍼',
        targetLeague: 'U_LEAGUE',
        targetTeam: uni,
        contractType: 'AMATEUR',
        contractYears: 4,
        annualSalary: 0,
        promisedRole: promise.promisedRole,
        promisedRoleLabel: promise.promisedRoleLabel,
        actionType: 'SIGN_TEAM',
      });
    }

    // 2) KBL 얼리 드래프트: 유망주 등급 3성 이상 또는 전국대회 우승/MVP 입증 시 참가 가능
    const kblEarlyEligible =
      prospect.stars >= 3 ||
      prospect.compositeScore >= 44 ||
      prospect.championships >= 1 ||
      prospect.mvps >= 1;
    if (kblEarlyEligible) {
      options.push({
        id: 'OPT_ROUTE_B_KBL_EARLY',
        title: '🔥 고졸 KBL 신인드래프트 얼리 참가 신청',
        subtitle: `고교 무대에서 입증한 실력(${prospect.stars}성급)을 바탕으로 KBL 프로 무대에 직행해요!`,
        badgeText: '고졸 프로 직행',
        targetLeague: 'KBL',
        contractType: 'KBL_ROOKIE',
        contractYears: 3,
        annualSalary: getContractDefaultSalary('KBL_ROOKIE', career.ovr),
        actionType: 'ENTER_KBL_DRAFT',
      });
    }

    // 3) 미국 NCAA D1 장학금 오퍼: 4성급 이상 초고교급 유망주에게만 1~2곳 제시
    if (prospect.stars >= 4) {
      const sortedNcaa = [...ncaaTeams].sort((a, b) => {
        const aNeed = a.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        const bNeed = b.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        return bNeed - aNeed || (rng() - 0.5);
      });
      const ncaaOfferCount = prospect.stars === 5 ? 2 : 1;
      for (const ncaaTeam of sortedNcaa.slice(0, ncaaOfferCount)) {
        const promise = determineTeamRolePromise(career, ncaaTeam, 'AMATEUR');
        options.push({
          id: `OPT_ROUTE_C_${ncaaTeam.id}`,
          title: `🇺🇸 ${ncaaTeam.name} D1 전액 장학금 스카우트 오퍼!`,
          subtitle: `${prospect.stars}성급 고교 활약에 반한 미국 D1 명문대의 공식 오퍼예요! · [${promise.promisedRoleLabel}]`,
          badgeText: 'NCAA D1 장학금',
          targetLeague: 'NCAA',
          targetTeam: ncaaTeam,
          contractType: 'AMATEUR',
          contractYears: 4,
          annualSalary: 0,
          promisedRole: promise.promisedRole,
          promisedRoleLabel: promise.promisedRoleLabel,
          actionType: 'SIGN_TEAM',
        });
      }
    }

    // 4) 해외 프로/G리그 직행: 5성급 슈퍼 유망주에게만 스카우팅 적합도 최상위 1개 구단 오퍼 발생
    if (prospect.stars === 5) {
      const directCandidates = [...overseasTeams, ...gleagueTeams]
        .map((team) => ({
          team,
          scout: evaluateTeamScouting(career, team, rng),
        }))
        .sort((a, b) => b.scout.scoutingScore - a.scout.scoutingScore);

      const pickedDirect = directCandidates[0]?.team;
      if (pickedDirect) {
        const directContract: ContractType =
          pickedDirect.league === 'GLEAGUE'
            ? 'GLEAGUE_EXHIBIT'
            : 'OVERSEAS_CONTRACT';
        options.push({
          id: `OPT_ROUTE_D_${pickedDirect.id}`,
          title: `🌏 [5성 슈퍼 유망주 특별 오퍼] ${pickedDirect.name} 직행 계약`,
          subtitle: `아시아 고교 무대를 평정한 5성급 유망주를 영입하기 위해 해외 구단 스카우트가 직접 찾아왔어요!`,
          badgeText: '해외 스카우트 픽',
          targetLeague: pickedDirect.league,
          targetTeam: pickedDirect,
          contractType: directContract,
          contractYears: 2,
          annualSalary: getContractDefaultSalary(directContract, career.ovr),
          promisedRole: 'PROSPECT_DEVELOPMENT',
          promisedRoleLabel: ROLE_PROMISE_LABELS.PROSPECT_DEVELOPMENT,
          actionType: 'SIGN_TEAM',
        });
      }
    }

    return options;
  }

  // [Case 2] 한국 대학(U-리그) 또는 미국 대학(NCAA) 재학 중
  if (career.league === 'U_LEAGUE' || career.league === 'NCAA') {
    const canStayInCollege = career.age < 23 && career.contractYearsLeft > 0;
    if (canStayInCollege) {
      options.push({
        id: 'OPT_COLLEGE_STAY',
        title: `🎓 ${career.team.name} 다음 학년 잔류`,
        subtitle: '대학 무대에서 주전 에이스로 도약하며 실전 기록과 드래프트 주가를 더 끌어올려요.',
        badgeText: '대학 잔류',
        targetLeague: career.league,
        targetTeam: career.team,
        contractType: 'AMATEUR',
        contractYears: career.contractYearsLeft,
        annualSalary: 0,
        promisedRole: 'ACE_FIRST_OPTION',
        promisedRoleLabel: ROLE_PROMISE_LABELS.ACE_FIRST_OPTION,
        actionType: 'STAY_TEAM',
      });
    }

    const collegePer36Impact = lastLog
      ? ((lastLog.ppg + lastLog.rpg * 0.7 + lastLog.apg * 0.8) * 36) /
        Math.max(12, lastLog.mpg)
      : 16;
    const collegeReadyForNbaDraft =
      career.league === 'NCAA' ||
      (collegePer36Impact >= 22.0 && career.draftStock >= 40);
    if (collegeReadyForNbaDraft) {
      options.push({
        id: 'OPT_COLLEGE_TO_NBA_DRAFT',
        title: '🏀 NBA 신인드래프트 참가 신청 (시카고 컴바인 진출)',
        subtitle: '시카고 드래프트 컴바인에서 기량을 검증받고 브루클린 바클레이스 센터 지명에 도전해요!',
        badgeText: 'NBA 드래프트',
        targetLeague: 'NBA',
        contractType: 'NBA_STANDARD',
        contractYears: 4,
        actionType: 'ENTER_NBA_DRAFT',
      });
    }

    options.push({
      id: 'OPT_COLLEGE_TO_KBL_DRAFT',
      title: '🇰🇷 KBL 신인드래프트 참가 신청',
      subtitle: '국내 프로 무대 KBL 10개 구단 지명을 통해 프로 커리어를 시작해요.',
      badgeText: 'KBL 드래프트',
      targetLeague: 'KBL',
      contractType: 'KBL_ROOKIE',
      contractYears: 3,
      annualSalary: getContractDefaultSalary('KBL_ROOKIE', career.ovr),
      actionType: 'ENTER_KBL_DRAFT',
    });

    return options;
  }

  // [Case 3] NBA 투웨이(Two-Way) 계약 중인 선수 심사
  if (career.league === 'NBA' && career.contractType === 'TWO_WAY') {
    const survival = evaluateTwoWaySurvival(career, lastPpg, rng);
    if (survival.status === 'PROMOTED') {
      const stdSalary = getContractDefaultSalary('NBA_STANDARD', career.ovr);
      options.push({
        id: 'OPT_TWOWAY_PROMOTED_STANDARD',
        title: `🎉 ${career.team.name} NBA 정식 보장 계약(Standard) 승격 체결!`,
        subtitle: survival.message,
        badgeText: '정식 계약 승격!',
        targetLeague: 'NBA',
        targetTeam: career.team,
        contractType: 'NBA_STANDARD',
        contractYears: 3,
        annualSalary: stdSalary,
        promisedRole: 'SIXTH_MAN_CORE',
        promisedRoleLabel: ROLE_PROMISE_LABELS.SIXTH_MAN_CORE,
        actionType: 'SIGN_TEAM',
      });
      return options;
    }

    if (survival.status === 'RETAINED_YEAR_2') {
      options.push({
        id: 'OPT_TWOWAY_YEAR_2',
        title: `💪 ${career.team.name} 투웨이 계약 2년 차 잔류 도전`,
        subtitle: survival.message,
        badgeText: '투웨이 2년 차',
        targetLeague: 'NBA',
        targetTeam: career.team,
        contractType: 'TWO_WAY',
        contractYears: 1,
        annualSalary: getContractDefaultSalary('TWO_WAY', career.ovr),
        promisedRole: 'PROSPECT_DEVELOPMENT',
        promisedRoleLabel: ROLE_PROMISE_LABELS.PROSPECT_DEVELOPMENT,
        actionType: 'STAY_TEAM',
      });
      return options;
    }

    // WAIVED (웨이버 방출): 리그 환산(League Translation)이 적용된 G리그, 해외, KBL 구단 스카우팅으로 현실적 재기 오퍼 생성!
    const rebuildCandidates = [...gleagueTeams, ...overseasTeams, ...kblTeams];
    const interestedTeams = rebuildCandidates
      .map((t) => ({
        team: t,
        scout: evaluateTeamScouting(career, t, rng),
      }))
      .filter((item) => item.scout.passesOfferThreshold)
      .sort((a, b) => b.scout.scoutingScore - a.scout.scoutingScore)
      .slice(0, 3);

    for (const item of interestedTeams) {
      const sal = getContractDefaultSalary(
        item.scout.recommendedContract,
        career.ovr
      );
      options.push({
        id: `OPT_WAIVED_REBUILD_${item.team.id}`,
        title: `[방출 후 재기 오퍼] ${item.team.name} (${LEAGUE_CONFIG[item.team.league].shortName}) 계약 제의`,
        subtitle: `스카우트 평가 ${item.scout.scoutingScore}점 · [${item.scout.promisedRoleLabel}] 조건으로 영입을 제안했어요!`,
        badgeText: `${LEAGUE_CONFIG[item.team.league].shortName} 주전급 오퍼`,
        targetLeague: item.team.league,
        targetTeam: item.team,
        contractType: item.scout.recommendedContract,
        contractYears: 2,
        annualSalary: sal,
        scoutingScore: item.scout.scoutingScore,
        promisedRole: item.scout.promisedRole,
        promisedRoleLabel: item.scout.promisedRoleLabel,
        actionType: 'SIGN_TEAM',
      });
    }

    if (options.length === 0) {
      options.push({
        id: 'OPT_FORCED_RETIRE_NO_OFFERS',
        title: '🎤 소속팀 부재로 인한 현역 은퇴 (영입 오퍼 0건)',
        subtitle:
          '웨이버 방출 이후 국내외 프로 구단 어디에서도 계약 제의가 도착하지 않아 정든 코트를 떠나게 되었어요.',
        badgeText: '미계약 은퇴',
        targetLeague: career.league,
        targetTeam: career.team,
        contractType: 'FREE_AGENT',
        contractYears: 0,
        actionType: 'RETIRE_OUT_OF_LEAGUE',
      });
    }

    return options;
  }

  // [Case 4] 프로 리그(KBL / 해외 / G리그 / NBA) 소속 선수들의 오프시즌 FA 및 역할 약속(Role Promise) 협상
  let teamOffersCount = 0;

  // 1) 잔여 계약 기간이 남아있고 노쇠화 방출 대상이 아닌 경우 소속팀 잔류 가능
  if (career.contractYearsLeft > 0 && !isOutOfLeague) {
    const stayPromise =
      career.promisedRole ||
      determineTeamRolePromise(career, career.team, career.contractType).promisedRole;
    options.push({
      id: 'OPT_STAY_CURRENT_CONTRACT',
      title: `🤝 ${career.team.name} 잔여 계약 시즌 진행 (${career.contractYearsLeft}년 남음)`,
      subtitle: `소속 구단에서 [${ROLE_PROMISE_LABELS[stayPromise]}] 입지로 다음 시즌을 준비해요.`,
      badgeText: '잔여 계약 이행',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: career.contractType,
      contractYears: career.contractYearsLeft,
      annualSalary: career.annualSalary,
      promisedRole: stayPromise,
      promisedRoleLabel: ROLE_PROMISE_LABELS[stayPromise],
      actionType: 'STAY_TEAM',
    });
    teamOffersCount += 1;

    // 만약 구단이 약속한 역할(Role Promise)을 어겼다면 오프시즌 공식 트레이드 이적 요구 선택지 활성화!
    if (career.brokenRolePromise) {
      const sameLeagueAlt = (
        career.league === 'NBA'
          ? nbaTeams
          : career.league === 'KBL'
          ? kblTeams
          : career.league === 'OVERSEAS'
          ? overseasTeams
          : gleagueTeams
      )
        .filter((t) => t.id !== career.team.id)
        .sort((a, b) => a.rating - b.rating)[0];

      if (sameLeagueAlt) {
        options.push({
          id: `OPT_DEMAND_TRADE_${sameLeagueAlt.id}`,
          title: `🚨 [역할 약속 위반 트레이드 요구] ${sameLeagueAlt.name}(으)로 전격 이적`,
          subtitle: `출전 시간 약속을 어긴 원소속팀을 떠나, 주전 스타터 보장을 약속한 ${sameLeagueAlt.name} 구단으로 트레이드 이적해요!`,
          badgeText: '트레이드 이적 (주전 보장)',
          targetLeague: sameLeagueAlt.league,
          targetTeam: sameLeagueAlt,
          contractType: career.contractType,
          contractYears: career.contractYearsLeft,
          annualSalary: career.annualSalary,
          promisedRole: 'STARTER_GUARANTEE',
          promisedRoleLabel: ROLE_PROMISE_LABELS.STARTER_GUARANTEE,
          actionType: 'SIGN_TEAM',
        });
        teamOffersCount += 1;
      }
    }
  } else if (career.contractYearsLeft === 0 && !isOutOfLeague) {
    // 2) 계약 만료(FA) 상태: 원소속팀 재계약 심사 (프랜차이즈의 심장 특성 보유 시 우대)
    const currentTeamEval = evaluateTeamScouting(career, career.team, rng);
    const hasFranchiseHeart = (career.traits || []).includes('FRANCHISE_HEART');

    if (
      currentTeamEval.passesOfferThreshold ||
      (hasFranchiseHeart && career.age <= 36 && currentTeamEval.scoutingScore >= 52)
    ) {
      const sal = getContractDefaultSalary(
        currentTeamEval.recommendedContract,
        career.ovr
      );
      options.push({
        id: 'OPT_RESIGN_CURRENT_TEAM',
        title: `✍️ ${career.team.name} FA 재계약 오퍼 (스카우트 ${currentTeamEval.scoutingScore}점)`,
        subtitle: `[${currentTeamEval.promisedRoleLabel}] 조건 · 원소속팀으로부터 공식 연장 계약서를 제안받았어요.`,
        badgeText: '원소속팀 재계약',
        targetLeague: career.league,
        targetTeam: career.team,
        contractType: currentTeamEval.recommendedContract,
        contractYears: career.age >= 33 ? 1 : 3,
        annualSalary: sal,
        scoutingScore: currentTeamEval.scoutingScore,
        promisedRole: currentTeamEval.promisedRole,
        promisedRoleLabel: currentTeamEval.promisedRoleLabel,
        actionType: 'SIGN_TEAM',
      });
      teamOffersCount += 1;
    }

    // 동일 리그 타 구단 동적 스카우팅: [주전/1옵션을 보장하는 리빌딩·중하위 팀] vs [식스맨·롤플레이어지만 우승을 노리는 컨텐더 팀]
    const sameLeaguePool = (
      career.league === 'NBA'
        ? nbaTeams
        : career.league === 'KBL'
        ? kblTeams
        : career.league === 'OVERSEAS'
        ? overseasTeams
        : gleagueTeams
    ).filter((t) => t.id !== career.team.id);

    const evaluatedSameLeague = sameLeaguePool
      .map((t) => ({
        team: t,
        eval: evaluateTeamScouting(career, t, rng),
      }))
      .filter((item) => item.eval.passesOfferThreshold)
      .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

    // 전략적 대비를 위해 ① 주전/에이스 보장 구단 1곳 + ② 컨텐더/플레이오프 구단 1곳 우선 추출
    const starterOffer = evaluatedSameLeague.find(
      (x) =>
        x.eval.promisedRole === 'ACE_FIRST_OPTION' ||
        x.eval.promisedRole === 'STARTER_GUARANTEE'
    );
    const contenderOffer = evaluatedSameLeague.find(
      (x) =>
        x.team.id !== starterOffer?.team.id &&
        (x.team.direction === 'CONTENDER' || x.eval.promisedRole === 'SIXTH_MAN_CORE')
    );

    const pickedOffers = [
      ...(starterOffer ? [starterOffer] : []),
      ...(contenderOffer ? [contenderOffer] : []),
    ];
    if (pickedOffers.length === 0 && evaluatedSameLeague.length > 0) {
      pickedOffers.push(...evaluatedSameLeague.slice(0, 2));
    }

    for (const item of pickedOffers) {
      const sal = getContractDefaultSalary(
        item.eval.recommendedContract,
        career.ovr
      );
      const dirLabel =
        item.team.direction === 'CONTENDER'
          ? '우승 컨텐더'
          : item.team.direction === 'REBUILDING'
          ? '리빌딩 코어'
          : '플레이오프 경쟁';
      options.push({
        id: `OPT_FA_OFFER_${item.team.id}`,
        title: `📝 [FA 영입 제의] ${item.team.name} (${dirLabel})`,
        subtitle: `[${item.eval.promisedRoleLabel}] · 스카우트 ${
          item.eval.scoutingScore
        }점 · 보강 포지션(${item.team.neededPositions?.join('/')}) 적임자로 낙점되었어요!`,
        badgeText:
          item.eval.promisedRole === 'ACE_FIRST_OPTION' ||
          item.eval.promisedRole === 'STARTER_GUARANTEE'
            ? 'FA 주전 보장 오퍼'
            : 'FA 컨텐더 오퍼',
        targetLeague: item.team.league,
        targetTeam: item.team,
        contractType: item.eval.recommendedContract,
        contractYears: career.age >= 33 ? 1 : 2,
        annualSalary: sal,
        scoutingScore: item.eval.scoutingScore,
        promisedRole: item.eval.promisedRole,
        promisedRoleLabel: item.eval.promisedRoleLabel,
        actionType: 'SIGN_TEAM',
      });
      teamOffersCount += 1;
    }

    // 3) 베테랑 최저연봉(Veteran Minimum) 시장: 만 31세 이상 베테랑이 수비(DEF), 외곽(OUT), 조율(PLY) 강점을 유지 중이면 컨텐더 구단이 1년 미니멈 오퍼 제시
    const currentLdr = LEAGUE_CONFIG[career.league].ldr;
    const hasVeteranSpecialistSkill =
      career.stats.def >= currentLdr - 3 ||
      career.stats.out >= currentLdr - 3 ||
      career.stats.ply >= currentLdr - 3 ||
      (career.traits || []).includes('CLUTCH_PERFORMER') ||
      (career.traits || []).includes('SNIPER');

    if (
      career.age >= 31 &&
      !isOutOfLeague &&
      hasVeteranSpecialistSkill &&
      career.ovr >= currentLdr - 9 &&
      teamOffersCount === 0
    ) {
      const contenderPool = sameLeaguePool.filter(
        (t) => t.direction === 'CONTENDER' || t.direction === 'PLAYOFF_HUNT'
      );
      const vetTeam =
        contenderPool[Math.floor(rng() * contenderPool.length)] ||
        sameLeaguePool[0];
      if (vetTeam) {
        const vetContract: ContractType =
          vetTeam.league === 'NBA'
            ? 'NBA_VET_MIN'
            : vetTeam.league === 'KBL'
            ? 'KBL_VET'
            : 'OVERSEAS_CONTRACT';
        options.push({
          id: `OPT_VET_MIN_${vetTeam.id}`,
          title: `🎖️ [베테랑 최저연봉 오퍼] ${vetTeam.name} 1년 계약 제의`,
          subtitle: `득점 볼륨은 줄었지만 노련한 수비·슈팅·경기 조율 가치를 높이 산 우승권 구단 ${vetTeam.shortName}에서 베테랑 롤플레이어 계약을 제안했어요!`,
          badgeText: '베테랑 미니멈 (1년)',
          targetLeague: vetTeam.league,
          targetTeam: vetTeam,
          contractType: vetContract,
          contractYears: 1,
          annualSalary: getContractDefaultSalary(vetContract, career.ovr),
          promisedRole: 'VETERAN_MENTOR',
          promisedRoleLabel: ROLE_PROMISE_LABELS.VETERAN_MENTOR,
          actionType: 'SIGN_TEAM',
        });
        teamOffersCount += 1;
      }
    }
  }

  // 4) KBL / 해외 / G리그 소속 선수의 상위 리그 및 NBA 단계적 도전 루트
  if (career.league !== 'NBA' && !isOutOfLeague) {
    const per36Pts = lastLog
      ? (lastLog.ppg * 36) / Math.max(12, lastLog.mpg)
      : 0;
    if (
      career.age <= 22 &&
      career.totals.nbaGp === 0 &&
      per36Pts >= 16.5 &&
      career.draftStock >= 44
    ) {
      options.push({
        id: 'OPT_PRO_TO_NBA_DRAFT',
        title: '🏀 NBA 신인드래프트 참가 신청 (시카고 컴바인 진출)',
        subtitle: '프로 무대에서 입증한 실전 기록을 바탕으로 NBA 드래프트에 도전장을 던져요!',
        badgeText: 'NBA 드래프트',
        targetLeague: 'NBA',
        contractType: 'NBA_STANDARD',
        contractYears: 4,
        actionType: 'ENTER_NBA_DRAFT',
      });
    }

    if (career.league === 'KBL' || career.league === 'OVERSEAS') {
      const glShowcaseTeam = selectBestFitTeamForPlayer(
        'GLEAGUE',
        career.primaryPos,
        career.secondaryPos,
        career.teamRatingsMap,
        rng
      );
      const glEval = evaluateTeamScouting(career, glShowcaseTeam, rng);

      if (glEval.passesOfferThreshold && per36Pts >= 17.5) {
        options.push({
          id: 'OPT_SUMMER_LEAGUE_SHOWCASE_STEP1',
          title: `🇺🇸 [1단계] NBA 라스베이거스 서머리그 초청 & ${glShowcaseTeam.name} 쇼케이스 합류`,
          subtitle:
            '서머리그와 G리그 쇼케이스 무대에서 NBA 스카우트들에게 실전 경쟁력을 증명해요!',
          badgeText: '서머리그 초청장',
          targetLeague: 'GLEAGUE',
          targetTeam: glShowcaseTeam,
          contractType: 'SUMMER_LEAGUE_INVITE',
          contractYears: 1,
          annualSalary: getContractDefaultSalary('SUMMER_LEAGUE_INVITE', career.ovr),
          scoutingScore: glEval.scoutingScore,
          promisedRole: 'STARTER_GUARANTEE',
          promisedRoleLabel: ROLE_PROMISE_LABELS.STARTER_GUARANTEE,
          actionType: 'SIGN_TEAM',
        });
        teamOffersCount += 1;
      }

      if (career.league === 'KBL') {
        const ovsCandidates = overseasTeams
          .map((t) => ({
            team: t,
            eval: evaluateTeamScouting(career, t, rng),
          }))
          .filter((x) => x.eval.passesOfferThreshold)
          .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

        if (ovsCandidates.length > 0) {
          const bestOvs = ovsCandidates[0];
          options.push({
            id: `OPT_KBL_TO_OVS_${bestOvs.team.id}`,
            title: `🌏 ${bestOvs.team.name} 해외 리그 스카우트 오퍼`,
            subtitle: `[${bestOvs.eval.promisedRoleLabel}] · 스카우트 ${bestOvs.eval.scoutingScore}점 · 더 높은 무대(LDR 71)에서 도전을 이어가요.`,
            badgeText: '해외 프로 오퍼',
            targetLeague: 'OVERSEAS',
            targetTeam: bestOvs.team,
            contractType: 'OVERSEAS_CONTRACT',
            contractYears: 2,
            annualSalary: getContractDefaultSalary('OVERSEAS_CONTRACT', career.ovr),
            scoutingScore: bestOvs.eval.scoutingScore,
            promisedRole: bestOvs.eval.promisedRole,
            promisedRoleLabel: bestOvs.eval.promisedRoleLabel,
            actionType: 'SIGN_TEAM',
          });
          teamOffersCount += 1;
        }
      }
    } else if (career.league === 'GLEAGUE') {
      const nbaTwoWayCandidates = nbaTeams
        .map((t) => ({
          team: t,
          eval: evaluateTeamScouting(career, t, rng),
        }))
        .filter((x) => x.eval.passesOfferThreshold && per36Pts >= 17.5)
        .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

      if (nbaTwoWayCandidates.length > 0) {
        const pickedTwoWay = nbaTwoWayCandidates[0];
        options.push({
          id: `OPT_GLEAGUE_TO_TWOWAY_${pickedTwoWay.team.id}`,
          title: `🏀 [2단계 돌파] ${pickedTwoWay.team.name} NBA 투웨이(Two-Way) 계약 오퍼!`,
          subtitle: `쇼케이스 맹활약(스카우트 ${pickedTwoWay.eval.scoutingScore}점)으로 마침내 NBA 투웨이 콜업 계약을 따냈어요!`,
          badgeText: 'NBA 투웨이 오퍼',
          targetLeague: 'NBA',
          targetTeam: pickedTwoWay.team,
          contractType: 'TWO_WAY',
          contractYears: 1,
          annualSalary: getContractDefaultSalary('TWO_WAY', career.ovr),
          scoutingScore: pickedTwoWay.eval.scoutingScore,
          promisedRole: 'PROSPECT_DEVELOPMENT',
          promisedRoleLabel: ROLE_PROMISE_LABELS.PROSPECT_DEVELOPMENT,
          actionType: 'SIGN_TEAM',
        });
        teamOffersCount += 1;
      }
    }
  }

  // 5) ★ 핵심 버그 방지 및 전략적 선택지 제공: 상위 리그(NBA/G리그/해외)에서 오퍼를 받지 못했거나,
  // 현재 리그 평균(LDR - 8)보다 OVR이 낮아 벤치에 머무는 선수는 하위 리그(KBL·해외·G리그) 주전/에이스 도약 오퍼가 함께 열림!
  const needsStepDownOption =
    teamOffersCount === 0 ||
    (career.contractYearsLeft === 0 &&
      career.league !== 'KBL' &&
      career.ovr <= LEAGUE_CONFIG[career.league].ldr - 8);

  if (needsStepDownOption && !isOutOfLeague) {
    const stepDownPools =
      career.league === 'NBA'
        ? [...gleagueTeams, ...overseasTeams, ...kblTeams]
        : career.league === 'GLEAGUE' || career.league === 'OVERSEAS'
        ? [...overseasTeams, ...kblTeams]
        : [...kblTeams];

    const fallbackCandidates = stepDownPools
      .map((t) => ({
        team: t,
        eval: evaluateTeamScouting(career, t, rng),
      }))
      .filter(
        (x) =>
          x.eval.passesOfferThreshold ||
          (career.age <= 33 && career.ovr >= LEAGUE_CONFIG.KBL.ldr - 6)
      )
      .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore)
      .slice(0, teamOffersCount === 0 ? 2 : 1);

    for (const item of fallbackCandidates) {
      const sal = getContractDefaultSalary(
        item.eval.recommendedContract,
        career.ovr
      );
      options.push({
        id: `OPT_STEPDOWN_${item.team.id}`,
        title: `🔥 [${LEAGUE_CONFIG[item.team.league].shortName} 주전 도약 오퍼] ${item.team.name} 영입 제의`,
        subtitle: `[${item.eval.promisedRoleLabel}] · 상위 리그 경험을 높이 평가한 ${item.team.name} 구단에서 주축 선수 계약을 제안했어요!`,
        badgeText: `${LEAGUE_CONFIG[item.team.league].shortName} 영입 오퍼`,
        targetLeague: item.team.league,
        targetTeam: item.team,
        contractType: item.eval.recommendedContract,
        contractYears: 2,
        annualSalary: sal,
        scoutingScore: item.eval.scoutingScore,
        promisedRole: item.eval.promisedRole,
        promisedRoleLabel: item.eval.promisedRoleLabel,
        actionType: 'SIGN_TEAM',
      });
      teamOffersCount += 1;
    }
  }

  // 6) 전 세계 어떤 구단에서도 오퍼가 0개이거나 노쇠화 방출(isOutOfLeague)인 경우에만 강제 은퇴 발동
  if (teamOffersCount === 0 || isOutOfLeague) {
    options.push({
      id: 'OPT_RETIRE_OUT_OF_LEAGUE',
      title: '🎤 소속팀 부재로 인한 현역 은퇴 (구단 영입 오퍼 0건)',
      subtitle:
        '전 세계 프로 구단 스카우팅 평가 결과 재계약 및 최저연봉 오퍼조차 도착하지 않아 현역 생활을 마무리하고 은퇴식을 진행해요.',
      badgeText: '미계약 강제 은퇴',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: 'FREE_AGENT',
      contractYears: 0,
      actionType: 'RETIRE_OUT_OF_LEAGUE',
    });
    return options;
  }

  // ② 레전드 은퇴 투어 선언
  if (canDeclareFarewellTour) {
    options.push({
      id: 'OPT_DECLARE_FAREWELL_TOUR',
      title: '🌟 [마지막 1년] 공식 레전드 은퇴 투어(Farewell Tour) 선언',
      subtitle:
        '이번 시즌을 현역 마지막 해로 선언하고 전 구단 팬들의 기립박수와 유니폼 교환식 속에 화려한 피날레를 장식해요!',
      badgeText: '레전드 은퇴 투어',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: career.contractType,
      contractYears: 1,
      annualSalary: career.annualSalary,
      actionType: 'START_FAREWELL_TOUR',
    });
  }

  // ① 자율 명예 은퇴
  if (canRetireVoluntarily) {
    options.push({
      id: 'OPT_VOLUNTARY_RETIREMENT',
      title: '🎤 박수칠 때 떠나기 (현역 은퇴 선언)',
      subtitle:
        '그동안 쌓아 올린 빛나는 커리어를 뒤로하고 공식 은퇴식과 영구결번·명예의 전당 심사로 이동해요.',
      badgeText: '자율 명예 은퇴',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: 'FREE_AGENT',
      contractYears: 0,
      actionType: 'RETIRE_VOLUNTARY',
    });
  }

  return options;
}
