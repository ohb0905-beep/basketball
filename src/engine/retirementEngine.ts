import {
  CareerState,
  GrowthDna,
  HallOfFameEntry,
  LeagueId,
  LegacyEvaluation,
  LegacyTierId,
  PlayerStats,
  RecordBookState,
  RetirementReason,
  StatDelta,
  TeamInfo,
} from '../types/game';
import {
  AGING_RETIREMENT_CONFIG,
  ECONOMY_CONFIG,
  INTERNATIONAL_TOURNAMENT_CONFIG,
  clampNum,
} from '../config/balanceConfig';
import { getTeamById } from '../data/teams';
import { LEAGUE_CONFIG } from '../data/leagues';
import { buildCareerRetrospective } from './retrospectiveEngine';

const PRO_LEAGUES: LeagueId[] = [
  'NBA',
  'KBL',
  'B_LEAGUE',
  'NBL',
  'EUROLEAGUE',
  'GLEAGUE',
];

export interface AgingCurveOptions {
  growthDna?: GrowthDna;
  careerMinutes?: number;
  hasBiomechLab?: boolean;
  hasCampAgingShield?: boolean;
  veteranReinvented?: boolean;
}

export interface AgingPhaseInfo {
  phaseId: 'GROWTH' | 'PRIME' | 'VETERAN_MANAGE' | 'DECLINE';
  label: string;
  description: string;
}

export function getAgingPhaseInfo(
  age: number,
  growthDna: GrowthDna = 'STANDARD',
  careerMinutes: number = 0
): AgingPhaseInfo {
  const maxGrowthAge =
    growthDna === 'LATE_BLOOMER'
      ? 28
      : growthDna === 'EARLY_BLOOMER'
      ? 25
      : growthDna === 'IRONMAN'
      ? 27
      : 26;
  const dnaOnsetOffset =
    growthDna === 'IRONMAN'
      ? 1.2
      : growthDna === 'LATE_BLOOMER'
      ? 0.6
      : growthDna === 'EARLY_BLOOMER'
      ? -1.2
      : 0;
  const mileageOffset = clampNum(
    (AGING_RETIREMENT_CONFIG.mileageReferenceMinutes - careerMinutes) /
      AGING_RETIREMENT_CONFIG.mileageScaleDivisor,
    -1.8,
    1.0
  );
  const onsetAge =
    AGING_RETIREMENT_CONFIG.baseOnsetAge + dnaOnsetOffset + mileageOffset;

  if (age <= maxGrowthAge) {
    return {
      phaseId: 'GROWTH',
      label: '성장기',
      description: '훈련과 실전 경험으로 기량이 빠르게 상승하는 구간입니다.',
    };
  }
  if (age < onsetAge) {
    return {
      phaseId: 'PRIME',
      label: '전성기',
      description: '커리어 최정점 기량을 유지하는 피크 구간입니다.',
    };
  }
  if (age - onsetAge <= 2.2) {
    return {
      phaseId: 'VETERAN_MANAGE',
      label: '베테랑 관리기',
      description: '운동능력 둔화가 시작되어 기술·컨디션 관리가 중요해집니다.',
    };
  }
  return {
    phaseId: 'DECLINE',
    label: '노쇠기',
    description: '누적 피로와 연령으로 신체 능력 하락이 가속되는 구간입니다.',
  };
}

/**
 * 4-1. 현실 NBA 평균형 에이징 커브 (28~31세 정점, 32세+ 가속 하락)
 * - 성장 DNA, 실제 누적 출전 마일리지, PHY 관리, 바이오메카닉스 랩, 31세+ 캠프 방어 버프 반영
 * - 곱연산 방어 배율 하한선(0.58x)으로 무적화 차단, 신체(PHY/DEF/INS/REB) vs 기술(OUT/PLY) 이원화 하락
 */
