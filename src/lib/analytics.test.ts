import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  __resetAnalyticsClientMemoryForTest,
  attachCareerAnalyticsTracker,
  buildLeagueHonorsSummary,
  emitCareerStateTransitionEvents,
  extractSeasonAwards,
  isStarterRole,
  normalizePlayerRole,
  normalizePlayoffResult,
  resolvePeakLeague,
  trackGameEvent,
  type SubscribableCareerStore,
  type TrackableCareerStoreSnapshot,
} from './analytics';
import {
  ANALYTICS_EVENT_NAMES,
  MAX_ANALYTICS_ARRAY_LENGTH,
  MAX_ANALYTICS_PAYLOAD_BYTES,
  createAnalyticsRateLimiter,
  validateAnalyticsEventPayload,
  type SeasonCompletedPayload,
} from './analyticsSchema';
import { buildRecentLogs } from './adminAnalytics';
import { POST } from '../app/api/analytics/event/route';
import {
  __resetAnalyticsSupabaseCooldownForTest,
  insertAnalyticsEventToSupabase,
} from './supabaseAdmin';
import type { CareerState, SeasonBoxScore } from '../types/game';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function makeMockSeasonLog(
  overrides: Partial<SeasonBoxScore> = {}
): SeasonBoxScore {
  return {
    seasonNumber: 1,
    year: 2026,
    age: 17,
    league: 'HIGH_SCHOOL',
    leagueName: '한국 고교농구',
    teamId: 'HS_SAMIL',
    teamName: '삼일상고',
    teamShortName: '삼일',
    contractType: 'AMATEUR',
    role: '주전 스타터',
    ovr: 66,
    gp: 24,
    injuredGamesMissed: 2,
    injurySeverity: 'MINOR',
    mpg: 28.5,
    ppg: 18.24,
    rpg: 6.12,
    apg: 4.44,
    spg: 1.52,
    bpg: 0.74,
    fgPct: 49.04,
    tpPct: 37.54,
    wins: 21,
    losses: 3,
    teamRank: 1,
    playoffResult: '우승',
    salaryEarned: 0,
    wonChampionship: true,
    wonMvp: true,
    wonFinalsMvp: true,
    wonDpoy: false,
    wonSixthMan: false,
    wonMip: false,
    wonRookieOfYear: true,
    allStarSelected: true,
    allLeagueTeam: 1,
    singleGameHighPts: 34,
    ...overrides,
  } as unknown as SeasonBoxScore;
}

function makeMockCareer(overrides: Partial<CareerState> = {}): CareerState {
  return {
    id: 'PLAYER_1700000000000',
    name: '민감한사용자입력선수명',
    jerseyNumber: 11,
    heightCm: 198,
    primaryPos: 'SF',
    secondaryPos: 'SG',
    growthDna: 'STANDARD',
    playstyle: 'SCORER',
    traits: ['CLUTCH_PERFORMER'],
    trainingFocus: 'OUTSIDE_SHOOTING',
    role: '벤치 로테이션',
    age: 17,
    seasonYear: 2026,
    seasonsPlayed: 0,
    league: 'HIGH_SCHOOL',
    team: {
      id: 'HS_SAMIL',
      name: '삼일상고',
      shortName: '삼일',
      city: '수원',
      league: 'HIGH_SCHOOL',
      primaryColor: '#1d4ed8',
      secondaryColor: '#ffffff',
      rating: 76,
      direction: 'CONTENDER',
      pace: 75,
      defenseRating: 74,
    },
    contractType: 'AMATEUR',
    annualSalary: 0,
    contractYearsLeft: 1,
    ovr: 62,
    peakOvr: 62,
    draftResult: null,
    draftPedigreePick: null,
    draftPedigreeRound: null,
    totals: {
      gp: 0,
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
      allLeagueSelections: 0,
      dpoys: 0,
      sixthManAwards: 0,
      mips: 0,
    },
    seasonLogs: [],
    retirementReason: null,
    legacyEvaluation: null,
    ...overrides,
  } as unknown as CareerState;
}

