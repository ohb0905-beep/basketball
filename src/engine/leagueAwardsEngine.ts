import {
  AWARD_VOTING_CONFIG,
  LEAGUE_AWARD_QUOTAS,
  LEAGUE_BALANCE_META,
  LeagueAwardQuotaConfig,
  clampNum,
} from '../config/balanceConfig';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  AllLeagueTier,
  AwardRaceEntry,
  CareerState,
  LeagueId,
  Position,
  RivalPlayer,
  SeasonBoxScore,
  StandingEntry,
} from '../types/game';
import { generateProceduralPlayerName } from './playerNames';

export interface RivalSeasonStatSnapshot {
  rivalId: string;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
}

export interface LeagueAwardCandidate {
  id: string;
  name: string;
  teamId: string;
  teamShortName: string;
  pos: Position;
  isPlayer: boolean;
  rivalId?: string;
  isRookie: boolean;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  defStat?: number;
  wins: number;
  losses: number;
  eligible: boolean;
  mvpScore: number;
  allStarScore: number;
  royScore: number;
  dpoyScore?: number;
}

/**
 * 통합 올스타·올리그 정원 경쟁 평가 점수 (주인공·라이벌·NPC 100% 동일 공식)
 */
export function calcUnifiedAllStarScore(params: {
  ppg: number;
  rpg: number;
  apg: number;
  spg?: number;
  bpg?: number;
  fgPct?: number;
  wins: number;
  losses: number;
}): number {
  const w = AWARD_VOTING_CONFIG.allStarWeights;
  const winPct = params.wins / Math.max(1, params.wins + params.losses);
  const spg = params.spg ?? 1.1;
  const bpg = params.bpg ?? 0.6;
  const fgPct = params.fgPct ?? 46.0;
  return Number(
    (
      params.ppg * w.ppg +
      params.rpg * w.rpg +
      params.apg * w.apg +
      spg * w.spg +
      bpg * w.bpg +
      (fgPct - w.fgEffBase) * w.fgEffWeight +
      winPct * w.winPctWeight
    ).toFixed(2)
  );
}

/**
 * 통합 MVP 평가 점수 (주인공·라이벌·NPC 100% 동일 공식)
 */
export function calcUnifiedMvpScore(params: {
  ppg: number;
  rpg: number;
  apg: number;
  spg?: number;
  bpg?: number;
  fgPct?: number;
  wins: number;
  losses: number;
}): number {
  const w = AWARD_VOTING_CONFIG.mvpWeights;
  const winPct = params.wins / Math.max(1, params.wins + params.losses);
  const spg = params.spg ?? 1.1;
  const bpg = params.bpg ?? 0.6;
  const fgPct = params.fgPct ?? 46.5;

  const sub500Deficit = Math.max(0, w.sub500Base - winPct);
  const sub500Penalty =
    sub500Deficit > 0
      ? sub500Deficit * w.sub500LinearPenalty +
        sub500Deficit * sub500Deficit * w.sub500QuadPenalty
      : 0;
  const topSeedBonus =
    winPct > w.topSeedBase ? (winPct - w.topSeedBase) * w.topSeedBonusSlope : 0;
  const teamRecordScore = winPct * w.winPctWeight + topSeedBonus - sub500Penalty;

  return Number(
    (
      params.ppg * w.ppg +
      params.rpg * w.rpg +
      params.apg * w.apg +
      spg * w.spg +
      bpg * w.bpg +
      (fgPct - w.fgEffBase) * w.fgEffWeight +
      teamRecordScore
    ).toFixed(2)
  );
}

/**
 * 통합 신인왕(ROY) 평가 점수 (올라운드/패스형/수비형 신인도 공정 경쟁)
 */
export function calcUnifiedRoyScore(params: {
  ppg: number;
  rpg: number;
  apg: number;
  spg?: number;
  bpg?: number;
  fgPct?: number;
  wins: number;
  losses: number;
}): number {
  const w = AWARD_VOTING_CONFIG.royWeights;
  const winPct = params.wins / Math.max(1, params.wins + params.losses);
  const spg = params.spg ?? 0.9;
  const bpg = params.bpg ?? 0.5;
  const fgPct = params.fgPct ?? 44.5;
  return Number(
    (
      params.ppg * w.ppg +
      params.rpg * w.rpg +
      params.apg * w.apg +
      spg * w.spg +
      bpg * w.bpg +
      (fgPct - w.fgEffBase) * w.fgEffWeight +
      winPct * w.winPctWeight
    ).toFixed(2)
  );
}

/**
 * 통합 올해의 수비수(DPOY) 평가 점수 (외곽 스틸·온볼 수비 vs 빅맨 림프로텍팅 포지션 균형 반영)
 */
export function calcUnifiedDpoyScore(params: {
  pos: Position;
  defStat: number;
  spg: number;
  bpg: number;
  rpg: number;
  wins: number;
  losses: number;
}): number {
  const w = AWARD_VOTING_CONFIG.dpoyWeights;
  const winPct = params.wins / Math.max(1, params.wins + params.losses);
  const isBig = params.pos === 'C' || params.pos === 'PF';
  const posRebBaseline =
    params.pos === 'C'
      ? 10.0
      : params.pos === 'PF'
      ? 8.0
      : params.pos === 'SF'
      ? 5.5
      : 4.2;
  const rebOverBaseline = Math.max(0, params.rpg - posRebBaseline);
  const spgTerm = params.spg * (isBig ? w.bigSpgWeight : w.perimeterSpgWeight);
  const bpgTerm = params.bpg * (isBig ? w.bigBpgWeight : w.perimeterBpgWeight);
  return Number(
    (
      params.defStat * w.defStatWeight +
      spgTerm +
      bpgTerm +
      rebOverBaseline * w.rebOverBaselineWeight +
      winPct * w.winPctWeight
    ).toFixed(2)
  );
}

function isGuardPos(pos: Position): boolean {
  return pos === 'PG' || pos === 'SG';
}

function isForwardPos(pos: Position): boolean {
  return pos === 'SF' || pos === 'PF';
}

/**
 * 리그별 정원(Quota) + 포지션 균형 배분(가드 / 프론트코트 / 와일드카드) 올스타 선정
 */
