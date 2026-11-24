import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
} from './adminAuth';
import {
  AnalyticsEventRow,
  aggregateAnalyticsEvents,
  getAnalyticsRangeStartIso,
  safePercent,
  toKstDateKey,
} from './adminAnalytics';
import { GET } from '../app/api/admin/analytics/route';

function hasNaNDeep(value: unknown): boolean {
  if (typeof value === 'number') return Number.isNaN(value) || !Number.isFinite(value);
  if (typeof value === 'string') return value.includes('NaN');
  if (Array.isArray(value)) return value.some(hasNaNDeep);
  if (value && typeof value === 'object') {
    return Object.values(value).some(hasNaNDeep);
  }
  return false;
}

test('aggregateAnalyticsEvents handles 0 rows without NaN or errors', () => {
  const nowMs = Date.parse('2026-11-24T06:00:00.000Z'); // 2026-11-24 15:00 KST
  const report7d = aggregateAnalyticsEvents([], {
    range: '7d',
    version: 'all',
    nowMs,
  });

  assert.equal(hasNaNDeep(report7d), false);
  assert.equal(report7d.kpi.uniquePlayers, 0);
  assert.equal(report7d.kpi.totalSessions, 0);
  assert.equal(report7d.kpi.careersCreated, 0);
  assert.equal(report7d.kpi.seasonsCompleted, 0);
  assert.equal(report7d.kpi.careersEnded, 0);
  assert.equal(report7d.dailyTrend.length, 7);
  assert.equal(report7d.dailyTrend[6].dateKey, '2026-11-24');
  assert.equal(report7d.dailyTrend[0].dateKey, '2026-11-18');
  assert.equal(report7d.recentLogs.length, 0);
  for (const item of [
    ...report7d.distributions.positions,
    ...report7d.distributions.leagueReach,
    ...report7d.distributions.maxSeasonReached,
    ...report7d.distributions.resetSeasons,
    ...report7d.distributions.devices,
  ]) {
    assert.equal(item.count, 0);
    assert.equal(item.percent, 0);
  }

  assert.equal(safePercent(0, 0), 0);
  assert.equal(safePercent(5, 0), 0);
  assert.equal(safePercent(Number.NaN, 10), 0);
});