export function applyAgingCurve(
  age: number,
  prev: PlayerStats,
  rng: () => number = Math.random,
  options?: AgingCurveOptions
): { nextStats: PlayerStats; delta: StatDelta } {
  const clamp = (v: number) => Math.max(35, Math.min(99, Math.round(v)));

  const dna: GrowthDna = options?.growthDna || 'STANDARD';
  const careerMinutes = options?.careerMinutes ?? 15000;
  const hasBiomechLab = Boolean(options?.hasBiomechLab);
  const hasCampAgingShield = Boolean(options?.hasCampAgingShield);
  const veteranReinvented = Boolean(options?.veteranReinvented);

  // DNA별 노쇠화 시작 나이 오프셋 및 하락 배율
  const dnaOnsetOffset =
    dna === 'IRONMAN'
      ? 1.2
      : dna === 'LATE_BLOOMER'
      ? 0.6
      : dna === 'EARLY_BLOOMER'
      ? -1.2
      : 0;
  const dnaSeverityMult =
    dna === 'IRONMAN'
      ? 0.78
      : dna === 'LATE_BLOOMER'
      ? 0.9
      : dna === 'EARLY_BLOOMER'
      ? 1.18
      : 1.0;

  // 실제 통산 누적 출전 시간(마일리지) 연속 오프셋 (18,000분 기준, 많을수록 조기 노쇠화 + 하락 가속)
  const mileageOffset = clampNum(
    (AGING_RETIREMENT_CONFIG.mileageReferenceMinutes - careerMinutes) /
      AGING_RETIREMENT_CONFIG.mileageScaleDivisor,
    -1.8,
    1.0
  );
  const mileageSeverityMult =
    careerMinutes > AGING_RETIREMENT_CONFIG.mileageReferenceMinutes
      ? 1.0 +
        clampNum(
          (careerMinutes - AGING_RETIREMENT_CONFIG.mileageReferenceMinutes) /
            45000,
          0,
          AGING_RETIREMENT_CONFIG.mileageHighSeverityMaxBonus
        )
      : 1.0;

  // 피지컬(PHY) 자기관리 연속 보정 (PHY 72 기준, 높을수록 노쇠화 소폭 완충)
  const phyConditionBonus = clampNum(
    1.0 +
      (AGING_RETIREMENT_CONFIG.phyReference - prev.phy) *
        AGING_RETIREMENT_CONFIG.phySlopePerPoint,
    0.82,
    1.28
  );
  const biomechCareBonus = hasBiomechLab
    ? ECONOMY_CONFIG.personalCare.BIOMECH_SKILL_LAB.agingReductionFactor
    : 1.0;
  const campShieldBonus = hasCampAgingShield
    ? AGING_RETIREMENT_CONFIG.campAgingShieldFactor
    : 1.0;

  // 개인별 실질 노쇠화 진행 연차 (연속 실수)
  const onsetAge =
    AGING_RETIREMENT_CONFIG.baseOnsetAge + dnaOnsetOffset + mileageOffset;
  const agingYears = age - onsetAge;

  const nextStats: PlayerStats = { ...prev };
  const delta: StatDelta = { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 };

  if (agingYears < 0) {
    // 개인 노쇠화 시작 전(전성기 후반): 기량 유지, 만 30세 이하에서만 노련미(PLY) 제한적 보정
    if (age <= 30 && rng() < 0.35 && prev.ply < 95) {
      nextStats.ply = clamp(prev.ply + 1);
      delta.ply = nextStats.ply - prev.ply;
    }
    return { nextStats, delta };
  }

  // 곱연산 방어 배율 하한선(0.58x) 강제: 풀 관리+철강왕 조합도 세월을 완전히 멈출 수 없음
  const combinedMult = Math.max(
    AGING_RETIREMENT_CONFIG.minCombinedMultFloor,
    dnaSeverityMult *
      phyConditionBonus *
      biomechCareBonus *
      campShieldBonus *
      mileageSeverityMult
  );

  if (agingYears <= 2.0) {
    // 1단계 초기 노쇠기 (대략 30~32세): 운동능력(PHY/DEF/INS) 완만 하락, 기술(OUT/PLY) 유지 (순 OVR 역상승 차단)
    const earlyScale = 1.0 + agingYears * 0.22;
    const phyDrop = Math.max(
      1,
      Math.round((1.15 + rng() * 0.95) * earlyScale * combinedMult)
    );
    const defDrop = Math.max(
      agingYears >= 0.8 ? 1 : 0,
      Math.round((0.55 + rng() * 0.75) * earlyScale * combinedMult)
    );
    const insDrop = Math.max(
      agingYears >= 1.1 ? 1 : 0,
      Math.round((0.5 + rng() * 0.7) * earlyScale * combinedMult)
    );
    const rebDrop =
      agingYears >= 1.0
        ? Math.round((0.4 + rng() * 0.65) * earlyScale * combinedMult)
        : 0;

    nextStats.phy = clamp(prev.phy - phyDrop);
    nextStats.def = clamp(prev.def - defDrop);
    nextStats.ins = clamp(prev.ins - insDrop);
    nextStats.reb = clamp(prev.reb - rebDrop);

    delta.phy = nextStats.phy - prev.phy;
    delta.def = nextStats.def - prev.def;
    delta.ins = nextStats.ins - prev.ins;
    delta.reb = nextStats.reb - prev.reb;
  } else if (agingYears <= 5.0) {
    // 2단계 가속 하락기 (대략 32~35세): 운동능력·공수 기동력 본격 하락, 기술(OUT/PLY)은 소폭 하락 또는 진화 방어
    const continuousSeverity = 1.0 + Math.pow(agingYears, 1.18) * 0.26;
    const phyDrop = Math.max(
      2,
      Math.round((1.45 + rng() * 0.95) * continuousSeverity * combinedMult)
    );
    const insDrop = Math.max(
      1,
      Math.round((1.05 + rng() * 0.85) * continuousSeverity * combinedMult)
    );
    const defDrop = veteranReinvented
      ? Math.max(
          1,
          Math.round(
            (0.75 + rng() * 0.65) * continuousSeverity * combinedMult * 0.85
          )
        )
      : Math.max(
          1,
          Math.round((1.05 + rng() * 0.85) * continuousSeverity * combinedMult)
        );
    const rebDrop = Math.max(
      1,
      Math.round((0.95 + rng() * 0.8) * continuousSeverity * combinedMult)
    );
    const outDrop = veteranReinvented
      ? agingYears > 3.5 && rng() < 0.35 * combinedMult
        ? 1
        : 0
      : Math.max(
          0,
          Math.round(
            (0.45 + rng() * 0.55) * continuousSeverity * combinedMult * 0.68
          )
        );
    const plyDrop = veteranReinvented
      ? 0
      : agingYears > 3.2 && rng() < 0.5 * combinedMult
      ? 1
      : 0;

    nextStats.phy = clamp(prev.phy - phyDrop);
    nextStats.ins = clamp(prev.ins - insDrop);
    nextStats.def = clamp(prev.def - defDrop);
    nextStats.reb = clamp(prev.reb - rebDrop);
    nextStats.out = clamp(prev.out - outDrop);
    nextStats.ply = clamp(prev.ply - plyDrop);

    delta.phy = nextStats.phy - prev.phy;
    delta.ins = nextStats.ins - prev.ins;
    delta.def = nextStats.def - prev.def;
    delta.reb = nextStats.reb - prev.reb;
    delta.out = nextStats.out - prev.out;
    delta.ply = nextStats.ply - prev.ply;
  } else {
    // 3단계 황혼기 (대략 35~40세+): 신체 능력 급격 하락, 기술 스탯도 완만 하락 (베테랑 진화 시 OUT/PLY 방어)
    const twilightSeverity =
      1.0 + Math.pow(Math.max(1, agingYears - 3.5), 1.15) * 0.28;
    const athleticKeys: (keyof PlayerStats)[] = ['phy', 'ins', 'def', 'reb'];
    for (const k of athleticKeys) {
      const base = k === 'phy' ? 2.0 : 1.55;
      const drop = Math.max(
        2,
        Math.round((base + rng() * 1.35) * twilightSeverity * combinedMult)
      );
      nextStats[k] = clamp(prev[k] - drop);
      delta[k] = nextStats[k] - prev[k];
    }

    const skillKeys: (keyof PlayerStats)[] = ['out', 'ply'];
    for (const k of skillKeys) {
      const drop = veteranReinvented
        ? Math.max(
            0,
            Math.round(
              (0.6 + rng() * 0.7) * twilightSeverity * combinedMult * 0.55
            )
          )
        : Math.max(
            1,
            Math.round(
              (1.1 + rng() * 0.9) * twilightSeverity * combinedMult * 0.72
            )
          );
      nextStats[k] = clamp(prev[k] - drop);
      delta[k] = nextStats[k] - prev[k];
    }
  }

  return { nextStats, delta };
}

