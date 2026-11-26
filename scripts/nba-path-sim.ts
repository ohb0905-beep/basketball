/**
 * NBA 진입 경로·루키 역할 분석 (시드 고정)
 *
 * 실행: bun scripts/nba-path-sim.ts [커리어 수=300] [시드=20261125] [--policy=first|nba] [--start=kr|us] [--nationality=KOR]
 * 1.2.0: --start=us는 미국 고교(전력 62, 삼일고와 같은 전력)에서 시작합니다. 국적 기본값은 kr이면 KOR, us이면 USA.
 * - first: balance-sim과 같은 '첫 선택지' 자동 플레이
 * - nba:   NBA 진출을 노리는 플레이어처럼 드래프트 참가·NBA·G리그 선택지를 우선
 * - human: 실제 유저 패턴 근사 (고교→NCAA 우선, 대학 2년차부터 NBA 드래프트, 캠프·스킬랩 구매)
 * - mixed: 커리어마다 first/human을 섞은 집단. 1.0.0 실데이터(완주 커리어 NBA 도달 90%)를 1.0.1 코드에서 재현하도록 맞춘 기본 측정 집단
 *
 * --check: NBA_PATH_TARGETS 범위를 벗어나면 exit code 1 (bun run balance:check 에 포함)
 * 시즌 중반 분기점 이벤트는 실제 화면처럼 매 시즌 발생시킵니다.
 */
import { mulberry32 } from './seededRandom';

export {};

const rawArgs = process.argv.slice(2);
const args = rawArgs.filter((a) => !a.startsWith('--'));
const CAREERS = Number(args[0] ?? 300);
const SEED = Number(args[1] ?? 20261125);
const POLICY = (rawArgs.find((a) => a.startsWith('--policy='))?.split('=')[1] ?? 'nba') as 'first' | 'nba' | 'human' | 'mixed';
/** mixed: 커리어마다 캐주얼(first)/적극(human) 플레이어를 섞어 실제 유저 집단을 근사합니다. */
const MIXED_CASUAL_SHARE = 0.56;
const policyRng = mulberry32(SEED ^ 0x5eed);
let activePolicy: 'first' | 'nba' | 'human' = 'human';
/** 적극 플레이어 중 우승 도전 카드를 받으면 수락하는 비율 */
const CONTENDER_TAKE_SHARE = Number(rawArgs.find((a) => a.startsWith('--contender='))?.split('=')[1] ?? 0.5);
let takesContender = false;
let contenderOffered = 0, contenderTaken = 0;
const JSON_OUT = rawArgs.includes('--json');
const START = (rawArgs.find((a) => a.startsWith('--start='))?.split('=')[1] ?? 'kr') as 'kr' | 'us';
const START_SCHOOL_ID = START === 'us' ? 'USHS_PROLIFIC' : 'HS_SAMIL';
const NATIONALITY = (rawArgs.find((a) => a.startsWith('--nationality='))?.split('=')[1] ??
  (START === 'us' ? 'USA' : 'KOR')) as import('../src/types/game').NationalityCode;
const CHECK = rawArgs.includes('--check');

const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { mem[k] = v; },
  removeItem: (k: string) => { delete mem[k]; },
};
(globalThis as any).window = globalThis;
const origWarn = console.warn;
console.warn = (...a: unknown[]) => { if (String(a[0]).includes('[zustand')) return; origWarn(...a); };

const { useCareerStore } = await import('../src/store/useCareerStore');
const S = () => useCareerStore.getState();
Math.random = mulberry32(SEED);

const POS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const HEIGHT: Record<string, number> = { PG: 185, SG: 192, SF: 199, PF: 204, C: 211 };
const LEAGUE_PREF: Record<string, number> = {
  NBA: 100, GLEAGUE: 80, EUROLEAGUE: 60, NCAA: 55, KBL: 50, NBL: 45, B_LEAGUE: 40, U_LEAGUE: 30, HIGH_SCHOOL: 0, US_HIGH_SCHOOL: 0,
};