export function selectPositionBalancedAllStars(
  candidates: LeagueAwardCandidate[],
  quota: LeagueAwardQuotaConfig
): {
  selectedIds: Set<string>;
  selectedList: LeagueAwardCandidate[];
  guardCount: number;
  frontcourtCount: number;
} {
  const eligibleSorted = candidates
    .filter((c) => c.eligible)
    .sort((a, b) => b.allStarScore - a.allStarScore);

  const selectedIds = new Set<string>();
  const selectedList: LeagueAwardCandidate[] = [];

  const pick = (c: LeagueAwardCandidate) => {
    if (selectedIds.has(c.id)) return;
    selectedIds.add(c.id);
    selectedList.push(c);
  };

  // 1) 가드(PG/SG) 우선 슬롯
  let guardsPicked = 0;
  for (const c of eligibleSorted) {
    if (guardsPicked >= quota.allStarGuards) break;
    if (isGuardPos(c.pos)) {
      pick(c);
      guardsPicked += 1;
    }
  }

  // 2) 프론트코트(SF/PF/C) 우선 슬롯
  let frontcourtPicked = 0;
  for (const c of eligibleSorted) {
    if (frontcourtPicked >= quota.allStarFrontcourt) break;
    if (!isGuardPos(c.pos)) {
      pick(c);
      frontcourtPicked += 1;
    }
  }

  // 3) 명시적 와일드카드 슬롯(포지션 무관 잔여 최고 점수 순)
  let wildcardsPicked = 0;
  for (const c of eligibleSorted) {
    if (wildcardsPicked >= quota.allStarWildcards) break;
    if (selectedList.length >= quota.allStarTotal) break;
    if (!selectedIds.has(c.id)) {
      pick(c);
      wildcardsPicked += 1;
    }
  }

  // 4) 특정 포지션 자원이 부족해 정원(allStarTotal)에 미달한 경우에만 잔여 적격 후보로 안전 보충
  for (const c of eligibleSorted) {
    if (selectedList.length >= quota.allStarTotal) break;
    pick(c);
  }

  const guardCount = selectedList.filter((c) => isGuardPos(c.pos)).length;
  const frontcourtCount = selectedList.length - guardCount;
  return { selectedIds, selectedList, guardCount, frontcourtCount };
}

/**
 * 포지션 균형(G2 · F2 · C1) 기반 올-리그 퍼스트/세컨드/서드 팀 배정
 */
export function assignPositionBalancedAllLeagueTeams(
  candidates: LeagueAwardCandidate[],
  teamCount: 1 | 2 | 3
): Map<string, 1 | 2 | 3> {
  const eligibleSorted = candidates
    .filter((c) => c.eligible)
    .sort((a, b) => b.allStarScore - a.allStarScore);

  const assigned = new Map<string, 1 | 2 | 3>();

  for (let tierNum = 1; tierNum <= teamCount; tierNum++) {
    const tier = tierNum as 1 | 2 | 3;
    const teamMembers: LeagueAwardCandidate[] = [];
    const pick = (c: LeagueAwardCandidate) => {
      if (assigned.has(c.id)) return;
      assigned.set(c.id, tier);
      teamMembers.push(c);
    };

    let g = 0;
    for (const c of eligibleSorted) {
      if (g >= 2) break;
      if (!assigned.has(c.id) && isGuardPos(c.pos)) {
        pick(c);
        g += 1;
      }
    }
    let f = 0;
    for (const c of eligibleSorted) {
      if (f >= 2) break;
      if (!assigned.has(c.id) && isForwardPos(c.pos)) {
        pick(c);
        f += 1;
      }
    }
    let ctr = 0;
    for (const c of eligibleSorted) {
      if (ctr >= 1) break;
      if (!assigned.has(c.id) && c.pos === 'C') {
        pick(c);
        ctr += 1;
      }
    }
    // 특정 포지션 자원이 부족하면 잔여 최고 성적 후보로 5인 정원 완성
    for (const c of eligibleSorted) {
      if (teamMembers.length >= 5) break;
      if (!assigned.has(c.id)) pick(c);
    }
  }

  return assigned;
}

/**
 * 구단별 NPC 주전·스타 + 동일 리그 라이벌 + 주인공이 함께 경쟁하는 대칭 리그 풀 생성
 */