/**
 * 5대 은퇴 조건 중 시즌 직후 체크 (고정 OVR 커트라인 대신 리그 수비저항 LDR 및 실전 퍼포먼스 기반 판정)
 */
export function checkRetirementEligibility(career: CareerState): {
  canRetireVoluntarily: boolean;
  canDeclareFarewellTour: boolean;
  isOutOfLeague: boolean;
  isMandatoryAge40: boolean;
  canExtendPast40: boolean;
} {
  const canRetireVoluntarily =
    career.age >= AGING_RETIREMENT_CONFIG.voluntaryRetireAge ||
    career.seasonsPlayed >= AGING_RETIREMENT_CONFIG.voluntaryRetireSeasons;

  const hasLegendResume =
    career.totals.championships >= 1 ||
    career.totals.allStars >= 3 ||
    career.totals.mvps >= 1;

  const canDeclareFarewellTour =
    career.age >= AGING_RETIREMENT_CONFIG.farewellTourMinAge &&
    hasLegendResume &&
    !career.isFarewellTour &&
    !career.farewellTourCompleted;

  const leagueLdr = LEAGUE_CONFIG[career.league].ldr;
  const lastLog =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const hasActiveGuaranteedContract =
    career.contractYearsLeft > 0 &&
    career.contractType !== 'TWO_WAY' &&
    career.contractType !== 'FREE_AGENT' &&
    career.contractType !== 'AMATEUR' &&
    career.contractType !== 'MILITARY_SERVICE';

  // 고정 OVR 수치 대신 소속 리그 수비 저항(LDR) 대비 경쟁력 상실 및 실전 성적 급락을 유기적으로 판정
  const ovrGapFromLeague = career.ovr - leagueLdr;
  const severeRealGameDecline =
    lastLog !== null &&
    lastLog.ppg < 3.2 &&
    lastLog.mpg < 8.5 &&
    lastLog.rpg + lastLog.apg < 2.8;

  // 보장 다년 계약 중에는 노쇠화로 일방 방출(미계약 은퇴)되지 않음
  const isOutOfLeague =
    !hasActiveGuaranteedContract &&
    career.age >= AGING_RETIREMENT_CONFIG.outOfLeagueMinAge &&
    ((ovrGapFromLeague <= -12 && (!lastLog || lastLog.ppg < 4.5)) ||
      (ovrGapFromLeague <= -8 && severeRealGameDecline));

  // 만 40세 이후에도 리그 경쟁력을 유지하거나 보장 계약이 남아 있으면 44세까지 현역 연장 허용
  const maintainsAge40Competitiveness =
    hasActiveGuaranteedContract ||
    ovrGapFromLeague >= AGING_RETIREMENT_CONFIG.age40ExtensionMaxLdrGap ||
    (lastLog !== null &&
      lastLog.ppg >= AGING_RETIREMENT_CONFIG.age40ExtensionMinPpg &&
      lastLog.mpg >= AGING_RETIREMENT_CONFIG.age40ExtensionMinMpg);

  const canExtendPast40 =
    career.age < AGING_RETIREMENT_CONFIG.hardRetireAge &&
    maintainsAge40Competitiveness &&
    !isOutOfLeague;

  const isMandatoryAge40 =
    career.age >= AGING_RETIREMENT_CONFIG.hardRetireAge ||
    (career.age >= AGING_RETIREMENT_CONFIG.mandatoryRetireAge &&
      !canExtendPast40);

  return {
    canRetireVoluntarily,
    canDeclareFarewellTour,
    isOutOfLeague,
    isMandatoryAge40,
    canExtendPast40,
  };
}