function pickOption(opts: any[]): any {
  const open = opts.filter((x) => !x.locked && !String(x.actionType).startsWith('RETIRE'));
  if (activePolicy === 'first' || open.length === 0) return open[0] ?? opts.find((x) => !x.locked);
  if (open.some((o) => o.contenderPath)) {
    contenderOffered++;
    if (activePolicy === 'human' && takesContender) {
      contenderTaken++;
      return open.find((o) => o.contenderPath);
    }
  }
  if (activePolicy === 'human') {
    const c: any = S().career;
    const collegeYears = (c?.seasonLogs || []).filter((l: any) => l.league === 'NCAA' || l.league === 'U_LEAGUE').length;
    const hscore = (o: any) => {
      if (o.actionType === 'ENTER_NBA_DRAFT') return collegeYears >= 2 || c?.league !== 'NCAA' ? 1000 : -10;
      if (c?.league === 'HIGH_SCHOOL' || c?.league === 'US_HIGH_SCHOOL') return o.targetLeague === 'NCAA' ? 500 : o.targetLeague === 'U_LEAGUE' ? 300 : 100;
      const promiseBonus = o.promisedRole === 'ACE_GUARANTEE' ? 15 : o.promisedRole === 'STARTER_GUARANTEE' ? 8 : 0;
      return (LEAGUE_PREF[o.targetLeague] ?? 0) * 3 + promiseBonus + (o.actionType === 'STAY_TEAM' ? 5 : 0);
    };
    return [...open].sort((a, b) => hscore(b) - hscore(a))[0];
  }
  const score = (o: any) =>
    (o.actionType === 'ENTER_NBA_DRAFT' ? 1000 : 0) +
    (LEAGUE_PREF[o.targetLeague] ?? 0) * 3 +
    (o.actionType === 'STAY_TEAM' ? 1 : 0);
  return [...open].sort((a, b) => score(b) - score(a))[0];
}

const pct = (n: number, d: number) => (d ? +((n / d) * 100).toFixed(1) : 0);
const isAce = (role: string) => role === '프랜차이즈 1옵션 에이스';

const debutSnapshots: any[] = [];
let careers = 0, reachedNba = 0, nbaRing = 0, errors = 0, nbaAllStarCareers = 0, nbaMvpCareers = 0;
const leagueStats: Record<string, { seasons: number; mvp: number; rankSum: number; po: number; firstSeason: number; firstSeasonAce: number; firstSeasonMvp: number; returnFirst: number; returnFirstAce: number }> = {};
let hsSeasons = 0, hsGarbage = 0, hsMvp = 0, hsCoachChance = 0, ncaaFresh = 0, ncaaFreshGoals = 0, ncaaSeasons = 0, ncaaMvp = 0;
let hsFirstSeasonGarbage = 0, hsFirstSeasons = 0;
const entryRoutes: Record<string, number> = {};
const entryContracts: Record<string, number> = {};
const firstNbaRoles: Record<string, number> = {};
let firstSeasonAce = 0, firstSeasonN = 0;
const seasonsToAce: number[] = [];
let nbaMvpSeasons = 0, nbaAllStarSeasons = 0;
let nbaSeasons = 0, nbaAceSeasons = 0, nbaChamps = 0, nbaRankSum = 0, nbaPlayoffMiss = 0;
const draftPicks: Record<string, number> = { lottery: 0, firstRound: 0, secondRound: 0, undrafted: 0 };

