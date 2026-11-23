import {
  ContractType,
  InternationalTournamentType,
  LeagueId,
  LiveTacticId,
  PersonalCareId,
} from '../types/game';

/**
 * 중앙 밸런스 파라미터 설정 모듈 (Single Source of Truth)
 * - 리그 메타(아마추어/프로 구분, 파울 한도, 라이브 중계 템포, 수상 명칭)
 * - 경제 및 퍼스널 케어(가용 자산 vs 통산 누적 연봉, 상무 급여, 리그별 해금 정책)
 * - 라이브 중계 & 클러치 1포제션(±4점 이내 자연 발동, 연장전, 파울 아웃, MPG 연동)
 * - 역할·출전시간(연속 보간)·부상 리스크·득점·투표 레이스(통합 공식)
 * - 드래프트·유망주(연속 종합 스코어)·트레이드(연속 승인 확률)·에이징 커브·은퇴/레거시
 */

export interface LeagueBalanceMeta {
  isPro: boolean;
  isAmateur: boolean;
  foulLimit: number;
  liveQuarterBasePts: number;
  liveOppQuarterBasePts: number;
  liveOvertimeBasePts: number;
  minAttendanceRatio: number;
  mvpBoardTitle: string;
  royBoardTitle: string;
  allStarLabel: string;
}

export const LEAGUE_BALANCE_META: Record<LeagueId, LeagueBalanceMeta> = {
  HIGH_SCHOOL: {
    isPro: false,
    isAmateur: true,
    foulLimit: 5,
    liveQuarterBasePts: 17,
    liveOppQuarterBasePts: 18,
    liveOvertimeBasePts: 8,
    minAttendanceRatio: 0.65,
    mvpBoardTitle: '전국대회 최우수 유망주(MVP) 랭킹 TOP 5',
    royBoardTitle: '신입생 유망주 랭킹 TOP 5',
    allStarLabel: '전국대회 베스트 5',
  },
  U_LEAGUE: {
    isPro: false,
    isAmateur: true,
    foulLimit: 5,
    liveQuarterBasePts: 18,
    liveOppQuarterBasePts: 19,
    liveOvertimeBasePts: 8,
    minAttendanceRatio: 0.65,
    mvpBoardTitle: '대학농구 최우수 선수(MVP) 랭킹 TOP 5',
    royBoardTitle: '대학 신인왕 랭킹 TOP 5',
    allStarLabel: '대학농구 베스트 5',
  },
  NCAA: {
    isPro: false,
    isAmateur: true,
    foulLimit: 5,
    liveQuarterBasePts: 18,
    liveOppQuarterBasePts: 19,
    liveOvertimeBasePts: 9,
    minAttendanceRatio: 0.66,
    mvpBoardTitle: 'NCAA 올해의 선수(NPOY) 투표 TOP 5',
    royBoardTitle: 'NCAA 최고 신입생(Freshman) TOP 5',
    allStarLabel: '올-아메리칸 선정',
  },
  KBL: {
    isPro: true,
    isAmateur: false,
    foulLimit: 5,
    liveQuarterBasePts: 19,
    liveOppQuarterBasePts: 20,
    liveOvertimeBasePts: 9,
    minAttendanceRatio: 0.67,
    mvpBoardTitle: 'KBL 정규시즌 MVP 투표 레이스 TOP 5',
    royBoardTitle: 'KBL 신인왕(ROY) 투표 레이스 TOP 5',
    allStarLabel: 'KBL 올스타',
  },
  B_LEAGUE: {
    isPro: true,
    isAmateur: false,
    foulLimit: 5,
    liveQuarterBasePts: 19,
    liveOppQuarterBasePts: 20,
    liveOvertimeBasePts: 9,
    minAttendanceRatio: 0.67,
    mvpBoardTitle: 'B.리그 B1 정규시즌 MVP 투표 TOP 5',
    royBoardTitle: 'B.리그 B1 신인왕(ROY) 투표 TOP 5',
    allStarLabel: 'B.리그 올스타',
  },
  NBL: {
    isPro: true,
    isAmateur: false,
    foulLimit: 5,
    liveQuarterBasePts: 21,
    liveOppQuarterBasePts: 22,
    liveOvertimeBasePts: 9,
    minAttendanceRatio: 0.66,
    mvpBoardTitle: '호주 NBL 정규시즌 MVP 투표 TOP 5',
    royBoardTitle: '호주 NBL 신인왕(ROY) 투표 TOP 5',
    allStarLabel: 'All-NBL 선정',
  },
  EUROLEAGUE: {
    isPro: true,
    isAmateur: false,
    foulLimit: 5,
    liveQuarterBasePts: 20,
    liveOppQuarterBasePts: 20,
    liveOvertimeBasePts: 9,
    minAttendanceRatio: 0.66,
    mvpBoardTitle: '유로리그 정규시즌 MVP 투표 TOP 5',
    royBoardTitle: '유로리그 라이징 스타(Rising Star) TOP 5',
    allStarLabel: '올-유로리그 선정',
  },
  GLEAGUE: {
    isPro: true,
    isAmateur: false,
    foulLimit: 6,
    liveQuarterBasePts: 24,
    liveOppQuarterBasePts: 25,
    liveOvertimeBasePts: 11,
    minAttendanceRatio: 0.65,
    mvpBoardTitle: 'G리그 정규시즌 MVP 투표 레이스 TOP 5',
    royBoardTitle: 'G리그 신인왕(ROY) 투표 레이스 TOP 5',
    allStarLabel: 'G리그 넥스트 업',
  },
  NBA: {
    isPro: true,
    isAmateur: false,
    foulLimit: 6,
    liveQuarterBasePts: 25,
    liveOppQuarterBasePts: 26,
    liveOvertimeBasePts: 11,
    minAttendanceRatio: 0.68,
    mvpBoardTitle: 'NBA 정규시즌 MVP 투표 레이스 TOP 5',
    royBoardTitle: 'NBA 신인왕(ROY) 투표 레이스 TOP 5',
    allStarLabel: 'NBA 올스타',
  },
};

