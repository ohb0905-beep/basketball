/**
 * 밸런스 회귀 시뮬레이션 (시드 고정)
 *
 * 실행: bun scripts/balance-sim.ts [커리어 수=200] [시드=20261121] [--check]
 *
 * 1) 실제 커리어 루프: 스토어 액션으로 고교 입학부터 은퇴까지 자동 진행
 * 2) 라이브 경기: 실제 커리어에서 발생한 결승 스냅샷을 전술별로 재시뮬레이션
 * 3) 동일 전력 라이브 경기: 팀 전력을 같게 맞추고 선수 등급(LDR-8 / LDR / LDR+10)별 승률 측정
 *
 * --check 를 주면 BALANCE_TARGETS 범위를 벗어난 지표가 있을 때 exit code 1 로 종료합니다.
 * 자동 플레이는 이벤트 첫 선택지·기본 훈련만 사용하므로 '평범한 유저' 기준 수치입니다.
 */
export {};

const rawArgs = process.argv.slice(2);
const args = rawArgs.filter((a) => !a.startsWith('--'));
const CHECK = rawArgs.includes('--check');
const seedsFlag = rawArgs.find((a) => a.startsWith('--seeds='));
const CAREERS = Number(args[0] ?? 200);
const SEEDS: number[] = seedsFlag
  ? seedsFlag
      .slice('--seeds='.length)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
  : [Number(args[1] ?? 20261121)];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => {
    mem[k] = v;
  },
  removeItem: (k: string) => {
    delete mem[k];
  },
};
(globalThis as any).window = globalThis;
const origWarn = console.warn;
console.warn = (...a: unknown[]) => {
  if (String(a[0]).includes('[zustand')) return;
  origWarn(...a);
};

const { useCareerStore } = await import('../src/store/useCareerStore');
const PE = await import('../src/engine/playoffEngine');
const SIM = await import('../src/engine/seasonSimulator');
const STAT = await import('../src/engine/statCalculator');
const TEAMS = await import('../src/data/teams');
const { LEAGUE_CONFIG } = await import('../src/data/leagues');
const S = () => useCareerStore.getState();

const ALL_LEAGUES = [
  'HIGH_SCHOOL',
  'U_LEAGUE',
  'NCAA',
  'KBL',
  'B_LEAGUE',
  'NBL',
  'EUROLEAGUE',
  'GLEAGUE',
  'NBA',
] as const;

const POS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const HEIGHT: Record<string, number> = { PG: 185, SG: 192, SF: 199, PF: 204, C: 211 };
const TACTICS = ['ACE_HERO', 'LOCKDOWN_DEFENSE', 'UNSELFISH_PASS', 'PACE_CONSERVE'] as const;
const AMATEUR = ['HIGH_SCHOOL', 'U_LEAGUE', 'NCAA'];

const pct = (n: number, d: number) => (d ? +((n / d) * 100).toFixed(1) : 0);
const avg = (xs: number[]) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : 0);
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0;
};

