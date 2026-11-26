import {
  ContractType,
  GrowthDna,
  InternationalTournamentType,
  LeagueId,
  LiveTacticId,
  PersonalCareId,
} from '../types/game';

/**
 * 중앙 밸런스 파라미터 설정 모듈 (Single Source of Truth)
 * - 리그 메타(아마추어/프로 구분, 파울 한도, 라이브 중계 템포, 수상 명칭)
 * - 경제 및 퍼스널 케어(가용 자산 vs 통산 누적 연봉, 상무 급여, 리그별 해금 정책)
 * - 라이브 중계 & 클러치 1포제션(±3점 이내 자연 발동, 연장전, 파울 아웃, MPG 연동)
 * - 역할·출전시간(연속 보간)·부상 리스크·득점·투표 레이스(통합 공식)
 * - 드래프트·유망주(연속 종합 스코어)·트레이드(연속 승인 확률)·에이징 커브·은퇴/레거시
 */

export interface LeagueBalanceMeta {
  isPro: boolean;
  isAmateur: boolean;
  foulLimit: number;
  playerBaselineOvr: number;
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
    playerBaselineOvr: 53,
    liveQuarterBasePts: 17,
    liveOppQuarterBasePts: 17,
    liveOvertimeBasePts: 8,
    minAttendanceRatio: 0.65,
    mvpBoardTitle: '전국대회 최우수 유망주(MVP) 랭킹 TOP 5',
    royBoardTitle: '신입생 유망주 랭킹 TOP 5',
    allStarLabel: '전국대회 베스트 5',
  },
  US_HIGH_SCHOOL: {
    isPro: false,
    isAmateur: true,
    foulLimit: 5,
    playerBaselineOvr: 53,
    liveQuarterBasePts: 17,
    liveOppQuarterBasePts: 17,
    liveOvertimeBasePts: 8,
    minAttendanceRatio: 0.65,
    mvpBoardTitle: '전미 고교 최우수 유망주(MVP) 랭킹 TOP 5',
    royBoardTitle: '전미 고교 신입생 랭킹 TOP 5',
    allStarLabel: '전미 고교 올아메리칸 퍼스트팀',
  },
  U_LEAGUE: {
    isPro: false,
    isAmateur: true,
    foulLimit: 5,
    playerBaselineOvr: 61,
    liveQuarterBasePts: 18,
    liveOppQuarterBasePts: 18,
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
    playerBaselineOvr: 71,
    liveQuarterBasePts: 18,
    liveOppQuarterBasePts: 18,
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
    playerBaselineOvr: 68,
    liveQuarterBasePts: 19,
    liveOppQuarterBasePts: 19,
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
    playerBaselineOvr: 66, // 1.1.0: 70→66 (약팀 에이스 PO 진출 11.8%에 그쳐 캐리 상향)
    liveQuarterBasePts: 19,
    liveOppQuarterBasePts: 19,
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
    playerBaselineOvr: 72,
    liveQuarterBasePts: 21,
    liveOppQuarterBasePts: 21,
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
    playerBaselineOvr: 75, // 1.1.0: 78→75 (약팀 에이스 PO 진출 14.3%에 그쳐 캐리 상향)
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
    playerBaselineOvr: 73,
    liveQuarterBasePts: 24,
    liveOppQuarterBasePts: 24,
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
    playerBaselineOvr: 84,
    liveQuarterBasePts: 25,
    liveOppQuarterBasePts: 25,
    liveOvertimeBasePts: 11,
    minAttendanceRatio: 0.68,
    mvpBoardTitle: 'NBA 정규시즌 MVP 투표 레이스 TOP 5',
    royBoardTitle: 'NBA 신인왕(ROY) 투표 레이스 TOP 5',
    allStarLabel: 'NBA 올스타',
  },
};

/**
 * 정규시즌 승률 대칭 파라미터 (플레이어 팀 & AI 팀 100% 동일 기준)
 */