/**
 * 프로 트레이드 시스템 허용 여부 (아마추어 및 상무 복무 제외 모든 프로 리그 허용)
 */
export function canUseProTradeSystem(params: {
  league: LeagueId;
  contractType?: ContractType;
  isMilitaryTeam?: boolean;
  teamId?: string;
}): boolean {
  if (!LEAGUE_BALANCE_META[params.league]?.isPro) return false;
  if (params.contractType === 'MILITARY_SERVICE') return false;
  if (params.isMilitaryTeam) return false;
  if (params.teamId === 'KBL_SANGMU') return false;
  return true;
}

export const ECONOMY_CONFIG = {
  amateurInitialScholarshipUsd: 20000,
  amateurAnnualStipendUsd: 8000,
  proNetCashRatio: 0.58, // 세금·에이전트 수수료·생활비 제외 가용 자산 적립 비율
  sangmuAnnualSalaryUsd: 5400,
  personalCare: {
    BIOMECH_SKILL_LAB: {
      proOnly: false,
      costs: {
        NBA: 450000,
        EUROLEAGUE: 220000,
        NBL: 110000,
        B_LEAGUE: 85000,
        KBL: 45000,
        GLEAGUE: 18000,
        NCAA: 10000,
        U_LEAGUE: 8000,
        HIGH_SCHOOL: 8000,
      } as Record<LeagueId, number>,
      growthMultiplier: 1.15,
      agingReductionFactor: 0.85,
    },
    REHAB_LOAD_MGMT: {
      proOnly: false,
      costs: {
        NBA: 350000,
        EUROLEAGUE: 170000,
        NBL: 85000,
        B_LEAGUE: 65000,
        KBL: 35000,
        GLEAGUE: 14000,
        NCAA: 8000,
        U_LEAGUE: 6000,
        HIGH_SCHOOL: 6000,
      } as Record<LeagueId, number>,
      injuryRiskMultiplier: 0.52,
      injuryGamesMultiplier: 0.55,
    },
    SIGNATURE_SNEAKER_MARKETING: {
      proOnly: true, // 고교·대학 아마추어는 글로벌 시그니처 스니커즈 런칭 불가
      costs: {
        NBA: 800000,
        EUROLEAGUE: 340000,
        NBL: 160000,
        B_LEAGUE: 120000,
        KBL: 75000,
        GLEAGUE: 30000,
        NCAA: 0,
        U_LEAGUE: 0,
        HIGH_SCHOOL: 0,
      } as Record<LeagueId, number>,
      stockBoost: 7,
      fanPopularityBoost: 18,
    },
  },
};