test('aggregateAnalyticsEvents computes accurate KPIs, KST daily buckets, funnel, and distributions', () => {
  const nowMs = Date.parse('2026-11-24T06:00:00.000Z'); // 2026-11-24 15:00 KST
  const rows: AnalyticsEventRow[] = [
    // UTC 2026-11-23T15:30:00Z => KST 2026-11-24 00:30 (날짜 경계 검증)
    {
      id: 'evt-1',
      event_name: 'session_start',
      anonymous_id: 'anon-A',
      session_id: 'sess-A1',
      career_run_id: null,
      game_version: '1.0.0',
      device_type: 'mobile',
      payload: { hasExistingSave: false, hofCount: 0 },
      created_at: '2026-11-23T15:30:00.000Z',
    },
    {
      id: 'evt-2',
      event_name: 'career_created',
      anonymous_id: 'anon-A',
      session_id: 'sess-A1',
      career_run_id: 'run-A1',
      game_version: '1.0.0',
      device_type: 'mobile',
      payload: {
        position: 'PG',
        heightCm: 185,
        startingLeague: 'HIGH_SCHOOL',
        initialOvr: 61,
      },
      created_at: '2026-11-23T15:35:00.000Z',
    },
    {
      id: 'evt-3',
      event_name: 'season_completed',
      anonymous_id: 'anon-A',
      session_id: 'sess-A1',
      career_run_id: 'run-A1',
      game_version: '1.0.0',
      device_type: 'mobile',
      payload: {
        seasonNumber: 1,
        league: 'HIGH_SCHOOL',
        overall: 66,
        ppg: 17.4,
        wonChampionship: true,
        wonMvp: true,
      },
      created_at: '2026-11-23T16:00:00.000Z',
    },
    {
      id: 'evt-4',
      event_name: 'league_changed',
      anonymous_id: 'anon-A',
      session_id: 'sess-A1',
      career_run_id: 'run-A1',
      game_version: '1.0.0',
      device_type: 'mobile',
      payload: {
        fromLeague: 'HIGH_SCHOOL',
        toLeague: 'KBL',
        seasonNumber: 1,
        overall: 68,
      },
      created_at: '2026-11-23T16:05:00.000Z',
    },
    {
      id: 'evt-5',
      event_name: 'season_completed',
      anonymous_id: 'anon-A',
      session_id: 'sess-A1',
      career_run_id: 'run-A1',
      game_version: '1.0.0',
      device_type: 'mobile',
      payload: {
        seasonNumber: 5,
        league: 'NBA',
        overall: 89,
        ppg: 24.8,
        allStarSelected: true,
      },
      created_at: '2026-11-23T17:00:00.000Z',
    },
    {
      id: 'evt-6',
      event_name: 'career_ended',
      anonymous_id: 'anon-A',
      session_id: 'sess-A1',
      career_run_id: 'run-A1',
      game_version: '1.0.0',
      device_type: 'mobile',
      payload: {
        totalSeasons: 12,
        finalLeague: 'NBA',
        peakOverall: 94,
        championshipCount: 3,
        mvpCount: 2,
        legacyTier: 'FIRST_BALLOT_HOF',
      },
      created_at: '2026-11-23T18:00:00.000Z',
    },
    // 전날 KST (2026-11-23 11:00 KST) 두 번째 유저
    {
      id: 'evt-7',
      event_name: 'session_start',
      anonymous_id: 'anon-B',
      session_id: 'sess-B1',
      career_run_id: null,
      game_version: '1.1.0',
      device_type: 'desktop',
      payload: { hasExistingSave: false },
      created_at: '2026-11-23T02:00:00.000Z',
    },
    {
      id: 'evt-8',
      event_name: 'career_created',
      anonymous_id: 'anon-B',
      session_id: 'sess-B1',
      career_run_id: 'run-B1',
      game_version: '1.1.0',
      device_type: 'desktop',
      payload: {
        position: 'SF',
        heightCm: 199,
        startingLeague: 'HIGH_SCHOOL',
        initialOvr: 63,
      },
      created_at: '2026-11-23T02:05:00.000Z',
    },
    {
      id: 'evt-9',
      event_name: 'career_reset',
      anonymous_id: 'anon-B',
      session_id: 'sess-B1',
      career_run_id: 'run-B1',
      game_version: '1.1.0',
      device_type: 'desktop',
      payload: {
        abandonedLeague: 'HIGH_SCHOOL',
        abandonedSeason: 1,
        abandonedOverall: 64,
      },
      created_at: '2026-11-23T02:20:00.000Z',
    },
  ];

  assert.equal(toKstDateKey('2026-11-23T15:30:00.000Z'), '2026-11-24');
  assert.equal(toKstDateKey('2026-11-23T02:00:00.000Z'), '2026-11-23');

  const report = aggregateAnalyticsEvents(rows, {
    range: '7d',
    version: 'all',
    nowMs,
  });

  assert.equal(hasNaNDeep(report), false);
  assert.equal(report.kpi.uniquePlayers, 2);
  assert.equal(report.kpi.totalSessions, 2);
  assert.equal(report.kpi.careersCreated, 2);
  assert.equal(report.kpi.seasonsCompleted, 2);
  assert.equal(report.kpi.careersEnded, 1);
  assert.equal(report.kpi.careersReset, 1);

  // KST 날짜별 추이 검증
  const day24 = report.dailyTrend.find((d) => d.dateKey === '2026-11-24');
  const day23 = report.dailyTrend.find((d) => d.dateKey === '2026-11-23');
  assert.equal(day24?.uniquePlayers, 1);
  assert.equal(day24?.careersCreated, 1);
  assert.equal(day23?.uniquePlayers, 1);
  assert.equal(day23?.careersCreated, 1);

  // 포지션 분포: PG 50%, SF 50%
  const pg = report.distributions.positions.find((p) => p.key === 'PG');
  const sf = report.distributions.positions.find((p) => p.key === 'SF');
  assert.equal(pg?.count, 1);
  assert.equal(pg?.percent, 50);
  assert.equal(sf?.count, 1);
  assert.equal(sf?.percent, 50);

  // 리그 도달 퍼널: 총 2개 커리어 중 HIGH_SCHOOL 2(100%), KBL 1(50%), NBA 1(50%)
  assert.equal(report.distributions.leagueReachDenominator, 2);
  const hs = report.distributions.leagueReach.find((l) => l.key === 'HIGH_SCHOOL');
  const kbl = report.distributions.leagueReach.find((l) => l.key === 'KBL');
  const nba = report.distributions.leagueReach.find((l) => l.key === 'NBA');
  assert.equal(hs?.percent, 100);
  assert.equal(kbl?.percent, 50);
  assert.equal(nba?.percent, 50);

  // 리셋 시즌 분포: 1시즌 버킷 100%
  const reset1 = report.distributions.resetSeasons.find((b) => b.key === '1');
  assert.equal(reset1?.count, 1);
  assert.equal(reset1?.percent, 100);

  // 최근 로그 정렬 (최신 evt-6이 첫 번째)
  assert.equal(report.recentLogs[0].id, 'evt-6');
  assert.equal(report.recentLogs[0].eventLabel, '커리어 은퇴');
  assert.match(report.recentLogs[0].summary, /총 12시즌/);

  // 기간 시작 ISO 검증
  const start7d = getAnalyticsRangeStartIso('7d', nowMs);
  assert.ok(start7d);
  assert.equal(toKstDateKey(start7d), '2026-11-18');
  assert.equal(getAnalyticsRangeStartIso('all', nowMs), null);
});

