import {
  AWARD_VOTING_CONFIG,
  ECONOMY_CONFIG,
  GROWTH_CONFIG,
  US_HIGH_SCHOOL_DEVELOPMENT_CONFIG,
  LEAGUE_AWARD_QUOTAS,
  LEAGUE_BALANCE_META,
  REGULAR_SEASON_WIN_CONFIG,
  CONTENDER_PATH_CONFIG,
  KBL_ROOKIE_CONFIG,
  NBA_ENTRY_CONFIG,
  ROLE_MPG_CONFIG,
  canUseProTradeSystem,
  clampNum,
  sigmoid,
} from '../config/balanceConfig';
import { FAREWELL_TOUR_LOGS } from '../data/events';
import {
  generateSeasonHeadline,
  generateSeasonNarrativeLogs,
} from '../data/headlines';
import { LEAGUE_CONFIG } from '../data/leagues';
import { getTeamsByLeague } from '../data/teams';
import {
  AllLeagueTier,
  CareerState,
  ContractType,
  GrowthDna,
  InjurySeverity,
  LeagueAwardSummary,
  LeagueId,
  PersonalCareId,
  PlayerStats,
  PlayerTraitId,
  PlaystyleArchetype,
  Position,
  RelationshipMetrics,
  RivalPlayer,
  RolePromiseType,
  SeasonBoxScore,
  StandingEntry,
  StatDelta,
  TeamInfo,
  TrainingFocus,
} from '../types/game';
import {
  generateLeagueStandings,
  getPlayoffCutoffByLeague,
} from './standingsEngine';
import { getEffectiveRelationships } from './progressionEngine';
import {
  applyAgingCurve,
  computeEffectiveAgingOnset,
} from './retirementEngine';
import {
  calculateBiomechanicalProfile,
  calculateHeightMismatchPenalty,
  calculateOvr,
  enforceBiomechanicalCaps,
  evaluateAcquiredTraits,
  evaluatePlayerBadges,
  getBiomechanicalGrowthElasticity,
} from './statCalculator';
import {
  RivalSeasonStatSnapshot,
  LeagueAwardCandidate,
  calcUnifiedAllStarScore,
  calcUnifiedMvpScore,
  calcUnifiedRoyScore,
  calcUnifiedDpoyScore,
  selectPositionBalancedAllStars,
  generateLeagueNpcStarPool,
  generateLeagueNpcRookiePool,
  applyMvpAllStarGuarantee,
  evaluateUnifiedLeagueAwards,
} from './leagueAwardsEngine';
import { generateProceduralPlayerName } from './playerNames';

/**
 * 리그 내 평균 구단 전력 산출 (seasonSimulator와 playoffEngine이 100% 동일한 기준선 공유)
 */
export function getLeagueBaselineTeamRating(
  league: LeagueId,
  ratingsMap?: Record<string, number>
): number {
  const teams = getTeamsByLeague(league, ratingsMap);
  if (teams.length === 0) return LEAGUE_CONFIG[league].ldr;
  const sum = teams.reduce((acc, t) => acc + t.rating, 0);
  return Number((sum / teams.length).toFixed(2));
}

/**
 * 컨퍼런스 리그(NBA·G리그·B.리그)의 실제 일정 비중(동일 컨퍼런스 63% + 타 컨퍼런스 37%)을 반영한
 * 상대 구단 평균 전력 기준선 산출 (seasonSimulator와 generateLeagueStandings 공용)
 */
export function getScheduleAdjustedTeamMeanRating(
  league: LeagueId,
  ratingsMap?: Record<string, number>,
  conference?: 'EAST' | 'WEST'
): number {
  const leagueMean = getLeagueBaselineTeamRating(league, ratingsMap);
  if (
    (league !== 'NBA' && league !== 'GLEAGUE' && league !== 'B_LEAGUE') ||
    (conference !== 'EAST' && conference !== 'WEST')
  ) {
    return leagueMean;
  }
  const teams = getTeamsByLeague(league, ratingsMap);
  const ownConf = teams.filter((t) => t.conference === conference);
  const otherConf = teams.filter(
    (t) => t.conference && t.conference !== conference
  );
  if (ownConf.length === 0 || otherConf.length === 0) return leagueMean;
  const ownMean = ownConf.reduce((s, t) => s + t.rating, 0) / ownConf.length;
  const otherMean =
    otherConf.reduce((s, t) => s + t.rating, 0) / otherConf.length;
  const w = REGULAR_SEASON_WIN_CONFIG.conferenceScheduleWeight;
  return Number((ownMean * w + otherMean * (1 - w)).toFixed(2));
}

const AWARD_LEAGUE_PRIORITY: LeagueId[] = [
  'NBA',
  'EUROLEAGUE',
  'NBL',
  'B_LEAGUE',
  'KBL',
  'GLEAGUE',
  'NCAA',
  'U_LEAGUE',
  'HIGH_SCHOOL',
  'US_HIGH_SCHOOL',
];

/**
 * 시즌 로그 배열을 분석하여 리그별(NBA, KBL, 해외, G리그, 대학, 고교)로 완전히 분리된 트로피·수상 요약을 반환합니다.
 */
export function getAwardsByLeague(
  seasonLogs: SeasonBoxScore[]
): LeagueAwardSummary[] {
  const map = new Map<LeagueId, LeagueAwardSummary>();

  for (const log of seasonLogs) {
    const cfg = LEAGUE_CONFIG[log.league];
    const existing = map.get(log.league) || {
      league: log.league,
      leagueName: cfg.name,
      leagueShortName: cfg.shortName,
      seasons: 0,
      gp: 0,
      points: 0,
      championships: 0,
      mvps: 0,
      finalsMvps: 0,
      dpoys: 0,
      sixthManAwards: 0,
      mips: 0,
      roys: 0,
      allStars: 0,
      allLeague1st: 0,
      allLeague2nd: 0,
      allLeague3rd: 0,
    };

    existing.seasons += 1;
    existing.gp += log.gp;
    existing.points += Math.round(log.ppg * log.gp);
    if (log.wonChampionship) existing.championships += 1;
    if (log.wonMvp) existing.mvps += 1;
    if (log.wonFinalsMvp) existing.finalsMvps += 1;
    if (log.wonDpoy) existing.dpoys += 1;
    if (log.wonSixthMan) existing.sixthManAwards += 1;
    if (log.wonMip) existing.mips += 1;
    if (log.wonRookieOfYear) existing.roys += 1;
    if (log.allStarSelected) existing.allStars += 1;
    if (log.allLeagueTeam === 1) existing.allLeague1st += 1;
    if (log.allLeagueTeam === 2) existing.allLeague2nd += 1;
    if (log.allLeagueTeam === 3) existing.allLeague3rd += 1;

    map.set(log.league, existing);
  }

  return AWARD_LEAGUE_PRIORITY.filter((lid) => map.has(lid)).map(
    (lid) => map.get(lid)!
  );
}

export interface RoleAndMpgResult {
  roleIndex: number;
  role: string;
  mpg: number;
  gp: number;
  injuredGamesMissed: number;
  injurySeverity: InjurySeverity;
  injuryLabel?: string;
  injuryPermanentPhyPenalty: number;
  veteranLoadManaged: boolean;
  basePer36: number;
}

/**
 * 실제 통산 누적 출전분(마일리지) 정밀 산출
 * - totals.minutes가 저장된 경우 우선 사용, 구 세이브는 seasonLogs(gp × mpg)에서 정확히 복원
 */
export function computeCareerMinutes(career: {
  totals?: Partial<CareerState['totals']>;
  seasonLogs?: Pick<SeasonBoxScore, 'gp' | 'mpg'>[];
}): number {
  if (typeof career.totals?.minutes === 'number' && career.totals.minutes > 0) {
    return Math.round(career.totals.minutes);
  }
  if (career.seasonLogs && career.seasonLogs.length > 0) {
    return career.seasonLogs.reduce(
      (sum, log) => sum + Math.round(log.gp * log.mpg),
      0
    );
  }
  return career.totals?.gp ? Math.round(career.totals.gp * 24) : 0;
}

const INJURY_LABELS_BY_SEVERITY: Record<
  Exclude<InjurySeverity, 'NONE'>,
  string[]
> = {
  MINOR: ['발목 염좌', '허벅지 타박상', '손가락 염좌', '무릎 타박상'],
  MODERATE: ['햄스트링 부분 파열', '종아리 근육 손상', '어깨 회전근개 염좌', '발목 인대 손상'],
  MAJOR: [
    '무릎 반월판 손상',
    '전방십자인대(ACL) 부상',
    '아킬레스건 부분 파열',
    '어깨 관절와순 수술',
  ],
};

/**
 * 계약 유형 및 선수 OVR에 따른 기본 연봉(USD) 산출
 */