export function isPersonalCareAllowedInLeague(
  careId: PersonalCareId,
  league: LeagueId
): boolean {
  const cfg = ECONOMY_CONFIG.personalCare[careId];
  if (cfg.proOnly && !LEAGUE_BALANCE_META[league].isPro) {
    return false;
  }
  return true;
}

export function getPersonalCareCostFromConfig(
  careId: PersonalCareId,
  league: LeagueId
): number {
  return ECONOMY_CONFIG.personalCare[careId].costs[league] ?? 10000;
}

export const INTERNATIONAL_TOURNAMENT_CONFIG: Record<
  InternationalTournamentType,
  {
    id: InternationalTournamentType;
    name: string;
    shortName: string;
    yearMod4: 0 | 1 | 2 | 3;
    minOvr: number;
    ldr: number;
    baseKorRating: number;
    aceRatingWeight: number;
    aceRatingMaxBonus: number;
    winProbCap: number;
    militaryExemptionMinMedal: 'GOLD' | 'BRONZE' | null;
    draftStockBonus: number;
    legacyPoints: { gold: number; silver: number; bronze: number; mvp: number };
    subtitle: string;
  }
> = {
  ASIA_CUP: {
    id: 'ASIA_CUP',
    name: 'FIBA 아시아컵',
    shortName: '아시아컵',
    yearMod4: 1,
    minOvr: 68,
    ldr: 72,
    baseKorRating: 75.0,
    aceRatingWeight: 0.56,
    aceRatingMaxBonus: 14.0,
    winProbCap: 0.91,
    militaryExemptionMinMedal: null,
    draftStockBonus: 5,
    legacyPoints: { gold: 350, silver: 160, bronze: 80, mvp: 180 },
    subtitle: '아시아·오세아니아 12개국 대륙 최강자전',
  },
  ASIAN_GAMES: {
    id: 'ASIAN_GAMES',
    name: '아시안게임 남자농구',
    shortName: '아시안게임',
    yearMod4: 2,
    minOvr: 65,
    ldr: 67,
    baseKorRating: 77.8,
    aceRatingWeight: 0.72,
    aceRatingMaxBonus: 15.5,
    winProbCap: 0.93,
    militaryExemptionMinMedal: 'GOLD',
    draftStockBonus: 6,
    legacyPoints: { gold: 400, silver: 140, bronze: 70, mvp: 160 },
    subtitle: '조별리그 · 8강 · 4강 · 결승 우승 시 병역특례 획득',
  },
  FIBA_WORLD_CUP: {
    id: 'FIBA_WORLD_CUP',
    name: 'FIBA 농구 월드컵',
    shortName: 'FIBA 월드컵',
    yearMod4: 3,
    minOvr: 72,
    ldr: 82,
    baseKorRating: 75.5,
    aceRatingWeight: 0.68,
    aceRatingMaxBonus: 18.0,
    winProbCap: 0.89,
    militaryExemptionMinMedal: null,
    draftStockBonus: 9,
    legacyPoints: { gold: 1100, silver: 650, bronze: 380, mvp: 520 },
    subtitle: '전 세계 16개국 최강자들이 격돌하는 농구 월드컵',
  },
  OLYMPICS: {
    id: 'OLYMPICS',
    name: '하계 올림픽 남자농구',
    shortName: '올림픽',
    yearMod4: 0,
    minOvr: 75,
    ldr: 85,
    baseKorRating: 76.0,
    aceRatingWeight: 0.72,
    aceRatingMaxBonus: 19.5,
    winProbCap: 0.88,
    militaryExemptionMinMedal: 'BRONZE',
    draftStockBonus: 11,
    legacyPoints: { gold: 1400, silver: 850, bronze: 500, mvp: 650 },
    subtitle: '세계 최정예 12개국 본선 · 동메달 이상 획득 시 병역특례',
  },
};