function runSeedSimulation(SEED: number, verbose: boolean): {
  seed: number;
  failed: number;
  passed: number;
  total: number;
  failedNames: string[];
  summary: Record<string, number>;
  targetValues: Record<string, number>;
  targetRanges: Record<string, [number, number]>;
} {
Math.random = mulberry32(SEED);

// ───────────────────── 1) 커리어 루프 ─────────────────────
const initOvr: Record<string, number[]> = {};
const posPeakOvr: Record<string, number[]> = {};
const peaks: number[] = [];
const peakAges: number[] = [];
const potDiffs: number[] = [];
const retireAges: number[] = [];
const proJumpDeltas: number[] = [];
const ageOvrBuckets: Record<number, number[]> = {};
const post35Drops: number[] = [];
const dnaStats: Record<
  string,
  { n: number; peaks: number[]; peakAges: number[]; seasons: number[]; retireAges: number[]; potAttain: number[] }
> = {};
const durabilityStats: Record<
  string,
  { n: number; seasons: number[]; retireAges: number[]; peaks: number[]; totalSeasons: number; injuredSeasons: number }
> = {};
const injuryTierStats: Record<string, { n: number; gamesMissed: number[] }> = {
  MINOR: { n: 0, gamesMissed: [] },
  MODERATE: { n: 0, gamesMissed: [] },
  MAJOR: { n: 0, gamesMissed: [] },
};
const snaps: { career: any; live: any }[] = [];
const seasons: any[] = [];
let nbaCareers = 0;
let nbaTotalSeasons = 0;
let nbaAllStarCareers = 0;
let nbaMvpCareers = 0;
let glassSeasons = 0;
let glassInjured = 0;
let age30PlusSeasons = 0;
let age30PlusInjured = 0;
let age30PlusMissed: number[] = [];
let unfinishedPlayoffBrackets = 0;
let proPlayoffQualified = 0;
let proTotalSeasons = 0;
let rivalTotalAllStars = 0;
let rivalTotalMvps = 0;
let rivalTotalChamps = 0;
let errors = 0;

for (let run = 0; run < CAREERS; run++) {
  S().resetAllGameData();
  const pos = POS[run % 5];
  S().startNewCareer({
    name: `SIM${run}`,
    jerseyNumber: '7',
    heightCm: HEIGHT[pos],
    primaryPos: pos,
    highSchoolTeamId: 'HS_SAMIL',
  });
  const initCareer: any = S().career!;
  const initPotential: number = initCareer.potential;
  (initOvr[pos] ??= []).push(initCareer.ovr);
  S().setView('DASHBOARD');
  try {
    for (let i = 0; i < 900 && S().view !== 'RETIREMENT'; i++) {
      const st = S();
      const c: any = st.career;
      if (!c) break;
      if (st.view === 'DRAFT_COMBINE') {
        st.completeCombineInterview('TEAM_FIRST');
        st.proceedToDraftLive();
        continue;
      }
      if (st.view === 'DRAFT_LIVE') {
        {
          // 실제 드래프트 화면과 같은 선택지: 1라운드는 보장 계약, 2라운드·미지명은 투웨이(있으면) 또는 G리그
          const dr = c.draftResult;
          const twoWayTeam = dr?.draftedTeam || dr?.twoWayOfferTeam;
          st.finalizeDraftSigning(
            dr?.draftType === 'KBL' ? 'KBL' : dr?.round === 1 ? 'NBA_STANDARD' : twoWayTeam ? 'TWO_WAY' : 'GLEAGUE'
          );
        }
        continue;
      }
      if (c.pendingEvent) {
        st.resolveEventChoice(c.pendingEvent.choices[0]);
        st.dismissEncounterOutcome();
        continue;
      }
      if (c.lastInternationalSummary) st.dismissInternationalSummary();
      if (c.seasonPhase === 'LIVE_FINAL_BROADCAST') {
        if (c.liveGame && c.liveGame.quarter === 0 && !c.liveGame.isFinished && snaps.length < 500) {
          snaps.push(structuredClone({ career: c, live: c.liveGame }));
        }
        if (!c.liveGame?.isFinished) st.skipLiveGame();
        else st.closeLiveGameAndReturn();
        continue;
      }
      if (c.seasonPhase === 'POSTSEASON_BRACKET') {
        const b = c.playoffBracket;
        // [P0 경로 통일] 플레이어가 조기 탈락했더라도 championTeamId가 확정될 때까지 대진표를 완결한 뒤 오프시즌 진입
        if (b.championTeamId) st.enterOffseasonFromPlayoffs();
        else if (b.playerReachedFinals || b.pendingConfFinalsGame7) st.startFinalsLiveBroadcast();
        else st.advancePlayoffBracketRound();
        continue;
      }
      if (c.seasonPhase === 'OFFSEASON' || c.offseasonLocked) {
        if (c.playoffBracket && c.playoffBracket.rounds?.length > 0 && !c.playoffBracket.championTeamId) {
          unfinishedPlayoffBrackets++;
        }
        const opts = c.offseasonOptions || [];
        const o =
          opts.find((x: any) => !x.locked && !String(x.actionType).startsWith('RETIRE')) ??
          opts.find((x: any) => !x.locked);
        if (!o) break;
        st.selectOffseasonOption(o);
        continue;
      }
      st.playSeason();
    }
  } catch (e) {
    errors++;
    console.error('career error', run, (e as Error).message);
  }
  const c: any = S().career;
  if (!c) continue;
  peaks.push(c.peakOvr);
  (posPeakOvr[pos] ??= []).push(c.peakOvr);
  potDiffs.push(c.peakOvr - initPotential);
  retireAges.push(c.age);

  const logs: any[] = c.seasonLogs || [];
  let maxLogOvr = -1;
  let maxLogAge = c.age;
  let recordedProJump = false;
  for (let idx = 0; idx < logs.length; idx++) {
    const l = logs[idx];
    if (l.ovr > maxLogOvr) {
      maxLogOvr = l.ovr;
      maxLogAge = l.age;
    }
    (ageOvrBuckets[l.age] ??= []).push(l.ovr);
    if (idx > 0 && l.age >= 35 && logs[idx - 1].age === l.age - 1) {
      post35Drops.push(logs[idx - 1].ovr - l.ovr);
    }
    if (!recordedProJump && idx > 0 && !AMATEUR.includes(l.league) && AMATEUR.includes(logs[idx - 1].league)) {
      const nextLog = logs[idx + 1];
      if (nextLog) {
        proJumpDeltas.push(nextLog.ovr - l.ovr);
        recordedProJump = true;
      }
    }
    if (!AMATEUR.includes(l.league)) {
      proTotalSeasons++;
      if (l.playoffResult && l.playoffResult !== 'PO 탈락') {
        proPlayoffQualified++;
      }
    }
    if (l.injuredGamesMissed > 0 && l.injurySeverity && injuryTierStats[l.injurySeverity]) {
      injuryTierStats[l.injurySeverity].n++;
      injuryTierStats[l.injurySeverity].gamesMissed.push(l.injuredGamesMissed);
    }
    if (l.age >= 30) {
      age30PlusSeasons++;
      if (l.injuredGamesMissed > 0) {
        age30PlusInjured++;
        age30PlusMissed.push(l.injuredGamesMissed);
      }
    }
  }
  peakAges.push(maxLogAge);

  const dnaKey: string = c.growthDna || 'STANDARD';
  const dBucket = (dnaStats[dnaKey] ??= {
    n: 0,
    peaks: [],
    peakAges: [],
    seasons: [],
    retireAges: [],
    potAttain: [],
  });
  dBucket.n++;
  dBucket.peaks.push(c.peakOvr);
  dBucket.peakAges.push(maxLogAge);
  dBucket.seasons.push(logs.length);
  dBucket.retireAges.push(c.age);
  dBucket.potAttain.push(c.peakOvr - initPotential);

  const traits: string[] = c.traits || [];
  const durKey = traits.includes('GLASS_BODY')
    ? '유리몸'
    : traits.includes('IRON_STAMINA')
    ? '강철체력'
    : '일반';
  const dur = (durabilityStats[durKey] ??= {
    n: 0,
    seasons: [],
    retireAges: [],
    peaks: [],
    totalSeasons: 0,
    injuredSeasons: 0,
  });
  dur.n++;
  dur.seasons.push(logs.length);
  dur.retireAges.push(c.age);
  dur.peaks.push(c.peakOvr);
  dur.totalSeasons += logs.length;
  dur.injuredSeasons += logs.filter((l: any) => l.injuredGamesMissed > 0).length;

  for (const r of c.rivals || []) {
    rivalTotalAllStars += r.allStars || 0;
    rivalTotalMvps += r.mvps || 0;
    rivalTotalChamps += r.championships || 0;
  }

  const nbaLogs = logs.filter((l: any) => l.league === 'NBA');
  if (nbaLogs.length) {
    nbaCareers++;
    nbaTotalSeasons += nbaLogs.length;
  }
  if (nbaLogs.some((l: any) => l.allStarSelected)) nbaAllStarCareers++;
  if (nbaLogs.some((l: any) => l.wonMvp)) nbaMvpCareers++;
  const glass = traits.includes('GLASS_BODY');
  for (const l of logs) {
    seasons.push(l);
    if (glass) {
      glassSeasons++;
      if (l.injuredGamesMissed > 0) glassInjured++;
    }
  }
}

const byLeague: Record<string, any> = {};
for (const l of seasons) {
  const a = (byLeague[l.league] ??= { n: 0, mvp: 0, champ: 0, allStar: 0, ppg: [] as number[], mpg: [] as number[] });
  a.n++;
  a.mvp += l.wonMvp ? 1 : 0;
  a.champ += l.wonChampionship ? 1 : 0;
  a.allStar += l.allStarSelected ? 1 : 0;
  a.ppg.push(l.ppg);
  a.mpg.push(l.mpg);
}
const leagueTable: Record<string, any> = {};
for (const [k, a] of Object.entries<any>(byLeague)) {
  leagueTable[k] = {
    시즌: a.n,
    'MVP%': pct(a.mvp, a.n),
    '우승%': pct(a.champ, a.n),
    '올스타%': pct(a.allStar, a.n),
    PPG: avg(a.ppg),
    MPG: avg(a.mpg),
  };
}
const proPpg = seasons.filter((l) => !AMATEUR.includes(l.league)).map((l) => l.ppg);
const amateurSeasons = seasons.filter((l) => l.league === 'HIGH_SCHOOL' || l.league === 'U_LEAGUE');

// ───────────────────── 2) 실제 결승 스냅샷 · 전술별 ─────────────────────
function playOut(live: any, career: any, tactic: string) {
  let lg = structuredClone(live);
  for (let g = 0; g < 24 && !lg.isFinished; g++) {
    lg = lg.pendingClutchPossession
      ? PE.resolveClutchPossession(lg, career, 'ISO_WINNER')
      : PE.simulateLiveQuarter(lg, career, tactic as any);
  }
  return lg;
}
const REPS = 20;
const tacticReal: Record<string, { n: number; w: number; pts: number; ot: number; fgm: number; fga: number }> = {};
for (const sn of snaps) {
  for (const t of TACTICS) {
    for (let k = 0; k < REPS; k++) {
      const lg = playOut(sn.live, sn.career, t);
      const a = (tacticReal[t] ??= { n: 0, w: 0, pts: 0, ot: 0, fgm: 0, fga: 0 });
      a.n++;
      a.w += lg.teamScore > lg.oppScore ? 1 : 0;
      a.pts += lg.playerStats.pts;
      a.ot += (lg.overtimeCount || 0) > 0 ? 1 : 0;
      a.fgm += lg.playerStats.fgm || 0;
      a.fga += lg.playerStats.fga || 0;
    }
  }
}

// ───────────────────── 3) 동일 전력 · 선수 등급별 ─────────────────────
const TIERS = { 하위: -8, 평균: 0, 엘리트: 10 } as const;
const equalTier: Record<string, { n: number; w: number; pts: number }> = {};
const leagueSnaps = snaps.filter((s) => s.live.gameType === 'LEAGUE_FINALS' || s.live.gameType === 'CONF_FINALS_GAME7');
for (const sn of leagueSnaps) {
  const ldr = LEAGUE_CONFIG[sn.career.league as keyof typeof LEAGUE_CONFIG].ldr;
  const teamRating = sn.career.teamRatingsMap?.[sn.live.playerTeam.id] ?? sn.live.playerTeam.rating;
  for (const [tier, d] of Object.entries(TIERS)) {
    const v = Math.max(35, Math.min(99, ldr + d));
    const career = { ...sn.career, stats: { ins: v, out: v, ply: v, def: v, reb: v, phy: v } };
    const live = { ...sn.live, opponentTeam: { ...sn.live.opponentTeam, rating: teamRating } };
    for (const t of TACTICS) {
      for (let k = 0; k < 10; k++) {
        const lg = playOut(live, career, t);
        for (const key of [tier, `${tier}|${t}`]) {
          const a = (equalTier[key] ??= { n: 0, w: 0, pts: 0 });
          a.n++;
          a.w += lg.teamScore > lg.oppScore ? 1 : 0;
          a.pts += lg.playerStats.pts;
        }
      }
    }
  }
}

// ───────────────────── 4) 9개 리그 자체 20년 판도 시뮬레이션 (리그당 100시즌) ─────────────────────
const parityRng = mulberry32(SEED ^ 0x51a7b3);
const parityTable: Record<string, any> = {};
const parityMetrics: Record<
  string,
  {
    uniqueChamps: number;
    maxChampPct: number;
    maxFinalsPct: number;
    bottomHalfChampPct: number;
    consecFinalsPct: number;
    topChamp: string;
    topPair: string;
  }
> = {};

for (const lg of ALL_LEAGUES) {
  const teams = TEAMS.getTeamsByLeague(lg);
  const sortedInit = [...teams].sort((a, b) => b.rating - a.rating);
  const bottomHalfIds = new Set(
    sortedInit.slice(Math.floor(sortedInit.length / 2)).map((t) => t.id)
  );
  const champCounts: Record<string, number> = {};
  const finalsTeamCounts: Record<string, number> = {};
  const finalsPairCounts: Record<string, number> = {};
  let consecFinals = 0;
  let bottomHalfChamps = 0;
  let totalSeasons = 0;

  for (let run = 0; run < 5; run++) {
    let ratingsMap = TEAMS.createInitialTeamRatingsMap();
    let prevPair = '';
    for (let yr = 0; yr < 20; yr++) {
      if (yr > 0) ratingsMap = TEAMS.evolveLeagueTeamRatings(ratingsMap, parityRng);
      const totalG = LEAGUE_CONFIG[lg].games;
      const ghostCareer: any = {
        id: 'PARITY',
        name: 'NPC',
        age: 22,
        seasonYear: 2025 + yr,
        seasonsPlayed: yr,
        heightCm: 192,
        primaryPos: 'SG',
        secondaryPos: null,
        jerseyNumber: 7,
        playstyle: 'ALL_ROUNDER',
        growthDna: 'BALANCED',
        traits: [],
        league: lg,
        team: { ...sortedInit[0], id: 'GHOST_OBSERVER', rating: 50 },
        teamRatingsMap: ratingsMap,
        ovr: LEAGUE_CONFIG[lg].ldr,
        peakOvr: 70,
        ovrHistory: [70],
        potential: 75,
        stats: {
          ins: LEAGUE_CONFIG[lg].ldr,
          out: LEAGUE_CONFIG[lg].ldr,
          ply: LEAGUE_CONFIG[lg].ldr,
          def: LEAGUE_CONFIG[lg].ldr,
          reb: LEAGUE_CONFIG[lg].ldr,
          phy: LEAGUE_CONFIG[lg].ldr,
        },
        role: '주전',
        coachTrust: 50,
        draftStock: 50,
        contractType: 'STANDARD',
        contractYearsLeft: 1,
        annualSalary: 50000,
        cashBalance: 50000,
        activePersonalCare: [],
        militaryExempt: true,
        militaryServiceSeasonsLeft: 0,
        previousTeamBeforeMilitary: null,
        seasonLogs: [],
        milestones: [],
        badges: [],
        rivals: [],
        internationalHistory: [],
        totals: {
          games: 0,
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          championships: 0,
          nbaChampionships: 0,
          mvps: 0,
          finalsMvps: 0,
          allStars: 0,
          allLeagueTeams: 0,
        },
        careerHighs: { points: 0, pointsContext: '', rebounds: 0, assists: 0, steals: 0, blocks: 0 },
        seasonPhase: 'REGULAR_SEASON',
        offseasonLocked: false,
        offseasonOptions: [],
        pendingEvent: null,
      };
      const rawStandings = PE.generateLeagueStandings(ghostCareer, 1, totalG - 1, parityRng);
      const realStandings = rawStandings.filter((s) => s.team.id !== 'GHOST_OBSERVER');
      const carrierTeam = realStandings[0].team;
      const neutralCareer = { ...ghostCareer, team: carrierTeam };
      const standingsWithCarrier = realStandings.map((s) => ({
        ...s,
        isPlayerTeam: s.team.id === carrierTeam.id,
      }));
      let bracket = PE.createPlayoffBracket(neutralCareer, standingsWithCarrier, parityRng);
      bracket = {
        ...bracket,
        rounds: bracket.rounds.map((r) => r.map((s) => ({ ...s, involvesPlayer: false }))),
      };
      const finished = PE.skipEntirePlayoffs(bracket, neutralCareer, standingsWithCarrier, parityRng);
      if (!finished.championTeamId) continue;
      totalSeasons++;
      const champTeam = teams.find((t) => t.id === finished.championTeamId);
      const champName = champTeam?.shortName || finished.championTeamId;
      champCounts[champName] = (champCounts[champName] || 0) + 1;
      if (bottomHalfIds.has(finished.championTeamId)) bottomHalfChamps++;

      const finalsSeries = (finished.rounds[finished.rounds.length - 1] || [])[0];
      let pairKey = 'NONE';
      if (finalsSeries) {
        const a = finalsSeries.higherSeed.team.shortName;
        const b = finalsSeries.lowerSeed.team.shortName;
        finalsTeamCounts[a] = (finalsTeamCounts[a] || 0) + 1;
        finalsTeamCounts[b] = (finalsTeamCounts[b] || 0) + 1;
        pairKey = [a, b].sort().join(' vs ');
      }
      finalsPairCounts[pairKey] = (finalsPairCounts[pairKey] || 0) + 1;
      if (yr > 0 && pairKey === prevPair) consecFinals++;
      prevPair = pairKey;
    }
  }

  const topChampEntry = Object.entries(champCounts).sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  const topFinalsEntry = Object.entries(finalsTeamCounts).sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  const topPairEntry = Object.entries(finalsPairCounts).sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  const pm = {
    uniqueChamps: Object.keys(champCounts).length,
    maxChampPct: pct(topChampEntry[1], totalSeasons),
    maxFinalsPct: pct(topFinalsEntry[1], totalSeasons),
    bottomHalfChampPct: pct(bottomHalfChamps, totalSeasons),
    consecFinalsPct: pct(consecFinals, Math.max(1, totalSeasons - 5)),
    topChamp: `${topChampEntry[0]}(${topChampEntry[1]}%)`,
    topPair: `${topPairEntry[0]}(${topPairEntry[1]}%)`,
  };
  parityMetrics[lg] = pm;
  parityTable[lg] = {
    우승팀종류: `${pm.uniqueChamps}/${teams.length}`,
    '최다결승%': pm.maxFinalsPct,
    '최다우승%': pm.maxChampPct,
    '하위50%우승%': pm.bottomHalfChampPct,
    '연속동일결승%': pm.consecFinalsPct,
    최다우승: pm.topChamp,
    최다매치업: pm.topPair,
  };
}

// ───────────────────── 5) 리그별 등급(평균/스타/슈퍼) MVP · 파이널 MVP 정합성 검증 ─────────────────────
const fmvpRng = mulberry32(SEED ^ 0x9e3779b9);
const fmvpCheckTable: Record<string, any> = {};
const fmvpCheckMetrics: Record<string, { avgLiveFmvp: number; starLiveFmvp: number; avgLivePts: number; starSimFmvp: number }> = {};
for (const lg of ['KBL', 'EUROLEAGUE', 'NBA'] as const) {
  const ldr = LEAGUE_CONFIG[lg].ldr;
  const teams = TEAMS.getTeamsByLeague(lg);
  const sorted = [...teams].sort((a, b) => b.rating - a.rating);
  const midTeam = sorted[Math.floor(sorted.length * 0.35)];
  const oppTeam = sorted[0].id === midTeam.id ? sorted[1] : sorted[0];
  const ratingsMap = TEAMS.createInitialTeamRatingsMap();
  const tierRes: Record<string, { liveFmvp: number; simFmvp: number; livePts: number; mvp: number }> = {};

  for (const [label, delta] of [['평균', 0], ['스타', 6], ['슈퍼', 12]] as const) {
    const v = Math.min(97, ldr + delta);
    const stats = { ins: v, out: v, ply: v, def: v, reb: v, phy: v };
    const ovr = STAT.calculateOvr(stats, 'SG', 193);
    let mvp = 0, simFmvp = 0, liveWins = 0, liveFmvp = 0, ptsSum = 0;
    const N = 160;
    for (let i = 0; i < N; i++) {
      const c: any = {
        id: 'F',
        name: '테스트',
        age: 25,
        seasonYear: 2027,
        seasonsPlayed: 5,
        heightCm: 193,
        primaryPos: 'SG',
        secondaryPos: null,
        jerseyNumber: 7,
        playstyle: 'ALL_ROUNDER',
        growthDna: 'BALANCED',
        traits: [],
        trainingFocus: 'BALANCED',
        league: lg,
        team: midTeam,
        teamRatingsMap: ratingsMap,
        ovr,
        peakOvr: ovr,
        ovrHistory: [ovr],
        potential: Math.min(99, ovr + 4),
        stats,
        role: delta >= 6 ? '에이스' : '주전',
        coachTrust: 75,
        draftStock: 75,
        contractType: 'STANDARD',
        contractYearsLeft: 2,
        annualSalary: 1000000,
        cashBalance: 500000,
        activePersonalCare: [],
        militaryExempt: true,
        militaryServiceSeasonsLeft: 0,
        previousTeamBeforeMilitary: null,
        // 5시즌차 기성 선수: 1.1.0 루키 적응 곡선이 적용되지 않도록 같은 리그 이전 시즌 3개 (출전 0분 → 효율 모멘텀 0)
        seasonLogs: [2024, 2025, 2026].map((year) => ({
          year, league: lg, teamId: midTeam.id, teamName: midTeam.name, teamShortName: midTeam.shortName,
          role: '주전 스타터', mpg: 0, gp: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 45, tpPct: 35,
          wins: 0, losses: 0, wonChampionship: false, wonMvp: false, wonFinalsMvp: false, allStarSelected: false,
        })),
        milestones: [],
        badges: [],
        rivals: [],
        internationalHistory: [],
        totals: { games:0, points:0, rebounds:0, assists:0, steals:0, blocks:0, championships:0, nbaChampionships:0, mvps:0, finalsMvps:0, allStars:0, allLeagueTeams:0 },
        careerHighs: { points:0, pointsContext:'', rebounds:0, assists:0, steals:0, blocks:0 },
        seasonPhase: 'REGULAR_SEASON',
        offseasonLocked: false,
        offseasonOptions: [],
        pendingEvent: null,
      };
      const sim = SIM.simulateSeason(c, fmvpRng);
      if (sim.boxScore.wonMvp) mvp++;
      const cLog = { ...c, seasonLogs: [sim.boxScore] };
      if (PE.evaluateRealisticFinalsMvp(cLog, true)) simFmvp++;
      const live = PE.createLiveFinalGame(cLog, oppTeam, 'LEAGUE_FINALS');
      const done = PE.skipLiveGameToEnd(live, cLog, fmvpRng);
      ptsSum += done.playerStats.pts;
      if (done.finalOutcome?.won) {
        liveWins++;
        if (done.finalOutcome.wonFinalsMvp) liveFmvp++;
      }
    }
    tierRes[label] = {
      mvp: pct(mvp, N),
      simFmvp: pct(simFmvp, N),
      liveFmvp: pct(liveFmvp, liveWins),
      livePts: +(ptsSum / N).toFixed(1),
    };
  }
  fmvpCheckMetrics[lg] = {
    avgLiveFmvp: tierRes['평균'].liveFmvp,
    starLiveFmvp: tierRes['스타'].liveFmvp,
    avgLivePts: tierRes['평균'].livePts,
    starSimFmvp: tierRes['스타'].simFmvp,
  };
  fmvpCheckTable[lg] = {
    '평균_라이브득점': tierRes['평균'].livePts,
    '평균_FMVP(시뮬/라이브%)': `${tierRes['평균'].simFmvp}/${tierRes['평균'].liveFmvp}`,
    '스타_FMVP(시뮬/라이브%)': `${tierRes['스타'].simFmvp}/${tierRes['스타'].liveFmvp}`,
    '슈퍼_MVP%': tierRes['슈퍼'].mvp,
    '슈퍼_FMVP(시뮬/라이브%)': `${tierRes['슈퍼'].simFmvp}/${tierRes['슈퍼'].liveFmvp}`,
  };
}

// ───────────────────── 출력 ─────────────────────
const totalLiveSims = Object.values(tacticReal).reduce((s, a) => s + a.n, 0);
const totalLiveOt = Object.values(tacticReal).reduce((s, a) => s + a.ot, 0);

const dnaTable = Object.fromEntries(
  Object.entries(dnaStats).map(([k, v]) => [
    k,
    {
      인원: v.n,
      최고OVR: avg(v.peaks),
      전성기나이: avg(v.peakAges),
      현역시즌: avg(v.seasons),
      은퇴나이: avg(v.retireAges),
      '잠재력대비(OVR-POT)': avg(v.potAttain),
    },
  ])
);

const durabilityTable = Object.fromEntries(
  Object.entries(durabilityStats).map(([k, v]) => [
    k,
    {
      인원: v.n,
      현역시즌: avg(v.seasons),
      은퇴나이: avg(v.retireAges),
      최고OVR: avg(v.peaks),
      '시즌부상률%': pct(v.injuredSeasons, v.totalSeasons),
    },
  ])
);

const ageMilestones = [17, 19, 21, 23, 25, 27, 30, 33, 35, 38, 40];
const ageOvrSummary = Object.fromEntries(
  ageMilestones
    .filter((a) => (ageOvrBuckets[a]?.length ?? 0) > 0)
    .map((a) => [`${a}세`, `${avg(ageOvrBuckets[a])} (n=${ageOvrBuckets[a].length})`])
);

const injuryTierSummary = Object.fromEntries(
  Object.entries(injuryTierStats).map(([tier, v]) => [
    tier,
    { 발생횟수: v.n, 평균결장경기: avg(v.gamesMissed) },
  ])
);

const metrics = {
  careers: CAREERS,
  errors,
  unfinishedPlayoffBrackets,
  nbaReachPct: pct(nbaCareers, CAREERS),
  nbaAvgSeasons: nbaCareers ? +(nbaTotalSeasons / nbaCareers).toFixed(2) : 0,
  nbaAllStarPctOfNba: pct(nbaAllStarCareers, nbaCareers),
  nbaMvpPct: pct(nbaMvpCareers, CAREERS),
  nbaPpg: byLeague.NBA ? avg(byLeague.NBA.ppg) : 0,
  kblPpg: byLeague.KBL ? avg(byLeague.KBL.ppg) : 0,
  kblMvpPct: byLeague.KBL ? pct(byLeague.KBL.mvp, byLeague.KBL.n) : 0,
  peakOvrP50: q(peaks, 0.5),
  peakOvrP90: q(peaks, 0.9),
  avgPeakAge: avg(peakAges),
  avgPotAttainmentGap: avg(potDiffs),
  avgProFirstYearOvrJump: avg(proJumpDeltas),
  avgRetireAge: avg(retireAges),
  avgOvrAt30: avg(ageOvrBuckets[30] || []),
  avgOvrAt35: avg(ageOvrBuckets[35] || []),
  avgOvrAt40: avg(ageOvrBuckets[40] || []),
  avgPost35AnnualOvrDrop: avg(post35Drops),
  age30PlusInjuryPct: pct(age30PlusInjured, age30PlusSeasons),
  age30PlusAvgMissedGames: avg(age30PlusMissed),
  amateurMvpPct: pct(amateurSeasons.filter((l) => l.wonMvp).length, amateurSeasons.length),
  proPpg26PlusPct: pct(proPpg.filter((x) => x >= 26).length, proPpg.length),
  proPlayoffQualPct: pct(proPlayoffQualified, proTotalSeasons),
  glassBodyInjuryPct: pct(glassInjured, glassSeasons),
  initOvrSpread: +(
    Math.max(...Object.values(initOvr).map(avg)) - Math.min(...Object.values(initOvr).map(avg))
  ).toFixed(2),
  peakOvrPosSpread: +(
    Math.max(...Object.values(posPeakOvr).map(avg)) - Math.min(...Object.values(posPeakOvr).map(avg))
  ).toFixed(2),
  rivalSymmetryTotals: {
    allStars: rivalTotalAllStars,
    mvps: rivalTotalMvps,
    championships: rivalTotalChamps,
  },
  liveOvertimePct: pct(totalLiveOt, totalLiveSims),
  realFinalsWinPct: Object.fromEntries(TACTICS.map((t) => [t, pct(tacticReal[t]?.w ?? 0, tacticReal[t]?.n ?? 0)])),
  realFinalsPlayerPts: Object.fromEntries(
    TACTICS.map((t) => [t, tacticReal[t] ? +(tacticReal[t].pts / tacticReal[t].n).toFixed(1) : 0])
  ),
  realFinalsPlayerFgPct: Object.fromEntries(
    TACTICS.map((t) => [t, tacticReal[t] && tacticReal[t].fga > 0 ? pct(tacticReal[t].fgm, tacticReal[t].fga) : 0])
  ),
  equalTeamWinPct: Object.fromEntries(Object.keys(TIERS).map((k) => [k, pct(equalTier[k]?.w ?? 0, equalTier[k]?.n ?? 0)])),
  equalTeamTacticSpread: Object.fromEntries(
    Object.keys(TIERS).map((tier) => {
      const ws = TACTICS.map((t) => pct(equalTier[`${tier}|${t}`]?.w ?? 0, equalTier[`${tier}|${t}`]?.n ?? 0));
      return [tier, +(Math.max(...ws) - Math.min(...ws)).toFixed(1)];
    })
  ),
  nbaParityMaxFinalsPct: parityMetrics.NBA.maxFinalsPct,
  nbaParityBottomHalfChampPct: parityMetrics.NBA.bottomHalfChampPct,
  nbaParityConsecFinalsPct: parityMetrics.NBA.consecFinalsPct,
  kblParityMaxChampPct: parityMetrics.KBL.maxChampPct,
  nbaAvgLiveFmvpPct: fmvpCheckMetrics.NBA.avgLiveFmvp,
  nbaStarLiveFmvpPct: fmvpCheckMetrics.NBA.starLiveFmvp,
};

const earlyPeakAge = dnaTable.EARLY_BLOOMER?.전성기나이 ?? 0;
const latePeakAge = dnaTable.LATE_BLOOMER?.전성기나이 ?? 0;
const ironInjuryPct = durabilityTable['강철체력']?.['시즌부상률%'] ?? 0;
const normalInjuryPct = durabilityTable['일반']?.['시즌부상률%'] ?? 0;
const glassInjuryPct = durabilityTable['유리몸']?.['시즌부상률%'] ?? 0;

const dnaLateMinusEarlyPeakAge = +(latePeakAge - earlyPeakAge).toFixed(2);
const durabilityNormalMinusIronInjuryPct = +(normalInjuryPct - ironInjuryPct).toFixed(1);
const durabilityGlassMinusNormalInjuryPct = +(glassInjuryPct - normalInjuryPct).toFixed(1);

if (verbose) {
  console.log(`\n== 시드 ${SEED} · 커리어 ${CAREERS}회 · 결승 스냅샷 ${snaps.length}개`);
  console.log('\n[포지션별 초기 OVR / 최고 OVR 평균]', Object.fromEntries(POS.map((p) => [p, `${avg(initOvr[p] || [])} -> ${avg(posPeakOvr[p] || [])}`])));
  console.log('\n[나이별 평균 OVR 곡선]', ageOvrSummary);
  console.log('\n[성장 DNA별 장기 커리어 분포]');
  console.table(dnaTable);
  console.log('[내구성 유형별 커리어·부상 비교]');
  console.table(durabilityTable);
  console.log('[부상 등급별 결장 경기 수]');
  console.table(injuryTierSummary);
  console.log('[리그별 시즌 기록]');
  console.table(leagueTable);
  console.log('[실제 결승 · 전술별 승률 / 선수 득점 / 야투율]');
  console.table(
    Object.fromEntries(
      TACTICS.map((t) => [
        t,
        {
          '승률%': metrics.realFinalsWinPct[t],
          선수득점: metrics.realFinalsPlayerPts[t],
          '야투%': metrics.realFinalsPlayerFgPct[t],
        },
      ])
    )
  );
  console.log('[동일 전력 결승 · 선수 등급 × 전술 승률%]');
  console.table(
    Object.fromEntries(
      Object.keys(TIERS).map((tier) => [
        tier,
        Object.fromEntries(
          TACTICS.map((t) => [t, pct(equalTier[`${tier}|${t}`]?.w ?? 0, equalTier[`${tier}|${t}`]?.n ?? 0)])
        ),
      ])
    )
  );
  console.log('[9개 리그 자체 20년 판도 (리그당 100시즌)]');
  console.table(parityTable);
  console.log('[주요 프로리그 등급별 정규 MVP · 파이널 MVP 정합성]');
  console.table(fmvpCheckTable);
  console.log('[요약 지표]');
  console.log(JSON.stringify(metrics, null, 2));
}

// ───────────────────── 목표 범위 검사 (성장·에이징·내구성·수상·판도·라이브 통합) ─────────────────────
const BALANCE_TARGETS: [string, number, number, number][] = [
  ['오류 0', metrics.errors, 0, 0],
  ['미완결 플레이오프 대진 0', metrics.unfinishedPlayoffBrackets, 0, 0],
  // NBA 진출·NBA 커리어 지표는 1.1.0부터 실제 유저 집단을 근사한 scripts/nba-path-sim.ts --check 에서 검사합니다.
  // (이 스크립트의 '첫 선택지' 자동 플레이는 NBA 드래프트에 거의 도전하지 않아 NBA 지표 대표성이 없습니다.)
  ['최고 OVR 중앙값', metrics.peakOvrP50, 80, 87],
  ['평균 전성기 나이', metrics.avgPeakAge, 28.5, 31.5],
  ['평균 은퇴 나이', metrics.avgRetireAge, 33.5, 37.0],
  ['잠재력 대비 최고 OVR 격차', metrics.avgPotAttainmentGap, -5.0, 1.0],
  ['35세 이후 연간 OVR 하락폭', metrics.avgPost35AnnualOvrDrop, 1.2, 3.6],
  ['30대 시즌 부상률(%)', metrics.age30PlusInjuryPct, 10, 28],
  ['성장 DNA 전성기 순서 (대기만성-조기개화)', dnaLateMinusEarlyPeakAge, 0.0, 3.5],
  ['내구성 부상률 격차 (일반-강철체력 %p)', durabilityNormalMinusIronInjuryPct, 4.0, 22.0],
  ['내구성 부상률 격차 (유리몸-일반 %p)', durabilityGlassMinusNormalInjuryPct, 2.0, 22.0],
  ['고교·대학 MVP 수상률(%)', metrics.amateurMvpPct, 10, 30],
  ['KBL 평균 PPG', metrics.kblPpg, 19, 26.5],
  ['프로 26+ PPG 시즌 비율(%)', metrics.proPpg26PlusPct, 0, 42],
  ['초기 OVR 포지션 격차', metrics.initOvrSpread, 0, 2.5],
  ['최고 OVR 포지션 격차', metrics.peakOvrPosSpread, 0, 3.2],
  ['라이브 결승 연장전 비율(%)', metrics.liveOvertimePct, 1.0, 9.0],
  ['라이브 결승 에이스 모드 평균 득점', metrics.realFinalsPlayerPts.ACE_HERO, 24, 38],
  ['라이브 결승 이타적 조율 평균 득점', metrics.realFinalsPlayerPts.UNSELFISH_PASS, 18, 28],
  ['동일 전력 하위 승률(%)', metrics.equalTeamWinPct['하위'], 25, 48],
  ['동일 전력 평균 승률(%)', metrics.equalTeamWinPct['평균'], 45, 60],
  ['동일 전력 엘리트 승률(%)', metrics.equalTeamWinPct['엘리트'], 60, 80],
  ['평균 선수 전술 승률 격차(%p)', metrics.equalTeamTacticSpread['평균'], 0, 10],
  ['NBA 최다 결승 진출팀 점유율(%)', metrics.nbaParityMaxFinalsPct, 0, 26],
  ['NBA 초기 하위50% 팀 우승 비율(%)', metrics.nbaParityBottomHalfChampPct, 20, 55],
  ['NBA 연속 동일 결승 비율(%)', metrics.nbaParityConsecFinalsPct, 0, 8],
  ['KBL 최다 우승팀 점유율(%)', metrics.kblParityMaxChampPct, 0, 24],
  ['NBA 평균 주전 라이브 FMVP(%)', metrics.nbaAvgLiveFmvpPct, 10, 55],
  ['NBA 스타급 라이브 FMVP(%)', metrics.nbaStarLiveFmvpPct, 65, 100],
];
let failed = 0;
const failedNames: string[] = [];
if (verbose) console.log('\n[목표 범위 검사]');
for (const [name, v, lo, hi] of BALANCE_TARGETS) {
  const ok = v >= lo && v <= hi;
  if (!ok) {
    failed++;
    failedNames.push(`${name}=${v} (${lo}~${hi})`);
  }
  if (verbose || !ok) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  [시드 ${SEED}] ${name}: ${v} (목표 ${lo}~${hi})`);
  }
}
return {
  seed: SEED,
  failed,
  passed: BALANCE_TARGETS.length - failed,
  total: BALANCE_TARGETS.length,
  failedNames,
  summary: {
    NBA진출: metrics.nbaReachPct,
    NBA시즌: metrics.nbaAvgSeasons,
    NBA올스타: metrics.nbaAllStarPctOfNba,
    NBAMVP: metrics.nbaMvpPct,
    평균FMVP: metrics.nbaAvgLiveFmvpPct,
    최고OVR: metrics.peakOvrP50,
    전성기: metrics.avgPeakAge,
    은퇴: metrics.avgRetireAge,
    '30대부상': metrics.age30PlusInjuryPct,
    DNA차: dnaLateMinusEarlyPeakAge,
    라이벌MVP: metrics.rivalSymmetryTotals.mvps,
  },
  targetValues: Object.fromEntries(BALANCE_TARGETS.map(([name, v]) => [name, v])),
  targetRanges: Object.fromEntries(BALANCE_TARGETS.map(([name, , lo, hi]) => [name, [lo, hi] as [number, number]])),
};
}

const results = SEEDS.map((s) => runSeedSimulation(s, SEEDS.length === 1));
let pooledFailed = 0;
if (SEEDS.length > 1) {
  const pooledFailedNames: string[] = [];
  const firstRanges = results[0].targetRanges;
  for (const [name, [lo, hi]] of Object.entries(firstRanges)) {
    const meanVal = +(
      results.reduce((sum, r) => sum + (r.targetValues[name] ?? 0), 0) / results.length
    ).toFixed(2);
    if (meanVal < lo || meanVal > hi) {
      pooledFailed++;
      pooledFailedNames.push(`${name}=${meanVal} (${lo}~${hi})`);
      console.log(`FAIL  [다중 시드 통합 평균] ${name}: ${meanVal} (목표 ${lo}~${hi})`);
    }
  }
  const pooledSummary = Object.fromEntries(
    Object.keys(results[0].summary).map((k) => [
      k,
      +(results.reduce((sum, r) => sum + (r.summary[k] ?? 0), 0) / results.length).toFixed(2),
    ])
  );
  console.log(`\n[다중 시드 회귀 검증 요약 (${SEEDS.length}개 시드 × ${CAREERS}커리어 = 총 ${SEEDS.length * CAREERS}커리어)]`);
  console.table({
    ...Object.fromEntries(
      results.map((r) => [
        `SEED_${r.seed}`,
        {
          통과: `${r.passed}/${r.total}`,
          ...r.summary,
          실패항목: r.failedNames.length ? r.failedNames.join('; ') : '-',
        },
      ])
    ),
    POOLED_MEAN: {
      통과: `${results[0].total - pooledFailed}/${results[0].total}`,
      ...pooledSummary,
      실패항목: pooledFailedNames.length ? pooledFailedNames.join('; ') : '-',
    },
  });
}

const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
const criticalPerSeedFailed = results.some(
  (r) => (r.targetValues['오류 0'] ?? 0) > 0 || (r.targetValues['미완결 플레이오프 대진 0'] ?? 0) > 0
);
if (CHECK) {
  if (SEEDS.length === 1 && totalFailed > 0) process.exit(1);
  if (SEEDS.length > 1 && (pooledFailed > 0 || criticalPerSeedFailed)) process.exit(1);
}
