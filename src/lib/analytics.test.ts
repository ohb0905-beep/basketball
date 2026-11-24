import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  __resetAnalyticsClientMemoryForTest,
  attachCareerAnalyticsTracker,
  emitCareerStateTransitionEvents,
  trackGameEvent,
  type SubscribableCareerStore,
  type TrackableCareerStoreSnapshot,
} from './analytics';
import {
  ANALYTICS_EVENT_NAMES,
  MAX_ANALYTICS_PAYLOAD_BYTES,
  createAnalyticsRateLimiter,
  validateAnalyticsEventPayload,
} from './analyticsSchema';
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
    role: '주전 포워드',
    ovr: 66,
    gp: 24,
    injuredGamesMissed: 0,
    mpg: 28.5,
    ppg: 18.2,
    rpg: 6.1,
    apg: 4.4,
    spg: 1.5,
    bpg: 0.7,
    fgPct: 49.0,
    tpPct: 37.5,
    wins: 21,
    losses: 3,
    playoffResult: '우승',
    salaryEarned: 0,
    wonChampionship: true,
    wonMvp: true,
    wonFinalsMvp: true,
    wonDpoy: false,
    wonSixthMan: false,
    wonMip: false,
    wonRookieOfYear: false,
    allStarSelected: false,
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
    traits: ['CLUTCH_GENE'],
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
    contractSalaryManWon: 0,
    contractYearsLeft: 1,
    ovr: 62,
    peakOvr: 62,
    totals: {
      gp: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      championships: 0,
      nbaChampionships: 0,
      mvps: 0,
      finalsMvps: 0,
      allStars: 0,
      allLeagueFirst: 0,
      dpoy: 0,
      sixthMan: 0,
      mip: 0,
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
  for (const eventName of ANALYTICS_EVENT_NAMES) {
    assert.ok(
      sql.includes(`'${eventName}'`),
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
  assert.equal('name' in captured[0].payload, false);
  assert.equal(
    JSON.stringify(captured[0].payload).includes('민감한사용자입력선수명'),
    false
  );

  // 2. season_completed
  const afterSeason1 = makeMockCareer({
    seasonsPlayed: 1,
    ovr: 68,
    peakOvr: 68,
    seasonLogs: [makeMockSeasonLog()],
  });
  emitCareerStateTransitionEvents(
    { view: 'DASHBOARD', career: createdCareer, hofList: [] },
    { view: 'DASHBOARD', career: afterSeason1, hofList: [] },
    dispatcher
  );
  assert.equal(captured[1].eventName, 'season_completed');
  assert.equal(captured[1].payload.seasonNumber, 1);
  assert.equal(captured[1].payload.ppg, 18.2);
  assert.equal(captured[1].payload.wonChampionship, true);
  assert.equal(captured[1].payload.wonMvp, true);

  // 3. league_changed (HIGH_SCHOOL -> KBL)
  const inKbl = makeMockCareer({
    seasonsPlayed: 1,
    seasonYear: 2027,
    age: 18,
    league: 'KBL',
    ovr: 70,
    contractType: 'KBL_ROOKIE',
  });
  emitCareerStateTransitionEvents(
    { view: 'DASHBOARD', career: afterSeason1, hofList: [] },
    { view: 'DASHBOARD', career: inKbl, hofList: [] },
    dispatcher
  );
  assert.equal(captured[2].eventName, 'league_changed');
  assert.equal(captured[2].payload.fromLeague, 'HIGH_SCHOOL');
  assert.equal(captured[2].payload.toLeague, 'KBL');

  // 4. career_ended (동일 시즌/리그에서 은퇴 선언 시나리오)
  const preRetirement = makeMockCareer({
    seasonsPlayed: 15,
    age: 35,
    league: 'NBA',
    ovr: 79,
    peakOvr: 95,
    totals: {
      ...createdCareer.totals,
      gp: 1020,
      mvps: 3,
      championships: 5,
      nbaChampionships: 4,
      finalsMvps: 3,
      allStars: 11,
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
  assert.equal(captured[3].payload.nbaChampionshipCount, 4);
  assert.equal(captured[3].payload.legacyTier, 'GOAT');

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

    // 동일 dedupeKey로 season_completed 이중 호출 시 1회만 전송
    trackGameEvent(
      'season_completed',
      {
        seasonNumber: 4,
        seasonYear: 2029,
        league: 'KBL',
        teamName: 'SK',
        overall: 76,
        seasonOvr: 75,
        age: 20,
        gamesPlayed: 54,
        ppg: 17.5,
        rpg: 4.8,
        apg: 5.2,
        wonChampionship: false,
        wonMvp: false,
        wonFinalsMvp: false,
        allStarSelected: true,
      },
      { careerRunId: 'run-1', dedupeKey: 'season_completed:run-1:4' }
    );
    trackGameEvent(
      'season_completed',
      {
        seasonNumber: 4,
        seasonYear: 2029,
        league: 'KBL',
        teamName: 'SK',
        overall: 76,
        seasonOvr: 75,
        age: 20,
        gamesPlayed: 54,
        ppg: 17.5,
        rpg: 4.8,
        apg: 5.2,
        wonChampionship: false,
        wonMvp: false,
        wonFinalsMvp: false,
        allStarSelected: true,
      },
      { careerRunId: 'run-1', dedupeKey: 'season_completed:run-1:4' }
    );

    assert.equal(fetchCalls.length, 2);
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