export function getContractDefaultSalary(
  contractType: ContractType,
  ovr: number
): number {
  switch (contractType) {
    case 'AMATEUR':
      return 0;
    case 'MILITARY_SERVICE':
      return ECONOMY_CONFIG.sangmuAnnualSalaryUsd;
    case 'KBL_ROOKIE':
      return 55000 + Math.max(0, ovr - 58) * 3500;
    case 'KBL_VET':
      return 120000 + Math.max(0, ovr - 65) * 8000;
    case 'KBL_MAX':
      return 380000 + Math.max(0, ovr - 72) * 24000;
    case 'BLEAGUE_CONTRACT':
      return 240000 + Math.max(0, ovr - 67) * 26000;
    case 'NBL_CONTRACT':
      return 320000 + Math.max(0, ovr - 69) * 32000;
    case 'EUROLEAGUE_CONTRACT':
      return 950000 + Math.max(0, ovr - 75) * 140000;
    case 'GLEAGUE_EXHIBIT':
    case 'SUMMER_LEAGUE_INVITE':
      return 45000;
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

const PRO_LEAGUE_SET: ReadonlySet<LeagueId> = new Set([
  'NBA',
  'EUROLEAGUE',
  'NBL',
  'B_LEAGUE',
  'KBL',
  'GLEAGUE',
]);

/**
 * 상무 전역 후 복귀 리그와 전역 시점 OVR에 맞는 정확한 계약 유형 산출
 * (NBA/G리그 복귀 시 B.리그 계약으로 잘못 매핑되거나 벤치급 KBL 선수가 무조건 KBL_MAX가 되는 버그 방지)
 */
export function getSangmuDischargeContractType(
  returnLeague: LeagueId,
  ovr: number
): ContractType {
  switch (returnLeague) {
    case 'NBA':
      return ovr >= 86
        ? 'NBA_MAX'
        : ovr >= 75
        ? 'NBA_STANDARD'
        : 'NBA_VET_MIN';
    case 'EUROLEAGUE':
      return 'EUROLEAGUE_CONTRACT';
    case 'NBL':
      return 'NBL_CONTRACT';
    case 'B_LEAGUE':
      return 'BLEAGUE_CONTRACT';
    case 'GLEAGUE':
      return 'GLEAGUE_EXHIBIT';
    case 'KBL':
    default:
      return ovr >= 76 ? 'KBL_MAX' : ovr >= 66 ? 'KBL_VET' : 'KBL_ROOKIE';
  }
}

/**
 * 리그별 현실 신인왕(ROY) 자격 판정 (타 프로 리그 이적 베테랑의 신인왕 중복 수상 방지)
 * - 아마추어(고교·대학): 해당 리그 첫 시즌
 * - NBA: NBA 첫 시즌(현실 규정상 해외 프로 경력자도 NBA 루키 자격 보유)
 * - 유로리그(Rising Star): 유로리그 첫 시즌 + 만 22세 이하
 * - KBL / B.리그 / NBL / G리그: 타 프로 리그 경력이 없는 순수 프로 1년 차 + 만 24세 이하
 */
export function isEligibleForLeagueRookieAward(
  career: Pick<CareerState, 'league' | 'age' | 'seasonLogs'>
): boolean {
  const logs = career.seasonLogs || [];
  const playedInCurrentLeague = logs.some((l) => l.league === career.league);
  if (playedInCurrentLeague) return false;

  if (!PRO_LEAGUE_SET.has(career.league)) {
    return true;
  }

  if (career.league === 'NBA') {
    return true;
  }

  if (career.league === 'EUROLEAGUE') {
    return career.age <= 22;
  }

  const priorProSeasons = logs.filter((l) => PRO_LEAGUE_SET.has(l.league)).length;
  return priorProSeasons === 0 && career.age <= 24;
}

const FIXED_STATUTORY_CONTRACTS: ReadonlySet<ContractType> = new Set([
  'AMATEUR',
  'MILITARY_SERVICE',
  'GLEAGUE_EXHIBIT',
  'SUMMER_LEAGUE_INVITE',
  'TWO_WAY',
  'NBA_VET_MIN',
]);

function hashTeamIdSpread(teamId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < teamId.length; i++) {
    hash ^= teamId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = ((hash >>> 0) % 1000) / 1000; // 0 ~ 0.999
  return (normalized - 0.45) * 0.09; // -0.0405 ~ +0.0495
}

/**
 * 구단별 차등 연봉 산출 공식 (구단 기조 · 약속 역할 · 스카우팅 관심도/포지션 적합도 · 재계약 보너스 반영)
 * - 법정 고정 계약(TWO_WAY, NBA_VET_MIN, GLEAGUE_EXHIBIT, SUMMER_LEAGUE_INVITE, MILITARY_SERVICE, AMATEUR)은 기준 연봉 유지
 */
export function calculateTeamContractOfferSalary(params: {
  contractType: ContractType;
  ovr: number;
  team: TeamInfo;
  promisedRole: RolePromiseType;
  scoutingScore?: number;
  isResigning?: boolean;
  coachTrust?: number;
  primaryPos?: Position;
  secondaryPos?: Position | null;
  rng?: () => number;
}): number {
  const {
    contractType,
    ovr,
    team,
    promisedRole,
    scoutingScore = 72,
    isResigning = false,
    coachTrust = 60,
    primaryPos,
    secondaryPos,
    rng,
  } = params;

  const base = getContractDefaultSalary(contractType, ovr);
  if (base <= 0 || FIXED_STATUTORY_CONTRACTS.has(contractType)) {
    return base;
  }

  // 1) 구단 기조 보정 (리빌딩 구단은 프리미엄, 우승후보는 페이컷/샐러리캡 압박)
  const dir = team.direction || 'PLAYOFF_HUNT';
  const dirMult =
    dir === 'REBUILDING' ? 1.09 : dir === 'CONTENDER' ? 0.91 : 1.01;

  // 2) 약속 역할 보정
  const roleMult =
    promisedRole === 'ACE_FIRST_OPTION'
      ? 1.13
      : promisedRole === 'STARTER_GUARANTEE'
      ? 1.03
      : promisedRole === 'PROSPECT_DEVELOPMENT'
      ? 0.97
      : promisedRole === 'SIXTH_MAN_CORE'
      ? 0.89
      : 0.82;

  // 3) 구단 스카우팅 관심도 & 포지션 니즈 보정
  const interestDelta = clampNum((scoutingScore - 70) * 0.0055, -0.07, 0.13);
  const needs = team.neededPositions || [];
  const needDelta =
    primaryPos && needs.includes(primaryPos)
      ? 0.045
      : secondaryPos && needs.includes(secondaryPos)
      ? 0.02
      : 0;
  const fitMult = 1 + interestDelta + needDelta;

  // 4) 원소속팀 재계약(버드 라이츠/프랜차이즈 로열티) 보너스
  const resignMult = isResigning
    ? 1.05 + clampNum((coachTrust - 55) * 0.0016, -0.02, 0.06)
    : 1.0;

  // 5) 구단 고유 마켓/협상 편차 (동일 기조·역할이어도 구단별 제시액이 구분되도록)
  const teamSignature = hashTeamIdSpread(team.id);
  const randJitter = rng ? (rng() - 0.5) * 0.05 : 0;
  const marketMult = 1 + teamSignature + randJitter;

  const raw = base * dirMult * roleMult * fitMult * resignMult * marketMult;

  const step =
    contractType === 'NBA_MAX' || contractType === 'NBA_STANDARD'
      ? 50000
      : contractType === 'EUROLEAGUE_CONTRACT'
      ? 25000
      : 5000;

  return Math.max(step, Math.round(raw / step) * step);
}

/**
 * 프로 입단(KBL / NBA) 시 드래프트 동기 & 리그 라이벌(1~2명) 절차적 생성
 */
export function generateDraftRivals(
  career: Pick<CareerState, 'seasonYear' | 'primaryPos' | 'ovr' | 'teamRatingsMap'>,
  targetLeague: 'KBL' | 'NBA',
  playerTeamId: string,
  rng: () => number = Math.random
): RivalPlayer[] {
  const teams = getTeamsByLeague(targetLeague, career.teamRatingsMap).filter(
    (t) => t.id !== playerTeamId
  );
  const leagueLdr = LEAGUE_CONFIG[targetLeague].ldr;
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const rivals: RivalPlayer[] = [];

  for (let i = 0; i < 2; i++) {
    const team =
      teams[Math.floor(rng() * teams.length)] ||
      getTeamsByLeague(targetLeague, career.teamRatingsMap)[0];
    // 첫 번째 라이벌은 유저와 동일 포지션(포지션 맞수), 두 번째 라이벌은 드래프트 동기 톱 유망주
    const pos =
      i === 0
        ? career.primaryPos
        : positions[Math.floor(rng() * positions.length)];
    const baseOvr = Math.max(
      leagueLdr - 6,
      Math.min(
        leagueLdr + 4,
        Math.round(career.ovr + (i === 0 ? 1 : 3) + (rng() * 6 - 2))
      )
    );
    const potential = Math.min(96, Math.max(baseOvr + 6, Math.round(baseOvr + 8 + rng() * 10)));
    const name = generateProceduralPlayerName(targetLeague, rng);

    rivals.push({
      id: `RIVAL_${targetLeague}_${career.seasonYear}_${i + 1}`,
      name,
      draftYear: career.seasonYear,
      league: targetLeague,
      teamId: team.id,
      teamName: team.name,
      teamShortName: team.shortName,
      pos,
      ovr: baseOvr,
      potential,
      ppg: 0,
      rpg: 0,
      apg: 0,
      championships: 0,
      mvps: 0,
      allStars: 0,
      roys: 0,
      lastHeadline: `${career.seasonYear} 드래프트 동기 라이벌로 ${team.shortName}에 입단했습니다.`,
    });
  }

  return rivals;
}

/**
 * 타 리그 대칭 수상 평가용 경량 정규시즌 순위표 생성기
 * (주인공이 속하지 않은 리그 구단들의 동적 전력 기반 현실적 승패 산출)
 */
function generateForeignLeagueStandings(
  league: LeagueId,
  teamRatingsMap: Record<string, number> | undefined,
  rng: () => number
): StandingEntry[] {
  const leagueCfg = LEAGUE_CONFIG[league];
  const teams = getTeamsByLeague(league, teamRatingsMap);
  const leagueMeanRating = getLeagueBaselineTeamRating(league, teamRatingsMap);
  const totalGames = leagueCfg.games;

  const entries: StandingEntry[] = teams.map((team) => {
    const rating = teamRatingsMap?.[team.id] ?? team.rating;
    const dirMod =
      team.direction === 'CONTENDER'
        ? 0.055
        : team.direction === 'REBUILDING'
        ? -0.055
        : 0;
    const winRate = clampNum(
      0.5 + (rating - leagueMeanRating) * 0.022 + dirMod + (rng() - 0.5) * 0.1,
      0.16,
      0.84
    );
    const wins = Math.max(1, Math.min(totalGames - 1, Math.round(totalGames * winRate)));
    const losses = Math.max(1, totalGames - wins);
    return {
      team,
      wins,
      losses,
      winPct: Number((wins / totalGames).toFixed(3)),
      gb: 0,
      rank: 1,
      conference: team.conference,
      isPlayerTeam: false,
      qualifiedPlayoffs: false,
      playInQualified: false,
    };
  });

  entries.sort((a, b) => b.winPct - a.winPct || b.team.rating - a.team.rating);
  const topWins = entries[0]?.wins ?? 0;
  const topLosses = entries[0]?.losses ?? 0;
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
    e.gb = Number((((topWins - e.wins) + (e.losses - topLosses)) / 2).toFixed(1));
  });
  return entries;
}

/**
 * 매 시즌 드래프트 동기 & 리그 라이벌들의 성적/성장 시뮬레이션
 * - 동일 리그 라이벌: 통합 리그 경쟁 풀(evaluateUnifiedLeagueAwards)에서 주인공·NPC와 대칭 판정
 * - 타 리그 라이벌: 해당 리그의 구단 순위표·NPC 주전 풀·리그 정원 규칙(LEAGUE_AWARD_QUOTAS)을
 *   동일 평가 함수로 실행해 임의 확률 판정 없이 대칭적으로 MVP·올스타·신인왕을 확정
 */