export function getInternationalTournamentByYear(
  year: number
): InternationalTournamentType {
  const mod = ((year % 4) + 4) % 4;
  if (mod === 1) return 'ASIA_CUP';
  if (mod === 2) return 'ASIAN_GAMES';
  if (mod === 3) return 'FIBA_WORLD_CUP';
  return 'OLYMPICS';
}

/**
 * 선수 성장 곡선 (seasonSimulator.calculateSeasonStatGrowth)
 */
export const GROWTH_CONFIG = {
  highOvrWallStart: 80, // 이 OVR부터 성장 감쇠 시작 (기존 76)
  highOvrWallSlope: 0.03, // OVR 1당 성장률 감소폭 (기존 0.038)
  proStageGrowthBoost: 1.3, // 프로 리그 소속 시 성장 가속 배율
  minPtFactor: 0.72, // 출전시간 성장 계수 하한 (기존 0.48 — 벤치 선수 성장 정체 완화)
  primeGrowthChance: 0.5, // 전성기(성장기 이후~전성기 종료) 능력치별 +1 확률
  primeGrowthChanceWithLab: 0.68, // 바이오메카닉스 스킬 랩 사용 시
};

export const LIVE_GAME_CONFIG = {
  clutchMaxPointGap: 4, // 실제 ±4점 이내 접전일 때만 클러치 마지막 1포제션 자연 발동
  maxOvertimePeriods: 3, // 최대 3차 연장(3OT)
  // [대칭 보정] 선수 기여도는 리그 평균 선수(스탯 = LDR) 기대 기여도 대비 차이로 반영
  playerImpactWeight: 0.8, // 공격 기여도(평균 대비) → 팀 쿼터 득점 환산 계수
  defImpactWeight: 0.6, // 수비 기여도(평균 대비) → 상대 쿼터 득점 억제 계수
  replacementStaminaFactor: 0.95, // 리그 평균 선수의 기준 체력 효율 (이보다 지치면 손해)
  fouledOutLiftPenalty: 1.5, // 5/6반칙 퇴장 후 쿼터당 공격 손실
  fouledOutDefPenalty: 1.2, // 5/6반칙 퇴장 후 쿼터당 수비 손실
  asianGamesLdr: 67,
  asianGamesFoulLimit: 5,
  clutchProbMin: 0.2,
  clutchProbMax: 0.85,
  tacticMods: {
    ACE_HERO: {
      usageMult: 1.38,
      fgBonus: 0.01,
      defBonus: 0,
      astBonus: 0.85,
      staminaDrain: 23,
      foulRisk: 0.24,
      label: '에이스 모드 (공격 주도)',
    },
    LOCKDOWN_DEFENSE: {
      usageMult: 0.86,
      fgBonus: 0.01,
      defBonus: 1.45,
      astBonus: 0.95,
      staminaDrain: 22,
      foulRisk: 0.42,
      label: '질식 수비 (상대 에이스 봉쇄)',
    },
    UNSELFISH_PASS: {
      usageMult: 1.0,
      fgBonus: 0.032,
      defBonus: -0.4,
      astBonus: 1.42,
      staminaDrain: 15,
      foulRisk: 0.17,
      label: '이타적 조율 (팀플레이)',
    },
    PACE_CONSERVE: {
      usageMult: 0.78,
      fgBonus: 0.03,
      defBonus: 1.15,
      astBonus: 0.9,
      staminaDrain: 8,
      foulRisk: 0.1,
      label: '체력 안배 (페이스 조절)',
    },
  } as Record<
    LiveTacticId,
    {
      usageMult: number;
      fgBonus: number;
      defBonus: number;
      astBonus: number;
      staminaDrain: number;
      foulRisk: number;
      label: string;
    }
  >,
};

