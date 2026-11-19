import { DRAFT_SCOUTING_CONFIG, ECONOMY_CONFIG } from '../config/balanceConfig';
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
  Position,
  RolePromiseType,
  TeamInfo,
} from '../types/game';
import { checkRetirementEligibility } from './retirementEngine';
import { getContractDefaultSalary } from './seasonSimulator';
import {
  calculateBiomechanicalProfile,
  calculateHeightMismatchPenalty,
} from './statCalculator';

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
  ACE_FIRST_OPTION: '1옵션 에이스 보장',
  STARTER_GUARANTEE: '주전 스타터 보장',
  SIXTH_MAN_CORE: '핵심 식스맨 · 클러치',
  PROSPECT_DEVELOPMENT: '코어 유망주 육성',
  VETERAN_MENTOR: '베테랑 리더 · 롤플레이어',
};

function getFrontOfficeInterestLabel(scoutingScore: number): string {
  if (scoutingScore >= 82) return '구단 최우선 영입 타깃';
  if (scoutingScore >= 72) return '적극적인 주축 영입 희망';
  if (scoutingScore >= 62) return '로테이션 핵심 전력 제안';
  return '전력 보강 영입 제안';
}

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
  if (
    contractType === 'NBA_VET_MIN' ||
    contractType === 'KBL_VET' ||
    (career.age >= 33 && gap < 1)
  ) {
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
  const mismatch = calculateHeightMismatchPenalty(
    career.heightCm,
    career.primaryPos
  );

  const compositeScore = Number(
    (
      (career.ovr - LEAGUE_CONFIG.HIGH_SCHOOL.ldr) * 3.0 +
      avgPpg * 1.65 +
      avgRpg * 0.85 +
      avgApg * 1.15 +
      avgStk * 2.2 +
      championships * 8 +
      mvps * 10 -
      mismatch.scoutingPenalty * 0.6
    ).toFixed(1)
  );

  // 득점 단일 컷오프(PPG>=18.5)를 폐기하고 올라운드 종합 지수(compositeScore)만으로 공정 평가
  const hsCut = DRAFT_SCOUTING_CONFIG.hsStarThresholds;
  let stars: 1 | 2 | 3 | 4 | 5 = 1;
  if (compositeScore >= hsCut.fiveStar) {
    stars = 5;
  } else if (compositeScore >= hsCut.fourStar) {
    stars = 4;
  } else if (
    compositeScore >= hsCut.threeStar ||
    championships >= 1 ||
    mvps >= 1
  ) {
    stars = 3;
  } else if (compositeScore >= hsCut.twoStar) {
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
 * 다차원 구단 스카우팅 AI 엔진 (리그 수준 환산 League Translation & Per-36 효율 모델 + 신장 미스매치 물리 검증)
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
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const mismatch = calculateHeightMismatchPenalty(
    career.heightCm,
    career.primaryPos
  );

  const ldrRatio = Math.pow(currentLeagueCfg.ldr / targetLeagueCfg.ldr, 1.45);
  const isSteppingDownLeague = currentLeagueCfg.ldr >= targetLeagueCfg.ldr + 6;

  let realGameCompetence = true;
  let translatedPerfScore = 13.5;

  // [자연 도태 스카우팅 (Natural Selection)]
  // 신장 숫자만으로 무조건 하드밴하지 않고, 생체역학 물리 부하(positionalPhysicsStrain, tovRatePenalty, perimeterDefPenalty)와
  // 실전 코트 효율(야투율, 36분 환산 생산성, 포지션별 리바운드/어시스트 효율)을 결합해 평가합니다.
  const bioEfficiencyDrag =
    bio.positionalPhysicsStrain * 14.5 +
    bio.tovRatePenalty * 2.2 +
    bio.perimeterDefPenalty * 0.55;

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
      (lastLog.fgPct - 43.0) * 0.45 + (lastLog.tpPct - 33.0) * 0.3;

    // 포지션별 필수 실전 역할 검증 (빅맨은 리바운드/블록 효율, 포인트가드는 어시스트/턴오버 억제 효율)
    const scale36 = 36 / Math.max(10.5, lastLog.mpg);
    const roleSpecificPenalty =
      (career.primaryPos === 'C' || career.primaryPos === 'PF') &&
      lastLog.rpg * scale36 < 5.2
        ? (5.2 - lastLog.rpg * scale36) * 1.8
        : career.primaryPos === 'PG' &&
          (lastLog.apg * scale36 < 4.2 || bio.tovRatePenalty >= 1.8)
        ? bio.tovRatePenalty * 2.4
        : 0;

    translatedPerfScore =
      (weightedImpact * ldrRatio + shootingEfficiency - roleSpecificPenalty) *
      (0.78 + currentLeagueCfg.prestige * 0.28);

    const ovrEdgeOverTargetLeague = career.ovr - targetLeagueCfg.ldr;
    const effectiveCompetenceIndex =
      weightedImpact * ldrRatio +
      shootingEfficiency * 1.15 -
      roleSpecificPenalty -
      bioEfficiencyDrag * 0.65 +
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
  } else if (
    bioEfficiencyDrag >= 11.0 &&
    (targetTeam.league === 'NBA' ||
      targetTeam.league === 'GLEAGUE' ||
      targetTeam.league === 'OVERSEAS')
  ) {
    // 경기 기록이 없거나 부족한 상태에서 극단적 물리 부하 포지션을 고집할 경우 실전 경쟁력 미달
    realGameCompetence = false;
  }

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
    mismatch.scoutingPenalty -
    (realGameCompetence ? 0 : 22);

  const scoutingScore = Number(
    Math.max(10, Math.min(99, rawScoutingScore)).toFixed(1)
  );

  const baseLeagueBar =
    targetTeam.league === 'NBA'
      ? 64
      : targetTeam.league === 'OVERSEAS' || targetTeam.league === 'GLEAGUE'
      ? 55
      : 51;
  const directionOffset =
    teamDirection === 'CONTENDER' ? 6 : teamDirection === 'PLAYOFF_HUNT' ? 3 : -1;
  const threshold = baseLeagueBar + directionOffset;

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
    rejectionReason: mismatch.isSevereMismatch
      ? `${career.heightCm}cm 신장으로 ${career.primaryPos} 포지션 수행 불가 (신장 미스매치 감점 -${mismatch.scoutingPenalty}점)`
      : !realGameCompetence
      ? '직전 시즌 리그 환산 Per-36 생산성 및 실전 효율 기준 미달'
      : scoutingScore < threshold
      ? `구단 스카우팅 기준 점수(${threshold}점) 미달 (현재 ${scoutingScore}점)`
      : undefined,
  };
}