test('validateAnalyticsEventPayload accepts valid milestone payload and strips forbidden PII keys', () => {
  const result = validateAnalyticsEventPayload({
    event_name: 'career_created',
    anonymous_id: 'anon-1234-uuid',
    session_id: 'sess-5678-uuid',
    career_run_id: 'run-9999-uuid',
    game_version: '1.0.0',
    device_type: 'mobile',
    payload: {
      position: 'SF',
      heightCm: 198,
      startingLeague: 'HIGH_SCHOOL',
      initialOvr: 62,
      // 금지된 PII 키들은 자동 제거되어야 함
      name: '홍길동',
      playerName: '비밀이름',
      email: 'test@example.com',
      token: 'secret-token',
      saveData: { dumped: true },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.event_name, 'career_created');
  assert.equal(result.data.device_type, 'mobile');
  assert.equal(result.data.payload.position, 'SF');
  assert.equal('name' in result.data.payload, false);
  assert.equal('playerName' in result.data.payload, false);
  assert.equal('email' in result.data.payload, false);
  assert.equal('token' in result.data.payload, false);
  assert.equal('saveData' in result.data.payload, false);
});

test('validateAnalyticsEventPayload rejects unknown event_name, bad device_type, deep nesting, and oversized payload', () => {
  const badEvent = validateAnalyticsEventPayload({
    event_name: 'button_click_spam',
    anonymous_id: 'anon-1',
    session_id: 'sess-1',
    payload: {},
  });
  assert.equal(badEvent.ok, false);

  const badDevice = validateAnalyticsEventPayload({
    event_name: 'session_start',
    anonymous_id: 'anon-1',
    session_id: 'sess-1',
    device_type: 'smart_fridge',
    payload: {},
  });
  assert.equal(badDevice.ok, false);

  const deepPayload = validateAnalyticsEventPayload({
    event_name: 'session_start',
    anonymous_id: 'anon-1',
    session_id: 'sess-1',
    payload: { a: { b: { c: { d: 1 } } } },
  });
  assert.equal(deepPayload.ok, false);

  // 각 문자열 120자 제한을 고려해 38개 키로 4KB 초과 페이로드 구성
  const bigPayload: Record<string, string> = {};
  for (let i = 0; i < 38; i += 1) {
    bigPayload[`k_${i}`] = '가'.repeat(50); // UTF-8 150바이트 * 38 > 4096바이트
  }
  const oversized = validateAnalyticsEventPayload({
    event_name: 'session_start',
    anonymous_id: 'anon-1',
    session_id: 'sess-1',
    payload: bigPayload,
  });
  assert.equal(oversized.ok, false);
  assert.ok(MAX_ANALYTICS_PAYLOAD_BYTES === 4096);
});

test('createAnalyticsRateLimiter enforces session+event and IP burst limits cleanly', () => {
  const limiter = createAnalyticsRateLimiter();
  const baseTime = 1_700_000_000_000;

  // session_start는 세션당 10분 최대 3회 허용
  assert.equal(
    limiter.checkAndConsume(
      { clientIp: '1.1.1.1', sessionId: 'sess-a', eventName: 'session_start' },
      baseTime
    ),
    true
  );
  assert.equal(
    limiter.checkAndConsume(
      { clientIp: '1.1.1.1', sessionId: 'sess-a', eventName: 'session_start' },
      baseTime + 100
    ),
    true
  );
  assert.equal(
    limiter.checkAndConsume(
      { clientIp: '1.1.1.1', sessionId: 'sess-a', eventName: 'session_start' },
      baseTime + 200
    ),
    true
  );
  assert.equal(
    limiter.checkAndConsume(
      { clientIp: '1.1.1.1', sessionId: 'sess-a', eventName: 'session_start' },
      baseTime + 300
    ),
    false
  );

  // 10분 경과 후 다시 허용
  assert.equal(
    limiter.checkAndConsume(
      { clientIp: '1.1.1.1', sessionId: 'sess-a', eventName: 'session_start' },
      baseTime + 10 * 60 * 1000 + 1
    ),
    true
  );
});

test('SQL migration for analytics_events enforces allowlist, indexes, and strict RLS', () => {
  const sqlPath = path.join(
    process.cwd(),
    'supabase/migrations/20261124_create_analytics_events.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.analytics_events/);

  // 최신 허용 목록은 1.1.2 설문 이벤트 마이그레이션이 CHECK 제약을 교체해 정의합니다.
  const latestAllowlistSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261125_analytics_survey_event.sql'),
    'utf8'
  );
  assert.match(latestAllowlistSql, /ADD CONSTRAINT analytics_events_event_name_check/);
  for (const eventName of ANALYTICS_EVENT_NAMES) {
    assert.ok(
      latestAllowlistSql.includes(`'${eventName}'`),
      `SQL CHECK constraint must include ${eventName}`
    );
  }
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.analytics_events FROM anon, authenticated/
  );
  assert.match(sql, /idx_analytics_events_created_at_desc/);
  assert.match(sql, /idx_analytics_events_event_name_created_at_desc/);
  assert.match(sql, /idx_analytics_events_anonymous_id_created_at_desc/);
});

test('emitCareerStateTransitionEvents emits exact milestone payloads without custom player name', () => {
  const captured: Array<{
    eventName: string;
    payload: Record<string, unknown>;
    careerRunId?: string | null;
    dedupeKey?: string;
  }> = [];

  const dispatcher = {
    track: (
      eventName: string,
      payload: unknown,
      options?: { careerRunId?: string | null; dedupeKey?: string }
    ) => {
      captured.push({
        eventName,
        payload: payload as Record<string, unknown>,
        careerRunId: options?.careerRunId,
        dedupeKey: options?.dedupeKey,
      });
    },
    resolveCareerRunId: (careerId: string) => `run-for-${careerId}`,
  };

  // 1. career_created
  const createdCareer = makeMockCareer();
  emitCareerStateTransitionEvents(
    { view: 'CREATE', career: null, hofList: [] },
    { view: 'DASHBOARD', career: createdCareer, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 1);
  assert.equal(captured[0].eventName, 'career_created');
  assert.equal(captured[0].payload.position, 'SF');
  assert.equal(captured[0].payload.startingLeague, 'HIGH_SCHOOL');
  assert.equal(captured[0].payload.initialOvr, 62);
  assert.equal('initialOverall' in captured[0].payload, false);
  assert.equal(captured[0].payload.trainingFocus, 'OUTSIDE_SHOOTING');
  assert.equal('name' in captured[0].payload, false);
  assert.equal(
    JSON.stringify(captured[0].payload).includes('민감한사용자입력선수명'),
    false
  );

  // 2. season_completed (고도화된 수상·플레이오프·성장·부상·메타 지표 검증)
  const afterSeason1 = makeMockCareer({
    seasonsPlayed: 1,
    ovr: 68,
    peakOvr: 68,
    role: '주전 스타터',
    seasonLogs: [makeMockSeasonLog()],
  });
  emitCareerStateTransitionEvents(
    { view: 'DASHBOARD', career: createdCareer, hofList: [] },
    { view: 'DASHBOARD', career: afterSeason1, hofList: [] },
    dispatcher
  );
  assert.equal(captured[1].eventName, 'season_completed');
  assert.equal(captured[1].payload.seasonNumber, 1);
  assert.equal(captured[1].payload.position, 'SF');
  assert.equal(captured[1].payload.ppg, 18.2);
  // 1.1.3: 분석에 쓰지 않던 필드는 보내지 않음 (용량 절감)
  for (const dropped of ['seasonYear', 'teamName', 'teamRank', 'spg', 'bpg', 'fgPct', 'threePtPct']) {
    assert.equal(dropped in captured[1].payload, false, dropped);
  }
  assert.equal(captured[1].payload.wonChampionship, true);
  assert.equal(captured[1].payload.wonMvp, true);
  assert.equal('wonFmvp' in captured[1].payload, false);
  assert.equal(captured[1].payload.wonFinalsMvp, true);
  assert.deepEqual(captured[1].payload.awards, [
    'ROY',
    'ALL_STAR',
    'ALL_LEAGUE_1ST',
  ]);
  assert.equal(captured[1].payload.madePlayoffs, true);
  assert.equal(captured[1].payload.playoffResult, 'champion');
  assert.equal(captured[1].payload.teamWins, 21);
  assert.equal(captured[1].payload.teamLosses, 3);
  assert.equal(captured[1].payload.overallDelta, 6);
  assert.equal(captured[1].payload.role, 'starter');
  assert.equal(captured[1].payload.isStarter, true);
  assert.equal(captured[1].payload.trainingFocus, 'OUTSIDE_SHOOTING');
  assert.equal(captured[1].payload.injuredGames, 2);
  assert.equal(captured[1].payload.hadInjury, true);

  // 3. league_changed (HIGH_SCHOOL -> KBL 드래프트 지명 시나리오)
  const draftPending = makeMockCareer({
    ...afterSeason1,
    draftResult: {
      draftType: 'KBL',
      round: 1,
      pickNumber: 2,
      draftedTeam: afterSeason1.team,
      twoWayOfferTeam: null,
      scoutingGrade: 88,
    },
  });
  const inKbl = makeMockCareer({
    seasonsPlayed: 1,
    seasonYear: 2027,
    age: 18,
    league: 'KBL',
    ovr: 70,
    role: '핵심 식스맨',
    contractType: 'KBL_ROOKIE',
    annualSalary: 12000,
    draftPedigreePick: 2,
    draftPedigreeRound: 1,
    seasonLogs: [makeMockSeasonLog()],
    totals: {
      ...createdCareer.totals,
      championships: 1,
      mvps: 1,
      finalsMvps: 1,
    },
  });
  emitCareerStateTransitionEvents(
    { view: 'DRAFT_LIVE', career: draftPending, hofList: [] },
    { view: 'DASHBOARD', career: inKbl, hofList: [] },
    dispatcher
  );
  assert.equal(captured[2].eventName, 'league_changed');
  assert.equal(captured[2].payload.fromLeague, 'HIGH_SCHOOL');
  assert.equal(captured[2].payload.toLeague, 'KBL');
  assert.equal(captured[2].payload.position, 'SF');
  assert.equal(captured[2].payload.changeReason, 'draft');
  assert.equal(captured[2].payload.draftPick, 2);
  assert.equal(captured[2].payload.draftRound, 1);

  // 4. career_ended (동일 시즌/리그에서 은퇴 선언 + 리그별 수상 집계 검증)
  const nbaLog1 = makeMockSeasonLog({
    seasonNumber: 10,
    year: 2035,
    age: 26,
    league: 'NBA',
    wonChampionship: true,
    wonMvp: true,
    wonFinalsMvp: true,
  });
  const kblLog1 = makeMockSeasonLog({
    seasonNumber: 2,
    year: 2027,
    age: 18,
    league: 'KBL',
    wonChampionship: true,
    wonMvp: false,
    wonFinalsMvp: true,
  });
  const preRetirement = makeMockCareer({
    seasonsPlayed: 15,
    age: 35,
    league: 'KBL',
    ovr: 79,
    peakOvr: 95,
    seasonLogs: [makeMockSeasonLog(), kblLog1, nbaLog1],
    totals: {
      ...createdCareer.totals,
      gp: 1000,
      points: 22500,
      rebounds: 6400,
      assists: 5100,
      mvps: 3,
      championships: 5,
      nbaChampionships: 4,
      finalsMvps: 3,
      allStars: 11,
      allLeagueSelections: 9,
      dpoys: 1,
      sixthManAwards: 1,
      mips: 1,
    },
  });
  const retired = makeMockCareer({
    ...preRetirement,
    retirementReason: 'VOLUNTARY_HONOR',
    legacyEvaluation: {
      tierId: 'GOAT',
      tierTitle: '시대의 전설',
      tierEmoji: '👑',
      legacyScore: 98,
      summaryComment: '전설적인 커리어',
      jerseyRetired: true,
      honoredTeam: preRetirement.team,
      honoredTeamSeasons: 10,
      honoredTeamPoints: 21000,
      honoredTeamMvps: 3,
      honoredTeamChamps: 4,
      honoredTeamAllStars: 10,
    },
  });
  emitCareerStateTransitionEvents(
    { view: 'DASHBOARD', career: preRetirement, hofList: [] },
    { view: 'RETIREMENT', career: retired, hofList: [] },
    dispatcher
  );
  assert.equal(captured[3].eventName, 'career_ended');
  assert.equal(captured[3].payload.totalSeasons, 15);
  assert.equal(captured[3].payload.finalLeague, 'KBL');
  assert.equal(captured[3].payload.peakLeague, 'NBA');
  assert.equal(captured[3].payload.championshipCount, 5);
  assert.equal(captured[3].payload.mvpCount, 3);
  assert.equal(captured[3].payload.finalsMvpCount, 3);
  for (const aliasKey of ['totalChampionships', 'totalMvp', 'totalFmvp', 'totalAllStar']) {
    assert.equal(aliasKey in captured[3].payload, false);
  }
  assert.equal(captured[3].payload.totalAllLeague, 9);
  assert.equal(captured[3].payload.nbaChampionshipCount, 4);
  assert.equal(captured[3].payload.legacyTier, 'GOAT');
  assert.equal(captured[3].payload.endingType, 'GOAT');
  assert.equal(captured[3].payload.hallOfFame, true);
  assert.equal(captured[3].payload.careerPpg, 22.5);
  assert.equal(captured[3].payload.careerRpg, 6.4);
  assert.equal(captured[3].payload.careerApg, 5.1);
  assert.deepEqual(captured[3].payload.leagueHonors, {
    HIGH_SCHOOL: { seasons: 1, championships: 1, mvp: 1, fmvp: 1 },
    KBL: { seasons: 1, championships: 1, mvp: 0, fmvp: 1 },
    NBA: { seasons: 1, championships: 1, mvp: 1, fmvp: 1 },
  });

  // 5. 정상 은퇴 완료 후 홈 복귀(completeRetirementAndReturnHome)는 career_reset을 발생시키지 않아야 함
  emitCareerStateTransitionEvents(
    { view: 'RETIREMENT', career: retired, hofList: [] },
    { view: 'HOME', career: null, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 4);

  // 6. 진행 중 커리어 중도 초기화(resetActiveCareer)는 career_reset을 정확히 발생시켜야 함
  emitCareerStateTransitionEvents(
    { view: 'DASHBOARD', career: inKbl, hofList: [] },
    { view: 'HOME', career: null, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 5);
  assert.equal(captured[4].eventName, 'career_reset');
  assert.equal(captured[4].payload.abandonedLeague, 'KBL');
  assert.equal(captured[4].payload.abandonedSeason, 1);
  assert.equal(captured[4].payload.abandonedRole, 'sixth_man');
  assert.equal(captured[4].payload.wasStarter, false);
  assert.equal(captured[4].payload.hadWonChampionship, true);
  assert.equal(captured[4].payload.hadWonMvp, true);
  assert.equal(captured[4].payload.hadWonFmvp, true);
});

test('client tracker deduplicates StrictMode double-mount and silently survives offline fetch failure', () => {
  __resetAnalyticsClientMemoryForTest();
  const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

  const localStorageMock = createMemoryStorage();
  const sessionStorageMock = createMemoryStorage();

  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      innerWidth: 1280,
      fetch: (url: string, init?: RequestInit) => {
        fetchCalls.push({
          url,
          body: JSON.parse(String(init?.body || '{}')),
        });
        return Promise.reject(new Error('Simulated offline error'));
      },
    },
  });

  try {
    let hydrated = false;
    let hydrationCb: ((state: TrackableCareerStoreSnapshot) => void) | null =
      null;
    const savedCareer = makeMockCareer({ seasonsPlayed: 3 });
    const snapshot: TrackableCareerStoreSnapshot = {
      view: 'HOME',
      career: savedCareer,
      hofList: [],
    };

    const fakeStore: SubscribableCareerStore = {
      getState: () => snapshot,
      subscribe: () => () => {},
      persist: {
        hasHydrated: () => hydrated,
        onFinishHydration: (fn) => {
          hydrationCb = fn;
          return () => {
            hydrationCb = null;
          };
        },
      },
    };

    // React StrictMode 이중 마운트 시뮬레이션 (하이드레이션 완료 후)
    hydrated = true;
    const unsub1 = attachCareerAnalyticsTracker(fakeStore);
    unsub1();
    const unsub2 = attachCareerAnalyticsTracker(fakeStore);

    // session_start는 단 1회만 전송되어야 하며, 기존 세이브 복원을 career_created로 오인하면 안 됨
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/analytics/event');
    assert.equal(fetchCalls[0].body.event_name, 'session_start');
    assert.equal(
      (fetchCalls[0].body.payload as Record<string, unknown>).hasExistingSave,
      true
    );

    const sampleSeasonPayload: SeasonCompletedPayload = {
      league: 'KBL',
      position: 'SF',
      seasonNumber: 4,
      age: 20,
      wonChampionship: false,
      wonMvp: false,
      wonFinalsMvp: false,
      allStarSelected: true,
      awards: ['ALL_STAR'],
      madePlayoffs: true,
      playoffResult: 'semifinals',
      teamWins: 34,
      teamLosses: 20,
      overall: 76,
      seasonOvr: 75,
      overallDelta: 3,
      role: 'starter',
      isStarter: true,
      mpg: 31.2,
      gamesPlayed: 54,
      ppg: 17.5,
      rpg: 4.8,
      apg: 5.2,
      trainingFocus: 'OUTSIDE_SHOOTING',
      injuredGames: 0,
      hadInjury: false,
      contractType: 'KBL_MAX',
      salary: 45000,
    };

    // 동일 dedupeKey로 season_completed 이중 호출 시 1회만 전송
    trackGameEvent('season_completed', sampleSeasonPayload, {
      careerRunId: 'run-1',
      dedupeKey: 'season_completed:run-1:4',
      dedupeScope: 'persistent',
    });
    trackGameEvent('season_completed', sampleSeasonPayload, {
      careerRunId: 'run-1',
      dedupeKey: 'season_completed:run-1:4',
      dedupeScope: 'persistent',
    });

    assert.equal(fetchCalls.length, 2);

    // 새 탭 / 페이지 새로고침 시뮬레이션 (sessionStorage & 메모리 초기화, localStorage 유지)
    sessionStorageMock.clear();
    __resetAnalyticsClientMemoryForTest();
    trackGameEvent('season_completed', sampleSeasonPayload, {
      careerRunId: 'run-1',
      dedupeKey: 'season_completed:run-1:4',
      dedupeScope: 'persistent',
    });
    // persistent dedupe 덕분에 새 탭/새로고침에서도 중복 전송되지 않아야 함
    assert.equal(fetchCalls.length, 2);

    // 반면 새 세션의 session_start는 정상적으로 1회 전송되어야 함
    trackGameEvent(
      'session_start',
      {
        hasExistingSave: true,
        currentLeague: 'KBL',
        currentSeason: 4,
        seasonYear: 2029,
        hofCount: 0,
      },
      { careerRunId: 'run-1', dedupeKey: 'session_start', dedupeScope: 'session' }
    );
    assert.equal(fetchCalls.length, 3);

    unsub2();
    void hydrationCb;
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
    }
    __resetAnalyticsClientMemoryForTest();
  }
});