export function simulateRivalsSeason(
  rivals: RivalPlayer[] | undefined,
  seasonYear: number,
  playerBox: SeasonBoxScore,
  rng: () => number = Math.random,
  teamRatingsMap?: Record<string, number>
): {
  updatedRivals: RivalPlayer[];
  rivalNarrative: string | null;
  rivalSeasonStats: Record<string, RivalSeasonStatSnapshot>;
} {
  if (!rivals || rivals.length === 0) {
    return { updatedRivals: [], rivalNarrative: null, rivalSeasonStats: {} };
  }

  let rivalNarrative: string | null = null;
  const rivalSeasonStats: Record<string, RivalSeasonStatSnapshot> = {};

  // 1) 모든 라이벌의 시즌 성장 및 개인 박스스코어 산출
  const statSimulatedRivals = rivals.map((r, idx) => {
    const cfg = LEAGUE_CONFIG[r.league];
    const seasonsSinceDraft = Math.max(0, seasonYear - r.draftYear);
    // 라이벌 OVR 성장 및 노쇠화
    let nextOvr = r.ovr;
    if (seasonsSinceDraft <= 6 && r.ovr < r.potential) {
      nextOvr = Math.min(r.potential, r.ovr + Math.round(1 + rng() * 2.4));
    } else if (seasonsSinceDraft >= 11) {
      nextOvr = Math.max(cfg.ldr - 8, r.ovr - Math.round(rng() * 2.2));
    }

    const edge = (nextOvr - cfg.ldr) / 28;
    const mpg = Number(
      clampNum(24 + edge * 10 + (rng() * 4 - 2), 18, 36.5).toFixed(1)
    );
    // 라이벌도 자연스러운 시즌 출전 경기 수(소규모 부상 결장 가능) 산출
    const healthyRatio = clampNum(0.84 + rng() * 0.16, 0.58, 1.0);
    const gp = Math.max(1, Math.round(cfg.games * healthyRatio));
    const ppg = Number(
      clampNum(
        (mpg / 36) * (17.5 + edge * 9.5) + (rng() * 2.6 - 1.3),
        7.5,
        31.5
      ).toFixed(1)
    );
    const rpgBase = r.pos === 'C' || r.pos === 'PF' ? 8.8 : 4.4;
    const apgBase =
      r.pos === 'PG' ? 7.6 : r.pos === 'SG' || r.pos === 'SF' ? 4.2 : 2.6;
    const rpg = Number(
      clampNum(
        (mpg / 36) * rpgBase * (1 + edge * 0.25) + (rng() - 0.5),
        2.0,
        15.0
      ).toFixed(1)
    );
    const apg = Number(
      clampNum(
        (mpg / 36) * apgBase * (1 + edge * 0.25) + (rng() - 0.5),
        1.2,
        12.5
      ).toFixed(1)
    );
    const spg = Number(
      clampNum((mpg / 36) * (1.1 + edge * 0.4) + (rng() * 0.4 - 0.2), 0.3, 2.6).toFixed(1)
    );
    const bpgBase = r.pos === 'C' ? 1.8 : r.pos === 'PF' ? 1.2 : 0.45;
    const bpg = Number(
      clampNum((mpg / 36) * bpgBase * (1 + edge * 0.2) + (rng() * 0.3 - 0.15), 0.1, 3.2).toFixed(1)
    );
    const fgBase = r.pos === 'C' ? 53.0 : r.pos === 'PF' ? 48.5 : 44.5;
    const fgPct = Number(
      clampNum(fgBase + edge * 5.0 + (rng() * 3.0 - 1.5), 37.0, 62.0).toFixed(1)
    );

    rivalSeasonStats[r.id] = {
      rivalId: r.id,
      gp,
      mpg,
      ppg,
      rpg,
      apg,
      spg,
      bpg,
      fgPct,
    };

    const sameLeague = r.league === playerBox.league;
    const headline = `${r.teamShortName}의 동기 라이벌 ${r.name}(${r.pos}, OVR ${nextOvr}) 선수가 이번 시즌 평균 ${ppg}점 ${rpg}리바운드 ${apg}도움을 기록했습니다.`;
    if (!rivalNarrative && sameLeague) {
      const diffPpg = (playerBox.ppg - ppg).toFixed(1);
      rivalNarrative = `라이벌 매치업 · 드래프트 동기 ${r.name}(${r.teamShortName}) 평균 ${ppg}점 ${rpg}리바운드 ${apg}도움 (내 득점 대비 ${
        Number(diffPpg) >= 0 ? `+${diffPpg}` : diffPpg
      }점)`;
    }

    return {
      ...r,
      ovr: nextOvr,
      ppg,
      rpg,
      apg,
      lastHeadline: headline,
    };
  });

  // 2) 타 리그 라이벌을 소속 리그별로 묶어 해당 리그 정원 + NPC 대칭 풀로 수상 판정
  const foreignLeagueBuckets = new Map<LeagueId, RivalPlayer[]>();
  for (const r of statSimulatedRivals) {
    if (r.league === playerBox.league) continue;
    const list = foreignLeagueBuckets.get(r.league) ?? [];
    list.push(r);
    foreignLeagueBuckets.set(r.league, list);
  }

  const foreignAwardMap = new Map<
    string,
    {
      wonMvp: boolean;
      allStar: boolean;
      wonRoy: boolean;
      wonChampionship: boolean;
      leagueLabel: string;
    }
  >();

  for (const [foreignLeague, leagueRivals] of foreignLeagueBuckets.entries()) {
    const foreignCfg = LEAGUE_CONFIG[foreignLeague];
    const foreignMeta = LEAGUE_BALANCE_META[foreignLeague];
    const foreignQuota = LEAGUE_AWARD_QUOTAS[foreignLeague];
    const foreignStandings = generateForeignLeagueStandings(
      foreignLeague,
      teamRatingsMap,
      rng
    );

    // 타 리그 플레이오프 우승 구단 시뮬레이션 (PO 진출권 팀 전력·정규 순위 가중 추첨)
    const poCutoff = Math.max(
      2,
      Math.min(
        foreignStandings.length,
        getPlayoffCutoffByLeague(foreignLeague, foreignStandings.length)
      )
    );
    const poContenders = foreignStandings.slice(0, poCutoff);
    let foreignChampionTeamId: string | null = null;
    if (poContenders.length > 0) {
      const weights = poContenders.map((st, sIdx) => {
        const seedWeight = Math.max(1, poCutoff - sIdx);
        const ratingBoost = Math.max(1, st.team.rating - foreignCfg.ldr + 10);
        return seedWeight * ratingBoost * ratingBoost;
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let roll = rng() * totalWeight;
      foreignChampionTeamId = poContenders[0].team.id;
      for (let i = 0; i < poContenders.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          foreignChampionTeamId = poContenders[i].team.id;
          break;
        }
      }
    }

    const occupiedSlots = new Map<string, number>();
    const pool: LeagueAwardCandidate[] = [];

    for (const r of leagueRivals) {
      const st =
        foreignStandings.find((s) => s.team.id === r.teamId) || foreignStandings[0];
      const rWins = st ? st.wins : Math.round(foreignCfg.games * 0.5);
      const rLosses = st ? st.losses : Math.max(1, foreignCfg.games - rWins);
      const snap = rivalSeasonStats[r.id];
      const rGp = snap?.gp ?? Math.round(foreignCfg.games * 0.9);
      const rMpg = snap?.mpg ?? 31.0;
      const rSpg = snap?.spg ?? 1.1;
      const rBpg = snap?.bpg ?? (r.pos === 'C' || r.pos === 'PF' ? 1.2 : 0.4);
      const rFgPct = snap?.fgPct ?? (r.pos === 'C' ? 52.5 : 46.5);
      const rDefStat = Math.round(clampNum(r.ovr + (rng() * 6 - 3), 50, 96));
      const rEligible =
        rGp / Math.max(1, foreignCfg.games) >= foreignMeta.minAttendanceRatio &&
        rMpg >= AWARD_VOTING_CONFIG.minMpgForMajorAward;

      occupiedSlots.set(r.teamId, (occupiedSlots.get(r.teamId) ?? 0) + 1);
      pool.push({
        id: `RIVAL_${r.id}`,
        name: r.name,
        teamId: r.teamId,
        teamShortName: r.teamShortName,
        pos: r.pos,
        isPlayer: false,
        rivalId: r.id,
        isRookie: r.draftYear === seasonYear,
        gp: rGp,
        mpg: rMpg,
        ppg: r.ppg,
        rpg: r.rpg,
        apg: r.apg,
        spg: rSpg,
        bpg: rBpg,
        fgPct: rFgPct,
        defStat: rDefStat,
        wins: rWins,
        losses: rLosses,
        eligible: rEligible,
        mvpScore: calcUnifiedMvpScore({
          ppg: r.ppg,
          rpg: r.rpg,
          apg: r.apg,
          spg: rSpg,
          bpg: rBpg,
          fgPct: rFgPct,
          wins: rWins,
          losses: rLosses,
        }),
        allStarScore: calcUnifiedAllStarScore({
          ppg: r.ppg,
          rpg: r.rpg,
          apg: r.apg,
          spg: rSpg,
          bpg: rBpg,
          fgPct: rFgPct,
          wins: rWins,
          losses: rLosses,
        }),
        royScore: calcUnifiedRoyScore({
          ppg: r.ppg,
          rpg: r.rpg,
          apg: r.apg,
          spg: rSpg,
          bpg: rBpg,
          fgPct: rFgPct,
          wins: rWins,
          losses: rLosses,
        }),
        dpoyScore: calcUnifiedDpoyScore({
          pos: r.pos,
          defStat: rDefStat,
          spg: rSpg,
          bpg: rBpg,
          rpg: r.rpg,
          wins: rWins,
          losses: rLosses,
        }),
      });
    }

    const npcCandidates = generateLeagueNpcStarPool({
      league: foreignLeague,
      standings: foreignStandings,
      teamOccupiedSlots: occupiedSlots,
      rng,
    });
    pool.push(...npcCandidates);

    const eligibleMvpSorted = pool
      .filter((c) => c.eligible)
      .sort((a, b) => b.mvpScore - a.mvpScore);
    const mvpWinner = eligibleMvpSorted[0] ?? null;

    const allStarSelection = selectPositionBalancedAllStars(pool, foreignQuota);
    const allStarIds = new Set(allStarSelection.selectedIds);
    if (AWARD_VOTING_CONFIG.mvpGuaranteesAllStarAndFirstTeam && mvpWinner) {
      applyMvpAllStarGuarantee(allStarIds, pool, mvpWinner, foreignQuota);
    }

    const rookieRivals = pool.filter((c) => c.rivalId && c.isRookie);
    let royWinnerId: string | null = null;
    if (rookieRivals.length > 0) {
      const npcRookies = generateLeagueNpcRookiePool({
        league: foreignLeague,
        standings: foreignStandings,
        rng,
      });
      const eligibleRoySorted = [...rookieRivals, ...npcRookies]
        .filter((c) => c.eligible)
        .sort((a, b) => b.royScore - a.royScore);
      royWinnerId = eligibleRoySorted[0]?.id ?? null;
    }

    for (const r of leagueRivals) {
      const candId = `RIVAL_${r.id}`;
      foreignAwardMap.set(r.id, {
        wonMvp: mvpWinner?.id === candId,
        allStar: allStarIds.has(candId),
        wonRoy: royWinnerId === candId,
        wonChampionship: foreignChampionTeamId === r.teamId,
        leagueLabel: foreignMeta.allStarLabel,
      });
    }
  }

  const updatedRivals = statSimulatedRivals.map((r) => {
    const foreignRes = foreignAwardMap.get(r.id);
    if (!foreignRes) return r;
    const awardTags: string[] = [];
    if (foreignRes.wonChampionship) awardTags.push('리그 우승');
    if (foreignRes.wonMvp) awardTags.push('정규시즌 MVP');
    if (foreignRes.allStar) awardTags.push(foreignRes.leagueLabel);
    if (foreignRes.wonRoy) awardTags.push('신인왕');
    const suffix = awardTags.length > 0 ? ` (${awardTags.join(' · ')} 선정)` : '';
    return {
      ...r,
      championships: r.championships + (foreignRes.wonChampionship ? 1 : 0),
      allStars: r.allStars + (foreignRes.allStar ? 1 : 0),
      mvps: r.mvps + (foreignRes.wonMvp ? 1 : 0),
      roys: r.roys + (foreignRes.wonRoy ? 1 : 0),
      lastHeadline: `${r.lastHeadline}${suffix}`,
    };
  });

  return { updatedRivals, rivalNarrative, rivalSeasonStats };
}

/**
 * 직전 시즌 분당 실전 효율(Per-36 Real Efficiency) 모멘텀 계산
 */
export function calculateRecentEfficiencyMomentum(
  seasonLogs?: SeasonBoxScore[],
  primaryPos: Position = 'SG'
): number {
  if (!seasonLogs || seasonLogs.length === 0) return 0;
  const lastLog = seasonLogs[seasonLogs.length - 1];
  if (lastLog.mpg < 3.5) return 0;

  const scale36 = 36 / Math.max(10, lastLog.mpg);
  const pts36 = lastLog.ppg * scale36;
  const reb36 = lastLog.rpg * scale36;
  const ast36 = lastLog.apg * scale36;
  const stk36 = (lastLog.spg + lastLog.bpg) * scale36;

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
 * 드래프트 위상(Draft Pedigree) + 구단 육성 기조 + 역할 약속(Role Promise) + 실전 효율 모멘텀이 결합된 유기적 로테이션 시스템
 */
export function calculateRoleAndMpg(
  career: Pick<
    CareerState,
    'ovr' | 'team' | 'coachTrust' | 'secondaryPos' | 'contractType' | 'league'
  > & {
    age?: number;
    stats?: Pick<PlayerStats, 'phy'>;
    primaryPos?: Position;
    growthDna?: GrowthDna;
    traits?: PlayerTraitId[];
    promisedRole?: RolePromiseType;
    draftPedigreePick?: number | null;
    draftPedigreeRound?: 1 | 2 | null;
    draftPedigreeSeasonsLeft?: number;
    seasonLogs?: SeasonBoxScore[];
    totals?: CareerState['totals'];
    activePersonalCare?: PersonalCareId[];
    seasonYear?: number;
    coachChanceRotationYear?: number | null;
    contenderPathTeamId?: string | null;
    seasonsOnCurrentTeam?: number;
  },
  rng: () => number = Math.random
): RoleAndMpgResult {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const dualBonus = career.secondaryPos ? 2.5 : 0;

  const teamDirection = career.team.direction || 'PLAYOFF_HUNT';
  const rebuildingYouthBoost =
    teamDirection === 'REBUILDING'
      ? 3.5
      : teamDirection === 'CONTENDER'
      ? -1.0
      : 1.0;

  const needed = career.team.neededPositions || [];
  const posNeedBoost =
    career.primaryPos && needed.includes(career.primaryPos)
      ? 2.8
      : career.secondaryPos && needed.includes(career.secondaryPos)
      ? 1.5
      : 0;

  // 구단 역할 약속(Role Promise) 보정 (단, 감독 신뢰도가 기준 미만으로 추락하면 약속이 깨질 수 있음)
  const trustHonorsPromise = career.coachTrust >= ROLE_MPG_CONFIG.trustHonorThreshold;
  const promiseBoost =
    !trustHonorsPromise || !career.promisedRole
      ? 0
      : career.promisedRole === 'ACE_FIRST_OPTION'
      ? 5.5
      : career.promisedRole === 'STARTER_GUARANTEE'
      ? 3.8
      : career.promisedRole === 'PROSPECT_DEVELOPMENT'
      ? 3.2
      : career.promisedRole === 'SIXTH_MAN_CORE'
      ? 1.8
      : 0.8;

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
      const kblPedigree = KBL_ROOKIE_CONFIG.pedigreeBonus;
      pedigreeBonus =
        pick <= 3 ? kblPedigree.top3 : pick <= 6 ? kblPedigree.top6 : kblPedigree.firstRound;
    } else if (career.league === 'NBA') {
      const nbaPedigree = NBA_ENTRY_CONFIG.pedigreeBonus;
      pedigreeBonus =
        pick <= 5 ? nbaPedigree.top5 : pick <= 14 ? nbaPedigree.lottery : nbaPedigree.firstRound;
    }
  } else if (pedigreeSeasonsLeft > 0 && round === 2) {
    pedigreeBonus = career.league === 'NBA' ? NBA_ENTRY_CONFIG.pedigreeBonus.secondRound : 3.5;
  }

  // NBA 적응 곡선: 루키·2·3년차는 단계적으로 페널티를 받아 로테이션에서 시작해 에이스로 올라갑니다.
  const priorNbaSeasons =
    career.league === 'NBA'
      ? (career.seasonLogs || []).filter((l) => l.league === 'NBA').length
      : 0;
  // KBL 신인 적응: 프로 경력이 없는 신인만 (해외·NBA 복귀 베테랑 경로는 제외)
  const priorLogs = career.seasonLogs || [];
  const kblRookieSeasonIndex =
    career.league === 'KBL' &&
    !career.team.isMilitaryTeam &&
    !priorLogs.some((l) => l.league !== 'KBL' && PRO_LEAGUE_SET.has(l.league))
      ? priorLogs.filter((l) => l.league === 'KBL').length
      : -1;
  const nbaAdaptationPenalty =
    career.league === 'NBA'
      ? NBA_ENTRY_CONFIG.adaptationPenaltyBySeason[priorNbaSeasons] ?? 0
      : kblRookieSeasonIndex >= 0
      ? KBL_ROOKIE_CONFIG.adaptationPenaltyBySeason[kblRookieSeasonIndex] ?? 0
      : 0;

  const efficiencyMomentum = calculateRecentEfficiencyMomentum(
    career.seasonLogs,
    career.primaryPos || 'SG'
  );

  const rawOvrDiff = career.ovr - career.team.rating;
  const roleIndex = Number(
    (
      rawOvrDiff +
      (career.coachTrust - 50) * 0.22 +
      dualBonus +
      rebuildingYouthBoost * (pedigreeSeasonsLeft > 0 ? 1.0 : 0.35) +
      posNeedBoost *
        (pedigreeSeasonsLeft > 0 || (career.seasonLogs && career.seasonLogs.length > 0)
          ? 1.0
          : 0) +
      promiseBoost +
      pedigreeBonus +
      efficiencyMomentum *
        (career.league === 'NBA' && priorNbaSeasons === 0
          ? NBA_ENTRY_CONFIG.rookieMomentumCarryover
          : 1) -
      nbaAdaptationPenalty
    ).toFixed(2)
  );

  let role = '가비지 타임 (벤치 끝자리)';
  let mpg = 6.0;
  let healthyGp = leagueConfig.games;
  let basePer36 = 10.0;

  if (career.contractType === 'TWO_WAY') {
    // 투웨이 계약도 아래 노장 로드매니지먼트·부상 판정 파이프라인을 그대로 통과하도록 통합
    healthyGp = Math.min(50, Math.round(18 + rng() * 24));
    role = '투웨이 콜업 로테이션';
    const effBoostMpg = Math.max(0, efficiencyMomentum * 0.9);
    mpg = Number(
      Math.min(
        24.5,
        8.5 + Math.max(0, (career.ovr - (leagueConfig.ldr - 14)) * 1.1) + effBoostMpg
      ).toFixed(1)
    );
    basePer36 = 12.8;
  } else {
    // [연속 시그모이드 보간] 계단식 절벽 점프 없이 roleIndex에 따라 출전시간/볼륨/출전비율이 매끄럽게 상승
    const roleFactor = sigmoid((roleIndex + 1.2) / 4.3);
    const mpgSpan = ROLE_MPG_CONFIG.maxMpg - ROLE_MPG_CONFIG.minMpg;
    const rawMpg =
      ROLE_MPG_CONFIG.minMpg + roleFactor * mpgSpan + (rng() * 2.4 - 1.2);
    mpg = Number(
      clampNum(rawMpg, ROLE_MPG_CONFIG.minMpg, ROLE_MPG_CONFIG.maxMpg).toFixed(1)
    );

    const per36Span =
      ROLE_MPG_CONFIG.maxBasePer36 - ROLE_MPG_CONFIG.minBasePer36;
    basePer36 = Number(
      clampNum(
        ROLE_MPG_CONFIG.minBasePer36 + roleFactor * per36Span,
        ROLE_MPG_CONFIG.minBasePer36,
        ROLE_MPG_CONFIG.maxBasePer36
      ).toFixed(2)
    );

    const healthyRatio = clampNum(
      0.56 + roleFactor * 0.42 + (rng() * 0.06 - 0.03),
      0.52,
      1.0
    );
    healthyGp = Math.max(1, Math.round(leagueConfig.games * healthyRatio));

    // 우승 도전팀 이적 직후 2옵션 기간: 주전 스타터 출전 시간 상한
    if (
      career.contenderPathTeamId &&
      career.contenderPathTeamId === career.team.id &&
      (career.seasonsOnCurrentTeam ?? 0) < CONTENDER_PATH_CONFIG.secondOptionSeasons &&
      mpg > CONTENDER_PATH_CONFIG.secondOptionMaxMpg
    ) {
      mpg = Number((CONTENDER_PATH_CONFIG.secondOptionMaxMpg - rng() * 1.5).toFixed(1));
    }

    // 1라운드 드래프트 위상(Pedigree) 보호: 별도 if-override 대신 연속 곡선 위에 하한선(floor)으로 매끄럽게 적용
    if (isFirstRoundPedigree) {
      const isTopLottery =
        pick !== null && (career.league === 'KBL' ? pick <= 3 : pick <= 10);
      const minPedigreeMpg = isTopLottery ? 23.5 : 20.0;
      const minPedigreePer36 = isTopLottery ? 16.5 : 14.8;
      const minPedigreeGp = Math.max(1, Math.round(leagueConfig.games * 0.88));
      const pedigreeFloorApplied = mpg < minPedigreeMpg;
      mpg = Number(Math.max(mpg, minPedigreeMpg).toFixed(1));
      basePer36 = Number(Math.max(basePer36, minPedigreePer36).toFixed(2));
      healthyGp = Math.max(healthyGp, minPedigreeGp);
      if (pedigreeFloorApplied || mpg < 27.5) {
        role = isTopLottery
          ? '주전급 코어 유망주 (1라운드 픽)'
          : '핵심 유망주 로테이션 (1라운드 픽)';
      } else if (mpg < 31.8) {
        role = '주전 스타터';
      } else {
        role = '프랜차이즈 1옵션 에이스';
      }
    } else if (
      mpg < 10.0 &&
      career.coachChanceRotationYear != null &&
      career.coachChanceRotationYear === career.seasonYear
    ) {
      // 고교 '코치의 기회'를 잡은 시즌: 벤치 로테이션 하한 보장
      const chanceCfg = ROLE_MPG_CONFIG.coachChance;
      mpg = Number((chanceCfg.minMpg + rng() * chanceCfg.mpgJitter).toFixed(1));
      healthyGp = Math.max(healthyGp, Math.round(leagueConfig.games * chanceCfg.minGpRatio));
      role = '벤치 로테이션';
    } else if (mpg < 10.0) {
      role = '가비지 타임 (벤치 끝자리)';
    } else if (mpg < 17.5) {
      role = '벤치 로테이션';
    } else if (mpg < 24.5) {
      role = '핵심 식스맨';
    } else if (mpg < 31.8) {
      role = '주전 스타터';
    } else {
      role = '프랜차이즈 1옵션 에이스';
    }
  }

  // 노장(33세+) 출전시간 및 백투백 로드매니지먼트
  const age = career.age ?? 25;
  const dna = career.growthDna || 'STANDARD';
  const traits = career.traits || [];
  const hasIronDurability =
    dna === 'IRONMAN' || traits.includes('IRON_STAMINA');
  const vetCfg = ROLE_MPG_CONFIG.veteranLoadMgmt;
  let veteranLoadManaged = false;

  if (age >= vetCfg.startAge) {
    const tierCap =
      age >= 37
        ? vetCfg.age37Plus
        : age >= 35
        ? vetCfg.age35to36
        : vetCfg.age33to34;
    const effectiveMaxMpg =
      tierCap.maxMpg + (hasIronDurability ? vetCfg.ironmanMpgBonus : 0);
    const effectiveMaxRatio = Math.min(
      0.96,
      tierCap.maxHealthyRatio +
        (hasIronDurability ? vetCfg.ironmanGpRatioBonus : 0)
    );
    const maxVetHealthyGp = Math.max(
      1,
      Math.round(leagueConfig.games * effectiveMaxRatio)
    );

    if (mpg > effectiveMaxMpg) {
      mpg = Number(effectiveMaxMpg.toFixed(1));
      veteranLoadManaged = true;
    }
    if (healthyGp > maxVetHealthyGp) {
      healthyGp = maxVetHealthyGp;
      veteranLoadManaged = true;
    }
  }

  // 부상 리스크 계산 (PHY, 출전시간, 연령, 실제 누적 마일리지, DNA, 특성, 퍼스널 케어 통합 반영)
  const phy = career.stats?.phy ?? 65;
  const careerMinutes = computeCareerMinutes(career);
  const hasRehabCare = (career.activePersonalCare || []).includes(
    'REHAB_LOAD_MGMT'
  );
  const injCfg = ROLE_MPG_CONFIG.injury;
  const rehabCfg = ECONOMY_CONFIG.personalCare.REHAB_LOAD_MGMT;
  let injuredGamesMissed = 0;
  let injurySeverity: InjurySeverity = 'NONE';
  let injuryLabel: string | undefined = undefined;
  let injuryPermanentPhyPenalty = 0;

  const lowPhyRisk = Math.max(
    injCfg.minBaseRisk,
    (injCfg.phyReference - phy) * injCfg.phySlope
  );
  const highMpgRisk = Math.max(
    0,
    (mpg - injCfg.mpgReference) * injCfg.mpgSlope
  );
  const ageRisk =
    age >= injCfg.ageRiskStart
      ? (age - (injCfg.ageRiskStart - 1)) * injCfg.ageRiskPerYear +
        (age >= 35 ? (age - 34) * injCfg.age35ExtraPerYear : 0)
      : 0;
  const mileageRisk =
    careerMinutes > injCfg.mileageRiskReference
      ? Math.min(
          injCfg.mileageRiskCap,
          ((careerMinutes - injCfg.mileageRiskReference) / 10000) *
            injCfg.mileageRiskPer10k
        )
      : 0;

  let injuryMult = dna === 'IRONMAN' ? injCfg.ironmanDnaMult : 1.0;
  if (traits.includes('IRON_STAMINA')) injuryMult *= injCfg.ironStaminaMult;
  // 유리몸 페널티는 재활 관리로 일부만 완화됩니다 (완전히 사라지지 않음)
  const glassBodyRetention = hasRehabCare ? injCfg.glassBodyRehabRetention : 1.0;
  if (traits.includes('GLASS_BODY')) {
    injuryMult *= 1 + (injCfg.glassBodyMult - 1) * glassBodyRetention;
  }
  if (hasRehabCare) injuryMult *= rehabCfg.injuryRiskMultiplier;

  const totalInjuryProb = clampNum(
    (lowPhyRisk + highMpgRisk + ageRisk + mileageRisk) * injuryMult,
    0.01,
    0.72
  );

  if (rng() < totalInjuryProb) {
    const majorCfg = injCfg.tiers.major;
    const majorShare = clampNum(
      majorCfg.baseShare +
        (age >= 30 ? (age - 29) * majorCfg.age30SharePerYear : 0) +
        (traits.includes('GLASS_BODY')
          ? majorCfg.glassBodyShareBonus * glassBodyRetention
          : 0) +
        (phy < 68 ? majorCfg.lowPhyShareBonus : 0) +
        (careerMinutes > 26000 ? majorCfg.highMileageShareBonus : 0) -
        (hasRehabCare ? majorCfg.rehabShareReduction : 0),
      0.04,
      0.34
    );
    const moderateShare = 0.32;
    const sevRoll = rng();

    if (sevRoll < majorShare) {
      injurySeverity = 'MAJOR';
    } else if (sevRoll < majorShare + moderateShare) {
      injurySeverity = 'MODERATE';
    } else {
      injurySeverity = 'MINOR';
    }

    const labels = INJURY_LABELS_BY_SEVERITY[injurySeverity];
    injuryLabel = labels[Math.floor(rng() * labels.length) % labels.length];

    const tierRatio =
      injurySeverity === 'MAJOR'
        ? injCfg.tiers.major
        : injurySeverity === 'MODERATE'
        ? injCfg.tiers.moderate
        : injCfg.tiers.minor;

    const rawMissRatio =
      tierRatio.minRatio + rng() * (tierRatio.maxRatio - tierRatio.minRatio);
    const careGamesMult = hasRehabCare
      ? injurySeverity === 'MAJOR'
        ? majorCfg.majorRehabGamesMult
        : rehabCfg.injuryGamesMultiplier
      : 1.0;

    const injuryBaseGames =
      career.contractType === 'TWO_WAY' ? healthyGp : leagueConfig.games;
    injuredGamesMissed = Math.max(
      1,
      Math.min(
        Math.max(1, healthyGp - 1),
        Math.round(injuryBaseGames * rawMissRatio * careGamesMult)
      )
    );

    if (
      injurySeverity === 'MAJOR' &&
      age >= injCfg.majorAftermath.minAge
    ) {
      injuryPermanentPhyPenalty =
        age >= 34
          ? injCfg.majorAftermath.phyDrop34Plus
          : injCfg.majorAftermath.phyDrop30to33;
    }
  }

  const gp = Math.max(1, healthyGp - injuredGamesMissed);

  return {
    roleIndex,
    role,
    mpg,
    gp,
    injuredGamesMissed,
    injurySeverity,
    injuryLabel,
    injuryPermanentPhyPenalty,
    veteranLoadManaged,
    basePer36,
  };
}