export const REGULAR_SEASON_WIN_CONFIG = {
  contenderDirectionMod: 0.025,
  rebuildingDirectionMod: -0.025,
  teamRatingSlope: 0.021,
  playerRandomHalfSpread: 0.055, // ±5.5%p
  aiMinHalfSpread: 0.032,        // 압축 리그(고교·G리그·NCAA) 과잉 로또화 방지
  aiMaxHalfSpread: 0.040,        // NBA·유로리그 등 ±4.0%p
  conferenceScheduleWeight: 0.63, // 컨퍼런스 리그 동일 컨퍼런스 경기 비중
  zeroSumMaxShift: 0.045,        // AI 팀 제로섬 평균 보정 상한
  minWinPct: 0.16,
  maxWinPct: 0.85,
  playerMarginSlope: 0.0115,
  starterSynergyBonus: 0.015,
  maxClutchWinBonus: 0.018,
  negativeMarginFloor: -0.015,
};

/** PO 시드 구조 보정: 앞 라운드 추가 경기 피로와 하위 시드 뎁스 부담 (표에 없는 리그는 뎁스 보정 없음) */
export const PLAYOFF_SEED_CONFIG = {
  fatiguePerExtraGame: 0.35,
  fatigueCap: 2.5,
  lowSeedDepthPerRound: 0.9, // 2라운드부터 (roundNumber - 1) × 값
  lowSeedDepthStartByLeague: {
    NBA: 6,
    EUROLEAGUE: 6,
    B_LEAGUE: 6,
    GLEAGUE: 5,
    KBL: 5,
    NBL: 5,
  } as Partial<Record<LeagueId, number>>,
};

/**
 * 플레이오프 시리즈 승률 파라미터 (출전 비중·부상 감쇠·경기별 홈/원정 교대·왕조 수확체감)
 */