test('POST /api/analytics/event validates requests and degrades gracefully when Supabase env is unset', async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // 1. 잘못된 event_name -> 400
    const badReq = new NextRequest('http://localhost:3000/api/analytics/event', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        event_name: 'invalid_event',
        anonymous_id: 'anon-test-1',
        session_id: 'sess-test-1',
        payload: {},
      }),
    });
    const badRes = await POST(badReq);
    assert.equal(badRes.status, 400);

    // 2. 교차 출처 요청 -> 403
    const crossOriginReq = new NextRequest(
      'http://localhost:3000/api/analytics/event',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'localhost:3000',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({
          event_name: 'session_start',
          anonymous_id: 'anon-test-1',
          session_id: 'sess-test-1',
          payload: {},
        }),
      }
    );
    const crossRes = await POST(crossOriginReq);
    assert.equal(crossRes.status, 403);

    // 3. 정상 요청이지만 Supabase 환경변수 미설정 -> 202 gracefully (stored: false)
    const validReq = new NextRequest(
      'http://localhost:3000/api/analytics/event',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          event_name: 'session_start',
          anonymous_id: 'anon-test-1',
          session_id: 'sess-test-2',
          game_version: '1.0.0',
          device_type: 'desktop',
          payload: {
            hasExistingSave: false,
            currentLeague: null,
            currentSeason: null,
            seasonYear: null,
            hofCount: 0,
          },
        }),
      }
    );
    const validRes = await POST(validReq);
    assert.equal(validRes.status, 202);
    const validJson = (await validRes.json()) as {
      ok: boolean;
      stored: boolean;
      reason?: string;
    };
    assert.equal(validJson.ok, true);
    assert.equal(validJson.stored, false);
    assert.equal(validJson.reason, 'not_configured');
  } finally {
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  }
});

