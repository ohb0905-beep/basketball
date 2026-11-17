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
  LeagueAwardSummary,
  LeagueId,
  PlayerStats,
  PlayerTraitId,
  PlaystyleArchetype,
  Position,
  RivalPlayer,
  RolePromiseType,
  SeasonBoxScore,
  StandingEntry,
  StatDelta,
  TrainingFocus,
} from '../types/game';
import {
  generateLeagueStandings,
  getPlayoffCutoffByLeague,
} from './playoffEngine';
import { applyAgingCurve } from './retirementEngine';
import {
  calculateBiomechanicalProfile,
  calculateHeightMismatchPenalty,
  calculateOvr,
  enforceBiomechanicalCaps,
  evaluateAcquiredTraits,
  evaluatePlayerBadges,
  getBiomechanicalGrowthElasticity,
} from './statCalculator';

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

const AWARD_LEAGUE_PRIORITY: LeagueId[] = [
  'NBA',
  'KBL',
  'OVERSEAS',
  'GLEAGUE',
  'NCAA',
  'U_LEAGUE',
  'HIGH_SCHOOL',
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
  basePer36: number;
}

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
      return 8000;
    case 'KBL_ROOKIE':
      return 55000 + Math.max(0, ovr - 58) * 3500;
    case 'KBL_VET':
      return 120000 + Math.max(0, ovr - 65) * 8000;
    case 'KBL_MAX':
      return 380000 + Math.max(0, ovr - 72) * 24000;
    case 'OVERSEAS_CONTRACT':
      return 450000 + Math.max(0, ovr - 70) * 38000;
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

/**
 * 절차적(Procedural) 음절 조합 라이벌 이름 생성기 (실존 선수/만화 캐릭터 이름 0%)
 */
const KR_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황'];
const KR_SYLLABLE_A = ['도', '시', '주', '민', '서', '지', '건', '태', '승', '현', '재', '성', '우', '준', '연', '하'];
const KR_SYLLABLE_B = ['훈', '우', '원', '혁', '빈', '호', '영', '찬', '결', '율', '환', '진', '석', '규', '민', '성'];

const EN_FIRST_A = ['Mar', 'Jay', 'De', 'Ty', 'Tre', 'Ka', 'Zay', 'Bran', 'Co', 'Da', 'Ke', 'La', 'Sha', 'Mal', 'Quin'];
const EN_FIRST_B = ['cus', 'len', 'vin', 'rese', 'von', 'lik', 'den', 'don', 'by', 'rius', 'gan', 'elo', 'ed', 'colm', 'ton'];
const EN_LAST_A = ['Vaughn', 'Mercer', 'Calloway', 'Sterling', 'Hawkins', 'Thornton', 'Prescott', 'Langford', 'Kessler', 'Bates', 'Hollis', 'Granger', 'redick', 'Rowe', 'Sutton'];

export function generateProceduralPlayerName(
  league: LeagueId,
  rng: () => number = Math.random
): string {
  if (league === 'KBL' || league === 'HIGH_SCHOOL' || league === 'U_LEAGUE') {
    const s = KR_SURNAMES[Math.floor(rng() * KR_SURNAMES.length)];
    const a = KR_SYLLABLE_A[Math.floor(rng() * KR_SYLLABLE_A.length)];
    const b = KR_SYLLABLE_B[Math.floor(rng() * KR_SYLLABLE_B.length)];
    return `${s}${a}${b}`;
  }
  const f1 = EN_FIRST_A[Math.floor(rng() * EN_FIRST_A.length)];
  const f2 = EN_FIRST_B[Math.floor(rng() * EN_FIRST_B.length)];
  const l = EN_LAST_A[Math.floor(rng() * EN_LAST_A.length)];
  const capLast = l.charAt(0).toUpperCase() + l.slice(1);
  return `${f1}${f2} ${capLast}`;
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
      lastHeadline: `${career.seasonYear} 드래프트 동기 라이벌로 ${team.shortName}에 입단했어요.`,
    });
  }

  return rivals;
}

/**
 * 매 시즌 드래프트 동기 & 리그 라이벌들의 성적/성장/이적 시뮬레이션
 */