for (let run = 0; run < CAREERS; run++) {
  S().resetAllGameData();
  takesContender = policyRng() < CONTENDER_TAKE_SHARE;
  activePolicy = POLICY === 'mixed' ? (policyRng() < MIXED_CASUAL_SHARE ? 'first' : 'human') : POLICY;
  const pos = POS[run % 5];
  S().startNewCareer({ name: `SIM${run}`, jerseyNumber: '7', heightCm: HEIGHT[pos], primaryPos: pos, highSchoolTeamId: START_SCHOOL_ID, nationality: NATIONALITY });
  S().setView('DASHBOARD');
  careers++;
  try {
    for (let i = 0; i < 900 && S().view !== 'RETIREMENT'; i++) {
      const st = S();
      const c: any = st.career;
      if (!c) break;
      if (st.view === 'DRAFT_COMBINE') { st.completeCombineInterview('TEAM_FIRST'); st.proceedToDraftLive(); continue; }
      if (st.view === 'DRAFT_LIVE') {
        const dr = c.draftResult;
        if (dr?.draftType === 'NBA') {
          const p = dr.pickNumber;
          if (p == null) { draftPicks.undrafted++; if (dr.twoWayOfferTeam) draftPicks.undraftedTwoWay = (draftPicks.undraftedTwoWay ?? 0) + 1; }
          else if (p <= 14) draftPicks.lottery++;
          else if (p <= 30) draftPicks.firstRound++;
          else draftPicks.secondRound++;
        }
        // 실제 드래프트 화면과 같은 선택지: 1라운드는 보장 계약, 2라운드·미지명은 투웨이(있으면) 또는 G리그
        const twoWayTeam = dr?.draftedTeam || dr?.twoWayOfferTeam;
        st.finalizeDraftSigning(
          dr?.draftType === 'KBL' ? 'KBL' : dr?.round === 1 ? 'NBA_STANDARD' : twoWayTeam ? 'TWO_WAY' : 'GLEAGUE'
        );
        continue;
      }
      if (c.pendingEvent) { if (String(c.pendingEvent.id).startsWith('EVT_MID_HS_COACH_CHANCE')) hsCoachChance++; st.resolveEventChoice(c.pendingEvent.choices[0]); st.dismissEncounterOutcome(); continue; }
      if (c.lastInternationalSummary) st.dismissInternationalSummary();
      if (c.seasonPhase === 'LIVE_FINAL_BROADCAST') { if (!c.liveGame?.isFinished) st.skipLiveGame(); else st.closeLiveGameAndReturn(); continue; }
      if (c.seasonPhase === 'POSTSEASON_BRACKET') {
        const b = c.playoffBracket;
        if (b.championTeamId) st.enterOffseasonFromPlayoffs();
        else if (b.playerReachedFinals && !b.pendingFinalsLiveGame) st.advanceFinalsToDecisiveGame();
        else if (b.playerReachedFinals || b.pendingConfFinalsGame7) st.startFinalsLiveBroadcast();
        else st.advancePlayoffBracketRound();
        continue;
      }
      if (c.seasonPhase === 'OFFSEASON' || c.offseasonLocked) {
        const o = pickOption(c.offseasonOptions || []);
        if (!o) break;
        st.selectOffseasonOption(o);
        continue;
      }
      if (c.league === 'NBA' && !(c.seasonLogs || []).some((l: any) => l.league === 'NBA')) {
        debutSnapshots.push({
          ovr: c.ovr, teamRating: c.team.rating, direction: c.team.direction, trust: c.coachTrust,
          promise: c.promisedRole ?? null, pick: c.draftPedigreePick ?? null, round: c.draftPedigreeRound ?? null,
          contract: c.contractType, age: c.age,
        });
      }
      if (!c.midSeasonEventTriggeredThisYear && (c.seasonPhase ?? 'REGULAR_SEASON') === 'REGULAR_SEASON') {
        st.triggerMidSeasonCrossroads();
        if (S().career?.pendingEvent) continue;
      }
      if (activePolicy === 'human') {
        if (c.lastCampYear !== c.seasonYear) st.runSpecialCamp('LEGEND_SKILL_CAMP');
        if (!(S().career as any).activePersonalCare?.includes('BIOMECH_SKILL_LAB')) S().purchasePersonalCare('BIOMECH_SKILL_LAB');
      }
      S().playSeason();
    }
  } catch (e) { errors++; }
  const c: any = S().career;
  if (!c) continue;
  const logs: any[] = c.seasonLogs || [];
  logs.forEach((l, idx) => {
    if (!['KBL', 'EUROLEAGUE', 'B_LEAGUE', 'NBL', 'GLEAGUE'].includes(l.league)) return;
    const ls = (leagueStats[l.league] ??= { seasons: 0, mvp: 0, rankSum: 0, po: 0, firstSeason: 0, firstSeasonAce: 0, firstSeasonMvp: 0, returnFirst: 0, returnFirstAce: 0 });
    ls.seasons++;
    if (l.wonMvp) ls.mvp++;
    ls.rankSum += l.teamRank ?? 0;
    if (l.playoffResult && l.playoffResult !== 'PO 탈락') ls.po++;
    const prev = logs.slice(0, idx);
    if (!prev.some((p) => p.league === l.league)) {
      const cameFromNba = prev.some((p) => p.league === 'NBA');
      if (cameFromNba) { ls.returnFirst++; if (isAce(l.role)) ls.returnFirstAce++; }
      else { ls.firstSeason++; if (isAce(l.role)) ls.firstSeasonAce++; if (l.wonMvp) ls.firstSeasonMvp++; }
    }
  });
  for (const l of logs) {
    if (l.league === 'HIGH_SCHOOL' || l.league === 'US_HIGH_SCHOOL') {
      hsSeasons++;
      if (String(l.role).includes('가비지')) hsGarbage++;
      if (l.wonMvp) hsMvp++;
    }
    if (l.league === 'NCAA') {
      ncaaSeasons++;
      if (l.wonMvp) ncaaMvp++;
    }
    if (l.freshmanAdaptation) { ncaaFresh++; ncaaFreshGoals += l.freshmanAdaptation.achievedCount; }
  }
  if (logs[0]?.league === 'HIGH_SCHOOL' || logs[0]?.league === 'US_HIGH_SCHOOL') { hsFirstSeasons++; if (String(logs[0].role).includes('가비지')) hsFirstSeasonGarbage++; }
  const firstNbaIdx = logs.findIndex((l) => l.league === 'NBA');
  if (firstNbaIdx >= 0) {
    reachedNba++;
    const from = firstNbaIdx > 0 ? logs[firstNbaIdx - 1].league : 'START';
    const ek = `${from}->${logs[firstNbaIdx].contractType}`;
    entryContracts[ek] = (entryContracts[ek] ?? 0) + 1;
    firstNbaRoles[logs[firstNbaIdx].role] = (firstNbaRoles[logs[firstNbaIdx].role] ?? 0) + 1;
    entryRoutes[from] = (entryRoutes[from] ?? 0) + 1;
    firstSeasonN++;
    if (isAce(logs[firstNbaIdx].role)) firstSeasonAce++;
    const nbaLogs = logs.filter((l) => l.league === 'NBA');
    const aceIdx = nbaLogs.findIndex((l) => isAce(l.role));
    if (aceIdx >= 0) seasonsToAce.push(aceIdx);
    for (const l of nbaLogs) {
      nbaSeasons++;
      if (isAce(l.role)) nbaAceSeasons++;
      if (l.wonChampionship) nbaChamps++;
      if (l.wonMvp) nbaMvpSeasons++;
      if (l.allStarSelected) nbaAllStarSeasons++;
      if (typeof l.teamRank === 'number') nbaRankSum += l.teamRank;
      if (!l.playoffResult || l.playoffResult === 'PO 탈락') nbaPlayoffMiss++;
    }
    if (nbaLogs.some((l) => l.wonChampionship)) nbaRing++;
    if (nbaLogs.some((l) => l.allStarSelected)) nbaAllStarCareers++;
    if (nbaLogs.some((l) => l.wonMvp)) nbaMvpCareers++;
  }
}