/**
 * NBA 드래프트 예상 지명 순위 공식 (실전 성적, 리그 수준 환산 및 포지션별 신장 미스매치 반영)
 */
export function calculateProjectedNbaPick(
  career: Pick<CareerState, 'ovr' | 'draftStock' | 'league'> & {
    heightCm?: number;
    primaryPos?: Position;
    seasonLogs?: CareerState['seasonLogs'];
  },
  combineBonus: number = 0
): { nbaReadyScore: number; projectedPick: number; undraftedRisk: boolean } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const lastLog =
    career.seasonLogs && career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const mismatch =
    career.heightCm && career.primaryPos
      ? calculateHeightMismatchPenalty(career.heightCm, career.primaryPos)
      : { scoutingPenalty: 0 };

  const per36Pts = lastLog ? (lastLog.ppg * 36) / Math.max(10, lastLog.mpg) : 14;
  const lowPerfPenalty =
    lastLog && per36Pts < 10.5 && lastLog.mpg < 12.0 ? -12 : 0;

  const nbaReadyScore =
    (career.ovr - (LEAGUE_CONFIG.NBA.ldr - 16)) * 3.5 +
    career.draftStock * leagueConfig.prestige * 0.45 +
    combineBonus +
    lowPerfPenalty -
    mismatch.scoutingPenalty;
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
    const kblCfg = DRAFT_SCOUTING_CONFIG.kblDraft;
    const sourceLeagueCfg = LEAGUE_CONFIG[career.league];
    const mismatch = calculateHeightMismatchPenalty(
      career.heightCm,
      career.primaryPos
    );

    // 대학 4년 졸업생 경쟁 풀(만 21~22세 즉시전력)과 고졸 얼리 엔트리(만 19세 미완성 원석)를 공정 비교
    const ovrDiff = (career.ovr - kblCfg.collegeBaselineOvr) * kblCfg.ovrWeight;
    const prestigeAdj =
      (sourceLeagueCfg.prestige - kblCfg.prestigeRef) * kblCfg.prestigeWeight;
    const stockAdj = (career.draftStock - kblCfg.stockRef) * kblCfg.stockWeight;
    const potentialUpside =
      Math.max(0, career.potential - kblCfg.potentialRef) * kblCfg.potentialWeight;

    let earlyEntryAdj = 0;
    if (career.league === 'HIGH_SCHOOL') {
      const hsStars =
        career.prospectStars ?? evaluateHighSchoolProspect(career).stars;
      if (hsStars >= 5) {
        earlyEntryAdj = kblCfg.hsFiveStarBonus;
      } else if (hsStars === 4) {
        earlyEntryAdj = kblCfg.hsFourStarAdj;
      } else {
        earlyEntryAdj = kblCfg.hsThreeStarOrBelowAdj;
      }
    }

    const kblScore =
      ovrDiff +
      prestigeAdj +
      earlyEntryAdj +
      stockAdj +
      potentialUpside -
      mismatch.scoutingPenalty * kblCfg.mismatchWeight;

    const rawPick = Math.round(
      kblCfg.basePickAnchor - kblScore + (rng() * 4 - 2)
    );
    const pickNumber = Math.max(1, Math.min(20, rawPick));
    const round: 1 | 2 = pickNumber <= 10 ? 1 : 2;

    const sortedByRatingAsc = [...kblTeams].sort((a, b) => a.rating - b.rating);
    const candidateWindow =
      pickNumber <= 4
        ? sortedByRatingAsc.slice(0, 4)
        : pickNumber <= 10
        ? sortedByRatingAsc.slice(2, Math.min(10, sortedByRatingAsc.length))
        : sortedByRatingAsc;
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
      scoutingGrade: Math.max(45, Math.min(98, Math.round(68 + kblScore * 2.1))),
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
      message: `투웨이 신분으로 36분 환산 공헌도 ${per36Impact.toFixed(
        1
      )}(평균 ${lastSeasonPpg.toFixed(1)}점, FG ${fgPct}%)를 기록해 NBA 정식 보장 계약 승격 오퍼를 받았습니다.`,
    };
  }

  if (
    career.twoWaySeasonsUsed < 2 &&
    promotionEfficiencyScore >= 14.5 &&
    teamScout.realGameCompetence
  ) {
    return {
      status: 'RETAINED_YEAR_2',
      message: '정식 승격 기준에는 다소 못 미쳤으나 분당 효율과 잠재력을 인정받아 2년 차 투웨이 연장 제안을 받았습니다.',
    };
  }

  return {
    status: 'WAIVED',
    message: '투웨이 기간 동안 NBA 로테이션 기준을 충족하지 못해 웨이버 방출되었습니다. 타 리그 재기 오퍼를 확인하세요.',
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

  // [특수 Case 0] 국군체육부대 상무 복무 중인 경우
  if (career.militaryServiceSeasonsLeft > 0) {
    options.push({
      id: 'OPT_SANGMU_CONTINUE',
      title: `${SANGMU_TEAM.name} 잔여 복무 (${career.militaryServiceSeasonsLeft}시즌 남음)`,
      subtitle: '상무 소속으로 남은 병역 복무 기간 동안 경기에 출전합니다.',
      badgeText: '병역 복무',
      targetLeague: 'KBL',
      targetTeam: SANGMU_TEAM,
      contractType: 'MILITARY_SERVICE',
      contractYears: career.militaryServiceSeasonsLeft,
      annualSalary: ECONOMY_CONFIG.sangmuAnnualSalaryUsd,
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
        title: `${career.team.name} 다음 학년 진급`,
        subtitle: '고교 무대에서 실전 경험을 쌓으며 스카우트 평가를 높입니다.',
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
        title: `${uni.name} 스카우트 입학`,
        subtitle: `${uni.prestigeDesc}`,
        badgeText: 'U-리그 입학',
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
        title: 'KBL 신인드래프트 얼리 참가',
        subtitle:
          prospect.stars >= 5
            ? '최상위권 고교 평가를 바탕으로 KBL 프로 직행에 도전합니다.'
            : '대학 졸업생들과 경쟁하는 얼리 드래프트에 참가합니다.',
        badgeText: 'KBL 얼리',
        targetLeague: 'KBL',
        contractType: 'KBL_ROOKIE',
        contractYears: 3,
        annualSalary: getContractDefaultSalary('KBL_ROOKIE', career.ovr),
        actionType: 'ENTER_KBL_DRAFT',
      });
    }

    // 3) 미국 NCAA D1 장학금 오퍼: 4성급 이상 유망주에게만 1~2곳 제시
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
          title: `${ncaaTeam.name} D1 장학금 오퍼`,
          subtitle: '미국 NCAA 디비전 1 공식 장학금 입학 제안입니다.',
          badgeText: 'NCAA D1',
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

    // 4) 해외 프로/G리그 직행: 최상위 고교 유망주에게 스카우팅 적합도 최상위 1개 구단 오퍼 발생
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
          title: `${pickedDirect.name} 영입 오퍼`,
          subtitle: '해외 구단 스카우트의 공식 프로 직행 계약 제안입니다.',
          badgeText: '해외 직행',
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
        title: `${career.team.name} 다음 학년 잔류`,
        subtitle: '대학 무대에서 출전 기록과 드래프트 평가를 끌어올립니다.',
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
        title: 'NBA 신인드래프트 참가',
        subtitle: '시카고 드래프트 컴바인을 거쳐 NBA 지명에 도전합니다.',
        badgeText: 'NBA 드래프트',
        targetLeague: 'NBA',
        contractType: 'NBA_STANDARD',
        contractYears: 4,
        actionType: 'ENTER_NBA_DRAFT',
      });
    }

    options.push({
      id: 'OPT_COLLEGE_TO_KBL_DRAFT',
      title: 'KBL 신인드래프트 참가',
      subtitle: '국내 프로 무대 KBL 10개 구단 지명에 참가합니다.',
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
        title: `${career.team.name} 정식 보장 계약 승격`,
        subtitle: survival.message,
        badgeText: '정식 승격',
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
        title: `${career.team.name} 투웨이 2년 차 잔류`,
        subtitle: survival.message,
        badgeText: '투웨이 연장',
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
        title: `${item.team.name} 계약 오퍼`,
        subtitle: `${getFrontOfficeInterestLabel(item.scout.scoutingScore)}`,
        badgeText: `${LEAGUE_CONFIG[item.team.league].shortName} 오퍼`,
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
        title: '현역 은퇴 (영입 오퍼 없음)',
        subtitle: '웨이버 방출 이후 국내외 프로 구단 영입 오퍼가 없어 커리어를 마무리합니다.',
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
      title: `${career.team.name} 잔류`,
      subtitle: `${ROLE_PROMISE_LABELS[stayPromise]} 역할로 잔여 계약을 이어갑니다.`,
      badgeText: '잔여 계약',
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

    // 만약 구단이 약속한 역할(Role Promise)을 어겼거나 다년 계약 중 새로운 도전을 원할 경우 공식 트레이드 이적 요구 선택지 제공!
    const sameLeaguePoolForTrade = (
      career.league === 'NBA'
        ? nbaTeams
        : career.league === 'KBL'
        ? kblTeams
        : career.league === 'OVERSEAS'
        ? overseasTeams
        : gleagueTeams
    ).filter((t) => t.id !== career.team.id);

    const tradeTarget =
      sameLeaguePoolForTrade.find((t) =>
        t.neededPositions?.includes(career.primaryPos)
      ) || sameLeaguePoolForTrade.sort((a, b) => a.rating - b.rating)[0];

    if (tradeTarget) {
      if (career.brokenRolePromise) {
        options.push({
          id: `OPT_DEMAND_TRADE_${tradeTarget.id}`,
          title: `${tradeTarget.name} 트레이드 요구`,
          subtitle: `출전 시간 약속 미이행에 따라 ${tradeTarget.name} 구단으로 트레이드를 요구합니다.`,
          badgeText: '트레이드 요구',
          targetLeague: tradeTarget.league,
          targetTeam: tradeTarget,
          contractType: career.contractType,
          contractYears: career.contractYearsLeft,
          annualSalary: career.annualSalary,
          promisedRole: 'STARTER_GUARANTEE',
          promisedRoleLabel: ROLE_PROMISE_LABELS.STARTER_GUARANTEE,
          actionType: 'SIGN_TEAM',
        });
      } else {
        const tradePromise = determineTeamRolePromise(
          career,
          tradeTarget,
          career.contractType
        );
        options.push({
          id: `OPT_CONTRACT_REQUEST_TRADE_${tradeTarget.id}`,
          title: `${tradeTarget.name} 트레이드 요청`,
          subtitle: `잔여 계약을 유지한 채 ${tradeTarget.name} 구단으로 이적을 타진합니다.`,
          badgeText: '트레이드 요청',
          targetLeague: tradeTarget.league,
          targetTeam: tradeTarget,
          contractType: career.contractType,
          contractYears: career.contractYearsLeft,
          annualSalary: career.annualSalary,
          promisedRole: tradePromise.promisedRole,
          promisedRoleLabel: tradePromise.promisedRoleLabel,
          actionType: 'REQUEST_TRADE',
        });
      }
      teamOffersCount += 1;
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
        title: `${career.team.name} 재계약 오퍼`,
        subtitle: `${getFrontOfficeInterestLabel(currentTeamEval.scoutingScore)}`,
        badgeText: '재계약',
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
      options.push({
        id: `OPT_FA_OFFER_${item.team.id}`,
        title: `${item.team.name} FA 오퍼`,
        subtitle: `${getFrontOfficeInterestLabel(item.eval.scoutingScore)}`,
        badgeText: 'FA 오퍼',
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
          title: `${vetTeam.name} 베테랑 최저연봉 오퍼`,
          subtitle: `노련한 경기 운영과 수비 경험을 높이 평가한 ${vetTeam.shortName} 구단의 1년 계약 제안입니다.`,
          badgeText: '베테랑 미니멈',
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
      : 15;
    if (
      career.age <= 24 &&
      career.totals.nbaGp === 0 &&
      (per36Pts >= 14.5 || career.ovr >= 68) &&
      career.draftStock >= 36
    ) {
      options.push({
        id: 'OPT_PRO_TO_NBA_DRAFT',
        title: 'NBA 신인드래프트 참가',
        subtitle: '시카고 드래프트 컴바인을 거쳐 NBA 지명에 도전합니다.',
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
          title: `${glShowcaseTeam.name} 서머리그 초청`,
          subtitle: 'NBA 서머리그와 G리그 쇼케이스 무대에 합류합니다.',
          badgeText: '서머리그 초청',
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
            title: `${bestOvs.team.name} 영입 오퍼`,
            subtitle: `${getFrontOfficeInterestLabel(bestOvs.eval.scoutingScore)}`,
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
          title: `${pickedTwoWay.team.name} NBA 투웨이 오퍼`,
          subtitle: `${getFrontOfficeInterestLabel(pickedTwoWay.eval.scoutingScore)}`,
          badgeText: 'NBA 투웨이',
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

  // 5) 상위 리그에서 오퍼를 받지 못했거나 벤치에 머무는 선수에게 하위 리그 주전 도약 오퍼 제공
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
        title: `${item.team.name} 영입 오퍼`,
        subtitle: `${LEAGUE_CONFIG[item.team.league].shortName} 무대에서 주축 역할을 제안받았습니다.`,
        badgeText: `${LEAGUE_CONFIG[item.team.league].shortName} 오퍼`,
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
      title: '현역 은퇴 (영입 오퍼 없음)',
      subtitle: '도착한 구단 계약 오퍼가 없어 현역 생활을 마무리합니다.',
      badgeText: '미계약 은퇴',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: 'FREE_AGENT',
      contractYears: 0,
      actionType: 'RETIRE_OUT_OF_LEAGUE',
    });
    return options;
  }

  // 레전드 은퇴 투어 선언
  if (canDeclareFarewellTour) {
    options.push({
      id: 'OPT_DECLARE_FAREWELL_TOUR',
      title: '은퇴 투어 선언 (마지막 1년)',
      subtitle: '이번 시즌을 끝으로 은퇴를 예고하고 마지막 시즌을 치릅니다.',
      badgeText: '은퇴 투어',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: career.contractType,
      contractYears: 1,
      annualSalary: career.annualSalary,
      actionType: 'START_FAREWELL_TOUR',
    });
  }

  // 자율 명예 은퇴
  if (canRetireVoluntarily) {
    options.push({
      id: 'OPT_VOLUNTARY_RETIREMENT',
      title: '현역 은퇴 선언',
      subtitle: '커리어를 마무리하고 영구결번 및 명예의 전당 심사로 이동합니다.',
      badgeText: '현역 은퇴',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: 'FREE_AGENT',
      contractYears: 0,
      actionType: 'RETIRE_VOLUNTARY',
    });
  }

  return options;
}