/**
 * 상대 수비 저항치(ldr)와 소프트캡이 적용된 평균 득점(PPG) 공식
 */
export function calculatePpg(
  stats: Pick<PlayerStats, 'ins' | 'out'>,
  ldr: number,
  mpg: number,
  basePer36: number,
  rng: () => number = Math.random,
  traitMultiplier: number = 1.0
): { ppg: number; offEdge: number; rawPpg: number } {
  const ppgCfg = ROLE_MPG_CONFIG.ppg;
  const attackStat = stats.ins * 0.52 + stats.out * 0.48;
  const diff = attackStat - ldr;
  const generationalBonus = Math.max(0, attackStat - 93) * 0.012;
  const offEdge =
    (diff >= 0
      ? Math.max(
          0.28,
          1.0 + (diff <= 11 ? diff / 35 : 11 / 35 + (diff - 11) / 85) + generationalBonus
        )
      : Math.max(0.28, 1.0 + diff / 26)) * traitMultiplier;

  const rawPpg = (mpg / 36) * basePer36 * offEdge + (rng() * 1.8 - 0.9);
  // 초정상급 득점원(attackStat > 89) 구간에서는 소프트캡 기울기를 완만하게 완화해 역대급 NBA 득점 기록(34.0+ PPG) 도전을 허용
  const effectiveSlope = clampNum(
    ppgCfg.softCapSlope + Math.max(0, attackStat - 89) * 0.06,
    ppgCfg.softCapSlope,
    0.94
  );
  const finalPpg =
    rawPpg > ppgCfg.softCapStart
      ? ppgCfg.softCapStart + (rawPpg - ppgCfg.softCapStart) * effectiveSlope
      : rawPpg;
  const ppg = clampNum(Number(finalPpg.toFixed(1)), ppgCfg.minPpg, ppgCfg.maxPpg);

  return { ppg, offEdge, rawPpg };
}