const result = {
  policy: POLICY, seed: SEED, careers, errors,
  nbaReachPct: pct(reachedNba, careers),
  entryRoutes,
  entryContracts,
  firstNbaRoles,
  nbaDraftPicks: draftPicks,
  nbaFirstSeasonAcePct: pct(firstSeasonAce, firstSeasonN),
  avgNbaSeasonsBeforeFirstAce: seasonsToAce.length ? +(seasonsToAce.reduce((a, b) => a + b, 0) / seasonsToAce.length).toFixed(2) : null,
  nbaAvgSeasons: reachedNba ? +(nbaSeasons / reachedNba).toFixed(2) : 0,
  nbaAllStarPctOfNba: pct(nbaAllStarCareers, reachedNba),
  nbaMvpCareerPct: pct(nbaMvpCareers, careers),
  nbaMvpSeasonPct: pct(nbaMvpSeasons, nbaSeasons),
  nbaAllStarSeasonPct: pct(nbaAllStarSeasons, nbaSeasons),
  nbaAceSeasonPct: pct(nbaAceSeasons, nbaSeasons),
  nbaChampSeasonPct: pct(nbaChamps, nbaSeasons),
  nbaAvgTeamRank: nbaSeasons ? +(nbaRankSum / nbaSeasons).toFixed(1) : null,
  nbaPlayoffMissPct: pct(nbaPlayoffMiss, nbaSeasons),
  nbaRingCareerPctOfNba: pct(nbaRing, reachedNba),
  nbaRingCareerPctOfAll: pct(nbaRing, careers),
  contenderOffered,
  contenderTaken,
  leagues: Object.fromEntries(Object.entries(leagueStats).map(([k, v]) => [k, {
    seasons: v.seasons, mvpPct: pct(v.mvp, v.seasons), avgRank: +(v.rankSum / Math.max(1, v.seasons)).toFixed(1), poPct: pct(v.po, v.seasons),
    newcomerN: v.firstSeason, newcomerAcePct: pct(v.firstSeasonAce, v.firstSeason), newcomerMvpPct: pct(v.firstSeasonMvp, v.firstSeason),
    nbaReturnN: v.returnFirst, nbaReturnAcePct: pct(v.returnFirstAce, v.returnFirst),
  }])),
  hsCoachChancePerCareer: +(hsCoachChance / Math.max(1, careers)).toFixed(2),
  hsGarbageSeasonPct: pct(hsGarbage, hsSeasons),
  hsFirstSeasonGarbagePct: pct(hsFirstSeasonGarbage, hsFirstSeasons),
  hsMvpSeasonPct: pct(hsMvp, hsSeasons),
  ncaaMvpSeasonPct: pct(ncaaMvp, ncaaSeasons),
  ncaaFreshmen: ncaaFresh,
  ncaaFreshmanAvgGoals: ncaaFresh ? +(ncaaFreshGoals / ncaaFresh).toFixed(2) : null,
  debut: (() => {
    const n = debutSnapshots.length || 1;
    const avgOf = (k: string) => +(debutSnapshots.reduce((a, d) => a + (d[k] ?? 0), 0) / n).toFixed(1);
    const count = (k: string) => debutSnapshots.reduce((m: Record<string, number>, d) => { const v = String(d[k]); m[v] = (m[v] ?? 0) + 1; return m; }, {});
    return { n: debutSnapshots.length, ovr: avgOf('ovr'), teamRating: avgOf('teamRating'), trust: avgOf('trust'), age: avgOf('age'), promise: count('promise'), direction: count('direction'), contract: count('contract') };
  })(),
};
if (!CHECK) {
  console.log(JSON_OUT ? JSON.stringify(result) : JSON.stringify(result, null, 2));
} else {
  // 시뮬 집단은 '끝까지 플레이한 커리어'라서 실제 전체 커리어 지표보다 높게 나옵니다.
  // 1.0.0 기준 실제 완주 커리어 NBA 도달 90% ≈ 시뮬 95%, 실제 전체 커리어 67%.
  // 실제 전체 커리어 45~55% 목표는 시뮬 60~72%에 해당합니다.
  const NBA_PATH_TARGETS: [string, number, number, number][] = [
    ['오류 0', result.errors, 0, 0],
    ['NBA 도달률(완주 커리어 %)', result.nbaReachPct, 60, 72],
    ['NBA 첫 시즌 에이스 비율(%)', result.nbaFirstSeasonAcePct, 5, 30],
    ['첫 에이스까지 NBA 시즌 수(평균)', result.avgNbaSeasonsBeforeFirstAce ?? 0, 1.0, 3.0],
    ['NBA 진출자 평균 활동 시즌', result.nbaAvgSeasons, 7, 14],
    // 시뮬 집단(캠프·스킬랩을 매 시즌 구매하는 적극 플레이어 포함)은 실제보다 강해서 수상 비율이 높게 나옵니다.
    // 1.0.1 코드 기준선: 올스타 56%, MVP 커리어 27%. NBA에 더 강해진 뒤 들어가므로 1.1.0에서 소폭 상승합니다.
    ['NBA 진출자 중 올스타 경험(%)', result.nbaAllStarPctOfNba, 40, 85],
    ['NBA MVP 경험(%)', result.nbaMvpCareerPct, 15, 40],
    ['NBA 우승 경험 커리어(%)', result.nbaRingCareerPctOfAll, 36, 48],
    ['고교 MVP 시즌 비율(%)', result.hsMvpSeasonPct, 33, 44],
    ['고교 첫 시즌 가비지 타임 비율(%)', result.hsFirstSeasonGarbagePct, 10, 35],
  ];
  let failed = 0;
  console.log(`\n[NBA 경로 목표 범위 검사 · ${POLICY} ${CAREERS}명 · 시드 ${SEED}]`);
  for (const [name, v, lo, hi] of NBA_PATH_TARGETS) {
    const ok = v >= lo && v <= hi;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${v} (목표 ${lo}~${hi})`);
  }
  if (failed > 0) process.exit(1);
}