/**
 * 6. 영구 결번(Jersey Retirement) 기준 대폭 상향 및 프로 한정 & 6단계 레거시 등급 심사
 * - 대학/아마추어 팀(HIGH_SCHOOL, U_LEAGUE, NCAA) 및 상무는 영구 결번 심사 대상에서 완전 제외
 * - 오직 프로 구단(NBA, KBL, B_LEAGUE, NBL, EUROLEAGUE, GLEAGUE)에서만 심사하며, 해당 단일 프로 구단(honoredTeam) 소속 누적 기록만 기준:
 *   1) 프랜차이즈 헌신 (필수): 단일 프로 구단 최소 7시즌 이상 활약 AND 해당 구단 누적 득점 10,000점 이상 (KBL/해외/G리그는 6,000점 이상)
 *   2) 압도적 구단 업적 (다음 중 1개 이상 충족):
 *      - 해당 구단 소속 정규리그 MVP 2회 이상
 *      - 해당 구단 소속 우승 2회 이상 + 올스타 5회 이상
 *      - 해당 구단 10시즌 이상 프랜차이즈 스타 + 우승 1회 이상 + 올스타 6회 이상
 */
export function evaluateCareerLegacy(career: CareerState): LegacyEvaluation {
  const teamMap = new Map<
    string,
    {
      teamId: string;
      league: LeagueId;
      seasons: number;
      points: number;
      championships: number;
      mvps: number;
      allStars: number;
      impactScore: number;
      isProEligible: boolean;
    }
  >();

  for (const log of career.seasonLogs) {
    const teamObj = getTeamById(log.teamId, career.teamRatingsMap);
    const isProEligible =
      PRO_LEAGUES.includes(log.league) && !teamObj?.isMilitaryTeam;

    const prev = teamMap.get(log.teamId) || {
      teamId: log.teamId,
      league: log.league,
      seasons: 0,
      points: 0,
      championships: 0,
      mvps: 0,
      allStars: 0,
      impactScore: 0,
      isProEligible,
    };
    const seasonPts = Math.round(log.ppg * log.gp);
    const leagueBonus = log.league === 'NBA' ? 1.6 : isProEligible ? 1.15 : 0.4;

    prev.seasons += 1;
    prev.points += seasonPts;
    if (log.wonChampionship) prev.championships += 1;
    if (log.wonMvp) prev.mvps += 1;
    if (log.allStarSelected) prev.allStars += 1;
    prev.impactScore +=
      (seasonPts * 0.1 +
        (log.wonChampionship ? 300 : 0) +
        (log.wonMvp ? 400 : 0) +
        (log.allStarSelected ? 120 : 0)) *
      leagueBonus;

    teamMap.set(log.teamId, prev);
  }

  let honoredTeam: TeamInfo = career.team;
  let honoredTeamSeasons = 0;
  let honoredTeamPoints = 0;
  let honoredTeamMvps = 0;
  let honoredTeamChamps = 0;
  let honoredTeamAllStars = 0;

  if (teamMap.size > 0) {
    // 프로 구단 기록이 있다면 프로 구단을 최우선으로 대표 구단 선정
    const allRecords = Array.from(teamMap.values());
    const proRecords = allRecords.filter((r) => r.isProEligible);
    const pool = proRecords.length > 0 ? proRecords : allRecords;
    const sorted = pool.sort((a, b) => b.impactScore - a.impactScore);
    const top = sorted[0];
    const foundTeam = getTeamById(top.teamId, career.teamRatingsMap);
    if (foundTeam) {
      honoredTeam = foundTeam;
    }
    honoredTeamSeasons = top.seasons;
    honoredTeamPoints = top.points;
    honoredTeamMvps = top.mvps;
    honoredTeamChamps = top.championships;
    honoredTeamAllStars = top.allStars;
  }

  // 프로 구단 여부 확인 (HIGH_SCHOOL, U_LEAGUE, NCAA 및 군팀 영구결번 절대 불가)
  const isProFranchise =
    PRO_LEAGUES.includes(honoredTeam.league) && !honoredTeam.isMilitaryTeam;

  const jerseyCfg = AGING_RETIREMENT_CONFIG.jerseyRetirement;
  const requiredFranchisePoints =
    honoredTeam.league === 'NBA'
      ? jerseyCfg.nbaMinPoints
      : jerseyCfg.otherProMinPoints;

  const meetsCommitment =
    isProFranchise &&
    honoredTeamSeasons >= jerseyCfg.minSeasons &&
    honoredTeamPoints >= requiredFranchisePoints;

  const meetsDominantAchievement =
    honoredTeamMvps >= 2 ||
    (honoredTeamChamps >= 2 && honoredTeamAllStars >= 5) ||
    (honoredTeamSeasons >= 10 &&
      honoredTeamChamps >= 1 &&
      honoredTeamAllStars >= 6);

  const jerseyRetired = meetsCommitment && meetsDominantAchievement;

  // 레거시 점수 계산 (신규 어워드 파이널 MVP, DPOY, 식스맨, MIP, 올-리그 팀, 국제대회 메달/MVP 및 마케팅 보너스 반영)
  const marketingLegacyBonus =
    (career.fanPopularity || 0) * 10 +
    (career.purchasedPersonalCareCount || 0) * 80;
  const internationalLegacyBonus = (career.internationalHistory || []).reduce(
    (sum, rec) => {
      const pts = INTERNATIONAL_TOURNAMENT_CONFIG[rec.tournamentType]?.legacyPoints;
      if (!pts) return sum;
      let delta = 0;
      if (rec.result === 'GOLD') delta += pts.gold;
      else if (rec.result === 'SILVER') delta += pts.silver;
      else if (rec.result === 'BRONZE') delta += pts.bronze;
      if (rec.wonMvp) delta += pts.mvp;
      return sum + delta;
    },
    0
  );
  const legacyScore = Math.round(
    career.totals.points * 0.12 +
      career.totals.nbaPoints * 0.18 +
      career.totals.rebounds * 0.08 +
      career.totals.assists * 0.12 +
      career.totals.nbaChampionships * 850 +
      (career.totals.championships - career.totals.nbaChampionships) * 260 +
      career.totals.nbaMvps * 1100 +
      (career.totals.mvps - career.totals.nbaMvps) * 300 +
      (career.totals.finalsMvps || 0) * 550 +
      (career.totals.dpoys || 0) * 420 +
      (career.totals.sixthManAwards || 0) * 220 +
      (career.totals.mips || 0) * 200 +
      (career.totals.allLeagueSelections || 0) * 180 +
      career.totals.nbaAllStars * 300 +
      (career.totals.allStars - career.totals.nbaAllStars) * 100 +
      career.peakOvr * 15 +
      marketingLegacyBonus +
      internationalLegacyBonus
  );

  let tierId: LegacyTierId = 'COURT_CHALLENGER';
  let tierTitle = '코트의 도전자';
  const tierEmoji = '';
  let summaryComment =
    '벤치에서 출발해 끝까지 코트를 지키며 자신의 커리어를 완주했습니다.';

  const finalsMvps = career.totals.finalsMvps || 0;
  const nbaMvpsFromLogs = career.seasonLogs.filter(
    (l) => l.league === 'NBA' && l.wonMvp
  ).length;
  const nbaFinalsMvpsFromLogs = career.seasonLogs.filter(
    (l) => l.league === 'NBA' && l.wonFinalsMvp
  ).length;
  const allNbaFirstTeams = career.seasonLogs.filter(
    (l) => l.league === 'NBA' && l.allLeagueTeam === 1
  ).length;
  const nbaAllStarsFromLogs = career.seasonLogs.filter(
    (l) => l.league === 'NBA' && l.allStarSelected
  ).length;

  const nbaMvps = Math.max(career.totals.nbaMvps || 0, nbaMvpsFromLogs);
  const nbaFinalsMvps =
    career.seasonLogs.length > 0
      ? nbaFinalsMvpsFromLogs
      : career.totals.nbaChampionships >= 1
      ? Math.min(finalsMvps, career.totals.nbaChampionships)
      : 0;
  const nbaAllStars = Math.max(
    career.totals.nbaAllStars || 0,
    nbaAllStarsFromLogs
  );

  const goatReq = AGING_RETIREMENT_CONFIG.goatRequirements;
  const hofReq = AGING_RETIREMENT_CONFIG.firstBallotHofRequirements;
  const meetsFirstBallotHof =
    nbaMvps >= hofReq.minNbaMvps ||
    nbaFinalsMvps >= hofReq.minNbaFinalsMvps ||
    allNbaFirstTeams >= hofReq.minAllNbaFirstTeams ||
    nbaAllStars >= hofReq.minNbaAllStars ||
    career.totals.nbaPoints >= hofReq.minNbaPoints;

  // GOAT 필수 조건: NBA MVP >= 3 AND NBA 우승 >= 3 AND 파이널 MVP >= 2 (점수 합산 우회 진입 완전 금지)
  if (
    nbaMvps >= goatReq.minNbaMvps &&
    career.totals.nbaChampionships >= goatReq.minNbaChampionships &&
    nbaFinalsMvps >= goatReq.minFinalsMvps
  ) {
    tierId = 'GOAT';
    tierTitle = '역대 최고 선수 (GOAT)';
    summaryComment =
      'NBA MVP, 파이널 우승, 파이널 MVP를 모두 다수 석권하며 농구 역사상 최고 반열에 이름을 올렸습니다.';
  } else if (meetsFirstBallotHof) {
    tierId = 'FIRST_BALLOT_HOF';
    tierTitle = '명예의 전당 퍼스트 발롯';
    summaryComment =
      'NBA 무대에서 MVP·파이널 MVP, All-NBA 퍼스트 팀 다수 선정, 올스타 10회 또는 통산 25,000득점의 반열에 오르며 첫 투표 만에 명예의 전당 헌액 자격을 확보했습니다.';
  } else if (
    career.totals.nbaAllStars >= 1 ||
    career.totals.nbaChampionships >= 1 ||
    career.totals.nbaPoints >= 6000
  ) {
    tierId = 'NBA_ALL_STAR';
    tierTitle = 'NBA 올스타 · 챔피언';
    summaryComment =
      'NBA 주축 선수로 자리 잡아 올스타 선정과 우승 경쟁 무대에서 뚜렷한 족적을 남겼습니다.';
  } else if (
    career.totals.nbaGp >= 120 ||
    career.totals.nbaPoints >= 1500
  ) {
    tierId = 'NBA_VETERAN';
    tierTitle = 'NBA 정식 리거';
    summaryComment =
      '치열한 NBA 로스터 경쟁을 뚫고 다년간 정식 로테이션 멤버로 활약했습니다.';
  } else if (
    career.totals.championships >= 2 ||
    career.totals.mvps >= 1 ||
    career.totals.points >= 6500 ||
    legacyScore >= 2600
  ) {
    tierId = 'ASIA_KBL_LEGEND';
    tierTitle = 'KBL · 아시아 최정상급 선수';
    summaryComment =
      'KBL과 아시아 프로 무대에서 리그를 대표하는 간판 선수로 오랜 기간 정상급 성적을 남겼습니다.';
  } else if (career.seasonsPlayed >= 6 || career.totals.points >= 2200) {
    tierId = 'PRO_VETERAN';
    tierTitle = '프로 베테랑';
    summaryComment =
      '여러 시즌 동안 안정적인 경기력과 팀 기여도를 보여주며 신뢰받는 프로 베테랑으로 경력을 마쳤습니다.';
  }

  return {
    tierId,
    tierTitle,
    tierEmoji,
    legacyScore,
    summaryComment,
    jerseyRetired,
    honoredTeam,
    honoredTeamSeasons,
    honoredTeamPoints,
    honoredTeamMvps,
    honoredTeamChamps,
    honoredTeamAllStars,
  };
}