/**
 * 선수 고유 성장 곡선 DNA 및 특성(슬로우 스타터, 퍼스널 케어 바이오메카닉스 랩, 베테랑 스타일 진화 등)이 반영된 시즌 성장 및 에이징 수식
 */
export function calculateSeasonStatGrowth(
  career: Pick<
    CareerState,
    'age' | 'ovr' | 'potential' | 'league' | 'stats' | 'trainingFocus'
  > & {
    heightCm?: number;
    primaryPos?: Position;
    growthDna?: GrowthDna;
    traits?: PlayerTraitId[];
    totals?: CareerState['totals'];
    seasonLogs?: SeasonBoxScore[];
    activePersonalCare?: PersonalCareId[];
    campAgingShield?: boolean;
    veteranReinvented?: boolean;
  },
  mpg: number,
  rng: () => number = Math.random,
  injuredGamesMissed: number = 0,
  majorInjuryAftermath?: {
    phyPenalty: number;
    secondaryPenalty?: number;
    currentSeasonMinutes?: number;
  }
): { nextStats: PlayerStats; delta: StatDelta } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const prev = career.stats;
  const dna: GrowthDna = career.growthDna || 'STANDARD';
  const traits = career.traits || [];
  const isSlowStarter = traits.includes('SLOW_STARTER');
  const hasBiomechLab = (career.activePersonalCare || []).includes(
    'BIOMECH_SKILL_LAB'
  );
  const hasCampAgingShield = Boolean(career.campAgingShield);
  const veteranReinvented = Boolean(career.veteranReinvented);
  const heightCm = career.heightCm ?? 195;
  const primaryPos = career.primaryPos ?? 'SG';

  const applyBioCapAndAftermath = (
    rawNext: PlayerStats
  ): { nextStats: PlayerStats; delta: StatDelta } => {
    const withAftermath: PlayerStats = { ...rawNext };
    const phyPen = majorInjuryAftermath?.phyPenalty ?? 0;
    const secPen = majorInjuryAftermath?.secondaryPenalty ?? 0;
    if (phyPen > 0) {
      withAftermath.phy = Math.max(35, withAftermath.phy - phyPen);
    }
    if (secPen > 0) {
      withAftermath.def = Math.max(35, withAftermath.def - secPen);
    }

    const capped = enforceBiomechanicalCaps(withAftermath, heightCm, primaryPos);
    return {
      nextStats: capped,
      delta: {
        ins: capped.ins - prev.ins,
        out: capped.out - prev.out,
        ply: capped.ply - prev.ply,
        def: capped.def - prev.def,
        reb: capped.reb - prev.reb,
        phy: capped.phy - prev.phy,
      },
    };
  };

  // 성장기·전성기·노쇠기 구간 경계를 retirementEngine의 단일 진실 원천(computeEffectiveAgingOnset)으로 통합
  const priorMinutes = computeCareerMinutes(career);
  const seasonMinutes = majorInjuryAftermath?.currentSeasonMinutes ?? 0;
  const careerMinutes = priorMinutes + seasonMinutes;
  const { maxGrowthAge, onsetAge } = computeEffectiveAgingOnset(
    dna,
    careerMinutes,
    traits
  );

  if (career.age <= maxGrowthAge) {
    // 연속적 출전 시간 계수
    // 벤치 선수도 팀 훈련으로 일정 수준 성장하도록 하한(minPtFactor) 보장
    const ptFactor = Math.max(
      GROWTH_CONFIG.minPtFactor,
      Math.min(1.22, 0.42 + (mpg / 30) * 0.75)
    );
    // 리그 성장 상한선과의 거리에 따른 연속 감쇠
    const capGap = leagueConfig.growthCap - career.ovr;
    const capPenalty =
      capGap <= 0
        ? 0.2
        : capGap <= 3
        ? 0.45 + capGap * 0.15
        : 1.0;

    // 잠재력 상한선과의 거리에 따른 연속 감쇠
    const potGap = career.potential - career.ovr;
    const potPenalty =
      potGap <= 0
        ? 0.15
        : potGap <= 4
        ? 0.35 + potGap * 0.15
        : 1.0;

    // 고능력치 구간 연속 감쇠 (Diminishing Returns)
    const highOvrWall = Math.max(
      0.36,
      Math.min(
        1.0,
        1.0 -
          Math.max(0, career.ovr - GROWTH_CONFIG.highOvrWallStart) *
            GROWTH_CONFIG.highOvrWallSlope
      )
    );

    const injuryFactor = Math.max(0.62, 1.0 - injuredGamesMissed * 0.018);

    let ageMultiplier = 0.85;
    if (dna === 'EARLY_BLOOMER') {
      ageMultiplier = career.age <= 21 ? 1.34 : career.age <= 24 ? 1.24 : 0.88;
    } else if (dna === 'LATE_BLOOMER' || isSlowStarter) {
      ageMultiplier = career.age <= 21 ? 0.92 : career.age <= 26 ? 1.3 : 1.1;
    } else {
      ageMultiplier = career.age <= 20 ? 1.12 : career.age <= 23 ? 1.0 : 1.0;
    }

    const careGrowthMult = hasBiomechLab
      ? ECONOMY_CONFIG.personalCare.BIOMECH_SKILL_LAB.growthMultiplier
      : 1.0;

    // 프로 입단(23세 전후) 이후 성장 가속: 잠재력에 실제로 근접할 수 있도록 보정
    const proStageBoost =
      LEAGUE_BALANCE_META[career.league].isPro ? GROWTH_CONFIG.proStageGrowthBoost : 1.0;
    // 1.2.0: 미국 고교 재학 중에는 성장 속도가 빠릅니다.
    const usHighSchoolBoost =
      career.league === 'US_HIGH_SCHOOL'
        ? US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.growthMultiplier
        : 1.0;
    const baseGain =
      1.72 *
      proStageBoost *
      usHighSchoolBoost *
      ptFactor *
      capPenalty *
      potPenalty *
      highOvrWall *
      injuryFactor *
      ageMultiplier *
      careGrowthMult;

    const focusWeights: Record<
      TrainingFocus,
      Partial<Record<keyof PlayerStats, number>>
    > = {
      INSIDE_SCORING: { ins: 1.75, phy: 1.1, reb: 1.0, out: 0.65, ply: 0.7, def: 0.7 },
      OUTSIDE_SHOOTING: { out: 1.8, ply: 1.1, ins: 0.75, def: 0.65, reb: 0.6, phy: 0.7 },
      PLAYMAKING: { ply: 1.8, out: 1.1, ins: 0.8, def: 0.75, phy: 0.75, reb: 0.55 },
      DEFENSE_LOCKDOWN: { def: 1.8, phy: 1.2, reb: 1.0, ins: 0.65, out: 0.65, ply: 0.65 },
      REBOUND_POST: { reb: 1.8, ins: 1.2, phy: 1.1, def: 0.95, out: 0.5, ply: 0.55 },
      PHYSICAL_CONDITIONING: {
        phy: 1.85,
        def: 1.1,
        reb: 1.05,
        ins: 0.95,
        out: 0.6,
        ply: 0.65,
      },
      BALANCED: { ins: 1.0, out: 1.0, ply: 1.0, def: 1.0, reb: 1.0, phy: 1.0 },
    };

    const fw = focusWeights[career.trainingFocus];
    const elasticity = getBiomechanicalGrowthElasticity(heightCm, primaryPos, prev);
    const keys: (keyof PlayerStats)[] = ['ins', 'out', 'ply', 'def', 'reb', 'phy'];
    const nextStats: PlayerStats = { ...prev };

    for (const k of keys) {
      const w = fw[k] ?? 1.0;
      const rawStep = baseGain * w * elasticity[k] * (0.65 + rng() * 0.55);
      const gain = Math.max(0, Math.round(rawStep));
      const updated = Math.min(99, prev[k] + gain);
      nextStats[k] = updated;
    }

    return applyBioCapAndAftermath(nextStats);
  }

  if (career.age < onsetAge) {
    const nextStats: PlayerStats = { ...prev };
    if (career.ovr < leagueConfig.growthCap && career.ovr < career.potential) {
      // 전성기 미세 성장: 훈련 집중 능력치(BALANCED는 6개 중 균등 무작위) + 서로 다른 보조 능력치 각각 확률적으로 +1
      const allKeys: (keyof PlayerStats)[] = ['ins', 'out', 'ply', 'def', 'reb', 'phy'];
      const bonusKey: keyof PlayerStats =
        career.trainingFocus === 'OUTSIDE_SHOOTING'
          ? 'out'
          : career.trainingFocus === 'PLAYMAKING'
          ? 'ply'
          : career.trainingFocus === 'DEFENSE_LOCKDOWN'
          ? 'def'
          : career.trainingFocus === 'REBOUND_POST'
          ? 'reb'
          : career.trainingFocus === 'PHYSICAL_CONDITIONING'
          ? 'phy'
          : career.trainingFocus === 'INSIDE_SCORING'
          ? 'ins'
          : allKeys[Math.floor(rng() * allKeys.length)];
      const secondaryCandidates = allKeys.filter((k) => k !== bonusKey);
      const secondaryKey =
        secondaryCandidates[Math.floor(rng() * secondaryCandidates.length)];
      const primeChance = hasBiomechLab
        ? GROWTH_CONFIG.primeGrowthChanceWithLab
        : GROWTH_CONFIG.primeGrowthChance;
      for (const key of [bonusKey, secondaryKey]) {
        if (rng() < primeChance && nextStats[key] < 99) {
          nextStats[key] += 1;
        }
      }
    }
    return applyBioCapAndAftermath(nextStats);
  }

  const aged = applyAgingCurve(career.age, prev, rng, {
    growthDna: dna,
    careerMinutes,
    traits,
    hasBiomechLab,
    hasCampAgingShield,
    veteranReinvented,
  });
  return applyBioCapAndAftermath(aged.nextStats);
}