test('insertAnalyticsEventToSupabase treats HTTP 404 as table_not_ready with cooldown', async () => {
  __resetAnalyticsSupabaseCooldownForTest();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify({ code: 'PGRST205', message: 'table not found' }),
      { status: 404 }
    );
  }) as typeof fetch;

  try {
    const sampleEvent = {
      event_name: 'session_start',
      anonymous_id: 'anon-404',
      session_id: 'sess-404',
      career_run_id: null,
      game_version: '1.0.0',
      device_type: 'desktop',
      payload: { hasExistingSave: false },
    };
    const fakeEnv = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    } as unknown as NodeJS.ProcessEnv;

    const first = await insertAnalyticsEventToSupabase(sampleEvent, fakeEnv);
    assert.deepEqual(first, {
      ok: true,
      stored: false,
      reason: 'table_not_ready',
    });
    assert.equal(fetchCount, 1);

    // 쿨다운 중 재요청은 중복 404 호출 없이 즉시 table_not_ready 반환
    const second = await insertAnalyticsEventToSupabase(sampleEvent, fakeEnv);
    assert.deepEqual(second, {
      ok: true,
      stored: false,
      reason: 'table_not_ready',
    });
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    __resetAnalyticsSupabaseCooldownForTest();
  }
});

test('normalizers map role, playoffResult, awards, peakLeague, and leagueHonors accurately', () => {
  assert.equal(normalizePlayerRole('프랜차이즈 1옵션 에이스'), 'franchise_ace');
  assert.equal(isStarterRole('franchise_ace'), true);
  assert.equal(normalizePlayerRole('주전 스타터'), 'starter');
  assert.equal(isStarterRole('starter'), true);
  assert.equal(normalizePlayerRole('핵심 식스맨'), 'sixth_man');
  assert.equal(isStarterRole('sixth_man'), false);
  assert.equal(normalizePlayerRole('투웨이 콜업 로테이션'), 'two_way');
  assert.equal(normalizePlayerRole('가비지 타임 (벤치 끝자리)'), 'garbage_time');
  assert.equal(normalizePlayerRole('벤치 로테이션'), 'bench');
  assert.equal(normalizePlayerRole('주전급 코어 유망주 (1라운드 픽)'), 'starter');
  assert.equal(normalizePlayerRole('핵심 유망주 로테이션 (1라운드 픽)'), 'bench');
  assert.equal(normalizePlayerRole('팀 에이스'), 'franchise_ace');
  assert.equal(normalizePlayerRole('벤치 에이스'), 'bench');
  assert.equal(normalizePlayerRole('세컨드 유닛 에이스'), 'sixth_man');
  assert.equal(normalizePlayerRole(null), 'bench');

  assert.equal(normalizePlayoffResult('PO 탈락', false), 'missed');
  assert.equal(normalizePlayoffResult('플레이인 탈락', false), 'play_in');
  assert.equal(normalizePlayoffResult('플레이오프 1R 탈락', false), 'round1');
  assert.equal(normalizePlayoffResult('8강 탈락', false), 'quarterfinals');
  assert.equal(normalizePlayoffResult('컨퍼런스 파이널 탈락', false), 'semifinals');
  assert.equal(normalizePlayoffResult('파이널 준우승', false), 'finals_loss');
  assert.equal(normalizePlayoffResult('NBA 파이널 우승 🏆', true), 'champion');

  const awards = extractSeasonAwards(
    makeMockSeasonLog({
      wonRookieOfYear: true,
      wonDpoy: true,
      wonSixthMan: false,
      wonMip: true,
      allStarSelected: true,
      allLeagueTeam: 2,
    })
  );
  assert.deepEqual(awards, ['ROY', 'DPOY', 'MIP', 'ALL_STAR', 'ALL_LEAGUE_2ND']);

  const career = makeMockCareer({
    league: 'KBL',
    seasonLogs: [
      makeMockSeasonLog({ league: 'HIGH_SCHOOL', wonChampionship: true, wonMvp: false, wonFinalsMvp: false }),
      makeMockSeasonLog({ league: 'NBA', wonChampionship: true, wonMvp: true, wonFinalsMvp: true }),
      makeMockSeasonLog({ league: 'NBA', wonChampionship: false, wonMvp: false, wonFinalsMvp: false }),
    ],
  });
  assert.equal(resolvePeakLeague(career), 'NBA');
  assert.deepEqual(buildLeagueHonorsSummary(career.seasonLogs), {
    HIGH_SCHOOL: { seasons: 1, championships: 1, mvp: 0, fmvp: 0 },
    NBA: { seasons: 2, championships: 1, mvp: 1, fmvp: 1 },
  });
});