export function simulateRivalsSeason(
  rivals: RivalPlayer[] | undefined,
  seasonYear: number,
  playerBox: SeasonBoxScore,
  rng: () => number = Math.random
): { updatedRivals: RivalPlayer[]; rivalNarrative: string | null } {
  if (!rivals || rivals.length === 0) {
    return { updatedRivals: [], rivalNarrative: null };
  }

  let rivalNarrative: string | null = null;
  const updatedRivals = rivals.map((r, idx) => {
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
    const mpg = Math.max(18, Math.min(36.5, 24 + edge * 10 + (rng() * 4 - 2)));
    const ppg = Number(
      Math.max(7.5, Math.min(31.5, (mpg / 36) * (17.5 + edge * 9.5) + (rng() * 2.6 - 1.3))).toFixed(1)
    );
    const rpgBase = r.pos === 'C' || r.pos === 'PF' ? 8.8 : 4.4;
    const apgBase = r.pos === 'PG' ? 7.6 : r.pos === 'SG' || r.pos === 'SF' ? 4.2 : 2.6;
    const rpg = Number(Math.max(2.0, (mpg / 36) * rpgBase * (1 + edge * 0.25) + (rng() - 0.5)).toFixed(1));
    const apg = Number(Math.max(1.2, (mpg / 36) * apgBase * (1 + edge * 0.25) + (rng() - 0.5)).toFixed(1));

    const rivalImpact = ppg + rpg * 0.72 + apg * 0.9;
    const isAllStar = rivalImpact >= (r.league === 'NBA' ? 30.5 : 24.5);
    const wonRoy =
      seasonsSinceDraft === 0 &&
      !playerBox.wonRookieOfYear &&
      idx === 0 &&
      ppg >= 13.0;
    const wonMvp =
      !playerBox.wonMvp &&
      isAllStar &&
      rivalImpact >= (r.league === 'NBA' ? 41.5 : 32.5) &&
      rng() < 0.35;

    const headline = `${r.teamShortName}의 동기 라이벌 ${r.name}(${r.pos}, OVR ${nextOvr}) 선수가 이번 시즌 평균 ${ppg}점 ${rpg}리바운드 ${apg}도움을 기록했어요!`;
    if (idx === 0 && r.league === playerBox.league) {
      const diffPpg = (playerBox.ppg - ppg).toFixed(1);
      rivalNarrative = `⚔️ [라이벌 매치업] 드래프트 동기 ${r.name}(${r.teamShortName}) 선수는 평균 ${ppg}점·${rpg}리바운드·${apg}도움을 기록했어요 (내 득점 대비 ${
        Number(diffPpg) >= 0 ? `+${diffPpg}` : diffPpg
      }점).`;
    }

    return {
      ...r,
      ovr: nextOvr,
      ppg,
      rpg,
      apg,
      allStars: r.allStars + (isAllStar ? 1 : 0),
      roys: r.roys + (wonRoy ? 1 : 0),
      mvps: r.mvps + (wonMvp ? 1 : 0),
      lastHeadline: headline,
    };
  });

  return { updatedRivals, rivalNarrative };
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
    stats?: Pick<PlayerStats, 'phy'>;
    primaryPos?: Position;
    growthDna?: GrowthDna;
    traits?: PlayerTraitId[];
    promisedRole?: RolePromiseType;
    draftPedigreePick?: number | null;
    draftPedigreeRound?: 1 | 2 | null;
    draftPedigreeSeasonsLeft?: number;
    seasonLogs?: SeasonBoxScore[];
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

  // 구단 역할 약속(Role Promise) 보정 (단, 감독 신뢰도가 35 미만으로 추락하면 약속이 깨질 수 있음)
  const trustHonorsPromise = career.coachTrust >= 38;
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
      pedigreeBonus = pick <= 3 ? 14.5 : pick <= 6 ? 11.5 : 9.0;
    } else if (career.league === 'NBA') {
      pedigreeBonus = pick <= 5 ? 15.0 : pick <= 14 ? 12.0 : 9.0;
    }
  } else if (pedigreeSeasonsLeft > 0 && round === 2) {
    pedigreeBonus = 3.5;
  }

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
      efficiencyMomentum
    ).toFixed(2)
  );

  if (career.contractType === 'TWO_WAY') {
    const gp = Math.min(50, Math.round(18 + rng() * 24));
    const role = '투웨이 콜업 로테이션';
    const effBoostMpg = Math.max(0, efficiencyMomentum * 0.9);
    const mpg = Number(
      Math.min(
        24.5,
        8.5 + Math.max(0, (career.ovr - (leagueConfig.ldr - 14)) * 1.1) + effBoostMpg
      ).toFixed(1)
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

  if (isFirstRoundPedigree && roleIndex < 7 && rawOvrDiff < 2) {
    const isTopLottery =
      pick !== null && (career.league === 'KBL' ? pick <= 3 : pick <= 10);
    role = isTopLottery
      ? '주전급 코어 유망주 (1라운드 픽)'
      : '핵심 유망주 로테이션 (1라운드 픽)';
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

  // 부상 리스크 계산 (PHY, 출전시간, 철강왕 DNA, 고유 특성 '강철 체력' / '유리몸' 모두 반영)
  const phy = career.stats?.phy ?? 65;
  const dna = career.growthDna || 'STANDARD';
  const traits = career.traits || [];
  let injuredGamesMissed = 0;

  const lowPhyRisk = Math.max(0.02, (72 - phy) * 0.008);
  const highMpgRisk = Math.max(0, (mpg - 28.0) * 0.015);
  let injuryMult = dna === 'IRONMAN' ? 0.45 : 1.0;
  if (traits.includes('IRON_STAMINA')) injuryMult *= 0.4;
  if (traits.includes('GLASS_BODY')) injuryMult *= 1.65;

  if (rng() < (lowPhyRisk + highMpgRisk) * injuryMult) {
    const maxMiss = Math.max(3, Math.round(leagueConfig.games * 0.28));
    injuredGamesMissed = Math.max(
      2,
      Math.min(maxMiss, Math.round(3 + rng() * (maxMiss - 2)))
    );
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
  const attackStat = stats.ins * 0.52 + stats.out * 0.48;
  const diff = attackStat - ldr;
  const offEdge =
    (diff >= 0
      ? Math.max(0.28, 1.0 + diff / 33)
      : Math.max(0.28, 1.0 + diff / 26)) * traitMultiplier;

  const rawPpg = (mpg / 36) * basePer36 * offEdge + (rng() * 1.8 - 0.9);
  const finalPpg = rawPpg > 25.0 ? 25.0 + (rawPpg - 25.0) * 0.35 : rawPpg;
  const ppg = Math.max(1.2, Math.min(34.5, Number(finalPpg.toFixed(1))));

  return { ppg, offEdge, rawPpg };
}

/**
 * 선수 고유 성장 곡선 DNA 및 특성(슬로우 스타터 등)이 반영된 시즌 성장 및 에이징 수식
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
  },
  mpg: number,
  rng: () => number = Math.random,
  injuredGamesMissed: number = 0
): { nextStats: PlayerStats; delta: StatDelta } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const prev = career.stats;
  const dna: GrowthDna = career.growthDna || 'STANDARD';
  const traits = career.traits || [];
  const isSlowStarter = traits.includes('SLOW_STARTER');
  const heightCm = career.heightCm ?? 195;
  const primaryPos = career.primaryPos ?? 'SG';

  const applyBioCap = (rawNext: PlayerStats): { nextStats: PlayerStats; delta: StatDelta } => {
    const capped = enforceBiomechanicalCaps(rawNext, heightCm, primaryPos);
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

  const maxGrowthAge =
    dna === 'LATE_BLOOMER' || isSlowStarter
      ? 29
      : dna === 'EARLY_BLOOMER'
      ? 26
      : 27;

  if (career.age <= maxGrowthAge) {
    // 연속적 출전 시간 계수
    const ptFactor = Math.max(0.48, Math.min(1.22, 0.42 + (mpg / 30) * 0.75));
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
      Math.min(1.0, 1.0 - Math.max(0, career.ovr - 76) * 0.038)
    );

    const injuryFactor = Math.max(0.62, 1.0 - injuredGamesMissed * 0.018);

    let ageMultiplier = 0.85;
    if (dna === 'EARLY_BLOOMER') {
      ageMultiplier = career.age <= 21 ? 1.32 : career.age <= 24 ? 1.05 : 0.62;
    } else if (dna === 'LATE_BLOOMER' || isSlowStarter) {
      ageMultiplier = career.age <= 21 ? 0.92 : career.age <= 26 ? 1.15 : 0.98;
    } else {
      ageMultiplier = career.age <= 20 ? 1.12 : career.age <= 23 ? 0.96 : 0.74;
    }

    const baseGain =
      1.72 *
      ptFactor *
      capPenalty *
      potPenalty *
      highOvrWall *
      injuryFactor *
      ageMultiplier;

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

    return applyBioCap(nextStats);
  }

  const primeEndAge =
    dna === 'IRONMAN'
      ? 31
      : dna === 'LATE_BLOOMER' || isSlowStarter
      ? 30
      : dna === 'EARLY_BLOOMER'
      ? 28
      : 29;

  if (career.age <= primeEndAge) {
    const nextStats: PlayerStats = { ...prev };
    if (
      career.ovr < leagueConfig.growthCap &&
      career.ovr < career.potential &&
      rng() < 0.58
    ) {
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
      }
    }
    return applyBioCap(nextStats);
  }

  const careerMinutes = career.totals ? career.totals.gp * 24 : 15000;
  const aged = applyAgingCurve(career.age, prev, rng, {
    growthDna: dna,
    careerMinutes,
  });
  return applyBioCap(aged.nextStats);
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
 * 유동적 시즌 수상 알고리즘 (정규시즌 전용 — 우승/파이널 MVP 선반영 스포일러 원천 차단!)
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
  const { career, role, gp, mpg, ppg, rpg, apg, spg, bpg, winRate, rng } = params;
  const leagueConfig = LEAGUE_CONFIG[career.league];

  const attendanceRatio = gp / Math.max(1, leagueConfig.games);
  const eligibleForMajorAwards = attendanceRatio >= 0.67;

  const seasonPaceFactor = 0.96 + rng() * 0.08;
  const ldrScale = leagueConfig.ldr / 78;

  const sameLeagueRivals = (career.rivals || []).filter(
    (r) => r.league === career.league
  );
  const topRivalImpact =
    sameLeagueRivals.length > 0
      ? Math.max(...sameLeagueRivals.map((r) => r.ppg + r.rpg * 0.72 + r.apg * 0.9))
      : 0;

  const dynamicAllStarBar = Math.max(
    22.0,
    (21.5 + ldrScale * 9.5) * seasonPaceFactor
  );
  const dynamicMvpBar = Math.max(
    dynamicAllStarBar + 6.5,
    (29.5 + ldrScale * 11.8) * seasonPaceFactor,
    topRivalImpact * 0.96
  );

  const defenseImpact =
    spg * 2.6 + bpg * 2.8 + Math.max(0, career.stats.def - leagueConfig.ldr) * 0.22;
  const perfScore =
    ppg +
    rpg * 0.72 +
    apg * 0.9 +
    defenseImpact +
    Math.max(0, winRate - 0.5) * 12;

  const allStarSelected =
    eligibleForMajorAwards && perfScore >= dynamicAllStarBar;
  const wonMvp =
    allStarSelected && perfScore >= dynamicMvpBar && winRate >= 0.56;

  let allLeagueTeam: AllLeagueTier = null;
  if (eligibleForMajorAwards) {
    if (perfScore >= dynamicMvpBar * 0.95) {
      allLeagueTeam = 1;
    } else if (perfScore >= (dynamicAllStarBar + dynamicMvpBar) * 0.5) {
      allLeagueTeam = 2;
    } else if (perfScore >= dynamicAllStarBar) {
      allLeagueTeam = 3;
    }
  }

  const dpoyScore =
    career.stats.def * 0.55 +
    spg * 7.5 +
    bpg * 8.5 +
    rpg * 0.8 +
    winRate * 15;
  const dynamicDpoyBar = (leagueConfig.ldr * 0.82 + 8.0) * seasonPaceFactor;
  const wonDpoy =
    eligibleForMajorAwards &&
    career.stats.def >= leagueConfig.ldr + 3 &&
    dpoyScore >= dynamicDpoyBar &&
    winRate >= 0.51;

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

  const hadPreviousSeasonInLeague = career.seasonLogs.some(
    (l) => l.league === career.league
  );
  const dynamicRoyBar = (11.0 + ldrScale * 3.5) * seasonPaceFactor;
  const wonRookieOfYear =
    !hadPreviousSeasonInLeague &&
    eligibleForMajorAwards &&
    ppg >= dynamicRoyBar &&
    mpg >= 20.0;

  // 🚨 [스포일러 원천 차단] 정규시즌 시뮬레이션 시점에는 절대로 우승(wonChampionship)이나 파이널 MVP(wonFinalsMvp)를 선반영하지 않음!
  const wonChampionship = false;
  const wonFinalsMvp = false;

  return {
    allStarSelected,
    wonMvp,
    allLeagueTeam,
    wonDpoy,
    wonSixthMan,
    wonMip,
    wonRookieOfYear,
    wonChampionship,
    wonFinalsMvp,
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
    career.league === 'OVERSEAS' ||
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
        reason: `프로 무대에서 피나는 노력과 타이틀 수상으로 스카우트들이 평가하던 성장 한계를 깨부수고 잠재력 상한선이 ${
          currentPot + gain
        }(+${gain})로 돌파되었어요!`,
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
        reason: `프로 시즌 내내 보여준 리그 최상위권 고효율 퍼포먼스로 잠재력 한계 돌파(Breakthrough)에 성공해 잠재력이 ${
          currentPot + gain
        }(+${gain})로 확장되었어요!`,
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

  const { role, mpg, gp, injuredGamesMissed, basePer36, roleIndex } =
    calculateRoleAndMpg(career, rng);

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
      Number(((mpg / 36) * 1.55 * defEdge + (rng() * 0.3 - 0.15)).toFixed(1))
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
  const fgPct = Number(
    Math.max(
      31.5,
      Math.min(
        64.5,
        42.5 + (offEdge - 1.0) * 11.5 - mismatch.fgPctPenalty + rng() * 3.0
      )
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

  const burstFactor = 1.62 + rng() * 0.52;
  const singleGameHighPts = Math.max(
    Math.ceil(ppg + 4),
    Math.min(72, Math.round(ppg * burstFactor + (career.stats.out >= 84 ? 5 : 2)))
  );

  // 🏆 팀 승패 공식 통일 (playoffEngine.ts의 AI 구단 순위표 생성 공식과 100% 동일한 리그 평균 구단 전력 기준선 사용!)
  // - 신인/벤치 선수가 강팀(예: 보스턴 92, 덴버 90)으로 이적했다고 해서 우승후보가 24위로 추락하는 버그를 원천 해결!
  // - 선수가 리그 평균 이상이면 팀 승률 보너스를 주고, 신인/벤치일 때는 기존 주전 로스터가 팀 승률을 방어(-0.015 하한)하되,
  //   생체역학 미스매치(168cm C, 220cm PG 등)를 고집하면 코트 마진이 하락함.
  const leagueMeanRating = getLeagueBaselineTeamRating(
    career.league,
    career.teamRatingsMap
  );
  const dynamicTeamRating =
    career.teamRatingsMap?.[career.team.id] ?? career.team.rating;
  const directionMod =
    career.team.direction === 'CONTENDER'
      ? 0.055
      : career.team.direction === 'REBUILDING'
      ? -0.055
      : 0;
  const clutchWinBonus = traits.includes('CLUTCH_PERFORMER') ? 0.025 : 0;

  const rawPlayerMargin = (career.ovr - leagueMeanRating) * (mpg / 36) * 0.0085;
  const effectivePlayerBoost =
    rawPlayerMargin >= 0
      ? Math.min(0.14, rawPlayerMargin + (roleIndex >= 2 ? 0.02 : 0))
      : Math.max(-0.015, rawPlayerMargin * 0.2);
  const bioCourtDrag = bio.positionalPhysicsStrain * (mpg / 32) * 0.1;

  const winRate = Math.max(
    0.16,
    Math.min(
      0.86,
      0.5 +
        (dynamicTeamRating - leagueMeanRating) * 0.022 +
        directionMod +
        effectivePlayerBoost -
        bioCourtDrag +
        clutchWinBonus +
        (rng() - 0.5) * 0.09
    )
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

  // 유동적 정규시즌 수상 판정 (우승/파이널 MVP는 절대 선반영하지 않음)
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

  // 정규시즌 종료 시점에는 오직 'PO 진출' 또는 'PO 탈락'만 기록 (포스트시즌 결과 스포일러 원천 차단!)
  const playoffResult = qualifiedPlayoffs ? 'PO 진출' : 'PO 탈락';

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
    wonChampionship: false,
    wonMvp: awards.wonMvp,
    allStarSelected: awards.allStarSelected,
    isFarewellTour: career.isFarewellTour,
  };

  const headline = generateSeasonHeadline(headlineCtx);
  const narrativeLog = generateSeasonNarrativeLogs(headlineCtx, FAREWELL_TOUR_LOGS);

  const rankDisplay =
    career.league === 'NBA' && myStanding?.conference
      ? `${myStanding.conference === 'EAST' ? '동부' : '서부'} ${
          myStanding.conferenceRank ?? teamRank
        }위 (전체 ${teamRank}위)`
      : `전체 ${totalLeagueTeams}개 구단 중 정규 ${teamRank}위`;

  narrativeLog.unshift(
    `📊 [정규시즌 순위] ${career.team.name}, ${wins}승 ${losses}패로 ${leagueConfig.shortName} ${rankDisplay} 기록 (${playoffResult})`
  );

  if (mismatch.isSevereMismatch) {
    narrativeLog.push(
      `⚠️ [생체역학 물리 부하 경고] ${career.heightCm}cm의 신장으로 ${career.primaryPos} 포지션을 소화하며 실전 매치업 효율(야투율, 턴오버, 골밑/외곽 수비)에서 물리적 열세를 겪었어요.`
    );
  }
  if (injuredGamesMissed > 0) {
    narrativeLog.push(
      `🩺 시즌 중 컨디션 저하와 잔부상이 겹치며 ${injuredGamesMissed}경기에 결장해 아쉬움을 남겼어요.`
    );
  }
  if (awards.wonDpoy) {
    narrativeLog.push(
      `🛡️ 질식 수비와 림 프로텍팅을 인정받아 ${leagueConfig.shortName} 올해의 수비수(DPOY) 트로피를 거머쥐었어요!`
    );
  }
  if (awards.wonSixthMan) {
    narrativeLog.push(
      `⚡ 벤치에서 코트 분위기를 뒤바꾸는 맹활약으로 올해의 식스맨상(6MOY)을 수상했어요!`
    );
  }
  if (awards.wonMip) {
    narrativeLog.push(
      `📈 지난 시즌 대비 눈부신 스텝업을 이뤄내며 기량발전상(MIP)의 주인공이 되었어요!`
    );
  }
  if (awards.wonFinalsMvp) {
    narrativeLog.push(
      `👑 챔피언십 시리즈에서 가장 빛난 별로 선정되어 파이널 MVP(FMVP)까지 석권했어요!`
    );
  }
  if (awards.allLeagueTeam) {
    narrativeLog.push(
      `🏅 시즌 베스트 라인업인 올-${leagueConfig.shortName} ${
        awards.allLeagueTeam === 1
          ? '퍼스트'
          : awards.allLeagueTeam === 2
          ? '세컨드'
          : '서드'
      } 팀에 이름을 올렸어요!`
    );
  }

  // 구단 역할 약속(Role Promise) 위반 여부 판정
  const brokenRolePromise = Boolean(
    (career.promisedRole === 'ACE_FIRST_OPTION' && mpg < 23.0) ||
      (career.promisedRole === 'STARTER_GUARANTEE' && mpg < 19.0)
  );
  if (brokenRolePromise) {
    narrativeLog.push(
      `⚠️ 구단이 계약 당시 약속했던 역할보다 출전 시간(${mpg.toFixed(
        1
      )}분)이 크게 줄어들어 코칭스태프와의 전술 갈등 및 트레이드 요구 명분이 생겼어요.`
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
    teamRank,
    totalLeagueTeams,
    playoffResult,
    salaryEarned,
    wonChampionship: awards.wonChampionship,
    wonMvp: awards.wonMvp,
    wonFinalsMvp: awards.wonFinalsMvp,
    wonDpoy: awards.wonDpoy,
    wonSixthMan: awards.wonSixthMan,
    wonMip: awards.wonMip,
    wonRookieOfYear: awards.wonRookieOfYear,
    allStarSelected: awards.allStarSelected,
    allLeagueTeam: awards.allLeagueTeam,
    singleGameHighPts,
    headline,
    narrativeLog,
    isFarewellTour: career.isFarewellTour,
  };

  // 라이벌 시즌 시뮬레이션
  const { updatedRivals, rivalNarrative } = simulateRivalsSeason(
    career.rivals,
    career.seasonYear,
    boxScore,
    rng
  );
  if (rivalNarrative) {
    boxScore.narrativeLog.push(rivalNarrative);
  }

  // 능력치 성장/노쇠화 적용 (신장 대비 포지션 물리 상한선 강제 적용)
  const { nextStats, delta: statDelta } = calculateSeasonStatGrowth(
    career,
    mpg,
    rng,
    injuredGamesMissed
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
    boxScore.narrativeLog.push(`🚀 [잠재력 한계 돌파] ${breakthrough.reason}`);
  }

  // 후천적 특성(Acquired Traits) 발현 심사
  const { nextTraits, newlyAcquired } = evaluateAcquiredTraits(career, boxScore);
  for (const acq of newlyAcquired) {
    boxScore.narrativeLog.push(
      `✨ [신규 고유 특성 발현] '${acq.name}'(${acq.badge}) 특성을 새롭게 획득했어요!`
    );
  }

  const stockBoost =
    (ppg * 1.05 + rpg * 0.42 + apg * 0.5 + (spg + bpg) * 1.2) *
      leagueConfig.prestige +
    (awards.wonChampionship ? 10 : 0) +
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
    nextTraits
  );

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
  };
}