/**
 * 포지션 및 플레이 성향에 맞춘 실전 공헌 효율 기반 감독 신뢰도 변화 산출
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
  const {
    pos,
    playstyle,
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
  } = params;

  const scale36 = 36 / Math.max(10, mpg);
  const pts36 = ppg * scale36;
  const reb36 = rpg * scale36;
  const ast36 = apg * scale36;
  const stk36 = (spg + bpg) * scale36;

  const effScore = (fgPct - 43.0) * 0.35 + (tpPct - 33.0) * 0.25;

  let roleContribution = 0;
  if (playstyle === 'PLAYMAKER' || pos === 'PG') {
    roleContribution = ast36 * 1.45 + pts36 * 0.42 + stk36 * 1.65 + reb36 * 0.35;
  } else if (playstyle === 'STRETCH_BIG') {
    roleContribution =
      reb36 * 0.9 + stk36 * 1.7 + (tpPct - 33.5) * 0.7 + pts36 * 0.5 + ast36 * 0.55;
  } else if (playstyle === 'POST_SCORER') {
    roleContribution =
      pts36 * 0.56 + reb36 * 1.05 + stk36 * 1.6 + (fgPct - 46.0) * 0.5 + ast36 * 0.5;
  } else if (playstyle === 'RIM_PROTECTOR' || pos === 'C' || pos === 'PF') {
    roleContribution = reb36 * 1.2 + stk36 * 2.25 + pts36 * 0.42 + ast36 * 0.65;
  } else if (playstyle === 'THREE_AND_D') {
    roleContribution =
      stk36 * 2.15 + (tpPct - 34.0) * 0.8 + pts36 * 0.48 + reb36 * 0.55;
  } else {
    roleContribution = pts36 * 0.55 + reb36 * 0.65 + ast36 * 0.85 + stk36 * 1.75;
  }

  const totalImpact =
    roleContribution +
    effScore +
    (winRate - 0.48) * 14 +
    (wonDpoy || wonSixthMan || wonMvp ? 6 : 0);

  return Math.max(-4, Math.min(10, Math.round((totalImpact - 9.5) * 0.62)));
}

/**
 * 정규시즌 보조·역할별 개인 수상 평가 (DPOY · 6MOY · MIP)
 * - 주요 경쟁 수상(MVP · 신인왕 · 올스타 · 올-리그 팀)은 이중 기준을 원천 제거하고
 *   evaluateUnifiedLeagueAwards()의 단일 대칭 풀에서 리그 정원·포지션 균형·투표로 일괄 확정합니다.
 * - 우승/파이널 MVP는 정규시즌 단계에서 절대 선반영하지 않습니다.
 */
export function evaluateFluidSeasonAwards(params: {
  career: CareerState;
  role: string;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  winRate: number;
  rng: () => number;
}): {
  allStarSelected: boolean;
  wonMvp: boolean;
  allLeagueTeam: AllLeagueTier;
  wonDpoy: boolean;
  wonSixthMan: boolean;
  wonMip: boolean;
  wonRookieOfYear: boolean;
  wonChampionship: boolean;
  wonFinalsMvp: boolean;
} {
  const { career, role, gp, ppg, rpg, apg, spg, bpg, winRate, rng } = params;
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const leagueMeta = LEAGUE_BALANCE_META[career.league];

  const attendanceRatio = gp / Math.max(1, leagueConfig.games);
  const eligibleForMajorAwards = attendanceRatio >= leagueMeta.minAttendanceRatio;

  const seasonPaceFactor = 0.96 + rng() * 0.08;
  const ldrScale = leagueConfig.ldr / 78;

  const isBenchRole = role.includes('식스맨') || role.includes('로테이션');
  const dynamicSixthManBar = (9.5 + ldrScale * 4.8) * seasonPaceFactor;
  const wonSixthMan =
    eligibleForMajorAwards &&
    isBenchRole &&
    !role.includes('투웨이') &&
    ppg >= dynamicSixthManBar &&
    winRate >= 0.47;

  const prevLog =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;
  const prevImpact = prevLog
    ? prevLog.ppg + prevLog.rpg * 0.6 + prevLog.apg * 0.7
    : 999;
  const currImpact = ppg + rpg * 0.6 + apg * 0.7;
  const wonMip =
    eligibleForMajorAwards &&
    prevLog !== null &&
    prevLog.league === career.league &&
    currImpact - prevImpact >= 5.2 &&
    currImpact / Math.max(6, prevImpact) >= 1.28;

  // 주요 경쟁 수상(올스타·올리그·MVP·DPOY·신인왕)은 통합 리그 풀(evaluateUnifiedLeagueAwards)에서만 단일 확정
  return {
    allStarSelected: false,
    wonMvp: false,
    allLeagueTeam: null,
    wonDpoy: false,
    wonSixthMan,
    wonMip,
    wonRookieOfYear: false,
    wonChampionship: false,
    wonFinalsMvp: false,
  };
}

/**
 * 잠재력 한계 돌파(Potential Breakthrough) 판정
 */
export function checkPotentialBreakthrough(params: {
  career: CareerState;
  wonMip: boolean;
  wonMvp: boolean;
  wonDpoy: boolean;
  wonSixthMan: boolean;
  mpg: number;
  ppg: number;
  fgPct: number;
  nextCoachTrust: number;
  rng: () => number;
}): {
  nextPotential: number;
  breakthroughGain: number;
  reason: string | null;
} {
  const {
    career,
    wonMip,
    wonMvp,
    wonDpoy,
    mpg,
    ppg,
    fgPct,
    nextCoachTrust,
    rng,
  } = params;

  const currentPot = career.potential;
  const breakthroughCount = career.potentialBreakthroughCount || 0;

  const isProLeague =
    career.league === 'NBA' ||
    career.league === 'KBL' ||
    career.league === 'B_LEAGUE' ||
    career.league === 'NBL' ||
    career.league === 'EUROLEAGUE' ||
    career.league === 'GLEAGUE';

  if (
    !isProLeague ||
    currentPot >= 95 ||
    career.age >= 29 ||
    breakthroughCount >= 2
  ) {
    return { nextPotential: currentPot, breakthroughGain: 0, reason: null };
  }

  const isSlowStarter = (career.traits || []).includes('SLOW_STARTER');
  const per36Pts = (ppg * 36) / Math.max(12, mpg);
  const eliteProEfficiency =
    per36Pts >= 22.5 && fgPct >= 49.0 && nextCoachTrust >= 76;

  if (wonMip || wonMvp || wonDpoy) {
    const gain = Math.min(95 - currentPot, wonMip ? 2 : 1);
    if (gain > 0) {
      return {
        nextPotential: currentPot + gain,
        breakthroughGain: gain,
        reason:
          '프로 무대에서의 활약과 타이틀 수상을 발판으로 스카우팅 예상치를 뛰어넘어 성장 한계가 한 단계 상향되었습니다.',
      };
    }
  }

  const breakoutChance =
    (eliteProEfficiency ? 0.22 : 0) +
    (isSlowStarter && career.age >= 23 ? 0.14 : 0);

  if (eliteProEfficiency && rng() < breakoutChance) {
    const gain = Math.min(95 - currentPot, isSlowStarter ? 2 : 1);
    if (gain > 0) {
      return {
        nextPotential: currentPot + gain,
        breakthroughGain: gain,
        reason:
          '프로 시즌 내내 이어진 고효율 경기력으로 성장 한계를 넓히며 한 단계 더 도약할 잠재력을 깨웠습니다.',
      };
    }
  }

  return { nextPotential: currentPot, breakthroughGain: 0, reason: null };
}

export interface SimulatedSeasonResult {
  boxScore: SeasonBoxScore;
  standings: StandingEntry[];
  nextStats: PlayerStats;
  statDelta: StatDelta;
  nextOvr: number;
  nextPotential: number;
  potentialBreakthroughReason: string | null;
  nextCoachTrust: number;
  nextDraftStock: number;
  nextBadges: string[];
  nextTraits: PlayerTraitId[];
  newlyAcquiredTraitNames: string[];
  updatedRivals: RivalPlayer[];
  brokenRolePromise: boolean;
  nextRelationships: RelationshipMetrics;
}

