import {
  CareerState,
  GrowthDna,
  HallOfFameEntry,
  LeagueId,
  LegacyEvaluation,
  LegacyTierId,
  PlayerStats,
  PlayerTraitId,
  RecordBookState,
  RetirementReason,
  StatDelta,
  TeamInfo,
} from '../types/game';
import {
  AGING_RETIREMENT_CONFIG,
  ECONOMY_CONFIG,
  GROWTH_DNA_CONFIG,
  INTERNATIONAL_TOURNAMENT_CONFIG,
  LEAGUE_BALANCE_META,
  clampNum,
} from '../config/balanceConfig';
import { getTeamById } from '../data/teams';
import { LEAGUE_CONFIG } from '../data/leagues';
import { buildCareerRetrospective } from './retrospectiveEngine';

export interface AgingCurveOptions {
  growthDna?: GrowthDna;
  careerMinutes?: number;
  traits?: PlayerTraitId[];
  hasBiomechLab?: boolean;
  hasCampAgingShield?: boolean;
  veteranReinvented?: boolean;
}

export interface AgingPhaseInfo {
  phaseId: 'GROWTH' | 'PRIME' | 'VETERAN_MANAGE' | 'DECLINE';
  label: string;
  description: string;
}

/**
 * DNA·트레이트별 성장 종료 나이 및 노쇠화 시작 나이(onsetAge) 단일 진실 원천 산출
 * - SLOW_STARTER 트레이트는 성장 종료 나이와 노쇠화 시작 나이를 최소 대기만성형(LATE_BLOOMER) 수준으로 끌어올림
 * - 고마일리지 대기만성형이라도 성장기 직후 최소 1시즌의 전성기(PRIME) 구간을 보장
 */
export function computeEffectiveAgingOnset(
  growthDna: GrowthDna = 'STANDARD',
  careerMinutes: number = 0,
  traits?: PlayerTraitId[]
): { maxGrowthAge: number; onsetAge: number; mileageOffset: number; dnaSeverityMult: number } {
  const dnaCfg = GROWTH_DNA_CONFIG[growthDna] || GROWTH_DNA_CONFIG.STANDARD;
  const hasSlowStarter = Boolean(traits?.includes('SLOW_STARTER'));
  const effectiveMaxGrowthAge = hasSlowStarter
    ? Math.max(dnaCfg.maxGrowthAge, GROWTH_DNA_CONFIG.LATE_BLOOMER.maxGrowthAge)
    : dnaCfg.maxGrowthAge;
  const effectiveAgingOnsetOffset = hasSlowStarter
    ? Math.max(
        dnaCfg.agingOnsetOffset,
        GROWTH_DNA_CONFIG.LATE_BLOOMER.agingOnsetOffset
      )
    : dnaCfg.agingOnsetOffset;
  const mileageOffset = clampNum(
    (AGING_RETIREMENT_CONFIG.mileageReferenceMinutes - careerMinutes) /
      AGING_RETIREMENT_CONFIG.mileageScaleDivisor,
    -1.8,
    1.0
  );
  const rawOnsetAge =
    AGING_RETIREMENT_CONFIG.baseOnsetAge + effectiveAgingOnsetOffset + mileageOffset;
  const minOnsetForPrime =
    effectiveMaxGrowthAge + dnaCfg.minPrimeYearsAfterGrowth + 0.5;
  const onsetAge = Math.max(minOnsetForPrime, rawOnsetAge);

  return {
    maxGrowthAge: effectiveMaxGrowthAge,
    onsetAge,
    mileageOffset,
    dnaSeverityMult: dnaCfg.agingSeverityMult,
  };
}