export const PLAYOFF_SERIES_CONFIG = {
  gameWinProbSlope: 0.036,
  minGameWinProb: 0.24,
  maxGameWinProb: 0.78,
  homeCourtRatingEdge: 2.4,      // 실제 홈 경기 개최 팀 가산 (+2.4 / 원정 -2.4)
  singleElimHigherSeedEdge: 0.5, // 단판 토너먼트 상위 시드 소폭 이점
  playerOvrSlope: 0.35,
  clutchBonus: 1.0,
  maxPositivePlayerBonus: 8.0,
  minNegativePlayerBonus: -0.9,
  bioStrainWeight: 4.2,
  minMpgWeight: 0.15,
  maxMpgWeight: 1.1,
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
  specialCampBaseCostByLeague: {
    NBA: 250000,
    EUROLEAGUE: 90000,
    NBL: 55000,
    B_LEAGUE: 45000,
    KBL: 45000,
    GLEAGUE: 15000,
    NCAA: 15000,
    U_LEAGUE: 15000,
    HIGH_SCHOOL: 15000,
    US_HIGH_SCHOOL: 15000,
  } as Record<LeagueId, number>,
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
        US_HIGH_SCHOOL: 8000,
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
        US_HIGH_SCHOOL: 6000,
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
        US_HIGH_SCHOOL: 0,
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
    liveQuarterBasePts: number;
    liveOvertimeBasePts: number;
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
    baseKorRating: 73.5,
    aceRatingWeight: 0.50,
    aceRatingMaxBonus: 10.0,
    winProbCap: 0.84,
    liveQuarterBasePts: 19,
    liveOvertimeBasePts: 9,
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
    baseKorRating: 73.2,
    aceRatingWeight: 0.58,
    aceRatingMaxBonus: 10.5,
    winProbCap: 0.86,
    liveQuarterBasePts: 19,
    liveOvertimeBasePts: 9,
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
    baseKorRating: 74.0,
    aceRatingWeight: 0.48,
    aceRatingMaxBonus: 10.0,
    winProbCap: 0.80,
    liveQuarterBasePts: 19,
    liveOvertimeBasePts: 9,
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
    baseKorRating: 74.5,
    aceRatingWeight: 0.50,
    aceRatingMaxBonus: 11.0,
    winProbCap: 0.78,
    liveQuarterBasePts: 20,
    liveOvertimeBasePts: 9,
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

/**
 * 1.2.0: 미국 고교 육성 보정
 * 미국 고교 출신이 더 높은 수준에서 경쟁하고 NBA에서도 평균적으로 더 나은 활약을 하도록,
 * 잠재력을 높게 시작하고 고교 시절 성장 속도를 올립니다. (성장 상한은 src/data/leagues.ts의 growthCap)
 */
export const US_HIGH_SCHOOL_DEVELOPMENT_CONFIG = {
  /** 커리어 시작 시 잠재력 가산 */
  potentialBonus: 2,
  /** 잠재력 상한 (한국 고교 출발은 96) */
  potentialMax: 98,
  /** 미국 고교 재학 중 시즌 성장량 배율 */
  growthMultiplier: 1.03,
  /** 1.2.0: 미국 고교는 현실대로 4년제 (만 15세 9학년 입학 → 만 19세 졸업). 한국 고교는 만 16세 입학 3년제 */
  startAge: 15,
  schoolYears: 4,
};

export const LIVE_GAME_CONFIG = {
  clutchMaxPointGap: 3, // 실제 ±3점 이내 1포제션 접전일 때만 클러치 마지막 1포제션 자연 발동
  maxOvertimePeriods: 3, // 최대 3차 연장(3OT)
  // [대칭 보정] 선수 기여도는 리그 평균 선수(스탯 = LDR) 기대 기여도 대비 차이로 반영
  playerImpactWeight: 0.8, // 공격 기여도(평균 대비) → 팀 쿼터 득점 환산 계수
  defImpactWeight: 0.6, // 수비 기여도(평균 대비) → 상대 쿼터 득점 억제 계수
  replacementStaminaFactor: 0.95, // 리그 평균 선수의 기준 체력 효율 (이보다 지치면 손해)
  fouledOutLiftPenalty: 1.5, // 5/6반칙 퇴장 후 쿼터당 공격 손실
  fouledOutDefPenalty: 1.2, // 5/6반칙 퇴장 후 쿼터당 수비 손실
  asianGamesFoulLimit: 5,
  clutchProbMin: 0.2,
  clutchProbMax: 0.85,
  tacticMods: {
    ACE_HERO: {
      usageMult: 1.32,
      fgBonus: 0.008,
      defBonus: -0.25,
      astBonus: 0.88,
      staminaDrain: 18,
      foulRisk: 0.24,
      label: '에이스 모드 (공격 주도)',
    },
    LOCKDOWN_DEFENSE: {
      usageMult: 0.84,
      fgBonus: -0.02,
      defBonus: 1.05,
      astBonus: 0.86,
      staminaDrain: 20,
      foulRisk: 0.42,
      label: '질식 수비 (상대 에이스 봉쇄)',
    },
    UNSELFISH_PASS: {
      usageMult: 0.9,
      fgBonus: 0.014,
      defBonus: -0.45,
      astBonus: 1.22,
      staminaDrain: 15,
      foulRisk: 0.17,
      label: '이타적 조율 (팀플레이)',
    },
    PACE_CONSERVE: {
      usageMult: 0.86,
      fgBonus: 0.005,
      defBonus: 0.0,
      astBonus: 0.98,
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

/**
 * 1.1.0 NBA 진입·루키 적응 밸런스
 * - NBA 첫 시즌부터 1옵션 에이스가 되는 비율을 줄이고, 로테이션에서 시작해 2~4년에 걸쳐 에이스로 올라가도록 조정합니다.
 */
export const NBA_ENTRY_CONFIG = {
  /** NBA 드래프트 지명 위상 보너스 (roleIndex) — 기존 15/12/9 */
  pedigreeBonus: { top5: 9.0, lottery: 7.0, firstRound: 5.0, secondRound: 2.0 },
  /** NBA 출전 시즌 수별 적응 페널티 (roleIndex) — 0시즌(루키), 1시즌, 2시즌 */
  adaptationPenaltyBySeason: [5.0, 3.0, 1.5] as readonly number[],
  /** NBA 첫 시즌에는 하위 리그에서 쌓은 효율 모멘텀을 이 비율만 반영 */
  rookieMomentumCarryover: 0.3,
  /** NBA 신규 입성 시 1옵션 에이스 약속에 필요한 OVR-팀 전력 격차 */
  newcomerAcePromiseGap: 7,
  /** NBA 신규 입성 시 주전 보장 약속에 필요한 OVR-팀 전력 격차 */
  newcomerStarterPromiseGap: 1,
  /** 타 리그 → NBA 오퍼 스카우팅 기준선 추가 가산 */
  outsideOfferBarBonus: 3,
  /** G리그 → NBA 콜업에 필요한 36분당 득점 — 기존 17.5 */
  gleagueCallUpPer36Pts: 19.0,
  /** NBA 드래프트 예상 순위 기준점 (75 - 준비도 점수 → 값이 클수록 지명이 어려움) — 기존 75 */
  draftPickAnchor: 83,
  /** 미지명 선수 투웨이 오퍼 스카우팅 기준 — 기존 62 */
  undraftedTwoWayMinScore: 66,
  /** 미지명 투웨이 오퍼는 예상 순위가 이 값 이내인 '아깝게 놓친' 선수에게만 — 60순위 밖 8칸 */
  undraftedTwoWayMaxPick: 68,
  /** NBA 지명에 필요한 최소 OVR (NBA 기준치 대비 격차) — 이보다 낮으면 미지명 */
  draftMinOvrBelowLdr: 15,
  /** 미지명 투웨이 오퍼에 필요한 최소 OVR (NBA 기준치 대비 격차) */
  undraftedTwoWayMinOvrBelowLdr: 13,
} as const;

/**
 * 1.1.0 '우승 도전팀 이적 요청' (컨텐더 경로)
 * - 플레이오프에 2년 연속 실패한 NBA 에이스에게 오프시즌 우승 도전팀 이적 카드를 제시합니다.
 * - 이적하면 2옵션 주전으로 뛰며 출전 시간·MVP 기회는 줄지만 우승 확률이 올라갑니다.
 */
export const CONTENDER_PATH_CONFIG = {
  /** 연속 PO 실패 시즌 수 조건 */
  missedPlayoffSeasons: 2,
  /** 제시할 우승 도전팀 수 (최대) */
  maxOffers: 3,
  /** 카드가 열리는 최대 나이 */
  maxAge: 34,
  /** 2옵션 역할이 유지되는 시즌 수 (이적 후) */
  secondOptionSeasons: 2,
  /** 2옵션 기간 최대 출전 시간 (주전 스타터 구간) */
  secondOptionMaxMpg: 30.5,
  /** 수락 확률 보정 (우승팀은 에이스 영입에 적극적) */
  acceptProbBonus: 0.05,
  /** 전력이 더 강한 우승 도전팀일수록 낮아지는 수락 확률 (순위 1칸당) */
  acceptProbStepByRank: 0.08,
  /** 수락 확률 범위 */
  minAcceptProb: 0.2,
  maxAcceptProb: 0.85,
  /** FA 신분 이적 시 계약 기간 */
  faContractYears: 2,
} as const;

/**
 * 1.1.0 KBL 신인 적응 (NBA 복귀·해외 복귀 베테랑에는 적용하지 않음)
 */
export const KBL_ROOKIE_CONFIG = {
  /** KBL 드래프트 지명 위상 보너스 (roleIndex) — 기존 14.5/11.5/9 */
  pedigreeBonus: { top3: 9.5, top6: 7.5, firstRound: 5.5 },
  /** 프로 경력이 없는 KBL 신인의 첫 시즌·2번째 시즌 적응 페널티 (roleIndex) */
  adaptationPenaltyBySeason: [5.5, 2.5] as readonly number[],
} as const;

export const ROLE_MPG_CONFIG = {
  trustHonorThreshold: 38,
  /** 고교 '코치의 기회': 가비지 타임 선수에게 시즌 중반 찾아오는 로테이션 진입 기회 */
  coachChance: {
    /** 고교 가비지 타임 선수에게 시즌 중반 인카운터로 등장할 확률 */
    triggerProb: 0.6,
    /** 기회를 잡으면 보장되는 최소 출전 시간 (벤치 로테이션 구간) */
    minMpg: 11.5,
    /** 보장 출전 시간 위 무작위 폭 */
    mpgJitter: 3.0,
    /** 보장 시 최소 출전 경기 비율 */
    minGpRatio: 0.72,
  },
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
    maxPpg: 36.0,
  },
};

export interface LeagueAwardQuotaConfig {
  /** 올스타(또는 베스트 5 / 올-아메리칸) 총 선정 정원 */
  allStarTotal: number;
  /** 가드(PG/SG) 우선 배정 슬롯 */
  allStarGuards: number;
  /** 프론트코트(SF/PF/C) 우선 배정 슬롯 */
  allStarFrontcourt: number;
  /** 포지션 무관 와일드카드 슬롯 */
  allStarWildcards: number;
  /** 올-리그 팀 수 (1=퍼스트 5명, 2=1·2팀 10명, 3=1·2·3팀 15명) */
  allLeagueTeamCount: 1 | 2 | 3;
  /** 구단당 시즌 NPC 주전·스타 생성 인원 (주인공·라이벌과 동일 풀 경쟁) */
  npcStarsPerTeam: number;
}

export const LEAGUE_AWARD_QUOTAS: Record<LeagueId, LeagueAwardQuotaConfig> = {
  HIGH_SCHOOL: {
    allStarTotal: 5,
    allStarGuards: 2,
    allStarFrontcourt: 3,
    allStarWildcards: 0,
    allLeagueTeamCount: 1,
    npcStarsPerTeam: 2,
  },
  US_HIGH_SCHOOL: {
    allStarTotal: 5,
    allStarGuards: 2,
    allStarFrontcourt: 3,
    allStarWildcards: 0,
    allLeagueTeamCount: 1,
    npcStarsPerTeam: 2,
  },
  U_LEAGUE: {
    allStarTotal: 5,
    allStarGuards: 2,
    allStarFrontcourt: 3,
    allStarWildcards: 0,
    allLeagueTeamCount: 1,
    npcStarsPerTeam: 3,
  },
  NCAA: {
    allStarTotal: 15,
    allStarGuards: 5,
    allStarFrontcourt: 7,
    allStarWildcards: 3,
    allLeagueTeamCount: 3,
    npcStarsPerTeam: 2,
  },
  KBL: {
    allStarTotal: 12,
    allStarGuards: 4,
    allStarFrontcourt: 6,
    allStarWildcards: 2,
    allLeagueTeamCount: 2,
    npcStarsPerTeam: 4,
  },
  B_LEAGUE: {
    allStarTotal: 16,
    allStarGuards: 6,
    allStarFrontcourt: 8,
    allStarWildcards: 2,
    allLeagueTeamCount: 2,
    npcStarsPerTeam: 2,
  },
  NBL: {
    allStarTotal: 10,
    allStarGuards: 4,
    allStarFrontcourt: 5,
    allStarWildcards: 1,
    allLeagueTeamCount: 2,
    npcStarsPerTeam: 4,
  },
  EUROLEAGUE: {
    allStarTotal: 15,
    allStarGuards: 5,
    allStarFrontcourt: 7,
    allStarWildcards: 3,
    allLeagueTeamCount: 3,
    npcStarsPerTeam: 3,
  },
  GLEAGUE: {
    allStarTotal: 14,
    allStarGuards: 5,
    allStarFrontcourt: 7,
    allStarWildcards: 2,
    allLeagueTeamCount: 2,
    npcStarsPerTeam: 2,
  },
  NBA: {
    allStarTotal: 24,
    allStarGuards: 8,
    allStarFrontcourt: 12,
    allStarWildcards: 4,
    allLeagueTeamCount: 3,
    npcStarsPerTeam: 3,
  },
};

export const AWARD_VOTING_CONFIG = {
  // 명시적 수상 연동 정책: MVP·올스타·올리그는 독립 경쟁하되, 정규시즌 MVP 수상자는 올스타 및 올-리그 퍼스트팀을 명시적으로 보장
  mvpGuaranteesAllStarAndFirstTeam: true,
  // 리그별 NPC 주전·스타 득점 기준 보정 (구단별 전체 풀 생성 시 주인공의 리그 LDR 대비 커브와 대칭 정렬)
  npcMvpPpgOffsetByLeague: {
    HIGH_SCHOOL: 1.4,
    US_HIGH_SCHOOL: 1.4,
    U_LEAGUE: 2.0,
    NCAA: -1.4,
    KBL: 2.5,
    B_LEAGUE: 1.2,
    NBL: 0.0,
    EUROLEAGUE: -0.9,
    GLEAGUE: 1.8,
    NBA: 0.55,
  } as Record<LeagueId, number>,
  npcMvpPoolSize: 9,
  npcRoyPoolSize: 8, // 신인왕 후보 풀 (루키 NPC 8명 + 동일 리그 루키 라이벌 + 주인공)
  // 올스타·올리그 정원 경쟁 통합 평가 가중치 (개인 기록 비중 중심 + 팀 성적 완만 반영)
  allStarWeights: {
    ppg: 1.15,
    rpg: 0.72,
    apg: 0.92,
    spg: 2.35,
    bpg: 2.55,
    fgEffBase: 44.0,
    fgEffWeight: 0.22,
    winPctWeight: 10.5,
  },
  // 단일 통합 MVP 평가 가중치 (개인 스탯 + 팀 성적을 투표 단계에서 통합 반영 — 투표 1위 = 무조건 MVP 수상)
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
  // 통합 DPOY 평가 가중치 (외곽 수비수 스틸·블록 vs 빅맨 림프로텍팅·리바운드 포지션 균형 반영)
  dpoyWeights: {
    defStatWeight: 0.75,
    perimeterSpgWeight: 8.5,
    perimeterBpgWeight: 7.0,
    bigSpgWeight: 6.5,
    bigBpgWeight: 5.5,
    rebOverBaselineWeight: 0.55,
    winPctWeight: 18.0,
  },
  minMpgForMajorAward: 18.0,
};

export const INITIAL_STAT_CREATION_CONFIG = {
  minStat: 36,
  maxStat: 72,
  talentOffsetMin: -2,
  talentOffsetMax: 2,
  statVarianceMin: -4,
  statVarianceMax: 5,
};

export const GROWTH_DNA_CONFIG: Record<
  GrowthDna,
  {
    maxGrowthAge: number;
    agingOnsetOffset: number;
    agingSeverityMult: number;
    minPrimeYearsAfterGrowth: number;
  }
> = {
  EARLY_BLOOMER: {
    maxGrowthAge: 25,
    agingOnsetOffset: -1.2,
    agingSeverityMult: 1.18,
    minPrimeYearsAfterGrowth: 1,
  },
  STANDARD: {
    maxGrowthAge: 26,
    agingOnsetOffset: 0,
    agingSeverityMult: 1.0,
    minPrimeYearsAfterGrowth: 1,
  },
  LATE_BLOOMER: {
    maxGrowthAge: 28,
    agingOnsetOffset: 0.6,
    agingSeverityMult: 0.9,
    minPrimeYearsAfterGrowth: 1,
  },
  IRONMAN: {
    maxGrowthAge: 27,
    agingOnsetOffset: 1.2,
    agingSeverityMult: 0.78,
    minPrimeYearsAfterGrowth: 1,
  },
};

export const DRAFT_SCOUTING_CONFIG = {
  nbaDraftTotalPicks: 60,
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
  firstBallotHofRequirements: {
    minNbaMvps: 1,
    minNbaFinalsMvps: 1,
    minAllNbaFirstTeams: 3,
    minNbaAllStars: 10,
    minNbaPoints: 25000,
  },
};

export function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