test('validateAnalyticsEventPayload accepts upgraded arrays and nested leagueHonors while rejecting oversized arrays', () => {
  const validSeason = validateAnalyticsEventPayload({
    event_name: 'season_completed',
    anonymous_id: 'anon-up-1',
    session_id: 'sess-up-1',
    career_run_id: 'run-up-1',
    payload: {
      league: 'NBA',
      position: 'PG',
      seasonNumber: 5,
      seasonYear: 2030,
      age: 22,
      teamName: 'LAL',
      wonChampionship: true,
      wonMvp: true,
      wonFinalsMvp: true,
      allStarSelected: true,
      awards: ['DPOY', 'ALL_STAR', 'ALL_LEAGUE_1ST'],
      madePlayoffs: true,
      playoffResult: 'champion',
      teamWins: 62,
      teamLosses: 20,
      teamRank: 1,
      overall: 94,
      seasonOvr: 92,
      overallDelta: 3,
      role: 'franchise_ace',
      isStarter: true,
      mpg: 36.4,
      gamesPlayed: 79,
      ppg: 29.3,
      rpg: 5.8,
      apg: 9.1,
      spg: 2.1,
      bpg: 0.5,
      fgPct: 50.2,
      threePtPct: 40.8,
      trainingFocus: 'BALANCED',
      injuredGames: 3,
      hadInjury: true,
      contractType: 'NBA_MAX',
      salary: 45000000,
    },
  });
  assert.equal(validSeason.ok, true);
  if (validSeason.ok) {
    assert.deepEqual(validSeason.data.payload.awards, [
      'DPOY',
      'ALL_STAR',
      'ALL_LEAGUE_1ST',
    ]);
  }

  const validCareerEnded = validateAnalyticsEventPayload({
    event_name: 'career_ended',
    anonymous_id: 'anon-up-1',
    session_id: 'sess-up-1',
    career_run_id: 'run-up-1',
    payload: {
      position: 'PG',
      totalSeasons: 16,
      finalLeague: 'NBA',
      peakLeague: 'NBA',
      finalAge: 36,
      peakOverall: 96,
      finalOverall: 80,
      totalGames: 1120,
      totalAllLeague: 11,
      totalDpoy: 2,
      totalSixthMan: 0,
      totalMip: 1,
      mvpCount: 4,
      championshipCount: 5,
      nbaChampionshipCount: 4,
      finalsMvpCount: 4,
      allStarCount: 12,
      leagueHonors: {
        HIGH_SCHOOL: { seasons: 1, championships: 1, mvp: 1, fmvp: 1 },
        NCAA: { seasons: 1, championships: 0, mvp: 0, fmvp: 0 },
        KBL: { seasons: 2, championships: 1, mvp: 1, fmvp: 1 },
        EUROLEAGUE: { seasons: 2, championships: 0, mvp: 0, fmvp: 0 },
        NBA: { seasons: 10, championships: 3, mvp: 2, fmvp: 2 },
      },
      endingType: 'GOAT',
      retirementReason: 'VOLUNTARY_HONOR',
      legacyTier: 'GOAT',
      hallOfFame: true,
      jerseyRetired: true,
      careerPoints: 28000,
      careerPpg: 25,
      careerRpg: 5.5,
      careerApg: 8.8,
    },
  });
  assert.equal(validCareerEnded.ok, true);

  // 배열 길이 20 초과 시 즉시 400 거부
  const tooManyAwards = Array.from(
    { length: MAX_ANALYTICS_ARRAY_LENGTH + 1 },
    (_, i) => `AWARD_${i}`
  );
  const badArray = validateAnalyticsEventPayload({
    event_name: 'season_completed',
    anonymous_id: 'anon-up-1',
    session_id: 'sess-up-1',
    payload: {
      awards: tooManyAwards,
    },
  });
  assert.equal(badArray.ok, false);
});