/**
 * 한 시즌 전체 시뮬레이션 실행 (정규시즌 전용 — 포스트시즌 스포일러 0% + 양방향 생체역학 + 팀 승률 공식 통일)
 */
export function simulateSeason(
  career: CareerState,
  rng: () => number = Math.random
): SimulatedSeasonResult {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const traits = career.traits || [];
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const mismatch = calculateHeightMismatchPenalty(
    career.heightCm,
    career.primaryPos
  );

  const {
    role,
    mpg,
    gp,
    injuredGamesMissed,
    injurySeverity,
    injuryLabel,
    injuryPermanentPhyPenalty,
    veteranLoadManaged,
    basePer36,
    roleIndex,
  } = calculateRoleAndMpg(career, rng);

  let traitOffMultiplier = 1.0;
  if (traits.includes('CONTRACT_YEAR_BOOST') && career.contractYearsLeft <= 1) {
    traitOffMultiplier += 0.07;
  }
  if (traits.includes('BENCH_ACE') && (role.includes('식스맨') || role.includes('로테이션'))) {
    traitOffMultiplier += 0.06;
  }
  if (traits.includes('CLUTCH_PERFORMER') && career.team.direction === 'CONTENDER') {
    traitOffMultiplier += 0.04;
  }

  // 양방향 생체역학 공격 효율 보정 (단신 빅맨 컨테스트 저항 & 초장신 볼핸들러 드리블 노출 저항)
  const bioOffMultiplier = Math.max(
    0.58,
    1.0 +
      bio.insideFgModifier * 0.012 -
      bio.tovRatePenalty * 0.055 -
      bio.positionalPhysicsStrain * 0.18
  );

  const { ppg, offEdge } = calculatePpg(
    career.stats,
    leagueConfig.ldr,
    mpg,
    basePer36,
    rng,
    traitOffMultiplier * bioOffMultiplier
  );

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
    0.5,
    Math.min(
      16.5,
      Number(
        (
          ((mpg / 36) * posRebBase * rebEdge + (rng() * 1.0 - 0.5)) *
          bio.rebMultiplier
        ).toFixed(1)
      )
    )
  );

  // 초장신 볼핸들러(215~220cm PG/SG)의 경우 높은 무게중심과 긴 드리블 궤적으로 인해 스틸 허용/턴오버가 급증해 실효 어시스트가 깎임
  const agilityAstFactor = Math.max(
    0.45,
    1.0 + (bio.centerOfGravityAgility - 0.85) * 0.25 - bio.tovRatePenalty * 0.12
  );
  const apg = Math.max(
    0.4,
    Math.min(
      13.2,
      Number(
        (
          ((mpg / 36) * posAstBase * plyEdge + (rng() * 0.9 - 0.45)) *
          agilityAstFactor
        ).toFixed(1)
      )
    )
  );
  const spg = Math.max(
    0.2,
    Math.min(
      3.1,
      Number(
        (
          (mpg / 36) * 1.55 * defEdge +
          (rng() * 0.3 - 0.15)
        ).toFixed(1)
      )
    )
  );
  const posBlkMult =
    career.primaryPos === 'C' ? 2.25 : career.primaryPos === 'PF' ? 1.55 : 0.65;
  const bpg = Math.max(
    0.1,
    Math.min(
      3.8,
      Number(
        (
          ((mpg / 36) * posBlkMult * defEdge + (rng() * 0.25 - 0.1)) *
          bio.blkMultiplier
        ).toFixed(1)
      )
    )
  );

  const sniperBoost = traits.includes('SNIPER') ? 1.8 : 0;
  const posFgCfg = ROLE_MPG_CONFIG.positionFgBase[career.primaryPos];
  const posFgAnchor =
    (career.primaryPos === 'C' || career.primaryPos === 'PF') &&
    career.playstyle === 'STRETCH_BIG'
      ? posFgCfg.stretchBigBase
      : posFgCfg.base;
  const fgPct = Number(
    clampNum(
      posFgAnchor +
        (offEdge - 1.0) * 10.5 -
        mismatch.fgPctPenalty +
        rng() * 2.8,
      posFgCfg.min,
      posFgCfg.max
    ).toFixed(1)
  );
  const outEdge = (career.stats.out - leagueConfig.ldr) / 35;
  const tpPct = Number(
    Math.max(
      23.0,
      Math.min(
        46.5,
        33.0 +
          outEdge * 9.5 +
          sniperBoost -
          bio.positionalPhysicsStrain * 3.2 +
          rng() * 2.5
      )
    ).toFixed(1)
  );

  // 포지션·플레이성향·외곽 능력치 기반 경기당 3점슛 시도 수(tpa) 산출
  const posBaseTpa36 =
    career.primaryPos === 'C'
      ? career.playstyle === 'STRETCH_BIG'
        ? 4.2
        : career.stats.out >= 74
        ? 3.0
        : career.stats.out >= 64
        ? 1.2
        : 0.3
      : career.primaryPos === 'PF'
      ? career.playstyle === 'STRETCH_BIG'
        ? 5.0
        : career.stats.out >= 70
        ? 3.4
        : 1.5
      : career.primaryPos === 'SG'
      ? 6.4
      : career.primaryPos === 'PG'
      ? 5.6
      : 5.2;
  const styleTpaBonus =
    career.playstyle === 'THREE_AND_D' || career.playstyle === 'STRETCH_BIG'
      ? 1.1
      : career.playstyle === 'POST_SCORER' || career.playstyle === 'RIM_PROTECTOR'
      ? -0.9
      : 0;
  const rawTpa =
    (mpg / 36) *
    Math.max(
      0.1,
      posBaseTpa36 + (career.stats.out - 68) * 0.11 + styleTpaBonus + (rng() * 1.0 - 0.5)
    );
  const tpa = Number(clampNum(rawTpa, 0.1, 12.5).toFixed(1));

  const burstFactor = 1.62 + rng() * 0.52;
  const singleGameHighPts = Math.max(
    Math.ceil(ppg + 4),
    Math.min(72, Math.round(ppg * burstFactor + (career.stats.out >= 84 ? 5 : 2)))
  );

  // 🏆 팀 승패 공식 통일 (playoffEngine.ts의 AI 구단 순위표 생성 공식과 100% 대칭 파라미터 공유!)
  // - 플레이어·AI 모두 동일한 directionMod(±2.5%p) 및 컨퍼런스 일정 보정 상대 평균 사용
  // - 선수 기여도는 구단 평균이 아닌 리그별 표준 주전 기준선(playerBaselineOvr) 대비 산출해 고교·대학·KBL 에이스 캐리 복원
  // - 팀 전력 연동 수확체감 곡선으로 약팀 리빌딩 캐리 상향(최대 +20%p) & 강팀 슈퍼팀 70승 과잉 독주 완화
  const effectiveOpponentMean = getScheduleAdjustedTeamMeanRating(
    career.league,
    career.teamRatingsMap,
    career.team.conference
  );
  const dynamicTeamRating =
    career.teamRatingsMap?.[career.team.id] ?? career.team.rating;
  const directionMod =
    career.team.direction === 'CONTENDER'
      ? REGULAR_SEASON_WIN_CONFIG.contenderDirectionMod
      : career.team.direction === 'REBUILDING'
      ? REGULAR_SEASON_WIN_CONFIG.rebuildingDirectionMod
      : 0;
  const teamBaseOffset =
    (dynamicTeamRating - effectiveOpponentMean) *
      REGULAR_SEASON_WIN_CONFIG.teamRatingSlope +
    directionMod;

  const baselinePlayerOvr = LEAGUE_BALANCE_META[career.league].playerBaselineOvr;
  const rawPlayerMargin =
    (career.ovr - baselinePlayerOvr) *
    (mpg / 36) *
    REGULAR_SEASON_WIN_CONFIG.playerMarginSlope;

  // 약팀(teamBaseOffset < 0)일수록 에이스 캐리 여지가 커지고, 우승권 강팀(teamBaseOffset > 0)일수록 수확체감 적용
  const carryScale = clampNum(1.0 - teamBaseOffset * 2.1, 0.52, 1.32);
  const maxPositiveBoost = clampNum(0.145 - teamBaseOffset * 0.30, 0.09, 0.20);
  const effectivePlayerBoost =
    rawPlayerMargin >= 0
      ? Math.min(
          maxPositiveBoost,
          (rawPlayerMargin +
            (roleIndex >= 2 ? REGULAR_SEASON_WIN_CONFIG.starterSynergyBonus : 0)) *
            carryScale
        )
      : Math.max(
          REGULAR_SEASON_WIN_CONFIG.negativeMarginFloor,
          rawPlayerMargin * 0.2
        );
  const clutchWinBonus = traits.includes('CLUTCH_PERFORMER')
    ? clampNum(
        (mpg / 34) * REGULAR_SEASON_WIN_CONFIG.maxClutchWinBonus,
        0.003,
        REGULAR_SEASON_WIN_CONFIG.maxClutchWinBonus
      ) * carryScale
    : 0;
  const bioCourtDrag = bio.positionalPhysicsStrain * (mpg / 32) * 0.1;

  const winRate = clampNum(
    0.5 +
      teamBaseOffset +
      effectivePlayerBoost -
      bioCourtDrag +
      clutchWinBonus +
      (rng() - 0.5) * (REGULAR_SEASON_WIN_CONFIG.playerRandomHalfSpread * 2),
    REGULAR_SEASON_WIN_CONFIG.minWinPct,
    REGULAR_SEASON_WIN_CONFIG.maxWinPct
  );
  const wins = Math.max(1, Math.min(leagueConfig.games - 1, Math.round(leagueConfig.games * winRate)));
  const losses = leagueConfig.games - wins;

  // 리그 전체 정규시즌 순위표 생성 및 플레이오프 진출 판정
  const standings = generateLeagueStandings(career, wins, losses, rng);
  const myStanding =
    standings.find((s) => s.isPlayerTeam) || standings[standings.length - 1];
  const teamRank = myStanding ? myStanding.rank : 1;
  const totalLeagueTeams = standings.length;
  const qualifiedPlayoffs = Boolean(myStanding?.qualifiedPlayoffs);
  const playInQualified = Boolean(myStanding?.playInQualified);

  // 1) 정규시즌 보조 수상(DPOY · 6MOY · MIP) 판정
  const awards = evaluateFluidSeasonAwards({
    career,
    role,
    gp,
    mpg,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    winRate,
    rng,
  });

  // 정규시즌 종료 시점에는 오직 'PO 진출', '플레이인 진출', 또는 'PO 탈락'만 기록 (포스트시즌 결과 스포일러 원천 차단!)
  const playoffResult = playInQualified
    ? '플레이인 진출'
    : qualifiedPlayoffs
    ? 'PO 진출'
    : 'PO 탈락';

  const salaryEarned =
    career.annualSalary > 0
      ? career.annualSalary
      : getContractDefaultSalary(career.contractType, career.ovr);

  const baseBoxScore: SeasonBoxScore = {
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
    injurySeverity,
    injuryLabel,
    injuryPermanentPhyPenalty:
      injuryPermanentPhyPenalty > 0 ? injuryPermanentPhyPenalty : undefined,
    mpg,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    fgPct,
    tpPct,
    tpa,
    wins,
    losses,
    teamRank,
    totalLeagueTeams,
    playoffResult,
    salaryEarned,
    wonChampionship: false,
    wonMvp: false,
    wonFinalsMvp: false,
    wonDpoy: awards.wonDpoy,
    wonSixthMan: awards.wonSixthMan,
    wonMip: awards.wonMip,
    wonRookieOfYear: false,
    allStarSelected: false,
    allLeagueTeam: null,
    singleGameHighPts,
    headline: '',
    narrativeLog: [],
    isFarewellTour: career.isFarewellTour,
  };

  // 2) 라이벌 시즌 스탯 산출 (동일 리그는 아래 통합 풀에서, 타 리그는 해당 리그 대칭 풀에서 확정)
  const {
    updatedRivals: preAwardRivals,
    rivalNarrative,
    rivalSeasonStats,
  } = simulateRivalsSeason(
    career.rivals,
    career.seasonYear,
    baseBoxScore,
    rng,
    career.teamRatingsMap
  );

  // 3) 통합 리그 수상 경쟁 풀 (Single Source of Truth: 주인공 + 라이벌 + 구단별 NPC 주전 풀)
  //    - MVP / ROY: 단일 투표 점수 1위 확정
  //    - 올스타 / 올-리그 팀: 리그별 정원(Quota) + 포지션 균형 배분
  //    - 명시적 정책(mvpGuaranteesAllStarAndFirstTeam): MVP 수상자는 올스타·퍼스트팀 보장
  //    - 동일 리그 라이벌 누적 수상(mvps/allStars/roys)까지 동일 풀 결과로 동기화
  const isRookieSeasonEligible = isEligibleForLeagueRookieAward(career);
  const awardRaces = evaluateUnifiedLeagueAwards({
    career,
    boxScore: baseBoxScore,
    standings,
    updatedRivals: preAwardRivals,
    rivalSeasonStats,
    isRookieSeason: isRookieSeasonEligible,
    rng,
  });

  awards.wonMvp = awardRaces.playerWonMvp;
  awards.wonDpoy = awardRaces.playerWonDpoy;
  awards.allStarSelected = awardRaces.playerAllStarSelected;
  awards.allLeagueTeam = awardRaces.playerAllLeagueTeam;
  awards.wonRookieOfYear = isRookieSeasonEligible ? awardRaces.playerWonRoy : false;

  const updatedRivals = awardRaces.syncedRivals;

  // 4) 최종 확정된 수상 결과를 반영해 시즌 헤드라인 & 서사 로그 생성 (수상·헤드라인 100% 일치)
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
    wonChampionship: false,
    wonMvp: awards.wonMvp,
    allStarSelected: awards.allStarSelected,
    isFarewellTour: career.isFarewellTour,
    isRookie: isRookieSeasonEligible,
    priorMvpsCount: career.totals.mvps,
  };

  const headline = generateSeasonHeadline(headlineCtx);
  const narrativeLog = generateSeasonNarrativeLogs(headlineCtx, FAREWELL_TOUR_LOGS);

  const hasConferenceStandings =
    career.league === 'NBA' ||
    career.league === 'GLEAGUE' ||
    career.league === 'B_LEAGUE';
  const rankDisplay =
    hasConferenceStandings && myStanding?.conference
      ? `${myStanding.conference === 'EAST' ? '동부' : '서부'} ${
          myStanding.conferenceRank ?? teamRank
        }위 (전체 ${teamRank}위)`
      : `전체 ${totalLeagueTeams}개 구단 중 정규 ${teamRank}위`;

  narrativeLog.unshift(
    `정규시즌 순위 · ${career.team.name} ${wins}승 ${losses}패 (${leagueConfig.shortName} ${rankDisplay} · ${playoffResult})`
  );

  if (mismatch.isSevereMismatch) {
    narrativeLog.push(
      `포지션 신장 부담 · ${career.heightCm}cm 신장으로 ${career.primaryPos} 포지션을 소화하며 매치업 효율에 부담이 있었습니다.`
    );
  }
  if (injuredGamesMissed > 0) {
    if (injurySeverity === 'MAJOR') {
      narrativeLog.push(
        `장기 중상 (${injuryLabel || '장기 부상'}) · 반시즌 이상(${injuredGamesMissed}경기) 결장하며 시즌에 큰 타격을 입었습니다.`
      );
      if (injuryPermanentPhyPenalty > 0) {
        narrativeLog.push(
          `중상 후유증 · 30대 이후 장기 부상의 여파로 운동능력(PHY -${injuryPermanentPhyPenalty}${
            career.age >= 34 ? ', DEF -1' : ''
          })이 영구적으로 저하되었습니다.`
        );
      }
    } else if (injurySeverity === 'MODERATE') {
      narrativeLog.push(
        `중등도 부상 (${injuryLabel || '근육 부상'}) · 재활 치료로 ${injuredGamesMissed}경기에 결장했습니다.`
      );
    } else {
      narrativeLog.push(
        `경미한 부상 (${injuryLabel || '잔부상'}) · ${injuredGamesMissed}경기 결장 후 복귀했습니다.`
      );
    }
  } else if (veteranLoadManaged) {
    narrativeLog.push(
      `노장 로드매니지먼트 · 구단과 협의해 백투백 휴식 및 출전시간 조절(${mpg.toFixed(
        1
      )}분 · ${gp}경기)을 병행했습니다.`
    );
  }
  if (awards.wonDpoy) {
    narrativeLog.push(
      `수상 · ${leagueConfig.shortName} 올해의 수비수(DPOY)에 선정되었습니다.`
    );
  }
  if (awards.wonSixthMan) {
    narrativeLog.push(
      `수상 · 올해의 식스맨상(6MOY)에 선정되었습니다.`
    );
  }
  if (awards.wonMip) {
    narrativeLog.push(
      `수상 · 기량발전상(MIP)에 선정되었습니다.`
    );
  }
  if (awards.allLeagueTeam) {
    narrativeLog.push(
      `수상 · 올-${leagueConfig.shortName} ${
        awards.allLeagueTeam === 1
          ? '퍼스트'
          : awards.allLeagueTeam === 2
          ? '세컨드'
          : '서드'
      } 팀에 선정되었습니다.`
    );
  }

  // 구단 역할 약속(Role Promise) 위반 여부 판정 (프로 비군인 계약 전용 — 고교·대학·상무 제외)
  const canEvaluateRolePromise = canUseProTradeSystem({
    league: career.league,
    contractType: career.contractType,
    isMilitaryTeam: career.team.isMilitaryTeam,
    teamId: career.team.id,
  });
  const brokenRolePromise = Boolean(
    canEvaluateRolePromise &&
      ((career.promisedRole === 'ACE_FIRST_OPTION' && mpg < 23.0) ||
        (career.promisedRole === 'STARTER_GUARANTEE' && mpg < 19.0))
  );
  if (brokenRolePromise) {
    narrativeLog.push(
      `역할 미이행 · 약속 역할 대비 출전 시간(${mpg.toFixed(
        1
      )}분)이 줄어 트레이드 요청이 가능합니다.`
    );
  }
  if (rivalNarrative) {
    narrativeLog.push(rivalNarrative);
  }
  if (awardRaces.mvpRaceNarrative) {
    narrativeLog.push(`MVP 투표 · ${awardRaces.mvpRaceNarrative}`);
  }
  if (awardRaces.royRace && awardRaces.royRaceNarrative) {
    narrativeLog.push(`신인왕 투표 · ${awardRaces.royRaceNarrative}`);
  }

  const boxScore: SeasonBoxScore = {
    ...baseBoxScore,
    wonMvp: awards.wonMvp,
    wonDpoy: awards.wonDpoy,
    wonRookieOfYear: awards.wonRookieOfYear,
    allStarSelected: awards.allStarSelected,
    allLeagueTeam: awards.allLeagueTeam,
    headline,
    narrativeLog,
    mvpRace: awardRaces.mvpRace,
    mvpRaceNarrative: awardRaces.mvpRaceNarrative,
    playerMvpRank: awardRaces.playerMvpRank,
    ...(awardRaces.royRace
      ? {
          royRace: awardRaces.royRace,
          royRaceNarrative: awardRaces.royRaceNarrative,
          playerRoyRank: awardRaces.playerRoyRank,
        }
      : {}),
  };

  // 능력치 성장/노쇠화 적용 (신장 대비 포지션 물리 상한선 + 30대+ 장기 중상 영구 후유증 반영)
  const { nextStats, delta: statDelta } = calculateSeasonStatGrowth(
    career,
    mpg,
    rng,
    injuredGamesMissed,
    {
      phyPenalty: injuryPermanentPhyPenalty,
      secondaryPenalty:
        injuryPermanentPhyPenalty > 0 && career.age >= 34
          ? ROLE_MPG_CONFIG.injury.majorAftermath.secondaryDrop34Plus
          : 0,
      currentSeasonMinutes: Math.round(gp * mpg),
    }
  );
  const nextOvr = calculateOvr(nextStats, career.primaryPos, career.heightCm);

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
    wonDpoy: awards.wonDpoy,
    wonSixthMan: awards.wonSixthMan,
    wonMvp: awards.wonMvp,
  });
  const franchiseHeartTrustBonus = traits.includes('FRANCHISE_HEART') ? 2 : 0;
  const nextCoachTrust = Math.max(
    15,
    Math.min(100, career.coachTrust + trustChange + franchiseHeartTrustBonus)
  );

  // 잠재력 한계 돌파(Potential Breakthrough) 체크 (프로 리그 한정)
  const breakthrough = checkPotentialBreakthrough({
    career,
    wonMip: awards.wonMip,
    wonMvp: awards.wonMvp,
    wonDpoy: awards.wonDpoy,
    wonSixthMan: awards.wonSixthMan,
    mpg,
    ppg,
    fgPct,
    nextCoachTrust,
    rng,
  });
  if (breakthrough.reason) {
    boxScore.narrativeLog.push(`잠재력 한계 돌파 · ${breakthrough.reason}`);
  }

  // 후천적 특성(Acquired Traits) 발현 심사
  const { nextTraits, newlyAcquired } = evaluateAcquiredTraits(career, boxScore);
  for (const acq of newlyAcquired) {
    boxScore.narrativeLog.push(
      `신규 특성 획득 · ${acq.name}`
    );
  }

  const stockBoost =
    (ppg * 1.05 + rpg * 0.42 + apg * 0.5 + (spg + bpg) * 1.2) *
      leagueConfig.prestige +
    (awards.wonMvp ? 14 : 0) +
    (awards.wonDpoy ? 8 : 0) -
    mismatch.scoutingPenalty * 0.4;
  const nextDraftStock = Math.max(
    10,
    Math.min(100, Math.round(career.draftStock * 0.42 + stockBoost))
  );

  const nextBadges = evaluatePlayerBadges(
    nextStats,
    career.secondaryPos,
    career.growthDna,
    career.playstyle,
    nextTraits,
    career.primaryPos
  );

  // 4축 관계도 자연 갱신
  const prevRelationships = getEffectiveRelationships(career);
  const lockerDelta =
    (winRate >= 0.58 ? 3 : winRate < 0.36 ? -2 : 1) +
    (apg >= 6.0 ? 2 : 0) +
    (awards.wonSixthMan ? 3 : 0);
  const frontOfficeDelta =
    (qualifiedPlayoffs ? 3 : -1) +
    (awards.wonMvp || awards.allStarSelected ? 4 : 0) -
    (brokenRolePromise ? 6 : 0);
  const mediaDelta =
    (awards.wonMvp ? 8 : awards.allStarSelected ? 5 : ppg >= 20 ? 3 : 1) +
    ((career.activePersonalCare || []).includes('SIGNATURE_SNEAKER_MARKETING') ? 4 : 0);
  const nextRelationships: RelationshipMetrics = {
    coachTrust: nextCoachTrust,
    lockerRoom: clampNum(prevRelationships.lockerRoom + lockerDelta, 15, 100),
    frontOffice: clampNum(prevRelationships.frontOffice + frontOfficeDelta, 15, 100),
    mediaFan: clampNum(prevRelationships.mediaFan + mediaDelta, 15, 100),
  };

  return {
    boxScore,
    standings,
    nextStats,
    statDelta,
    nextOvr,
    nextPotential: breakthrough.nextPotential,
    potentialBreakthroughReason: breakthrough.reason,
    nextCoachTrust,
    nextDraftStock,
    nextBadges,
    nextTraits,
    newlyAcquiredTraitNames: newlyAcquired.map((t) => t.name),
    updatedRivals,
    brokenRolePromise,
    nextRelationships,
  };
}