export function getAgingPhaseInfo(
  age: number,
  growthDna: GrowthDna = 'STANDARD',
  careerMinutes: number = 0,
  traits?: PlayerTraitId[]
): AgingPhaseInfo {
  const { maxGrowthAge, onsetAge } = computeEffectiveAgingOnset(
    growthDna,
    careerMinutes,
    traits
  );

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
 * 4-1. 단조 증가 연속 에이징 커브 (만 30세 전후 기준, DNA·마일리지·자기관리 반영)
 * - 구간 경계 불연속 점프 및 2단계→3단계 하락폭 역전 버그 제거
 * - 곱연산 방어 배율 하한선(0.58x)으로 무적화 차단, 신체(PHY/DEF/INS/REB) vs 기술(OUT/PLY) 이원화 하락
 */
export function applyAgingCurve(
  age: number,
  prev: PlayerStats,
  rng: () => number = Math.random,
  options?: AgingCurveOptions
): { nextStats: PlayerStats; delta: StatDelta } {
  const clampStat = (v: number) => clampNum(Math.round(v), 35, 99);

  const dna: GrowthDna = options?.growthDna || 'STANDARD';
  const careerMinutes = options?.careerMinutes ?? 15000;
  const hasBiomechLab = Boolean(options?.hasBiomechLab);
  const hasCampAgingShield = Boolean(options?.hasCampAgingShield);
  const veteranReinvented = Boolean(options?.veteranReinvented);

  const { onsetAge, dnaSeverityMult } = computeEffectiveAgingOnset(
    dna,
    careerMinutes,
    options?.traits
  );

  // 누적 출전 마일리지 가속 계수
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
  const agingYears = age - onsetAge;

  const nextStats: PlayerStats = { ...prev };
  const delta: StatDelta = { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 };

  if (agingYears < 0) {
    // 개인 노쇠화 시작 전(전성기 후반): 기량 유지, 만 30세 이하에서만 노련미(PLY) 제한적 보정
    if (age <= 30 && rng() < 0.35 && prev.ply < 95) {
      nextStats.ply = clampStat(prev.ply + 1);
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

  // 모든 agingYears >= 0 구간에서 엄격히 단조 증가하는 단일 연속 에이징 곡선
  const continuousSeverity = 1.0 + Math.pow(agingYears, 1.15) * 0.23;
  const athleticRamp = 0.35 + clampNum(agingYears / 3.2, 0, 0.65);
  const skillRamp = clampNum((agingYears - 1.8) / 3.2, 0, 1.0);
  const agingSpan6 = clampNum(agingYears / 6.0, 0, 1.0);
  const skillSpan5 = clampNum((agingYears - 2.0) / 5.0, 0, 1.0);

  const phyDrop = Math.max(
    1,
    Math.round(
      (1.2 + clampNum(agingYears / 10, 0, 0.78) + rng() * 0.9) *
        continuousSeverity *
        combinedMult
    )
  );
  const insDrop = Math.round(
    (0.68 + agingSpan6 * 0.55 + rng() * 0.75) *
      athleticRamp *
      continuousSeverity *
      combinedMult
  );
  const defDrop = Math.round(
    (0.68 + agingSpan6 * 0.55 + rng() * 0.75) *
      athleticRamp *
      continuousSeverity *
      combinedMult *
      (veteranReinvented ? 0.8 : 1.0)
  );
  const rebDrop = Math.round(
    (0.58 + agingSpan6 * 0.52 + rng() * 0.7) *
      athleticRamp *
      continuousSeverity *
      combinedMult
  );
  const outDrop = Math.round(
    (0.52 + skillSpan5 * 0.45 + rng() * 0.65) *
      skillRamp *
      continuousSeverity *
      combinedMult *
      (veteranReinvented ? 0.42 : 0.72)
  );
  const plyDrop = Math.round(
    (0.46 + skillSpan5 * 0.42 + rng() * 0.6) *
      skillRamp *
      continuousSeverity *
      combinedMult *
      (veteranReinvented ? 0.32 : 0.62)
  );

  nextStats.phy = clampStat(prev.phy - phyDrop);
  nextStats.ins = clampStat(prev.ins - insDrop);
  nextStats.def = clampStat(prev.def - defDrop);
  nextStats.reb = clampStat(prev.reb - rebDrop);
  nextStats.out = clampStat(prev.out - outDrop);
  nextStats.ply = clampStat(prev.ply - plyDrop);

  delta.phy = nextStats.phy - prev.phy;
  delta.ins = nextStats.ins - prev.ins;
  delta.def = nextStats.def - prev.def;
  delta.reb = nextStats.reb - prev.reb;
  delta.out = nextStats.out - prev.out;
  delta.ply = nextStats.ply - prev.ply;

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
      LEAGUE_BALANCE_META[log.league].isPro && !teamObj?.isMilitaryTeam;

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

  const jerseyCfg = AGING_RETIREMENT_CONFIG.jerseyRetirement;
  const meetsTeamJerseyRetirement = (rec: {
    league: LeagueId;
    seasons: number;
    points: number;
    championships: number;
    mvps: number;
    allStars: number;
    isProEligible: boolean;
  }): boolean => {
    if (!rec.isProEligible) return false;
    const reqPts =
      rec.league === 'NBA'
        ? jerseyCfg.nbaMinPoints
        : jerseyCfg.otherProMinPoints;
    const commitment = rec.seasons >= jerseyCfg.minSeasons && rec.points >= reqPts;
    const achievement =
      rec.mvps >= 2 ||
      (rec.championships >= 2 && rec.allStars >= 5) ||
      (rec.seasons >= 10 && rec.championships >= 1 && rec.allStars >= 6);
    return commitment && achievement;
  };

  let honoredTeam: TeamInfo = career.team;
  let honoredTeamSeasons = 0;
  let honoredTeamPoints = 0;
  let honoredTeamMvps = 0;
  let honoredTeamChamps = 0;
  let honoredTeamAllStars = 0;
  let jerseyRetired = false;

  if (teamMap.size > 0) {
    // 1순위: 영구결번 자격을 충족하는 프로 구단 중 최고 기여 구단
    // 2순위: 자격 미충족 시 프로 구단 중 최고 기여 구단 (프로 기록 없으면 전체 구단)
    const allRecords = Array.from(teamMap.values());
    const proRecords = allRecords.filter((r) => r.isProEligible);
    const qualifiedProRecords = proRecords.filter(meetsTeamJerseyRetirement);
    const pool =
      qualifiedProRecords.length > 0
        ? qualifiedProRecords
        : proRecords.length > 0
        ? proRecords
        : allRecords;
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
    jerseyRetired = qualifiedProRecords.length > 0;
  }

  // 레거시 점수 계산 (리그 티어 가중치를 반영한 어워드 점수 + 국제대회/마케팅 보너스)
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

  const hasSeasonLogs = career.seasonLogs.length > 0;
  const proLogs = career.seasonLogs.filter(
    (l) => LEAGUE_BALANCE_META[l.league].isPro
  );
  const currentIsPro = LEAGUE_BALANCE_META[career.league].isPro;

  const awardTierWeight = (league: LeagueId) =>
    league === 'NBA'
      ? 1.0
      : LEAGUE_BALANCE_META[league].isPro
      ? 0.55
      : 0.15;

  const weightedAwardLegacyPoints = hasSeasonLogs
    ? career.seasonLogs.reduce((sum, l) => {
        const w = awardTierWeight(l.league);
        return (
          sum +
          (l.wonFinalsMvp ? 550 * w : 0) +
          (l.wonDpoy ? 420 * w : 0) +
          (l.wonSixthMan ? 220 * w : 0) +
          (l.wonMip ? 200 * w : 0) +
          (l.allLeagueTeam ? 180 * w : 0)
        );
      }, 0)
    : (career.totals.finalsMvps || 0) * 550 +
      (career.totals.dpoys || 0) * 420 +
      (career.totals.sixthManAwards || 0) * 220 +
      (career.totals.mips || 0) * 200 +
      (career.totals.allLeagueSelections || 0) * 180;

  // 프로 기록 전용 집계 (고교·대학 아마추어 우승/MVP/득점이 프로 레전드 등급을 오염시키지 않도록 분리)
  const proPoints = hasSeasonLogs
    ? proLogs.reduce((s, l) => s + Math.round(l.ppg * l.gp), 0)
    : currentIsPro
    ? career.totals.points
    : 0;
  const proChamps = hasSeasonLogs
    ? proLogs.filter((l) => l.wonChampionship).length
    : currentIsPro
    ? career.totals.championships
    : 0;
  const proMvps = hasSeasonLogs
    ? proLogs.filter((l) => l.wonMvp).length
    : currentIsPro
    ? career.totals.mvps
    : 0;
  const proSeasons = hasSeasonLogs
    ? proLogs.length
    : currentIsPro
    ? career.seasonsPlayed
    : 0;

  const nonNbaProChamps = Math.max(0, proChamps - career.totals.nbaChampionships);
  const nonNbaProMvps = Math.max(0, proMvps - career.totals.nbaMvps);

  const legacyScore = Math.round(
    proPoints * 0.12 +
      career.totals.nbaPoints * 0.18 +
      career.totals.rebounds * 0.08 +
      career.totals.assists * 0.12 +
      career.totals.nbaChampionships * 850 +
      nonNbaProChamps * 260 +
      career.totals.nbaMvps * 1100 +
      nonNbaProMvps * 300 +
      weightedAwardLegacyPoints +
      career.totals.nbaAllStars * 300 +
      Math.max(0, career.totals.allStars - career.totals.nbaAllStars) * 100 +
      career.peakOvr * 15 +
      marketingLegacyBonus +
      internationalLegacyBonus
  );

  let tierId: LegacyTierId = 'COURT_CHALLENGER';
  let tierTitle = '코트의 도전자';
  const tierEmoji = '';
  let summaryComment =
    '끝까지 코트를 지키며 자신만의 농구 커리어를 완주했습니다.';

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

  // 주 활동 프로 리그 판별 (비아시아 프로 vs 아시아 프로 칭호 분기)
  const nonNbaProLeagueWeights = new Map<LeagueId, number>();
  for (const l of proLogs) {
    if (l.league === 'NBA') continue;
    nonNbaProLeagueWeights.set(
      l.league,
      (nonNbaProLeagueWeights.get(l.league) || 0) + 100 + Math.round(l.ppg * l.gp) * 0.05
    );
  }
  let primaryNonNbaProLeague: LeagueId =
    career.league !== 'NBA' && currentIsPro ? career.league : 'KBL';
  let bestLeagueWeight = -1;
  for (const [lg, weight] of nonNbaProLeagueWeights.entries()) {
    if (weight > bestLeagueWeight) {
      bestLeagueWeight = weight;
      primaryNonNbaProLeague = lg;
    }
  }

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
    proSeasons >= 1 &&
    (proChamps >= 2 ||
      proMvps >= 1 ||
      proPoints >= 6500 ||
      (proSeasons >= 4 && legacyScore >= 2600))
  ) {
    tierId = 'ASIA_KBL_LEGEND';
    if (primaryNonNbaProLeague === 'EUROLEAGUE') {
      tierTitle = '유로리그 · 유럽 최정상급 선수';
      summaryComment =
        '유럽 최상위 프로 무대인 유로리그에서 리그를 대표하는 간판 선수로 정상급 커리어를 남겼습니다.';
    } else if (
      primaryNonNbaProLeague === 'NBL' ||
      primaryNonNbaProLeague === 'GLEAGUE'
    ) {
      tierTitle = '해외 프로 최정상급 선수';
      summaryComment =
        '해외 프로 무대에서 압도적인 경쟁력과 꾸준한 활약으로 정상급 커리어를 완성했습니다.';
    } else {
      tierTitle = 'KBL · 아시아 최정상급 선수';
      summaryComment =
        'KBL과 아시아 프로 무대에서 리그를 대표하는 간판 선수로 오랜 기간 정상급 성적을 남겼습니다.';
    }
  } else if (
    proSeasons >= 4 ||
    proPoints >= 2200 ||
    (!hasSeasonLogs && currentIsPro && (career.seasonsPlayed >= 6 || career.totals.points >= 2200))
  ) {
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
  const leagueCareerHighPts: Partial<Record<LeagueId, number>> = {};
  for (const log of career.seasonLogs) {
    const prevHigh = leagueCareerHighPts[log.league] ?? 0;
    const seasonHigh = log.singleGameHighPts ?? 0;
    if (seasonHigh > prevHigh) {
      leagueCareerHighPts[log.league] = seasonHigh;
    }
  }
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
    finalSeasonYear:
      career.seasonLogs.length > 0
        ? career.seasonLogs[career.seasonLogs.length - 1].year
        : career.seasonYear,
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
    leagueCareerHighPts,
    epitaph: evaluation.summaryComment,
    retrospective,
  };
}