test('buildRecentLogs stays compatible with mixed legacy and upgraded rows', () => {
  const recentLogs = buildRecentLogs(
    [
      // 기존 레거시 season_completed (wonFmvp, awards 없음)
      {
        id: '1',
        event_name: 'season_completed',
        anonymous_id: 'anon-legacy',
        session_id: 'sess-legacy',
        career_run_id: 'run-legacy',
        game_version: '1.0.0',
        device_type: 'desktop',
        payload: {
          league: 'KBL',
          seasonNumber: 1,
          ppg: 15.2,
          wonChampionship: true,
          wonMvp: true,
          wonFinalsMvp: true,
        },
        created_at: '2026-11-23T10:00:00.000Z',
      },
      // 고도화 season_completed (wonFmvp + awards + 신규 밸런스 지표)
      {
        id: '2',
        event_name: 'season_completed',
        anonymous_id: 'anon-new',
        session_id: 'sess-new',
        career_run_id: 'run-new',
        game_version: '1.0.0',
        device_type: 'mobile',
        payload: {
          league: 'NBA',
          position: 'PG',
          seasonNumber: 4,
          ppg: 28.4,
          wonChampionship: true,
          wonMvp: true,
          wonFmvp: true,
          wonFinalsMvp: true,
          awards: ['DPOY', 'ALL_STAR', 'ALL_LEAGUE_1ST'],
        },
        created_at: '2026-11-24T10:00:00.000Z',
      },
      // 고도화 career_ended
      {
        id: '3',
        event_name: 'career_ended',
        anonymous_id: 'anon-new',
        session_id: 'sess-new',
        career_run_id: 'run-new',
        game_version: '1.0.0',
        device_type: 'mobile',
        payload: {
          totalSeasons: 14,
          finalLeague: 'NBA',
          peakLeague: 'NBA',
          totalChampionships: 3,
          totalMvp: 2,
          totalFmvp: 2,
          legacyTier: 'FIRST_BALLOT_HOF',
        },
        created_at: '2026-11-24T11:00:00.000Z',
      },
    ]
  );

  assert.equal(recentLogs.length, 3);
  // 레거시 행은 wonFinalsMvp만 있어도 FMVP 뱃지가 붙어야 함
  assert.deepEqual(recentLogs[0].badges, ['우승', 'MVP', 'FMVP']);
  assert.equal(recentLogs[0].position, null);
  assert.equal(recentLogs[1].position, 'PG');
  assert.ok(recentLogs.some((m) => m.summary.includes('FMVP')));
  assert.ok(
    recentLogs.some((m) => m.summary.includes('우승 3 · MVP 2 · FMVP 2'))
  );
});



