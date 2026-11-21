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

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CHECK = process.argv.includes('--check');
const CAREERS = Number(args[0] ?? 200);
const SEED = Number(args[1] ?? 20261121);

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
Math.random = mulberry32(SEED);

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
const { LEAGUE_CONFIG } = await import('../src/data/leagues');
const S = () => useCareerStore.getState();

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

// ───────────────────── 1) 커리어 루프 ─────────────────────
const initOvr: Record<string, number[]> = {};
const peaks: number[] = [];
const snaps: { career: any; live: any }[] = [];
const seasons: any[] = [];
let nbaCareers = 0;
let nbaAllStarCareers = 0;
let nbaMvpCareers = 0;
let glassSeasons = 0;
let glassInjured = 0;
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
  (initOvr[pos] ??= []).push(S().career!.ovr);
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
        st.finalizeDraftSigning(c.draftResult?.pickNumber ? 'NBA_STANDARD' : 'GLEAGUE');
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
        if (b.championTeamId || b.playerEliminated) st.enterOffseasonFromPlayoffs();
        else if (b.playerReachedFinals || b.pendingConfFinalsGame7) st.startFinalsLiveBroadcast();
        else st.advancePlayoffBracketRound();
        continue;
      }
      if (c.seasonPhase === 'OFFSEASON' || c.offseasonLocked) {
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
  const nbaLogs = c.seasonLogs.filter((l: any) => l.league === 'NBA');
  if (nbaLogs.length) nbaCareers++;
  if (nbaLogs.some((l: any) => l.allStarSelected)) nbaAllStarCareers++;
  if (nbaLogs.some((l: any) => l.wonMvp)) nbaMvpCareers++;
  const glass = (c.traits || []).includes('GLASS_BODY');
  for (const l of c.seasonLogs) {
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
const tacticReal: Record<string, { n: number; w: number; pts: number }> = {};
for (const sn of snaps) {
  for (const t of TACTICS) {
    for (let k = 0; k < REPS; k++) {
      const lg = playOut(sn.live, sn.career, t);
      const a = (tacticReal[t] ??= { n: 0, w: 0, pts: 0 });
      a.n++;
      a.w += lg.teamScore > lg.oppScore ? 1 : 0;
      a.pts += lg.playerStats.pts;
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

// ───────────────────── 출력 ─────────────────────
const metrics = {
  careers: CAREERS,
  errors,
  nbaReachPct: pct(nbaCareers, CAREERS),
  nbaAllStarPctOfNba: pct(nbaAllStarCareers, nbaCareers),
  nbaMvpPct: pct(nbaMvpCareers, CAREERS),
  nbaPpg: byLeague.NBA ? avg(byLeague.NBA.ppg) : 0,
  peakOvrP50: q(peaks, 0.5),
  peakOvrP90: q(peaks, 0.9),
  amateurMvpPct: pct(amateurSeasons.filter((l) => l.wonMvp).length, amateurSeasons.length),
  proPpg26PlusPct: pct(proPpg.filter((x) => x >= 26).length, proPpg.length),
  glassBodyInjuryPct: pct(glassInjured, glassSeasons),
  initOvrSpread: +(
    Math.max(...Object.values(initOvr).map(avg)) - Math.min(...Object.values(initOvr).map(avg))
  ).toFixed(2),
  realFinalsWinPct: Object.fromEntries(TACTICS.map((t) => [t, pct(tacticReal[t]?.w ?? 0, tacticReal[t]?.n ?? 0)])),
  realFinalsPlayerPts: Object.fromEntries(
    TACTICS.map((t) => [t, tacticReal[t] ? +(tacticReal[t].pts / tacticReal[t].n).toFixed(1) : 0])
  ),
  equalTeamWinPct: Object.fromEntries(Object.keys(TIERS).map((k) => [k, pct(equalTier[k]?.w ?? 0, equalTier[k]?.n ?? 0)])),
  equalTeamTacticSpread: Object.fromEntries(
    Object.keys(TIERS).map((tier) => {
      const ws = TACTICS.map((t) => pct(equalTier[`${tier}|${t}`]?.w ?? 0, equalTier[`${tier}|${t}`]?.n ?? 0));
      return [tier, +(Math.max(...ws) - Math.min(...ws)).toFixed(1)];
    })
  ),
};

console.log(`\n== 시드 ${SEED} · 커리어 ${CAREERS}회 · 결승 스냅샷 ${snaps.length}개`);
console.log('\n[포지션별 초기 OVR 평균]', Object.fromEntries(Object.entries(initOvr).map(([k, v]) => [k, avg(v)])));
console.log('\n[리그별 시즌 기록]');
console.table(leagueTable);
console.log('[실제 결승 · 전술별 승률 / 선수 득점]');
console.table(
  Object.fromEntries(
    TACTICS.map((t) => [t, { '승률%': metrics.realFinalsWinPct[t], 선수득점: metrics.realFinalsPlayerPts[t] }])
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
console.log('[요약 지표]');
console.log(JSON.stringify(metrics, null, 2));

// ───────────────────── 목표 범위 검사 ─────────────────────
const BALANCE_TARGETS: [string, number, number, number][] = [
  ['오류 0', metrics.errors, 0, 0],
  ['NBA 진출률(%)', metrics.nbaReachPct, 30, 55],
  ['NBA 진출자 중 올스타 경험(%)', metrics.nbaAllStarPctOfNba, 20, 65],
  ['NBA MVP 경험(%)', metrics.nbaMvpPct, 1, 12],
  ['최고 OVR 중앙값', metrics.peakOvrP50, 80, 87],
  ['고교·대학 MVP 수상률(%)', metrics.amateurMvpPct, 10, 30],
  ['초기 OVR 포지션 격차', metrics.initOvrSpread, 0, 2.5],
  ['동일 전력 하위 승률(%)', metrics.equalTeamWinPct['하위'], 25, 48],
  ['동일 전력 평균 승률(%)', metrics.equalTeamWinPct['평균'], 45, 60],
  ['동일 전력 엘리트 승률(%)', metrics.equalTeamWinPct['엘리트'], 60, 80],
  ['평균 선수 전술 승률 격차(%p)', metrics.equalTeamTacticSpread['평균'], 0, 10],
];
let failed = 0;
console.log('\n[목표 범위 검사]');
for (const [name, v, lo, hi] of BALANCE_TARGETS) {
  const ok = v >= lo && v <= hi;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${v} (목표 ${lo}~${hi})`);
}
if (CHECK && failed) process.exit(1);