export const ROLE_MPG_CONFIG = {
  trustHonorThreshold: 38,
  minMpg: 4.2,
  maxMpg: 37.2,
  minBasePer36: 9.8,
  maxBasePer36: 23.6,
  injury: {
    phyReference: 72,
    phySlope: 0.0075,
    minBaseRisk: 0.02,
    mpgReference: 28.0,
    mpgSlope: 0.015,
    ageRiskStart: 30,
    ageRiskPerYear: 0.013,
    age35ExtraPerYear: 0.01,
    mileageRiskReference: 20000,
    mileageRiskPer10k: 0.045,
    mileageRiskCap: 0.16,
    ironmanDnaMult: 0.52,
    ironStaminaMult: 0.5,
    glassBodyMult: 1.65,
    glassBodyRehabRetention: 0.5, // 재활 관리 시 유리몸 페널티 잔존 비율 (0 = 완전 제거, 1 = 그대로)
    maxMissRatio: 0.68,
    tiers: {
      minor: { minRatio: 0.04, maxRatio: 0.12 },
      moderate: { minRatio: 0.15, maxRatio: 0.3 },
      major: {
        minRatio: 0.38,
        maxRatio: 0.68,
        baseShare: 0.08,
        age30SharePerYear: 0.014,
        glassBodyShareBonus: 0.08,
        lowPhyShareBonus: 0.06,
        highMileageShareBonus: 0.04,
        rehabShareReduction: 0.05,
        majorRehabGamesMult: 0.82,
      },
    },
    majorAftermath: {
      minAge: 30,
      phyDrop30to33: 2,
      phyDrop34Plus: 3,
      secondaryDrop34Plus: 1,
    },
  },
  veteranLoadMgmt: {
    startAge: 33,
    age33to34: { maxMpg: 35.0, maxHealthyRatio: 0.92 },
    age35to36: { maxMpg: 32.8, maxHealthyRatio: 0.87 },
    age37Plus: { maxMpg: 30.2, maxHealthyRatio: 0.81 },
    ironmanMpgBonus: 1.5,
    ironmanGpRatioBonus: 0.03,
  },
  positionFgBase: {
    C: { base: 53.0, stretchBigBase: 48.0, min: 38.0, max: 68.0 },
    PF: { base: 48.5, stretchBigBase: 46.5, min: 35.0, max: 62.0 },
    SF: { base: 45.5, stretchBigBase: 45.5, min: 33.0, max: 57.0 },
    SG: { base: 44.0, stretchBigBase: 44.0, min: 32.0, max: 55.0 },
    PG: { base: 43.5, stretchBigBase: 43.5, min: 32.0, max: 54.0 },
  },
  ppg: {
    softCapStart: 22.8,
    softCapSlope: 0.35,
    minPpg: 1.2,
    maxPpg: 32.5,
  },
};

export const AWARD_VOTING_CONFIG = {
  // MVP 레이스 NPC 스타의 리그별 득점 보정 (주인공이 리그 LDR 대비 얼마나 앞서 출발하는지 반영)
  npcMvpPpgOffsetByLeague: {
    HIGH_SCHOOL: 6.0,
    U_LEAGUE: 6.5,
    NCAA: 2.0,
    KBL: 7.5,
    B_LEAGUE: 3.5,
    NBL: 1.0,
    EUROLEAGUE: 0,
    GLEAGUE: 5.0,
    NBA: -4.0,
  } as Record<LeagueId, number>,
  npcMvpPoolSize: 9, // 라이벌 외 9명의 리그 스타 후보 생성 (총 10~12명 풀에서 공정한 TOP 5 선발)
  npcRoyPoolSize: 8, // 신인왕 후보 풀 9~11명
  // 단일 통합 평가 가중치 (개인 스탯 + 팀 성적을 투표 단계에서 통합 반영 — 투표 1위 = 무조건 MVP 수상)
  mvpWeights: {
    ppg: 1.12,
    rpg: 0.74,
    apg: 0.94,
    spg: 2.3,
    bpg: 2.5,
    fgEffBase: 44.0,
    fgEffWeight: 0.25,
    winPctWeight: 26.0,
    sub500Base: 0.52,
    sub500LinearPenalty: 36.0,
    sub500QuadPenalty: 90.0,
    topSeedBase: 0.58,
    topSeedBonusSlope: 18.0,
  },
  royWeights: {
    ppg: 1.15,
    rpg: 0.8,
    apg: 0.98,
    spg: 2.1,
    bpg: 2.3,
    fgEffBase: 43.0,
    fgEffWeight: 0.2,
    winPctWeight: 9.0,
    mpgFactorRef: 26.0,
  },
  minMpgForMajorAward: 18.0,
};