test('1.0.1 funnel events: creation_started once per entry and draft_completed on draft resolution', () => {
  const captured: Array<{
    eventName: string;
    payload: Record<string, unknown>;
    dedupeKey?: string;
    dedupeScope?: string;
  }> = [];
  const dispatcher = {
    track: (
      eventName: string,
      payload: unknown,
      options?: { dedupeKey?: string; dedupeScope?: 'session' | 'persistent' }
    ) => {
      captured.push({
        eventName,
        payload: payload as Record<string, unknown>,
        dedupeKey: options?.dedupeKey,
        dedupeScope: options?.dedupeScope,
      });
    },
    resolveCareerRunId: (careerId: string) => `run-for-${careerId}`,
  };

  // 홈 → 생성 화면
  emitCareerStateTransitionEvents(
    { view: 'HOME', career: null, hofList: [] },
    { view: 'CREATE', career: null, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 1);
  assert.equal(captured[0].eventName, 'creation_started');
  assert.deepEqual(captured[0].payload, { hasExistingSave: false, hofCount: 0 });
  assert.equal(captured[0].dedupeScope, 'session');

  // 생성 화면에 머무는 동안에는 다시 보내지 않음
  emitCareerStateTransitionEvents(
    { view: 'CREATE', career: null, hofList: [] },
    { view: 'CREATE', career: null, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 1);

  // NBA 드래프트 지명
  const beforeDraft = makeMockCareer({ league: 'NCAA', ovr: 74, draftResult: null });
  const afterDraft = makeMockCareer({
    league: 'NCAA',
    ovr: 74,
    draftResult: {
      draftType: 'NBA',
      pickNumber: 12,
      round: 1,
      draftedTeam: null,
      twoWayOfferTeam: null,
      scoutingGrade: 81.26,
    },
  });
  emitCareerStateTransitionEvents(
    { view: 'DASHBOARD', career: beforeDraft, hofList: [] },
    { view: 'DRAFT_LIVE', career: afterDraft, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 2);
  assert.equal(captured[1].eventName, 'draft_completed');
  assert.equal(captured[1].payload.draftType, 'NBA');
  assert.equal(captured[1].payload.fromLeague, 'NCAA');
  assert.equal(captured[1].payload.pickNumber, 12);
  assert.equal(captured[1].payload.drafted, true);
  assert.equal(captured[1].payload.hasTwoWayOffer, false);
  assert.equal(captured[1].payload.scoutingGrade, 81.3);

  // 같은 드래프트 결과가 유지되는 동안에는 다시 보내지 않음
  emitCareerStateTransitionEvents(
    { view: 'DRAFT_LIVE', career: afterDraft, hofList: [] },
    { view: 'DASHBOARD', career: { ...afterDraft }, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 2);

  // 미지명도 기록
  const undrafted = makeMockCareer({
    league: 'HIGH_SCHOOL',
    draftResult: {
      draftType: 'KBL',
      pickNumber: null,
      round: null,
      draftedTeam: null,
      twoWayOfferTeam: null,
    },
  });
  emitCareerStateTransitionEvents(
    { view: 'DASHBOARD', career: makeMockCareer({ league: 'HIGH_SCHOOL', draftResult: null }), hofList: [] },
    { view: 'DRAFT_LIVE', career: undrafted, hofList: [] },
    dispatcher
  );
  assert.equal(captured.length, 3);
  assert.equal(captured[2].payload.drafted, false);
  assert.equal(captured[2].payload.scoutingGrade, null);
});
