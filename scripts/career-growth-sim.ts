/**
 * 장기 커리어 성장·은퇴 분포 분석 시뮬레이터
 *
 * 실행:
 *   bun run balance:career [커리어 수=1000] [시드=20261122]
 *   (= bun scripts/career-growth-sim.ts ...)
 *
 * 실제 useCareerStore 커리어 루프를 고교 입학부터 은퇴/중단까지 자동 진행합니다.
 * 시즌 로그와 pendingSeasonSettlement을 함께 읽어 시즌 종료 후 OVR/잠재력을 기록합니다.
 * 결과 CSV/JSON은 balance-results/ 아래에 저장됩니다.
 *
 * 자동 플레이는 이벤트 첫 선택지·기본 훈련·기본 비은퇴 오프시즌 선택지를 사용합니다.
 * 따라서 최적 플레이가 아닌 일관된 기준선(평범한 자동 진행)으로 해석해야 합니다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

export {};

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CAREERS = Math.max(1, Math.floor(Number(args[0] ?? 1000)));
const SEED = Number(args[1] ?? 20261122);

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
  setItem: (k: string, v: string) => { mem[k] = v; },
  removeItem: (k: string) => { delete mem[k]; },
};
(globalThis as any).window = globalThis;
const origWarn = console.warn;
console.warn = (...a: unknown[]) => {
  if (String(a[0]).includes('[zustand')) return;
  origWarn(...a);
};

const { useCareerStore } = await import('../src/store/useCareerStore');
const S = () => useCareerStore.getState();

const POS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const HEIGHT: Record<string, number> = { PG: 185, SG: 192, SF: 199, PF: 204, C: 211 };
const round = (n: number, d = 2) => Number(n.toFixed(d));
const mean = (xs: number[]) => xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
const quantile = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : 0;
};
const pct = (n: number, d: number) => d ? round((n / d) * 100, 1) : 0;
const potentialBand = (n: number) => n < 75 ? '<75' : n < 85 ? '75-84' : n < 90 ? '85-89' : '90+';

type SeasonPoint = {
  run: number;
  age: number;
  year: number;
  league: string;
  pos: string;
  growthDna: string;
  initialPotential: number;
  ovrAtSeasonStart: number;
  ovrAfterSeason: number;
  potentialAfterSeason: number;
  deltaOvr: number;
  gp: number;
  mpg: number;
  ppg: number;
  injuredGamesMissed: number;
  injurySeverity: string;
  wonMvp: boolean;
  allStarSelected: boolean;
  wonChampionship: boolean;
};
type CareerResult = {
  run: number;
  pos: string;
  growthDna: string;
  traits: string;
  initialOvr: number;
  initialPotential: number;
  finalOvr: number;
  peakOvr: number;
  peakAge: number;
  retirementAge: number;
  seasons: number;
  proSeasons: number;
  nbaSeasons: number;
  reachedNba: boolean;
  retirementReason: string;
  completed: boolean;
  error?: string;
};

const seasonPoints: SeasonPoint[] = [];
const careers: CareerResult[] = [];
let errors = 0;
let incomplete = 0;

for (let run = 0; run < CAREERS; run++) {
  S().resetAllGameData();
  const pos = POS[run % POS.length];
  try {
    S().startNewCareer({
      name: `GROWTH_SIM_${run}`,
      jerseyNumber: '7',
      heightCm: HEIGHT[pos],
      primaryPos: pos,
      highSchoolTeamId: 'HS_SAMIL',
    });
    S().setView('DASHBOARD');

    const initial: any = S().career;
    const initialOvr = initial.ovr;
    const initialPotential = initial.potential;
    let seenSeasonCount = 0;
    let guard = 0;

    while (guard++ < 900 && S().view !== 'RETIREMENT') {
      const st = S();
      const c: any = st.career;
      if (!c) break;

      // 시즌 로그가 생성되는 순간 pendingSeasonSettlement에 시즌 종료 후 능력치가 존재합니다.
      const logs: any[] = c.seasonLogs || [];
      if (logs.length > seenSeasonCount) {
        for (let i = seenSeasonCount; i < logs.length; i++) {
          const log = logs[i];
          const settlement = c.pendingSeasonSettlement;
          const afterOvr = Number.isFinite(settlement?.nextOvr) ? settlement.nextOvr : log.ovr;
          const afterPotential = Number.isFinite(settlement?.nextPotential) ? settlement.nextPotential : c.potential;
          seasonPoints.push({
            run,
            age: log.age,
            year: log.year,
            league: log.league,
            pos,
            growthDna: c.growthDna || 'STANDARD',
            initialPotential,
            ovrAtSeasonStart: log.ovr,
            ovrAfterSeason: afterOvr,
            potentialAfterSeason: afterPotential,
            deltaOvr: round(afterOvr - log.ovr),
            gp: log.gp,
            mpg: log.mpg,
            ppg: log.ppg,
            injuredGamesMissed: log.injuredGamesMissed || 0,
            injurySeverity: log.injurySeverity || 'NONE',
            wonMvp: Boolean(log.wonMvp),
            allStarSelected: Boolean(log.allStarSelected),
            wonChampionship: Boolean(log.wonChampionship),
          });
        }
        seenSeasonCount = logs.length;
      }

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
      if (c.lastInternationalSummary) {
        st.dismissInternationalSummary();
        continue;
      }
      if (c.seasonPhase === 'LIVE_FINAL_BROADCAST') {
        if (!c.liveGame?.isFinished) st.skipLiveGame();
        else st.closeLiveGameAndReturn();
        continue;
      }
      if (c.seasonPhase === 'POSTSEASON_BRACKET') {
        const bracket = c.playoffBracket;
        // 탈락 플래그만 보고 곧바로 오프시즌에 들어가면 스토어의
        // advancePlayoffBracketRound()가 수행하는 잔여 대진 자동 완결과
        // 시즌 로그의 우승팀/플레이오프 결과 반영을 건너뛰게 됩니다.
        // championTeamId가 확정될 때까지 먼저 라운드를 한 번 더 진행합니다.
        if (bracket?.championTeamId) st.enterOffseasonFromPlayoffs();
        else if (bracket?.playerEliminated) st.advancePlayoffBracketRound();
        else if (bracket?.playerReachedFinals || bracket?.pendingConfFinalsGame7) st.startFinalsLiveBroadcast();
        else st.advancePlayoffBracketRound();
        continue;
      }
      if (c.seasonPhase === 'OFFSEASON' || c.offseasonLocked) {
        const options = c.offseasonOptions || [];
        const option =
          options.find((x: any) => !x.locked && !String(x.actionType).startsWith('RETIRE')) ??
          options.find((x: any) => !x.locked);
        if (!option) break;
        st.selectOffseasonOption(option);
        continue;
      }
      st.playSeason();
    }

    const final: any = S().career;
    if (!final) {
      incomplete++;
      continue;
    }
    // 마지막 시즌 직후 바로 은퇴 화면으로 전환되면 루프 본문에서 처리되지 않을 수 있어 보정합니다.
    const finalLogs: any[] = final.seasonLogs || [];
    if (finalLogs.length > seenSeasonCount) {
      for (let i = seenSeasonCount; i < finalLogs.length; i++) {
        const log = finalLogs[i];
        const settlement = final.pendingSeasonSettlement;
        const justFinalized = i === finalLogs.length - 1 && final.age > log.age;
        const afterOvr = Number.isFinite(settlement?.nextOvr)
          ? settlement.nextOvr
          : justFinalized ? final.ovr : log.ovr;
        const afterPotential = Number.isFinite(settlement?.nextPotential)
          ? settlement.nextPotential
          : justFinalized ? final.potential : final.potential;
        seasonPoints.push({
          run, age: log.age, year: log.year, league: log.league, pos,
          growthDna: final.growthDna || 'STANDARD', initialPotential,
          ovrAtSeasonStart: log.ovr, ovrAfterSeason: afterOvr,
          potentialAfterSeason: afterPotential, deltaOvr: round(afterOvr - log.ovr),
          gp: log.gp, mpg: log.mpg, ppg: log.ppg,
          injuredGamesMissed: log.injuredGamesMissed || 0,
          injurySeverity: log.injurySeverity || 'NONE',
          wonMvp: Boolean(log.wonMvp), allStarSelected: Boolean(log.allStarSelected),
          wonChampionship: Boolean(log.wonChampionship),
        });
      }
    }
    const ownPoints = seasonPoints.filter((p) => p.run === run);
    const peakPoint = ownPoints.reduce<SeasonPoint | null>((best, p) =>
      !best || p.ovrAfterSeason > best.ovrAfterSeason ? p : best, null);
    const proLeagues = new Set(['NBA', 'KBL', 'B_LEAGUE', 'NBL', 'EUROLEAGUE', 'GLEAGUE']);
    careers.push({
      run,
      pos,
      growthDna: final.growthDna || 'STANDARD',
      traits: (final.traits || []).join('|'),
      initialOvr,
      initialPotential,
      finalOvr: final.ovr,
      peakOvr: final.peakOvr,
      peakAge: peakPoint?.age ?? final.age,
      retirementAge: final.age,
      seasons: final.seasonsPlayed,
      proSeasons: ownPoints.filter((p) => proLeagues.has(p.league)).length,
      nbaSeasons: ownPoints.filter((p) => p.league === 'NBA').length,
      reachedNba: ownPoints.some((p) => p.league === 'NBA'),
      retirementReason: final.retirementReason || (S().view === 'RETIREMENT' ? 'RETIREMENT_VIEW' : 'NOT_RETIRED'),
      completed: S().view === 'RETIREMENT',
    });
    if (S().view !== 'RETIREMENT') incomplete++;
  } catch (error) {
    errors++;
    careers.push({
      run, pos, growthDna: 'ERROR', traits: '', initialOvr: 0, initialPotential: 0,
      finalOvr: 0, peakOvr: 0, peakAge: 0, retirementAge: 0, seasons: 0,
      proSeasons: 0, nbaSeasons: 0, reachedNba: false, retirementReason: 'ERROR',
      completed: false, error: error instanceof Error ? error.message : String(error),
    });
  }
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = groups.get(k) || [];
    arr.push(item);
    groups.set(k, arr);
  }
  return groups;
}

const ageCurve = [...groupBy(seasonPoints, (p) => String(p.age)).entries()]
  .map(([age, rows]) => ({
    age: Number(age),
    seasons: rows.length,
    avgOvr: mean(rows.map((p) => p.ovrAtSeasonStart)),
    avgPostSeasonOvr: mean(rows.map((p) => p.ovrAfterSeason)),
    avgPotential: mean(rows.map((p) => p.potentialAfterSeason)),
    avgDelta: mean(rows.map((p) => p.deltaOvr)),
    avgMpg: mean(rows.map((p) => p.mpg)),
    avgPpg: mean(rows.map((p) => p.ppg)),
    injurySeasonPct: pct(rows.filter((p) => p.injuredGamesMissed > 0).length, rows.length),
  }))
  .sort((a, b) => a.age - b.age);

const potentialGroups = [...groupBy(careers.filter((c) => c.initialPotential > 0), (c) => potentialBand(c.initialPotential)).entries()]
  .map(([band, rows]) => ({
    initialPotential: band,
    players: rows.length,
    avgFinalOvr: mean(rows.map((p) => p.finalOvr)),
    avgPeakOvr: mean(rows.map((p) => p.peakOvr)),
    avgPeakAge: mean(rows.map((p) => p.peakAge)),
    avgCareerSeasons: mean(rows.map((p) => p.seasons)),
    nbaReachPct: pct(rows.filter((p) => p.reachedNba).length, rows.length),
  }));

const positionGroups = [...groupBy(careers.filter((c) => c.initialPotential > 0), (c) => c.pos).entries()]
  .map(([position, rows]) => ({
    position,
    players: rows.length,
    avgInitialOvr: mean(rows.map((p) => p.initialOvr)),
    avgInitialPotential: mean(rows.map((p) => p.initialPotential)),
    avgPeakOvr: mean(rows.map((p) => p.peakOvr)),
    avgPeakAge: mean(rows.map((p) => p.peakAge)),
    avgCareerSeasons: mean(rows.map((p) => p.seasons)),
  }));

const leagueGroups = [...groupBy(seasonPoints, (p) => p.league).entries()]
  .map(([league, rows]) => ({
    league,
    seasons: rows.length,
    avgAge: mean(rows.map((p) => p.age)),
    avgOvr: mean(rows.map((p) => p.ovrAtSeasonStart)),
    avgPpg: mean(rows.map((p) => p.ppg)),
    injurySeasonPct: pct(rows.filter((p) => p.injuredGamesMissed > 0).length, rows.length),
  }))
  .sort((a, b) => b.seasons - a.seasons);

const completed = careers.filter((c) => c.completed);
const summary = {
  seed: SEED,
  requestedCareers: CAREERS,
  recordedCareers: careers.length,
  completedRetirements: completed.length,
  incompleteCareers: incomplete,
  errors,
  avgRetirementAge: mean(completed.map((c) => c.retirementAge)),
  retirementAgeP10: quantile(completed.map((c) => c.retirementAge), 0.1),
  retirementAgeP50: quantile(completed.map((c) => c.retirementAge), 0.5),
  retirementAgeP90: quantile(completed.map((c) => c.retirementAge), 0.9),
  avgCareerSeasons: mean(completed.map((c) => c.seasons)),
  avgPeakOvr: mean(careers.filter((c) => c.initialPotential > 0).map((c) => c.peakOvr)),
  avgPeakAge: mean(careers.filter((c) => c.initialPotential > 0).map((c) => c.peakAge)),
  nbaReachPct: pct(careers.filter((c) => c.reachedNba).length, careers.filter((c) => c.initialPotential > 0).length),
  ageCurve,
  potentialGroups,
  positionGroups,
  leagueGroups,
  caveats: [
    '시즌 OVR은 해당 시즌 시작 OVR이며, 시즌 종료 OVR은 pendingSeasonSettlement.nextOvr를 사용합니다.',
    '잠재력 그룹은 생성 시점의 초기 잠재력 기준입니다.',
    '은퇴 연령은 RETIREMENT 화면에 진입한 career.age 기준입니다.',
    '자동 진행은 첫 이벤트 선택지와 첫 번째 비은퇴 오프시즌 선택지를 사용하므로 실제 유저의 최적 플레이를 대표하지 않습니다.',
  ],
};

const outDir = 'balance-results';
mkdirSync(outDir, { recursive: true });
const stem = `career-growth-${CAREERS}-${SEED}`;
writeFileSync(`${outDir}/${stem}.json`, JSON.stringify({ summary, careers, seasonPoints }, null, 2));
const columns = Object.keys(seasonPoints[0] || {});
const csv = [
  columns.join(','),
  ...seasonPoints.map((row) => columns.map((key) => {
    const value = (row as any)[key];
    const text = typeof value === 'string' ? value : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')),
].join('\n');
writeFileSync(`${outDir}/${stem}-seasons.csv`, csv);

console.log(`\n== 커리어 성장·은퇴 분석 | seed=${SEED} | careers=${CAREERS}`);
console.log('\n[전체 요약]');
console.table({
  '완료 은퇴': summary.completedRetirements,
  '미완료': summary.incompleteCareers,
  '오류': summary.errors,
  '평균 은퇴 나이': summary.avgRetirementAge,
  '은퇴 나이 P10/P50/P90': `${summary.retirementAgeP10}/${summary.retirementAgeP50}/${summary.retirementAgeP90}`,
  '평균 현역 시즌': summary.avgCareerSeasons,
  '평균 최고 OVR': summary.avgPeakOvr,
  '최고 OVR 도달 평균 나이': summary.avgPeakAge,
  'NBA 진출률(%)': summary.nbaReachPct,
});
console.log('\n[연령별 성장 곡선]');
console.table(ageCurve);
console.log('\n[초기 잠재력별 최종 성장]');
console.table(potentialGroups);
console.log('\n[포지션별 성장]');
console.table(positionGroups);
console.log('\n[리그별 활동]');
console.table(leagueGroups);
console.log(`\n저장 완료: ${outDir}/${stem}.json 및 ${outDir}/${stem}-seasons.csv`);