export function buildHallOfFameEntry(
  career: CareerState,
  reason: RetirementReason,
  evaluation: LegacyEvaluation,
  recordBook?: RecordBookState | null
): HallOfFameEntry {
  const gp = Math.max(1, career.totals.gp);
  const nbaFinalsMvps = career.seasonLogs.filter(
    (l) => l.league === 'NBA' && l.wonFinalsMvp
  ).length;
  const kblChampionships = career.seasonLogs.filter(
    (l) => l.league === 'KBL' && l.wonChampionship
  ).length;
  const kblMvps = career.seasonLogs.filter(
    (l) => l.league === 'KBL' && l.wonMvp
  ).length;
  const kblFinalsMvps = career.seasonLogs.filter(
    (l) => l.league === 'KBL' && l.wonFinalsMvp
  ).length;
  const retrospective = buildCareerRetrospective(
    career,
    reason,
    evaluation,
    recordBook
  );
  return {
    id: `HOF_${career.id}_${Date.now()}`,
    inductedAt: new Date().toISOString(),
    name: career.name,
    jerseyNumber: career.jerseyNumber,
    heightCm: career.heightCm,
    primaryPos: career.primaryPos,
    secondaryPos: career.secondaryPos,
    peakOvr: career.peakOvr,
    finalAge: career.age,
    seasonsPlayed: career.seasonsPlayed,
    retirementReason: reason,
    legacyTierId: evaluation.tierId,
    legacyTitle: evaluation.tierTitle,
    legacyEmoji: evaluation.tierEmoji,
    legacyScore: evaluation.legacyScore,
    jerseyRetired: evaluation.jerseyRetired,
    iconicTeam: evaluation.honoredTeam,
    careerEarnings: career.careerEarnings || 0,
    traits: career.traits || [],
    totals: {
      gp: career.totals.gp,
      points: career.totals.points,
      rebounds: career.totals.rebounds,
      assists: career.totals.assists,
      nbaGp: career.totals.nbaGp,
      nbaPoints: career.totals.nbaPoints,
      championships: career.totals.championships,
      nbaChampionships: career.totals.nbaChampionships,
      mvps: career.totals.mvps,
      nbaMvps: career.totals.nbaMvps,
      finalsMvps: career.totals.finalsMvps || 0,
      nbaFinalsMvps,
      kblChampionships,
      kblMvps,
      kblFinalsMvps,
      dpoys: career.totals.dpoys || 0,
      sixthManAwards: career.totals.sixthManAwards || 0,
      mips: career.totals.mips || 0,
      allLeagueSelections: career.totals.allLeagueSelections || 0,
      allStars: career.totals.allStars,
      nbaAllStars: career.totals.nbaAllStars,
      internationalMedals: career.totals.internationalMedals
        ? { ...career.totals.internationalMedals }
        : undefined,
      internationalMvps: career.totals.internationalMvps || 0,
    },
    careerAverages: {
      ppg: Number((career.totals.points / gp).toFixed(1)),
      rpg: Number((career.totals.rebounds / gp).toFixed(1)),
      apg: Number((career.totals.assists / gp).toFixed(1)),
    },
    careerHighPts: career.careerHighs.points,
    epitaph: evaluation.summaryComment,
    retrospective,
  };
}