export function buildSymmetricLeaguePlayerPool(params: {
  career: CareerState;
  boxScore: SeasonBoxScore;
  standings: StandingEntry[];
  updatedRivals: RivalPlayer[];
  rivalSeasonStats?: Record<string, RivalSeasonStatSnapshot>;
  isRookieSeason: boolean;
  rng?: () => number;
}): LeagueAwardCandidate[] {
  const {
    career,
    boxScore,
    standings,
    updatedRivals,
    rivalSeasonStats = {},
    isRookieSeason,
    rng = Math.random,
  } = params;

  const leagueCfg = LEAGUE_CONFIG[career.league];
  const leagueMeta = LEAGUE_BALANCE_META[career.league];
  const quota = LEAGUE_AWARD_QUOTAS[career.league];
  const ldrScale = leagueCfg.ldr / 78;
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  const pool: LeagueAwardCandidate[] = [];

  // 1) 주인공 후보 등록
  const playerAttendance = boxScore.gp / Math.max(1, leagueCfg.games);
  const playerEligible =
    playerAttendance >= leagueMeta.minAttendanceRatio &&
    boxScore.mpg >= AWARD_VOTING_CONFIG.minMpgForMajorAward;

  pool.push({
    id: 'PLAYER',
    name: career.name,
    teamId: boxScore.teamId,
    teamShortName: boxScore.teamShortName,
    pos: career.primaryPos,
    isPlayer: true,
    isRookie: isRookieSeason,
    gp: boxScore.gp,
    mpg: boxScore.mpg,
    ppg: boxScore.ppg,
    rpg: boxScore.rpg,
    apg: boxScore.apg,
    spg: boxScore.spg,
    bpg: boxScore.bpg,
    fgPct: boxScore.fgPct,
    defStat: career.stats.def,
    wins: boxScore.wins,
    losses: boxScore.losses,
    eligible: playerEligible,
    mvpScore: calcUnifiedMvpScore({
      ppg: boxScore.ppg,
      rpg: boxScore.rpg,
      apg: boxScore.apg,
      spg: boxScore.spg,
      bpg: boxScore.bpg,
      fgPct: boxScore.fgPct,
      wins: boxScore.wins,
      losses: boxScore.losses,
    }),
    allStarScore: calcUnifiedAllStarScore({
      ppg: boxScore.ppg,
      rpg: boxScore.rpg,
      apg: boxScore.apg,
      spg: boxScore.spg,
      bpg: boxScore.bpg,
      fgPct: boxScore.fgPct,
      wins: boxScore.wins,
      losses: boxScore.losses,
    }),
    royScore: calcUnifiedRoyScore({
      ppg: boxScore.ppg,
      rpg: boxScore.rpg,
      apg: boxScore.apg,
      spg: boxScore.spg,
      bpg: boxScore.bpg,
      fgPct: boxScore.fgPct,
      wins: boxScore.wins,
      losses: boxScore.losses,
    }),
    dpoyScore: calcUnifiedDpoyScore({
      pos: career.primaryPos,
      defStat: career.stats.def,
      spg: boxScore.spg,
      bpg: boxScore.bpg,
      rpg: boxScore.rpg,
      wins: boxScore.wins,
      losses: boxScore.losses,
    }),
  });

  // 2) 동일 리그 라이벌 후보 등록 (동일 공식·동일 출장 자격 검증)
  const sameLeagueRivals = updatedRivals.filter((r) => r.league === career.league);
  const teamOccupiedSlots = new Map<string, number>();
  // 주인공이 벤치(MPG < 25)인 경우 구단 1옵션 NPC 에이스 슬롯을 점유하지 않아 팀 동료 NPC 스타가 정상 생성되도록 보장
  if (boxScore.mpg >= 25.0) {
    teamOccupiedSlots.set(boxScore.teamId, 1);
  }

  for (const r of sameLeagueRivals) {
    const st = standings.find((s) => s.team.id === r.teamId) || standings[0];
    const rWins = st ? st.wins : Math.round(leagueCfg.games * 0.52);
    const rLosses = st ? st.losses : Math.max(1, leagueCfg.games - rWins);
    const snap = rivalSeasonStats[r.id];
    const rGp = snap?.gp ?? Math.round(leagueCfg.games * 0.9);
    const rMpg = snap?.mpg ?? 31.0;
    const rSpg = snap?.spg ?? 1.1;
    const rBpg = snap?.bpg ?? (r.pos === 'C' || r.pos === 'PF' ? 1.2 : 0.4);
    const rFgPct = snap?.fgPct ?? (r.pos === 'C' ? 52.5 : 46.5);
    const rDefStat = Math.round(clampNum(r.ovr + (rng() * 6 - 3), 50, 96));
    const rEligible =
      rGp / Math.max(1, leagueCfg.games) >= leagueMeta.minAttendanceRatio &&
      rMpg >= AWARD_VOTING_CONFIG.minMpgForMajorAward;

    teamOccupiedSlots.set(r.teamId, (teamOccupiedSlots.get(r.teamId) ?? 0) + 1);

    pool.push({
      id: `RIVAL_${r.id}`,
      name: r.name,
      teamId: r.teamId,
      teamShortName: r.teamShortName,
      pos: r.pos,
      isPlayer: false,
      rivalId: r.id,
      isRookie: r.draftYear === career.seasonYear,
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

  // 3) 리그 전체 구단의 시즌 NPC 주전·스타 풀 생성 (공용 대칭 빌더 호출)
  const npcPool = generateLeagueNpcStarPool({
    league: career.league,
    standings,
    teamOccupiedSlots,
    rng,
  });
  pool.push(...npcPool);

  return pool;
}

/**
 * 공용 리그별 NPC 주전·스타 풀 생성기 (주인공 소속 리그 & 타 리그 라이벌 대칭 평가 공용)
 */
export function generateLeagueNpcStarPool(params: {
  league: LeagueId;
  standings: StandingEntry[];
  teamOccupiedSlots: Map<string, number>;
  rng: () => number;
}): LeagueAwardCandidate[] {
  const { league, standings, teamOccupiedSlots, rng } = params;
  const leagueCfg = LEAGUE_CONFIG[league];
  const leagueMeta = LEAGUE_BALANCE_META[league];
  const quota = LEAGUE_AWARD_QUOTAS[league];
  const ldrScale = leagueCfg.ldr / 78;
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const npcPool: LeagueAwardCandidate[] = [];

  const leagueBaseStarPpg =
    14.8 +
    ldrScale * 6.4 +
    AWARD_VOTING_CONFIG.npcMvpPpgOffsetByLeague[league];
  const effectiveStandings = standings.length > 0 ? standings : [];

  for (let teamIdx = 0; teamIdx < effectiveStandings.length; teamIdx++) {
    const st = effectiveStandings[teamIdx];
    const occupied = teamOccupiedSlots.get(st.team.id) ?? 0;
    const npcCount = Math.max(0, quota.npcStarsPerTeam - occupied);
    const teamQuality =
      (st.team.rating - leagueCfg.ldr) * 0.2 + (st.winPct - 0.5) * 4.6;

    // 한 팀 내 주전 포지션이 겹치지 않도록 순환 배정
    const posOffset = (teamIdx * 2 + (st.isPlayerTeam ? 1 : 0)) % positions.length;

    for (let slot = 0; slot < npcCount; slot++) {
      // 주인공 팀이나 라이벌이 이미 1옵션 슬롯을 차지한 경우 NPC는 2옵션부터 생성
      const starTier = slot + occupied;
      const pos = positions[(posOffset + slot) % positions.length];
      const npcName = generateProceduralPlayerName(league, rng);

      // 상위 시드 에이스(starTier===0) 및 컨텐더 2옵션(starTier===1)에게 현실적인 올스타·MVP 경쟁 분포 부여
      const tierPpgDrop =
        starTier === 0 ? 0 : starTier === 1 ? 1.3 : starTier === 2 ? 5.2 : 8.6;
      const eliteSpike =
        starTier === 0 && teamIdx < Math.max(4, Math.round(effectiveStandings.length * 0.25))
          ? 0.1 + rng() * 1.0
          : starTier === 1 && teamIdx < Math.max(4, Math.round(effectiveStandings.length * 0.45))
          ? 0.5 + rng() * 1.4
          : (rng() - 0.5) * 3.0;

      const npcMpg = Number(
        clampNum(
          (starTier === 0 ? 34.8 : starTier === 1 ? 32.4 : starTier === 2 ? 28.6 : 25.0) +
            (rng() * 3.0 - 1.5),
          19.0,
          37.2
        ).toFixed(1)
      );
      // NPC 약 9%는 시즌 중 부상으로 최소 출장 비율 미달 (현실적 올스타·MVP 자격 탈락 반영)
      const npcInjuredOut = rng() < 0.09;
      const npcGpRatio = npcInjuredOut
        ? 0.42 + rng() * (leagueMeta.minAttendanceRatio - 0.46)
        : leagueMeta.minAttendanceRatio +
          0.03 +
          rng() * (0.97 - leagueMeta.minAttendanceRatio);
      const npcGp = Math.max(1, Math.min(leagueCfg.games, Math.round(leagueCfg.games * npcGpRatio)));
      const npcEligible =
        npcGp / Math.max(1, leagueCfg.games) >= leagueMeta.minAttendanceRatio &&
        npcMpg >= AWARD_VOTING_CONFIG.minMpgForMajorAward;

      const npcPpg = Number(
        clampNum(
          leagueBaseStarPpg + teamQuality - tierPpgDrop + eliteSpike + (rng() * 2.2 - 1.1),
          7.2,
          32.5
        ).toFixed(1)
      );
      const posRebAnchor =
        pos === 'C' ? 10.6 : pos === 'PF' ? 8.6 : pos === 'SF' ? 6.2 : pos === 'SG' ? 4.8 : 4.5;
      const posAstAnchor =
        pos === 'PG' ? 8.2 : pos === 'SG' ? 4.9 : pos === 'SF' ? 4.5 : pos === 'PF' ? 3.2 : 2.9;
      const tierSecondaryScale =
        (starTier === 0 ? 1.07 : starTier === 1 ? 1.04 : starTier === 2 ? 0.9 : 0.82) *
        (0.9 + ldrScale * 0.11);

      const npcRpg = Number(
        clampNum(
          posRebAnchor * tierSecondaryScale + (rng() * 2.4 - 1.2),
          2.0,
          14.8
        ).toFixed(1)
      );
      const npcApg = Number(
        clampNum(
          posAstAnchor * tierSecondaryScale + (rng() * 2.2 - 1.1),
          1.2,
          11.8
        ).toFixed(1)
      );
      const isDefSpecialist = rng() < 0.14;
      const npcDefStat = Math.round(
        clampNum(
          leagueCfg.ldr +
            (st.winPct - 0.5) * 8.0 +
            (isDefSpecialist ? 7.5 + rng() * 6.5 : (rng() * 8.0 - 4.0)),
          Math.max(40, leagueCfg.ldr - 12),
          97
        )
      );
      const npcSpg = Number(
        clampNum(
          (pos === 'PG' || pos === 'SG' || pos === 'SF' ? 1.38 : 0.95) * tierSecondaryScale +
            (isDefSpecialist && (pos === 'PG' || pos === 'SG' || pos === 'SF') ? 0.55 : 0) +
            (rng() * 0.7 - 0.35),
          0.3,
          2.8
        ).toFixed(1)
      );
      const npcBpg = Number(
        clampNum(
          (pos === 'C' ? 1.95 : pos === 'PF' ? 1.25 : 0.52) * tierSecondaryScale +
            (isDefSpecialist && (pos === 'C' || pos === 'PF') ? 0.65 : isDefSpecialist ? 0.25 : 0) +
            (rng() * 0.65 - 0.3),
          0.1,
          3.4
        ).toFixed(1)
      );
      const posFgAnchor = pos === 'C' ? 53.5 : pos === 'PF' ? 48.5 : 45.2;
      const npcFgPct = Number(
        clampNum(
          posFgAnchor + (starTier === 0 ? 1.5 : 0) + (rng() * 5.0 - 2.5),
          38.0,
          63.5
        ).toFixed(1)
      );

      npcPool.push({
        id: `NPC_${st.team.id}_${slot}`,
        name: npcName,
        teamId: st.team.id,
        teamShortName: st.team.shortName,
        pos,
        isPlayer: false,
        isRookie: false,
        gp: npcGp,
        mpg: npcMpg,
        ppg: npcPpg,
        rpg: npcRpg,
        apg: npcApg,
        spg: npcSpg,
        bpg: npcBpg,
        fgPct: npcFgPct,
        defStat: npcDefStat,
        wins: st.wins,
        losses: st.losses,
        eligible: npcEligible,
        mvpScore: calcUnifiedMvpScore({
          ppg: npcPpg,
          rpg: npcRpg,
          apg: npcApg,
          spg: npcSpg,
          bpg: npcBpg,
          fgPct: npcFgPct,
          wins: st.wins,
          losses: st.losses,
        }),
        allStarScore: calcUnifiedAllStarScore({
          ppg: npcPpg,
          rpg: npcRpg,
          apg: npcApg,
          spg: npcSpg,
          bpg: npcBpg,
          fgPct: npcFgPct,
          wins: st.wins,
          losses: st.losses,
        }),
        royScore: calcUnifiedRoyScore({
          ppg: npcPpg,
          rpg: npcRpg,
          apg: npcApg,
          spg: npcSpg,
          bpg: npcBpg,
          fgPct: npcFgPct,
          wins: st.wins,
          losses: st.losses,
        }),
        dpoyScore: calcUnifiedDpoyScore({
          pos,
          defStat: npcDefStat,
          spg: npcSpg,
          bpg: npcBpg,
          rpg: npcRpg,
          wins: st.wins,
          losses: st.losses,
        }),
      });
    }
  }

  return npcPool;
}

/**
 * 공용 리그별 NPC 루키 풀 생성기 (주인공 소속 리그 & 타 리그 루키 라이벌 공용)
 */
export function generateLeagueNpcRookiePool(params: {
  league: LeagueId;
  standings: StandingEntry[];
  excludePlayerTeam?: boolean;
  fallbackTeamId?: string;
  fallbackTeamShortName?: string;
  rng: () => number;
}): LeagueAwardCandidate[] {
  const {
    league,
    standings,
    excludePlayerTeam = false,
    fallbackTeamId = '',
    fallbackTeamShortName = '',
    rng,
  } = params;
  const leagueCfg = LEAGUE_CONFIG[league];
  const leagueMeta = LEAGUE_BALANCE_META[league];
  const ldrScale = leagueCfg.ldr / 78;
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const targetStandings = excludePlayerTeam
    ? standings.filter((s) => !s.isPlayerTeam)
    : standings;
  const rookies: LeagueAwardCandidate[] = [];

  for (let rookieIdx = 0; rookieIdx < AWARD_VOTING_CONFIG.npcRoyPoolSize; rookieIdx++) {
    const st =
      targetStandings[(rookieIdx + 2) % Math.max(1, targetStandings.length)] ||
      standings[0];
    const pos = positions[(rookieIdx + 2) % positions.length];
    const rkName = generateProceduralPlayerName(league, rng);
    const rkMpg = Number(
      clampNum(28.5 - rookieIdx * 1.1 + (rng() * 3.0 - 1.5), 18.5, 34.5).toFixed(1)
    );
    const rkGp = Math.max(
      1,
      Math.round(leagueCfg.games * (leagueMeta.minAttendanceRatio + 0.08 + rng() * 0.22))
    );
    const rkPpg = Number(
      clampNum(
        11.0 + ldrScale * 3.6 - rookieIdx * 0.95 + (rng() * 2.2 - 1.1),
        5.5,
        22.5
      ).toFixed(1)
    );
    const rkRpg = Number(
      clampNum(
        (pos === 'C' || pos === 'PF' ? 6.6 : 3.8) - rookieIdx * 0.15 + (rng() * 1.4 - 0.7),
        1.8,
        10.5
      ).toFixed(1)
    );
    const rkApg = Number(
      clampNum(
        (pos === 'PG' ? 5.2 : 2.6) - rookieIdx * 0.12 + (rng() * 1.2 - 0.6),
        1.0,
        8.5
      ).toFixed(1)
    );
    const rkSpg = Number((0.7 + rng() * 0.7).toFixed(1));
    const rkBpg = Number(
      (pos === 'C' || pos === 'PF' ? 0.9 + rng() * 0.8 : 0.3 + rng() * 0.3).toFixed(1)
    );
    const rkFgPct = Number((43.0 + rng() * 5.5).toFixed(1));
    const rw = st ? st.wins : Math.round(leagueCfg.games * 0.45);
    const rl = st ? st.losses : Math.max(1, leagueCfg.games - rw);

    rookies.push({
      id: `NPC_ROOKIE_${league}_${rookieIdx}`,
      name: rkName,
      teamId: st ? st.team.id : fallbackTeamId,
      teamShortName: st ? st.team.shortName : fallbackTeamShortName,
      pos,
      isPlayer: false,
      isRookie: true,
      gp: rkGp,
      mpg: rkMpg,
      ppg: rkPpg,
      rpg: rkRpg,
      apg: rkApg,
      spg: rkSpg,
      bpg: rkBpg,
      fgPct: rkFgPct,
      wins: rw,
      losses: rl,
      eligible: true,
      mvpScore: calcUnifiedMvpScore({
        ppg: rkPpg,
        rpg: rkRpg,
        apg: rkApg,
        spg: rkSpg,
        bpg: rkBpg,
        fgPct: rkFgPct,
        wins: rw,
        losses: rl,
      }),
      allStarScore: calcUnifiedAllStarScore({
        ppg: rkPpg,
        rpg: rkRpg,
        apg: rkApg,
        spg: rkSpg,
        bpg: rkBpg,
        fgPct: rkFgPct,
        wins: rw,
        losses: rl,
      }),
      royScore: calcUnifiedRoyScore({
        ppg: rkPpg,
        rpg: rkRpg,
        apg: rkApg,
        spg: rkSpg,
        bpg: rkBpg,
        fgPct: rkFgPct,
        wins: rw,
        losses: rl,
      }),
    });
  }

  return rookies;
}

/**
 * 명시적 MVP -> 올스타 보장 헬퍼 (정원 총량 & 포지션군 균형 유지)
 */
export function applyMvpAllStarGuarantee(
  allStarIds: Set<string>,
  pool: LeagueAwardCandidate[],
  mvpWinner: LeagueAwardCandidate,
  quota: LeagueAwardQuotaConfig
): void {
  if (allStarIds.has(mvpWinner.id)) return;
  const currentSelected = pool.filter((c) => allStarIds.has(c.id));
  const mvpIsGuard = isGuardPos(mvpWinner.pos);
  const replaceable =
    currentSelected
      .filter((c) => isGuardPos(c.pos) === mvpIsGuard)
      .sort((a, b) => a.allStarScore - b.allStarScore)[0] ??
    currentSelected.sort((a, b) => a.allStarScore - b.allStarScore)[0];
  if (replaceable && allStarIds.size >= quota.allStarTotal) {
    allStarIds.delete(replaceable.id);
  }
  allStarIds.add(mvpWinner.id);
}

/**
 * 명시적 MVP -> 올-리그 퍼스트팀 보장 헬퍼
 * - 기존 올-리그 하위 팀에 속해 있었다면 퍼스트팀 동일 포지션군 최하위와 맞교환
 * - 기존 올-리그 명단 밖에 있었다면 1팀 -> 2팀 -> ... -> 마지막 팀으로 연쇄 강등해
 *   모든 팀이 정확히 5인 정원을 유지하도록 보장
 */
export function applyMvpAllLeagueGuarantee(
  allLeagueTeams: Map<string, 1 | 2 | 3>,
  pool: LeagueAwardCandidate[],
  mvpWinner: LeagueAwardCandidate,
  teamCount: 1 | 2 | 3
): void {
  if (allLeagueTeams.get(mvpWinner.id) === 1) return;

  const samePosBucket = (a: Position, b: Position): boolean =>
    isGuardPos(a) ? isGuardPos(b) : isForwardPos(a) ? isForwardPos(b) : b === 'C';

  const prevTier = allLeagueTeams.get(mvpWinner.id);
  const firstTeamEntries = pool.filter((c) => allLeagueTeams.get(c.id) === 1);
  const displacedFromFirst =
    firstTeamEntries
      .filter((c) => samePosBucket(mvpWinner.pos, c.pos))
      .sort((a, b) => a.allStarScore - b.allStarScore)[0] ??
    firstTeamEntries.sort((a, b) => a.allStarScore - b.allStarScore)[0];

  if (!displacedFromFirst || firstTeamEntries.length < 5) {
    allLeagueTeams.set(mvpWinner.id, 1);
    return;
  }

  // 이미 2팀/3팀에 있던 경우 단순 스왑으로 모든 팀 5인 정원 유지
  if (prevTier) {
    allLeagueTeams.set(displacedFromFirst.id, prevTier);
    allLeagueTeams.set(mvpWinner.id, 1);
    return;
  }

  // 기존 명단 밖이었던 경우 1팀 -> 2팀 -> ... 연쇄 강등으로 각 팀 5인 정원 엄격 유지
  allLeagueTeams.set(mvpWinner.id, 1);
  let carry: LeagueAwardCandidate | null = displacedFromFirst;
  for (let tierNum = 2; tierNum <= teamCount && carry; tierNum++) {
    const tier = tierNum as 2 | 3;
    const tierEntries = pool.filter((c) => allLeagueTeams.get(c.id) === tier);
    if (tierEntries.length < 5) {
      allLeagueTeams.set(carry.id, tier);
      carry = null;
      break;
    }
    const displacedNext =
      tierEntries
        .filter((c) => samePosBucket(carry!.pos, c.pos))
        .sort((a, b) => a.allStarScore - b.allStarScore)[0] ??
      tierEntries.sort((a, b) => a.allStarScore - b.allStarScore)[0];
    allLeagueTeams.set(carry.id, tier);
    carry = displacedNext ?? null;
  }
  if (carry) {
    allLeagueTeams.delete(carry.id);
  }
}

export interface UnifiedLeagueAwardsResult {
  mvpRace: AwardRaceEntry[];
  mvpRaceNarrative: string;
  playerMvpRank: number | null;
  playerWonMvp: boolean;
  mvpWinnerId: string | null;
  playerWonDpoy: boolean;
  dpoyWinnerId: string | null;
  playerAllStarSelected: boolean;
  playerAllLeagueTeam: AllLeagueTier;
  allStarIds: Set<string>;
  allStarGuardCount: number;
  allStarFrontcourtCount: number;
  allLeagueTeams: Map<string, 1 | 2 | 3>;
  royRace?: AwardRaceEntry[];
  royRaceNarrative?: string;
  playerRoyRank?: number | null;
  playerWonRoy: boolean;
  royWinnerId: string | null;
  syncedRivals: RivalPlayer[];
  poolSize: number;
}

/**
 * 단일 진실 소스(Single Source of Truth) 통합 리그 수상 평가기
 * - MVP: 전체 대칭 풀에서 단일 투표 공식 정렬 → 1위만 수상
 * - 올스타 / 올-리그: 리그별 정원(Quota) + 포지션 균형 배분 독립 선정
 * - 명시적 정책: AWARD_VOTING_CONFIG.mvpGuaranteesAllStarAndFirstTeam 활성화 시
 *   정규시즌 MVP 수상자(주인공/라이벌/NPC 불문)의 올스타·퍼스트팀 자격을 정원 유지 상태로 보장
 * - 신인왕(ROY): 루키 풀 동일 투표 공식 정렬 → 1위만 수상
 * - 라이벌 동기화: 동일 리그 라이벌의 mvps / allStars / roys를 이 풀 결과로 직접 누적
 */
export function evaluateUnifiedLeagueAwards(params: {
  career: CareerState;
  boxScore: SeasonBoxScore;
  standings: StandingEntry[];
  updatedRivals: RivalPlayer[];
  rivalSeasonStats?: Record<string, RivalSeasonStatSnapshot>;
  isRookieSeason: boolean;
  rng?: () => number;
  customPool?: LeagueAwardCandidate[];
  customRookiePool?: LeagueAwardCandidate[];
}): UnifiedLeagueAwardsResult {
  const {
    career,
    boxScore,
    standings,
    updatedRivals,
    rivalSeasonStats = {},
    isRookieSeason,
    rng = Math.random,
    customPool,
    customRookiePool,
  } = params;

  const leagueCfg = LEAGUE_CONFIG[career.league];
  const leagueMeta = LEAGUE_BALANCE_META[career.league];
  const quota = LEAGUE_AWARD_QUOTAS[career.league];

  const pool =
    customPool ??
    buildSymmetricLeaguePlayerPool({
      career,
      boxScore,
      standings,
      updatedRivals,
      rivalSeasonStats,
      isRookieSeason,
      rng,
    });

  // 1. MVP 단일 투표 정렬 (자격 충족 후보만 필터링해 TOP 5 및 순위 구성 — 부적격 후보 노출 차단)
  const eligibleMvpSorted = pool
    .filter((c) => c.eligible)
    .sort((a, b) => b.mvpScore - a.mvpScore);

  const playerCandidate = pool.find((c) => c.isPlayer);
  const playerEligibleMvpIndex = eligibleMvpSorted.findIndex((c) => c.isPlayer);
  const playerMvpRank =
    playerCandidate?.eligible && playerEligibleMvpIndex >= 0
      ? playerEligibleMvpIndex + 1
      : null;

  const top5MvpRaw = eligibleMvpSorted.slice(0, 5);
  const mvpWeights = top5MvpRaw.map((c, idx) => {
    const scoreGapFromTop = Math.max(0, top5MvpRaw[0].mvpScore - c.mvpScore);
    const rankDecay =
      idx === 0 ? 1.0 : idx === 1 ? 0.45 : idx === 2 ? 0.16 : idx === 3 ? 0.05 : 0.02;
    return Math.max(0.01, Math.exp(-scoreGapFromTop * 0.22) * rankDecay);
  });
  const weightSum = mvpWeights.reduce((a, b) => a + b, 0);
  const rawShares =
    weightSum > 0
      ? mvpWeights.map((w) => Math.round((w / weightSum) * 100))
      : [];
  if (rawShares.length > 0) {
    const shareDiff = 100 - rawShares.reduce((a, b) => a + b, 0);
    rawShares[0] = Math.max(1, rawShares[0] + shareDiff);
  }

  const mvpRace: AwardRaceEntry[] = top5MvpRaw.map((c, idx) => ({
    rank: idx + 1,
    name: c.name,
    teamShortName: c.teamShortName,
    pos: c.pos,
    isPlayer: c.isPlayer,
    ppg: c.ppg,
    rpg: c.rpg,
    apg: c.apg,
    wins: c.wins,
    losses: c.losses,
    awardScore: c.mvpScore,
    firstPlaceVoteShare: rawShares[idx],
  }));

  const mvpWinnerCandidate = eligibleMvpSorted[0] ?? null;
  const mvpWinnerId = mvpWinnerCandidate ? mvpWinnerCandidate.id : null;
  const playerWonMvp = Boolean(mvpWinnerCandidate?.isPlayer);

  // 1-2. 올해의 수비수(DPOY) 대칭 풀 1위 선정 (외곽·빅맨 포지션 균형 수비 점수 비교)
  const getCandidateDpoyScore = (c: LeagueAwardCandidate): number =>
    typeof c.dpoyScore === 'number'
      ? c.dpoyScore
      : calcUnifiedDpoyScore({
          pos: c.pos,
          defStat: c.defStat ?? leagueCfg.ldr,
          spg: c.spg,
          bpg: c.bpg,
          rpg: c.rpg,
          wins: c.wins,
          losses: c.losses,
        });
  const eligibleDpoySorted = pool
    .filter((c) => c.eligible)
    .sort((a, b) => getCandidateDpoyScore(b) - getCandidateDpoyScore(a));
  const dpoyWinnerCandidate = eligibleDpoySorted[0] ?? null;
  const dpoyWinnerId = dpoyWinnerCandidate ? dpoyWinnerCandidate.id : null;
  const playerWonDpoy = Boolean(dpoyWinnerCandidate?.isPlayer);

  // 2. 올스타 & 올-리그 팀: 리그별 정원 + 포지션 균형 독립 선정
  const allStarSelection = selectPositionBalancedAllStars(pool, quota);
  const allStarIds = new Set(allStarSelection.selectedIds);
  const allLeagueTeams = assignPositionBalancedAllLeagueTeams(
    pool,
    quota.allLeagueTeamCount
  );

  // 3. 명시적 정책(mvpGuaranteesAllStarAndFirstTeam):
  //    MVP 수상자가 독립 올스타/퍼스트팀 컷에서 빠진 경우,
  //    정원 총량과 각 올-리그 팀 5인 정원을 유지한 채 자격을 명시적으로 보장
  if (
    AWARD_VOTING_CONFIG.mvpGuaranteesAllStarAndFirstTeam &&
    mvpWinnerCandidate
  ) {
    applyMvpAllStarGuarantee(allStarIds, pool, mvpWinnerCandidate, quota);
    applyMvpAllLeagueGuarantee(
      allLeagueTeams,
      pool,
      mvpWinnerCandidate,
      quota.allLeagueTeamCount
    );
  }

  const finalAllStarMembers = pool.filter((c) => allStarIds.has(c.id));
  const allStarGuardCount = finalAllStarMembers.filter((c) => isGuardPos(c.pos)).length;
  const allStarFrontcourtCount = finalAllStarMembers.length - allStarGuardCount;

  const playerAllStarSelected = allStarIds.has('PLAYER');
  const playerAllLeagueTeam: AllLeagueTier = allLeagueTeams.get('PLAYER') ?? null;

  const mvpWinner = mvpRace[0];
  const mvpRunnerUp = mvpRace[1] || mvpRace[0];
  const myMvpRankEntry = mvpRace.find((c) => c.isPlayer);

  const awardShortTitle = leagueMeta.isAmateur
    ? `${leagueCfg.shortName} 최우수 선수(MVP)`
    : `${leagueCfg.shortName} 정규시즌 MVP`;

  let mvpRaceNarrative = '';
  if (playerWonMvp && mvpWinner && mvpRunnerUp) {
    mvpRaceNarrative = `투표 결과 1위 (1위 표 ${mvpWinner.firstPlaceVoteShare}%) — 개인 기록과 팀 기여도를 모두 인정받아 2위 ${mvpRunnerUp.name}(${mvpRunnerUp.teamShortName}, ${mvpRunnerUp.firstPlaceVoteShare}%)을 제치고 ${awardShortTitle} 트로피를 차지했습니다.`;
  } else if (myMvpRankEntry && mvpWinner && (myMvpRankEntry.rank === 2 || myMvpRankEntry.rank === 3)) {
    const teamRecordLack = boxScore.wins < mvpWinner.wins;
    mvpRaceNarrative = teamRecordLack
      ? `투표 결과 ${myMvpRankEntry.rank}위 (1위 표 ${myMvpRankEntry.firstPlaceVoteShare}%) — 개인 스탯(${boxScore.ppg}점 ${boxScore.rpg}리바 ${boxScore.apg}도움)은 최정상급이었으나 팀 성적(${boxScore.wins}승 ${boxScore.losses}패)에서 앞선 1위 ${mvpWinner.name}(${mvpWinner.teamShortName}, ${mvpWinner.wins}승 ${mvpWinner.losses}패)에게 표가 쏠리며 아쉽게 고배를 마셨습니다.`
      : `투표 결과 ${myMvpRankEntry.rank}위 (1위 표 ${myMvpRankEntry.firstPlaceVoteShare}%) — 뛰어난 활약을 펼쳤지만 1위 ${mvpWinner.name}(${mvpWinner.teamShortName}, 평균 ${mvpWinner.ppg}점 ${mvpWinner.rpg}리바 ${mvpWinner.apg}도움)의 종합 공헌도에 밀려 아쉽게 수상에 실패했습니다.`;
  } else if (myMvpRankEntry && mvpWinner) {
    mvpRaceNarrative = `투표 결과 ${myMvpRankEntry.rank}위 (1위 표 ${myMvpRankEntry.firstPlaceVoteShare}%) — 정상급 활약을 인정받아 ${awardShortTitle} 투표 TOP 5에 이름을 올렸습니다 (1위: ${mvpWinner.name} · ${mvpWinner.firstPlaceVoteShare}%).`;
  } else if (playerCandidate && !playerCandidate.eligible && mvpWinner) {
    mvpRaceNarrative = `출전 시간·출장 경기 수 기준 미달로 투표권 밖(순위권 외)에 머물렀습니다. 이번 시즌 ${awardShortTitle}는 평균 ${mvpWinner.ppg}점 ${mvpWinner.rpg}리바 ${mvpWinner.apg}도움을 기록한 ${mvpWinner.name}(${mvpWinner.teamShortName}, 1위 표 ${mvpWinner.firstPlaceVoteShare}%) 선수가 차지했습니다.`;
  } else if (mvpWinner) {
    mvpRaceNarrative = `투표 순위권 외 (${playerMvpRank}위) — 이번 시즌 ${awardShortTitle}는 평균 ${mvpWinner.ppg}점 ${mvpWinner.rpg}리바 ${mvpWinner.apg}도움을 기록한 ${mvpWinner.name}(${mvpWinner.teamShortName}, 1위 표 ${mvpWinner.firstPlaceVoteShare}%) 선수가 차지했습니다.`;
  }

  // 4. 신인왕(ROY) 대칭 풀 평가 (자격 충족 루키 후보만 필터링해 TOP 5 및 수상자 확정)
  const sameLeagueRookieRivals = pool.filter((c) => !c.isPlayer && c.rivalId && c.isRookie);
  const shouldRunRoyPool = isRookieSeason || sameLeagueRookieRivals.length > 0;

  let royRace: AwardRaceEntry[] | undefined;
  let royRaceNarrative: string | undefined;
  let playerRoyRank: number | null | undefined;
  let playerWonRoy = false;
  let royWinnerId: string | null = null;

  if (shouldRunRoyPool) {
    const royCandidates: LeagueAwardCandidate[] = customRookiePool
      ? [...customRookiePool]
      : (() => {
          const list: LeagueAwardCandidate[] = [];
          if (isRookieSeason && playerCandidate) {
            list.push(playerCandidate);
          }
          for (const rr of sameLeagueRookieRivals) {
            list.push(rr);
          }
          const npcRookies = generateLeagueNpcRookiePool({
            league: career.league,
            standings,
            excludePlayerTeam: true,
            fallbackTeamId: career.team.id,
            fallbackTeamShortName: career.team.shortName,
            rng,
          });
          list.push(...npcRookies);
          return list;
        })();

    const eligibleRoySorted = royCandidates
      .filter((c) => c.eligible)
      .sort((a, b) => b.royScore - a.royScore);

    const royWinnerCand = eligibleRoySorted[0] ?? null;
    royWinnerId = royWinnerCand ? royWinnerCand.id : null;

    if (isRookieSeason) {
      const playerEligibleRoyIndex = eligibleRoySorted.findIndex((c) => c.isPlayer);
      playerRoyRank =
        playerCandidate?.eligible && playerEligibleRoyIndex >= 0
          ? playerEligibleRoyIndex + 1
          : null;

      const top5RoyRaw = eligibleRoySorted.slice(0, 5);
      const royWeights = top5RoyRaw.map((c, idx) => {
        const gap = Math.max(0, top5RoyRaw[0].royScore - c.royScore);
        const decay =
          idx === 0 ? 1.0 : idx === 1 ? 0.48 : idx === 2 ? 0.18 : idx === 3 ? 0.06 : 0.02;
        return Math.max(0.01, Math.exp(-gap * 0.24) * decay);
      });
      const royWeightSum = royWeights.reduce((a, b) => a + b, 0);
      const royShares =
        royWeightSum > 0
          ? royWeights.map((w) => Math.round((w / royWeightSum) * 100))
          : [];
      if (royShares.length > 0) {
        const royDiff = 100 - royShares.reduce((a, b) => a + b, 0);
        royShares[0] = Math.max(1, royShares[0] + royDiff);
      }

      royRace = top5RoyRaw.map((c, idx) => ({
        rank: idx + 1,
        name: c.name,
        teamShortName: c.teamShortName,
        pos: c.pos,
        isPlayer: c.isPlayer,
        ppg: c.ppg,
        rpg: c.rpg,
        apg: c.apg,
        wins: c.wins,
        losses: c.losses,
        awardScore: c.royScore,
        firstPlaceVoteShare: royShares[idx],
      }));

      const royWinner = royRace[0];
      const royRunnerUp = royRace[1] || royRace[0];
      const myRoyEntry = royRace.find((c) => c.isPlayer);
      playerWonRoy = Boolean(royWinnerCand?.isPlayer);

      const royShortTitle = leagueMeta.isAmateur ? '신입생 신인왕' : '올해의 신인왕(ROY)';
      if (playerWonRoy && royWinner && royRunnerUp) {
        royRaceNarrative = `신인왕 투표 1위 (1위 표 ${royWinner.firstPlaceVoteShare}%) — 동기 경쟁자 ${royRunnerUp.name}(${royRunnerUp.teamShortName}, ${royRunnerUp.firstPlaceVoteShare}%)을 제치고 생애 단 한 번뿐인 ${royShortTitle}을 수상했습니다.`;
      } else if (myRoyEntry && royWinner && (myRoyEntry.rank === 2 || myRoyEntry.rank === 3)) {
        royRaceNarrative = `신인왕 투표 ${myRoyEntry.rank}위 (1위 표 ${myRoyEntry.firstPlaceVoteShare}%) — 데뷔 시즌 준수한 기록(${boxScore.ppg}점 ${boxScore.rpg}리바 ${boxScore.apg}도움)을 남겼으나 종합 임팩트에서 앞선 1위 ${royWinner.name}(${royWinner.teamShortName}, 평균 ${royWinner.ppg}점 ${royWinner.rpg}리바 ${royWinner.apg}도움)에게 아쉽게 고배를 마셨습니다.`;
      } else if (myRoyEntry && royWinner) {
        royRaceNarrative = `신인왕 투표 ${myRoyEntry.rank}위 (1위 표 ${myRoyEntry.firstPlaceVoteShare}%) — 루키 TOP 5에 이름을 올렸으며, 1위는 ${royWinner.name}(${royWinner.teamShortName}, 평균 ${royWinner.ppg}점) 선수가 차지했습니다.`;
      } else if (royWinner) {
        royRaceNarrative = `신인왕 투표 순위권 외${
          playerRoyRank ? ` (${playerRoyRank}위)` : ''
        } — 이번 시즌 ${royShortTitle}은 평균 ${royWinner.ppg}점 ${royWinner.rpg}리바 ${royWinner.apg}도움을 기록한 ${royWinner.name}(${royWinner.teamShortName}, 1위 표 ${royWinner.firstPlaceVoteShare}%) 선수가 수상했습니다.`;
      }
    }
  }

  // 5. 동일 리그 라이벌 누적 수상 동기화 (주인공과 정확히 같은 경쟁 풀 결과 반영)
  const syncedRivals = updatedRivals.map((r) => {
    if (r.league !== career.league) return r;
    const candId = `RIVAL_${r.id}`;
    const rivalWonMvp = mvpWinnerId === candId;
    const rivalAllStar = allStarIds.has(candId);
    const rivalWonRoy = royWinnerId === candId;
    const awardTags: string[] = [];
    if (rivalWonMvp) awardTags.push('정규시즌 MVP');
    if (rivalAllStar) awardTags.push(leagueMeta.allStarLabel);
    if (rivalWonRoy) awardTags.push('신인왕');
    const suffix =
      awardTags.length > 0 ? ` (${awardTags.join(' · ')} 선정)` : '';
    return {
      ...r,
      allStars: r.allStars + (rivalAllStar ? 1 : 0),
      mvps: r.mvps + (rivalWonMvp ? 1 : 0),
      roys: r.roys + (rivalWonRoy ? 1 : 0),
      lastHeadline: `${r.lastHeadline}${suffix}`,
    };
  });

  return {
    mvpRace,
    mvpRaceNarrative,
    playerMvpRank,
    playerWonMvp,
    mvpWinnerId,
    playerWonDpoy,
    dpoyWinnerId,
    playerAllStarSelected,
    playerAllLeagueTeam,
    allStarIds,
    allStarGuardCount,
    allStarFrontcourtCount,
    allLeagueTeams,
    ...(royRace ? { royRace, royRaceNarrative, playerRoyRank } : {}),
    playerWonRoy,
    royWinnerId,
    syncedRivals,
    poolSize: pool.length,
  };
}

/**
 * 하위 호환 래퍼: 기존 호출부·테스트에서 buildAwardRaceTop5를 직접 호출해도
 * 통합 대칭 풀(evaluateUnifiedLeagueAwards)과 100% 동일한 결과를 반환합니다.
 */
export function buildAwardRaceTop5(params: {
  career: CareerState;
  boxScore: SeasonBoxScore;
  standings: StandingEntry[];
  updatedRivals: RivalPlayer[];
  isRookieSeason: boolean;
  rng?: () => number;
}): {
  mvpRace: AwardRaceEntry[];
  mvpRaceNarrative: string;
  playerMvpRank: number | null;
  playerWonMvp: boolean;
  playerAllStarSelected: boolean;
  playerAllLeagueTeam: AllLeagueTier;
  royRace?: AwardRaceEntry[];
  royRaceNarrative?: string;
  playerRoyRank?: number | null;
  playerWonRoy: boolean;
  syncedRivals: RivalPlayer[];
} {
  const res = evaluateUnifiedLeagueAwards(params);
  return {
    mvpRace: res.mvpRace,
    mvpRaceNarrative: res.mvpRaceNarrative,
    playerMvpRank: res.playerMvpRank,
    playerWonMvp: res.playerWonMvp,
    playerAllStarSelected: res.playerAllStarSelected,
    playerAllLeagueTeam: res.playerAllLeagueTeam,
    ...(res.royRace
      ? {
          royRace: res.royRace,
          royRaceNarrative: res.royRaceNarrative,
          playerRoyRank: res.playerRoyRank,
        }
      : {}),
    playerWonRoy: res.playerWonRoy,
    syncedRivals: res.syncedRivals,
  };
}