test('GET /api/admin/analytics blocks unauthenticated requests with 401 and validates queries when authenticated', async () => {
  const prevPass = process.env.ADMIN_PASSWORD;
  const prevSecret = process.env.ADMIN_SESSION_SECRET;
  const prevSupaUrl = process.env.SUPABASE_URL;
  const prevSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;

  process.env.ADMIN_PASSWORD = 'test-admin-password-strong';
  process.env.ADMIN_SESSION_SECRET = 'test-admin-secret-key-32-chars-minimum';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  try {
    // 1. 미인증 요청 -> 즉시 401 Unauthorized + Cache-Control: no-store
    const unauthReq = new NextRequest(
      'http://localhost:3000/api/admin/analytics?range=7d',
      { method: 'GET' }
    );
    const unauthRes = await GET(unauthReq);
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.headers.get('cache-control'), 'no-store');

    const token = createAdminSessionToken();
    assert.ok(token);

    // 2. 잘못된 range 쿼리 -> 400
    const badRangeReq = new NextRequest(
      'http://localhost:3000/api/admin/analytics?range=365d',
      {
        method: 'GET',
        headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}` },
      }
    );
    const badRangeRes = await GET(badRangeReq);
    assert.equal(badRangeRes.status, 400);

    // 3. 잘못된 version 쿼리 -> 400
    const badVerReq = new NextRequest(
      'http://localhost:3000/api/admin/analytics?range=7d&version=../secret',
      {
        method: 'GET',
        headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}` },
      }
    );
    const badVerRes = await GET(badVerReq);
    assert.equal(badVerRes.status, 400);

    // 4. 인증 + Supabase 404 (테이블 미생성) -> 200 + tableNotReady: true + NaN 없음
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ code: 'PGRST205' }), {
        status: 404,
      })) as typeof fetch;

    const tableNotReadyReq = new NextRequest(
      'http://localhost:3000/api/admin/analytics?range=30d&version=all',
      {
        method: 'GET',
        headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}` },
      }
    );
    const tableNotReadyRes = await GET(tableNotReadyReq);
    assert.equal(tableNotReadyRes.status, 200);
    assert.equal(tableNotReadyRes.headers.get('cache-control'), 'no-store');
    const body = (await tableNotReadyRes.json()) as {
      ok: boolean;
      report: { tableNotReady: boolean; kpi: { uniquePlayers: number } };
    };
    assert.equal(body.ok, true);
    assert.equal(body.report.tableNotReady, true);
    assert.equal(body.report.kpi.uniquePlayers, 0);
    assert.equal(hasNaNDeep(body), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevPass !== undefined) process.env.ADMIN_PASSWORD = prevPass;
    else delete process.env.ADMIN_PASSWORD;
    if (prevSecret !== undefined) process.env.ADMIN_SESSION_SECRET = prevSecret;
    else delete process.env.ADMIN_SESSION_SECRET;
    if (prevSupaUrl !== undefined) process.env.SUPABASE_URL = prevSupaUrl;
    else delete process.env.SUPABASE_URL;
    if (prevSupaKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevSupaKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