export const DRAFT_SCOUTING_CONFIG = {
  // 고교 유망주 1~5성 연속 종합 스코어 컷 (득점 PPG 단일 하드 컷오프 완전 폐기!)
  hsStarThresholds: {
    fiveStar: 76.0,
    fourStar: 58.0,
    threeStar: 41.0,
    twoStar: 24.0,
  },
  // KBL 드래프트 현실화 파라미터 (대학 4년 졸업생 경쟁 풀 기준선 + 고졸 얼리 리스크 vs 5성 특급 보정)
  kblDraft: {
    collegeBaselineOvr: 62.0,
    ovrWeight: 1.15,
    prestigeRef: 0.5,
    prestigeWeight: 10.0,
    stockRef: 55,
    stockWeight: 0.11,
    potentialRef: 75,
    potentialWeight: 0.18,
    hsFiveStarBonus: 3.6,
    hsFourStarAdj: -0.8,
    hsThreeStarOrBelowAdj: -3.4,
    mismatchWeight: 0.45,
    basePickAnchor: 7.5,
  },
  // 트레이드 요청 연속 승인 로직
  trade: {
    baseAcceptanceProb: 0.52,
    brokenPromiseBonus: 0.34,
    highOvrLeverageSlope: 0.025,
    lowTrustBonus: 0.14,
    expiringContractBonus: 0.12,
    rejectedTrustPenalty: -8,
  },
  // 시즌 중반 반환점 트레이드 루머 발동 제한 (매 시즌 반복 방지)
  tradeRumor: {
    cooldownSeasons: 3,
    minSeasonsOnTeam: 2,
    brokenPromiseProb: 0.72,
    rebuildingBaseProb: 0.34,
    playoffHuntBaseProb: 0.14,
    contenderRareProb: 0.08,
    contractYearBonusProb: 0.2,
  },
};

export const MILITARY_SERVICE_CONFIG = {
  defaultEnlistAge: 27,
  nbaDeferredEnlistAge: 29, // NBA 소속 선수는 만 28세 시즌까지 병역 연기 허용 (만 29세 미필 시 영장 발부)
  defaultExemptionMaxAge: 26,
  nbaExemptionMaxAge: 28,
};

export const AGING_RETIREMENT_CONFIG = {
  baseOnsetAge: 30,
  minCombinedMultFloor: 0.58,
  campAgingShieldFactor: 0.75,
  mileageReferenceMinutes: 18000,
  mileageScaleDivisor: 10000,
  mileageHighSeverityMaxBonus: 0.22,
  phyReference: 72,
  phySlopePerPoint: 0.011,
  voluntaryRetireAge: 31,
  voluntaryRetireSeasons: 10,
  farewellTourMinAge: 34,
  outOfLeagueMinAge: 33,
  mandatoryRetireAge: 40,
  hardRetireAge: 45, // 기량 유지 시 40~44세 연장 가능, 만 45세 절대 상한
  age40ExtensionMaxLdrGap: -4, // 소속 리그 LDR 대비 -4 이내 경쟁력 유지 시 연장 가능
  age40ExtensionMinPpg: 10.0,
  age40ExtensionMinMpg: 18.0,
  jerseyRetirement: {
    minSeasons: 7,
    nbaMinPoints: 10000,
    otherProMinPoints: 6000,
  },
  goatRequirements: {
    minNbaMvps: 3,
    minNbaChampionships: 3,
    minFinalsMvps: 2,
  },
};

export function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
