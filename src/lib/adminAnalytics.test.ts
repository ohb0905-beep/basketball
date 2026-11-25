import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
} from './adminAuth';
import {
  AnalyticsEventRow,
  buildAdminAnalyticsReport,
  buildCreationFunnel,
  buildSurveyReport,
  buildVersionCompare,
  compareGameVersionsDesc,
  buildShareableAnalyticsSummary,
  buildStorageReport,
  DB_SIZE_LIMIT_BYTES,
  getAnalyticsRangeStartIso,
  INSIGHT_MIN_SAMPLE,
  isValidAnalyticsDateRange,
  isValidAnalyticsLeagueFilter,
  rateCell,
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

const NOW_MS = Date.parse('2026-11-24T06:00:00.000Z'); // 2026-11-24 15:00 KST

test('filters and percent helpers never produce NaN', () => {
  assert.equal(safePercent(0, 0), 0);
  assert.equal(safePercent(5, 0), 0);
  assert.equal(safePercent(Number.NaN, 10), 0);
  assert.equal(safePercent(1, 3), 33.3);

  assert.deepEqual(rateCell(0, 0), { count: 0, n: 0, percent: null });
  assert.deepEqual(rateCell(3, 4), { count: 3, n: 4, percent: 75 });
  // 발생 수가 모수보다 클 수 없음
  assert.deepEqual(rateCell(9, 4), { count: 4, n: 4, percent: 100 });

  assert.equal(isValidAnalyticsDateRange('90d'), true);
  assert.equal(isValidAnalyticsDateRange('365d'), false);
  assert.equal(isValidAnalyticsLeagueFilter('all'), true);
  assert.equal(isValidAnalyticsLeagueFilter('NBA'), true);
  assert.equal(isValidAnalyticsLeagueFilter("NBA' or 1=1"), false);

  const start7d = getAnalyticsRangeStartIso('7d', NOW_MS);
  assert.ok(start7d);
  assert.equal(toKstDateKey(start7d), '2026-11-18');
  const start90d = getAnalyticsRangeStartIso('90d', NOW_MS);
  assert.ok(start90d);
  assert.equal(toKstDateKey(start90d), '2026-08-27');
  assert.equal(getAnalyticsRangeStartIso('all', NOW_MS), null);
});

test('buildAdminAnalyticsReport handles a missing aggregate (0 rows / function not installed) cleanly', () => {
  const report = buildAdminAnalyticsReport(null, [], {
    range: '7d',
    version: 'all',
    league: 'all',
    nowMs: NOW_MS,
    setupRequired: true,
  });

  assert.equal(hasNaNDeep(report), false);
  assert.equal(report.setupRequired, true);
  assert.equal(report.kpi.uniquePlayers, 0);
  assert.equal(report.dailyTrend.length, 7);
  assert.equal(report.dailyTrend[6].dateKey, '2026-11-24');
  assert.equal(report.leagueAwards.length, 0);
  assert.equal(report.positionBalance.rows.length, 5);
  for (const row of report.positionBalance.rows) {
    assert.equal(row.careers, 0);
    assert.equal(row.mvp.percent, null);
  }
  assert.equal(report.resets.earlyQuit.percent, null);
  assert.equal(report.endings.hallOfFame.percent, null);
  assert.deepEqual(report.insights, []);
  assert.equal(report.recentLogs.length, 0);

  // 'all' 기간 + 데이터 없음 -> 빈 추이
  const allReport = buildAdminAnalyticsReport({}, [], {
    range: 'all',
    version: 'all',
    league: 'all',
    nowMs: NOW_MS,
  });
  assert.deepEqual(allReport.dailyTrend, []);
});

test('buildAdminAnalyticsReport computes rates with per-field denominators and rule-based insights', () => {
  const aggregate = {
    schemaVersion: 1,
    kpi: {
      totalEvents: 500,
      uniquePlayers: 40,
      totalSessions: 60,
      careersCreated: 50,
      seasonsCompleted: 400,
      careersEnded: 10,
      careersReset: 40,
      championships: 30,
      mvps: 45,
      fmvps: 20,
    },
    daily: [
      { date: '2026-11-24', players: 30, careers: 20, seasons: 300 },
      { date: '2026-11-20', players: 10, careers: 30, seasons: 100 },
    ],
    leagues: [
      // 구버전 행이 섞여 playoffN(신규 필드 모수)이 seasons보다 작음
      { league: 'NBA', seasons: 100, v2Seasons: 40, champN: 100, champs: 5, mvpN: 100, mvps: 10, fmvpN: 100, fmvps: 4, playoffN: 40, playoffs: 20, ovrAvg: 81.84, ppgAvg: 20.6, rpgAvg: 5, apgAvg: 5 },
      { league: 'HIGH_SCHOOL', seasons: 300, v2Seasons: 0, champN: 300, champs: 25, mvpN: 300, mvps: 35, fmvpN: 300, fmvps: 16, playoffN: 0, playoffs: 0, ovrAvg: 59.6, ppgAvg: null, rpgAvg: null, apgAvg: null },
    ],
    positionsCreated: [
      { key: 'PG', count: 30 },
      { key: 'C', count: 20 },
    ],
    positionSeasons: [
      { position: 'PG', seasons: 250, champN: 250, champs: 20, mvpN: 250, mvps: 25, fmvpN: 250, fmvps: 12, ovrAvg: 70, ppgAvg: 18.5, rpgAvg: 2, apgAvg: 9.9 },
      { position: 'C', seasons: 140, champN: 140, champs: 10, mvpN: 140, mvps: 20, fmvpN: 140, fmvps: 8, ovrAvg: 72, ppgAvg: 18, rpgAvg: 12, apgAvg: 1 },
      { position: 'unknown', seasons: 10, champN: 10, champs: 0, mvpN: 10, mvps: 0, fmvpN: 10, fmvps: 0 },
    ],
    leagueReach: { runs: 50, items: [{ key: 'HIGH_SCHOOL', count: 50 }, { key: 'NBA', count: 20 }] },
    maxSeason: [
      { key: 1, count: 10 },
      { key: 5, count: 20 },
      { key: 20, count: 20 },
    ],
    resets: {
      total: 40,
      roleN: 20,
      champN: 30,
      hadChamp: 6,
      mvpN: 30,
      hadMvp: 3,
      byLeague: [{ key: 'HIGH_SCHOOL', count: 30 }, { key: 'NBA', count: 10 }],
      bySeason: [{ key: 0, count: 20 }, { key: 1, count: 10 }, { key: 8, count: 10 }],
      byOvr: [{ key: 70, count: 15 }, { key: 50, count: 25 }],
      byRole: [{ key: 'garbage_time', count: 15 }, { key: 'starter', count: 5 }],
    },
    roles: [{ key: 'franchise_ace', count: 30 }, { key: 'bench', count: 10 }],
    playoffResults: [{ key: 'missed', count: 20 }, { key: 'champion', count: 20 }],
    awardSeasons: 40,
    awards: [{ key: 'ALL_STAR', count: 20 }, { key: 'NEW_FUTURE_AWARD', count: 2 }],
    endings: { total: 10, hofN: 4, hof: 1, byType: [{ key: 'GOAT', count: 1 }] },
    created: { playstyle: [{ key: 'SCORER', count: 3 }], growthDna: [], trainingFocus: [], startingLeague: [] },
    leagueChanges: { total: 5, byReason: [{ key: 'draft', count: 5 }], byDraftRound: [{ key: 1, count: 3 }, { key: 2, count: 2 }] },
    devices: [{ key: 'mobile', count: 30 }, { key: 'unknown', count: 10 }],
    versions: [{ key: '1.0.0', count: 500 }],
    availableVersions: ['1.0.0'],
  };

  const report = buildAdminAnalyticsReport(aggregate, [], {
    range: '7d',
    version: 'all',
    league: 'all',
    nowMs: NOW_MS,
  });

  assert.equal(hasNaNDeep(report), false);
  assert.equal(report.kpi.fmvps, 20);

  // 리그 표: 퍼널 순서(고교 -> NBA)로 정렬, 플레이오프는 신규 필드 모수 기준
  assert.deepEqual(
    report.leagueAwards.map((r) => r.league),
    ['HIGH_SCHOOL', 'NBA']
  );
  const nba = report.leagueAwards[1];
  assert.deepEqual(nba.championship, { count: 5, n: 100, percent: 5 });
  assert.deepEqual(nba.playoffs, { count: 20, n: 40, percent: 50 });
  assert.equal(nba.ovrAvg, 81.8);
  const hs = report.leagueAwards[0];
  assert.equal(hs.playoffs.percent, null); // 모수 0 -> '-'
  assert.equal(hs.ppgAvg, null);

  // 포지션 매트릭스
  const pg = report.positionBalance.rows.find((r) => r.position === 'PG')!;
  assert.equal(pg.careers, 30);
  assert.equal(pg.careerShare, 60);
  assert.equal(pg.mvp.percent, 10);
  const sf = report.positionBalance.rows.find((r) => r.position === 'SF')!;
  assert.equal(sf.seasons, 0);
  assert.equal(sf.championship.percent, null);
  assert.equal(report.positionBalance.unknownPositionSeasons, 10);

  // 리셋 병목: 1시즌 이하 30/40, 우승 후 리셋 6/30 (해당 필드 수집분 기준)
  assert.deepEqual(report.resets.earlyQuit, { count: 30, n: 40, percent: 75 });
  assert.deepEqual(report.resets.afterChampionship, { count: 6, n: 30, percent: 20 });
  assert.deepEqual(
    report.resets.byOvr.map((i) => i.label),
    ['OVR 50~59', 'OVR 70~79']
  );
  assert.equal(report.resets.byLeague[0].percent, 75);

  // 기타 수상: 수상 데이터가 있는 시즌 대비 비율, 미등록 코드는 원문 표시
  assert.equal(report.awards.items[0].label, '올스타');
  assert.equal(report.awards.items[0].percent, 50);
  assert.equal(report.awards.items[1].label, 'NEW_FUTURE_AWARD');

  // 플레이오프 단계는 우승 -> 탈락 순
  assert.equal(report.seasonMeta.playoffResults[0].key, 'champion');
  assert.deepEqual(report.endings.hallOfFame, { count: 1, n: 4, percent: 25 });
  assert.equal(report.buildMeta.draftRounds[0].label, '1라운드');
  assert.equal(report.environment.devices[1].label, '미분류');

  // 일별 추이: 7일 연속 막대, 빈 날짜는 0
  assert.equal(report.dailyTrend.length, 7);
  assert.equal(report.dailyTrend[6].uniquePlayers, 30);
  assert.equal(report.dailyTrend[2].dateKey, '2026-11-20');
  assert.equal(report.dailyTrend[2].careersCreated, 30);
  assert.equal(report.dailyTrend[3].uniquePlayers, 0);

  // 최대 도달 시즌 버킷
  const maxBuckets = Object.fromEntries(
    report.funnel.maxSeasonReached.map((b) => [b.key, b.count])
  );
  assert.equal(maxBuckets['1'], 10);
  assert.equal(maxBuckets['4-6'], 20);
  assert.equal(maxBuckets['16+'], 20);

  // 인사이트: 표본이 충분한 항목만, 최대 5줄
  assert.ok(report.insights.length >= 3 && report.insights.length <= 5);
  assert.ok(report.insights.some((line) => line.includes('가장 많이 선택된 포지션은 PG')));
  assert.ok(report.insights.some((line) => line.includes('C가 14.3%로 가장 높고')));
  assert.ok(report.insights.some((line) => line.includes('NBA의 시즌 우승률은 5.0%')));
  assert.ok(report.insights.every((line) => !line.includes('NaN')));

  // 공유용 JSON에는 원본 로그가 없음
  const shareable = buildShareableAnalyticsSummary(report);
  assert.equal('recentLogs' in shareable, false);
  assert.ok(JSON.stringify(shareable).length > 100);
});

test('insights stay empty below the minimum sample size', () => {
  const report = buildAdminAnalyticsReport(
    {
      positionsCreated: [{ key: 'PG', count: INSIGHT_MIN_SAMPLE - 1 }],
      leagues: [{ league: 'NBA', seasons: 5, champN: 5, champs: 1, mvpN: 5, mvps: 1 }],
      resets: { total: 3, bySeason: [{ key: 0, count: 3 }] },
    },
    [],
    { range: '30d', version: 'all', league: 'all', nowMs: NOW_MS }
  );
  assert.deepEqual(report.insights, []);
  assert.equal(report.dailyTrend.length, 30);
});

function withAdminEnv() {
  const saved = {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.ADMIN_PASSWORD = 'test-admin-password-strong';
  process.env.ADMIN_SESSION_SECRET = 'test-admin-secret-key-32-chars-minimum';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value;
      else delete process.env[key];
    }
  };
}

function authedRequest(query: string, token: string) {
  return new NextRequest(`http://localhost:3000/api/admin/analytics?${query}`, {
    method: 'GET',
    headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}` },
  });
}

test('GET /api/admin/analytics blocks unauthenticated requests and validates filters', async () => {
  const restoreEnv = withAdminEnv();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response('[]', { status: 200 });
  }) as typeof fetch;

  try {
    // 미인증 -> 401 + no-store, Supabase 조회 없음
    const unauthRes = await GET(
      new NextRequest('http://localhost:3000/api/admin/analytics?range=7d', {
        method: 'GET',
      })
    );
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.headers.get('cache-control'), 'no-store');
    const unauthBody = (await unauthRes.json()) as Record<string, unknown>;
    assert.equal('report' in unauthBody, false);
    assert.equal(fetchCalls, 0);

    const token = createAdminSessionToken();
    assert.ok(token);

    for (const query of [
      'range=365d',
      'range=7d&version=../secret',
      'range=7d&league=MARS',
    ]) {
      const res = await GET(authedRequest(query, token));
      assert.equal(res.status, 400, query);
      assert.equal(res.headers.get('cache-control'), 'no-store');
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('GET /api/admin/analytics calls the aggregate RPC with filters and reports setup state', async () => {
  const restoreEnv = withAdminEnv();
  const originalFetch = globalThis.fetch;
  const token = createAdminSessionToken();
  assert.ok(token);

  try {
    // 1. 정상 응답: RPC 본문과 최근 로그 쿼리 필터 확인
    const seen: Array<{ url: string; method: string; body: string | null }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      seen.push({ url, method: init?.method ?? 'GET', body: (init?.body as string) ?? null });
      if (url.includes('/rpc/admin_analytics_report')) {
        return new Response(
          JSON.stringify({
            kpi: { uniquePlayers: 3, seasonsCompleted: 2 },
            leagues: [{ league: 'NBA', seasons: 2, champN: 2, champs: 1, mvpN: 2, mvps: 0, fmvpN: 2, fmvps: 1, playoffN: 0, playoffs: 0 }],
          }),
          { status: 200 }
        );
      }
      const recent: AnalyticsEventRow[] = [
        {
          id: 'r1',
          event_name: 'season_completed',
          game_version: '1.0.0',
          device_type: 'mobile',
          payload: { league: 'NBA', position: 'C', wonChampionship: true, wonFmvp: true },
          created_at: '2026-11-24T05:00:00.000Z',
        },
      ];
      return new Response(JSON.stringify(recent), { status: 200 });
    }) as typeof fetch;

    const okRes = await GET(authedRequest('range=90d&version=1.0.0&league=NBA', token));
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers.get('cache-control'), 'no-store');
    const okBody = (await okRes.json()) as {
      ok: boolean;
      report: ReturnType<typeof buildAdminAnalyticsReport>;
    };
    assert.equal(okBody.ok, true);
    assert.equal(okBody.report.setupRequired, false);
    assert.equal(okBody.report.league, 'NBA');
    assert.equal(okBody.report.kpi.uniquePlayers, 3);
    assert.equal(okBody.report.leagueAwards[0].championship.percent, 50);
    assert.equal(okBody.report.leagueAwards[0].playoffs.percent, null);
    assert.deepEqual(okBody.report.recentLogs[0].badges, ['우승', 'FMVP']);
    assert.equal(hasNaNDeep(okBody), false);

    const rpcCall = seen.find((c) => c.url.includes('/rpc/'))!;
    assert.equal(rpcCall.method, 'POST');
    const rpcBody = JSON.parse(rpcCall.body ?? '{}');
    assert.equal(rpcBody.p_version, '1.0.0');
    assert.equal(rpcBody.p_league, 'NBA');
    const sinceAgeDays = (Date.now() - Date.parse(rpcBody.p_since)) / (24 * 60 * 60 * 1000);
    assert.ok(sinceAgeDays > 89 && sinceAgeDays <= 90, `p_since ${rpcBody.p_since}`);
    const recentCall = seen.find((c) => c.url.includes('/analytics_events'))!;
    assert.match(recentCall.url, /event_name=neq.session_start/);
    assert.match(recentCall.url, /limit=30/);
    assert.match(recentCall.url, /game_version=eq.1.0.0/);

    // 2. 함수 미설치(PGRST202) -> 200 + setupRequired, 최근 로그는 유지
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/rpc/')) {
        return new Response(JSON.stringify({ code: 'PGRST202' }), { status: 404 });
      }
      return new Response('[]', { status: 200 });
    }) as typeof fetch;
    const setupRes = await GET(authedRequest('range=all', token));
    assert.equal(setupRes.status, 200);
    const setupBody = (await setupRes.json()) as {
      report: { setupRequired: boolean; tableNotReady: boolean };
    };
    assert.equal(setupBody.report.setupRequired, true);
    assert.equal(setupBody.report.tableNotReady, false);
    assert.equal(hasNaNDeep(setupBody), false);

    // 3. 테이블 미생성 -> 200 + tableNotReady
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/rpc/')) {
        return new Response(JSON.stringify({ code: '42P01' }), { status: 404 });
      }
      return new Response(JSON.stringify({ code: 'PGRST205' }), { status: 404 });
    }) as typeof fetch;
    const missingRes = await GET(authedRequest('range=30d', token));
    assert.equal(missingRes.status, 200);
    const missingBody = (await missingRes.json()) as {
      report: { tableNotReady: boolean };
    };
    assert.equal(missingBody.report.tableNotReady, true);

    // 4. 그 외 DB 오류 -> 502
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/rpc/')) {
        return new Response(JSON.stringify({ code: '57014' }), { status: 500 });
      }
      return new Response('[]', { status: 200 });
    }) as typeof fetch;
    const errRes = await GET(authedRequest('range=7d', token));
    assert.equal(errRes.status, 502);
    assert.equal(errRes.headers.get('cache-control'), 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

// ============================================================================
// SQL 집계 함수 통합 테스트 (선택 실행)
// ANALYTICS_SQL_TEST_PSQL="psql -h /tmp -p 54329 -U postgres" 처럼 빈 테스트 DB에
// 접속하는 psql 명령을 지정하면 실제 Postgres에서 함수를 실행해 검증합니다.
// 지정하지 않으면 건너뜁니다 (CI 기본값).
// ============================================================================

const PSQL_COMMAND = process.env.ANALYTICS_SQL_TEST_PSQL?.trim();

// 원본과 요약 테이블을 함께 비웁니다 (요약은 트리거로 채워지므로 원본만 비우면 이전 테스트 값이 남음).
const TRUNCATE_ANALYTICS_SQL = `TRUNCATE public.analytics_events, public.analytics_career_runs,
  public.analytics_player_versions, public.analytics_creation_sessions, public.analytics_daily_stats,
  public.analytics_daily_players, public.analytics_maintenance_log;`;

function runPsql(sql: string): string {
  const [bin, ...args] = (PSQL_COMMAND ?? '').split(/\s+/);
  return execFileSync(bin, [...args, '-v', 'ON_ERROR_STOP=1', '-At', '-q'], {
    input: sql,
    encoding: 'utf8',
  }).trim();
}

test(
  'admin_analytics_report SQL aggregates legacy and upgraded rows correctly',
  { skip: PSQL_COMMAND ? false : 'ANALYTICS_SQL_TEST_PSQL not set' },
  () => {
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    runPsql(`
      SET client_min_messages = warning;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;
      \\i ${path.join(migrationsDir, '20261124_create_analytics_events.sql')}
      \\i ${path.join(migrationsDir, '20261125_analytics_survey_event.sql')}
      \\i ${path.join(migrationsDir, '20261125_admin_analytics_report.sql')}
      \\i ${path.join(migrationsDir, '20261126_analytics_capacity.sql')}
      ${TRUNCATE_ANALYTICS_SQL}
    `);

    const ins = (
      eventName: string,
      run: string | null,
      payload: Record<string, unknown>,
      createdAt: string,
      version = '1.0.0',
      anon = 'anon-1'
    ) =>
      `INSERT INTO public.analytics_events (event_name, anonymous_id, session_id, career_run_id, game_version, device_type, payload, created_at)
       VALUES ('${eventName}', '${anon}', 'sess-1', ${run ? `'${run}'` : 'NULL'}, '${version}', 'mobile', '${JSON.stringify(payload)}'::jsonb, '${createdAt}');`;

    const recent = '2026-11-24T03:00:00Z';
    runPsql(
      [
        ins('session_start', null, { hasExistingSave: false }, recent),
        // 커리어 A (PG): 구버전 시즌(포지션·신규 필드 없음) + 신규 시즌
        ins('career_created', 'run-a', { position: 'PG', startingLeague: 'HIGH_SCHOOL', playstyle: 'SCORER' }, recent),
        ins('season_completed', 'run-a', { league: 'HIGH_SCHOOL', seasonNumber: 1, overall: 60, ppg: 20, wonChampionship: true, wonMvp: true, wonFinalsMvp: true }, recent),
        ins('season_completed', 'run-a', { league: 'KBL', position: 'PG', seasonNumber: 2, overall: 70, ppg: 10, wonChampionship: false, wonMvp: false, wonFmvp: false, wonFinalsMvp: false, madePlayoffs: true, playoffResult: 'semifinals', role: 'starter', isStarter: true, awards: ['ALL_STAR', 'DPOY'] }, recent),
        // 커리어 B (C): 신규 시즌 + 우승 후 리셋
        ins('career_created', 'run-b', { position: 'C', startingLeague: 'HIGH_SCHOOL' }, recent, '1.0.0', 'anon-2'),
        ins('season_completed', 'run-b', { league: 'KBL', position: 'C', seasonNumber: 1, overall: 72, ppg: 25, wonChampionship: true, wonMvp: true, wonFmvp: true, madePlayoffs: true, playoffResult: 'champion', role: 'franchise_ace', awards: ['ALL_STAR'] }, recent, '1.0.0', 'anon-2'),
        ins('career_reset', 'run-b', { position: 'C', abandonedLeague: 'KBL', abandonedSeason: 1, abandonedOverall: 72, abandonedRole: 'franchise_ace', hadWonChampionship: true, hadWonMvp: true }, recent, '1.0.0', 'anon-2'),
        // 커리어 C (SG): 생성은 기간 밖, 구버전 시즌은 기간 안 -> 포지션은 생성 이벤트에서 채움
        ins('career_created', 'run-c', { position: 'SG', startingLeague: 'HIGH_SCHOOL' }, '2026-10-01T00:00:00Z', '1.0.0', 'anon-3'),
        ins('season_completed', 'run-c', { league: 'NBA', seasonNumber: 9, overall: 80, wonChampionship: false, wonMvp: false, wonFinalsMvp: false }, recent, '1.0.0', 'anon-3'),
        ins('career_ended', 'run-c', { finalLeague: 'NBA', endingType: 'NBA_VETERAN', hallOfFame: false }, recent, '1.0.0', 'anon-3'),
        // 다른 버전 이벤트
        ins('session_start', null, {}, recent, '0.9.0', 'anon-4'),
      ].join('\n')
    );

    const since = "'2026-11-18T00:00:00Z'::timestamptz";
    const fetchAggregate = (args: string) =>
      JSON.parse(runPsql(`SELECT public.admin_analytics_report(${args});`));

    const all = fetchAggregate(`${since}, NULL, NULL`);
    const report = buildAdminAnalyticsReport(all, [], {
      range: '7d',
      version: 'all',
      league: 'all',
      nowMs: NOW_MS,
    });
    assert.equal(hasNaNDeep(report), false);

    assert.equal(report.kpi.totalEvents, 10); // 기간 밖 career_created 1건 제외
    assert.equal(report.kpi.uniquePlayers, 4);
    assert.equal(report.kpi.totalSessions, 2);
    assert.equal(report.kpi.careersCreated, 2);
    assert.equal(report.kpi.seasonsCompleted, 4);
    assert.equal(report.kpi.championships, 2);
    assert.equal(report.kpi.mvps, 2);
    assert.equal(report.kpi.fmvps, 2); // 구버전 wonFinalsMvp 포함

    const byLeague = Object.fromEntries(report.leagueAwards.map((r) => [r.league, r]));
    assert.deepEqual(byLeague.KBL.championship, { count: 1, n: 2, percent: 50 });
    assert.deepEqual(byLeague.KBL.fmvp, { count: 1, n: 2, percent: 50 });
    assert.deepEqual(byLeague.KBL.playoffs, { count: 2, n: 2, percent: 100 });
    assert.equal(byLeague.KBL.v2Seasons, 2);
    assert.equal(byLeague.KBL.ppgAvg, 17.5);
    assert.deepEqual(byLeague.HIGH_SCHOOL.fmvp, { count: 1, n: 1, percent: 100 });
    assert.equal(byLeague.HIGH_SCHOOL.playoffs.percent, null);
    assert.equal(byLeague.NBA.v2Seasons, 0);

    const byPos = Object.fromEntries(report.positionBalance.rows.map((r) => [r.position, r]));
    assert.equal(byPos.PG.seasons, 2); // 구버전 시즌도 career_created로 포지션 보완
    assert.equal(byPos.SG.seasons, 1); // 생성 이벤트가 기간 밖이어도 보완
    assert.equal(byPos.SG.careers, 0);
    assert.equal(byPos.C.mvp.percent, 100);
    assert.equal(report.positionBalance.unknownPositionSeasons, 0);

    assert.equal(report.awards.seasonsWithAwardData, 2);
    assert.equal(report.awards.items.find((i) => i.key === 'ALL_STAR')?.percent, 100);
    assert.deepEqual(report.resets.earlyQuit, { count: 1, n: 1, percent: 100 });
    assert.deepEqual(report.resets.afterChampionship, { count: 1, n: 1, percent: 100 });
    assert.deepEqual(report.endings.hallOfFame, { count: 0, n: 1, percent: 0 });
    assert.equal(report.funnel.leagueReachDenominator, 3);
    assert.equal(report.funnel.leagueReach.find((i) => i.key === 'KBL')?.count, 2);
    assert.equal(report.seasonMeta.roleSample, 2);
    assert.deepEqual(report.availableVersions, ['1.0.0', '0.9.0']);

    // 리그 필터: 리그 표는 전체 유지, 시즌 단위 분석만 KBL로 좁힘
    const kbl = buildAdminAnalyticsReport(fetchAggregate(`${since}, NULL, 'KBL'`), [], {
      range: '7d',
      version: 'all',
      league: 'KBL',
      nowMs: NOW_MS,
    });
    assert.equal(kbl.leagueAwards.length, 3);
    const kblPos = Object.fromEntries(kbl.positionBalance.rows.map((r) => [r.position, r]));
    assert.equal(kblPos.PG.seasons, 1);
    assert.equal(kblPos.SG.seasons, 0);
    assert.equal(kbl.resets.total, 1);

    // 버전 필터
    const v09 = fetchAggregate(`NULL, '0.9.0', NULL`);
    assert.equal(v09.kpi.totalEvents, 1);
    assert.deepEqual(v09.leagues, []);

    // 권한: anon/authenticated는 실행 불가, service_role은 실행 가능
    const privileges = runPsql(`
      SELECT has_function_privilege('anon', 'public.admin_analytics_report(timestamptz,text,text)', 'EXECUTE')::text || ',' ||
             has_function_privilege('authenticated', 'public.admin_analytics_report(timestamptz,text,text)', 'EXECUTE')::text || ',' ||
             has_function_privilege('service_role', 'public.admin_analytics_report(timestamptz,text,text)', 'EXECUTE')::text;
    `);
    assert.equal(privileges, 'false,false,true');
  }
);

// ============================================================================
// 2차 추가: 생성→드래프트 퍼널, 난이도 설문, 버전별 비교
// ============================================================================

test('version sorting puts newest first and preview after its release', () => {
  const versions = ['1.0.0', '1.10.0', '1.1.2-preview', '1.9.0', '1.1.2', 'unknown'];
  assert.deepEqual([...versions].sort(compareGameVersionsDesc), [
    '1.10.0',
    '1.9.0',
    '1.1.2',
    '1.1.2-preview',
    '1.0.0',
    'unknown',
  ]);
});

test('extras builders tolerate missing aggregate keys (old function)', () => {
  const report = buildAdminAnalyticsReport({ schemaVersion: 1, kpi: {} }, [], {
    range: '7d',
    version: 'all',
    league: 'all',
    nowMs: NOW_MS,
  });
  assert.equal(report.extrasAvailable, false);
  assert.equal(report.survey.total, 0);
  assert.equal(report.survey.responseRate, null);
  assert.equal(report.survey.questions.length, 5);
  assert.deepEqual(report.versionCompare, []);
  assert.equal(report.creationFunnel.runSteps[0].count, 0);
  assert.equal(report.creationFunnel.runSteps[1].percentOfPrev, null);
  assert.equal(hasNaNDeep(report), false);
});

test('extras builders compute rates and labels', () => {
  const funnel = buildCreationFunnel({
    startedSessions: 10,
    createdSessions: 8,
    runs: 20,
    reachedDraft: 10,
    drafted: 5,
    reachedNba: 4,
    ended: 2,
    reset: 3,
    draftOutcomes: [
      { key: 'NBA_UNDRAFTED', count: 2, ovrAvg: 65, pickAvg: null, twoWay: 1 },
      { key: 'NBA_R1', count: 3, ovrAvg: 76.25, pickAvg: 12, twoWay: 0 },
    ],
  });
  assert.equal(funnel.sessionSteps[1].percentOfPrev, 80);
  assert.equal(funnel.runSteps[2].percentOfPrev, 50);
  assert.equal(funnel.runSteps[2].percentOfStart, 25);
  assert.deepEqual(funnel.resetRuns, { count: 3, n: 20, percent: 15 });
  assert.deepEqual(
    funnel.draftOutcomes.map((o) => o.label),
    ['NBA 1라운드 지명', 'NBA 미지명']
  );

  const survey = buildSurveyReport({
    total: 4,
    submitted: 3,
    skipped: 1,
    withComment: 1,
    questions: [
      { key: 'nbaEntry', n: 3, avg: 4.333, dist: [0, 0, 1, 0, 2], expN: 1, expAvg: 3, noExpN: 2, noExpAvg: 5 },
    ],
  });
  assert.equal(survey.responseRate, 75);
  const nba = survey.questions.find((q) => q.key === 'nbaEntry')!;
  assert.equal(nba.avg, 4.33);
  assert.deepEqual(nba.dist, [0, 0, 1, 0, 2]);
  assert.equal(nba.noExpAvg, 5);
  assert.equal(survey.questions.find((q) => q.key === 'hsPacing')?.experiencedLabel, null);

  const versions = buildVersionCompare([
    { version: '1.0.0', runs: 10, reachedNba: 5, ended: 4, reset: 2, nbaChampN: 20, nbaChamps: 1 },
    { version: '1.1.0-preview', runs: 0 },
    { version: '1.1.0', runs: 4, reachedNba: 1 },
  ]);
  assert.deepEqual(
    versions.map((v) => v.label),
    ['v1.1.0', 'v1.1.0 미리보기', 'v1.0.0']
  );
  assert.equal(versions[2].nbaReach.percent, 50);
  assert.equal(versions[2].nbaChampionship.percent, 5);
  assert.equal(versions[1].nbaReach.percent, null);
  assert.equal(versions[1].isPreview, true);
});

test(
  'admin_analytics_report SQL builds funnel, survey and version comparison',
  { skip: PSQL_COMMAND ? false : 'ANALYTICS_SQL_TEST_PSQL not set' },
  () => {
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    runPsql(`
      SET client_min_messages = warning;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;
      \\i ${path.join(migrationsDir, '20261124_create_analytics_events.sql')}
      \\i ${path.join(migrationsDir, '20261125_analytics_survey_event.sql')}
      \\i ${path.join(migrationsDir, '20261125_admin_analytics_report.sql')}
      \\i ${path.join(migrationsDir, '20261126_analytics_capacity.sql')}
      ${TRUNCATE_ANALYTICS_SQL}
    `);

    const at = '2026-11-24T03:00:00Z';
    const ins = (
      eventName: string,
      session: string,
      run: string | null,
      payload: Record<string, unknown>,
      version: string,
      anon: string
    ) =>
      `INSERT INTO public.analytics_events (event_name, anonymous_id, session_id, career_run_id, game_version, device_type, payload, created_at)
       VALUES ('${eventName}', '${anon}', '${session}', ${run ? `'${run}'` : 'NULL'}, '${version}', 'desktop', '${JSON.stringify(payload)}'::jsonb, '${at}');`;

    runPsql(
      [
        // 구버전 커리어 (생성 화면 진입 기록 없음 → 퍼널 모수 제외)
        ins('career_created', 's-old', 'run-old', { position: 'PG' }, '1.0.0', 'a-old'),
        ins('season_completed', 's-old', 'run-old', { league: 'NBA', wonChampionship: true, wonMvp: false, madePlayoffs: true }, '1.0.0', 'a-old'),
        // 세션 1: 생성 화면 진입 → 커리어 2개 (하나는 NBA 지명 후 NBA 도달·은퇴, 하나는 미지명 후 KBL 지명)
        ins('creation_started', 's1', null, { hasExistingSave: false, hofCount: 0 }, '1.1.0', 'a1'),
        ins('career_created', 's1', 'run-1', { position: 'C' }, '1.1.0', 'a1'),
        ins('draft_completed', 's1', 'run-1', { draftType: 'NBA', drafted: true, round: 1, pickNumber: 10, overall: 78, hasTwoWayOffer: false }, '1.1.0', 'a1'),
        ins('league_changed', 's1', 'run-1', { fromLeague: 'NCAA', toLeague: 'NBA' }, '1.1.0', 'a1'),
        ins('season_completed', 's1', 'run-1', { league: 'NBA', wonChampionship: false, wonMvp: true, madePlayoffs: false }, '1.1.0', 'a1'),
        ins('career_ended', 's1', 'run-1', { totalSeasons: 12, hallOfFame: true }, '1.1.0', 'a1'),
        ins('career_created', 's1', 'run-2', { position: 'PG' }, '1.1.0', 'a1'),
        ins('draft_completed', 's1', 'run-2', { draftType: 'NBA', drafted: false, round: null, pickNumber: null, overall: 66, hasTwoWayOffer: true }, '1.1.0', 'a1'),
        ins('draft_completed', 's1', 'run-2', { draftType: 'KBL', drafted: true, round: 1, pickNumber: 3, overall: 66, hasTwoWayOffer: false }, '1.1.0', 'a1'),
        ins('career_reset', 's1', 'run-2', { abandonedLeague: 'KBL' }, '1.1.0', 'a1'),
        // 세션 2: 생성 화면만 보고 나감
        ins('creation_started', 's2', null, { hasExistingSave: true, hofCount: 1 }, '1.1.0', 'a2'),
        // 설문: 제출 2건, 건너뛰기 1건
        ins('survey_response', 's1', null, { surveyId: 'difficulty_2026_11', status: 'submitted', hasComment: true, militaryExemptionRating: 4, nbaEntryRating: 5, nbaPlayoffsRating: 3, kblOverseasRating: 2, hsPacingRating: 3, militaryExempt: true, reachedNba: false, nbaPlayoffSeasons: 0, kblSeasons: 3, overseasSeasons: 0 }, '1.1.2', 'a1'),
        ins('survey_response', 's3', null, { surveyId: 'difficulty_2026_11', status: 'submitted', hasComment: false, militaryExemptionRating: 2, nbaEntryRating: 3, nbaPlayoffsRating: 4, kblOverseasRating: 3, hsPacingRating: 1, militaryExempt: false, reachedNba: true, nbaPlayoffSeasons: 2, kblSeasons: 0, overseasSeasons: 0 }, '1.1.2', 'a3'),
        ins('survey_response', 's4', null, { surveyId: 'difficulty_2026_11', status: 'skipped', hasComment: false, militaryExemptionRating: null, nbaEntryRating: null, nbaPlayoffsRating: null, kblOverseasRating: null, hsPacingRating: null, militaryExempt: false, reachedNba: false, nbaPlayoffSeasons: 0, kblSeasons: 0, overseasSeasons: 0 }, '1.1.2', 'a4'),
      ].join('\n')
    );

    const raw = JSON.parse(runPsql(`SELECT public.admin_analytics_report(NULL, NULL, NULL);`));
    assert.equal(raw.schemaVersion, 3);
    const report = buildAdminAnalyticsReport(raw, [], {
      range: 'all',
      version: 'all',
      league: 'all',
      nowMs: NOW_MS,
    });
    assert.equal(report.extrasAvailable, true);
    assert.equal(hasNaNDeep(report), false);

    // 퍼널
    const sessionCounts = report.creationFunnel.sessionSteps.map((s) => s.count);
    assert.deepEqual(sessionCounts, [2, 1]);
    const runCounts = Object.fromEntries(report.creationFunnel.runSteps.map((s) => [s.key, s.count]));
    assert.deepEqual(runCounts, { runs: 2, reachedDraft: 2, drafted: 2, reachedNba: 1, ended: 1 });
    assert.deepEqual(report.creationFunnel.resetRuns, { count: 1, n: 2, percent: 50 });
    const outcomes = Object.fromEntries(report.creationFunnel.draftOutcomes.map((o) => [o.key, o]));
    assert.equal(outcomes.NBA_R1.count, 1);
    assert.equal(outcomes.NBA_UNDRAFTED.twoWay, 1);
    assert.equal(outcomes.KBL_R1.pickAvg, 3);

    // 설문
    assert.equal(report.survey.total, 3);
    assert.equal(report.survey.submitted, 2);
    assert.equal(report.survey.withComment, 1);
    const q = Object.fromEntries(report.survey.questions.map((x) => [x.key, x]));
    assert.equal(q.nbaEntry.n, 2);
    assert.equal(q.nbaEntry.avg, 4);
    assert.deepEqual(q.nbaEntry.dist, [0, 0, 1, 0, 1]);
    assert.equal(q.nbaEntry.expAvg, 3); // NBA에 간 사람
    assert.equal(q.nbaEntry.noExpAvg, 5);
    assert.equal(q.kblOverseas.expN, 1);
    assert.equal(q.hsPacing.expN, 0);

    // 버전 비교: 버전 필터를 걸어도 모든 버전이 나옴
    const filtered = buildAdminAnalyticsReport(
      JSON.parse(runPsql(`SELECT public.admin_analytics_report(NULL, '1.1.0', NULL);`)),
      [],
      { range: 'all', version: '1.1.0', league: 'all', nowMs: NOW_MS }
    );
    assert.deepEqual(
      filtered.versionCompare.map((v) => v.version),
      ['1.1.2', '1.1.0', '1.0.0']
    );
    assert.equal(filtered.survey.total, 0); // 설문은 버전 필터 적용
    const v110 = filtered.versionCompare.find((v) => v.version === '1.1.0')!;
    assert.equal(v110.runs, 2);
    assert.deepEqual(v110.nbaReach, { count: 1, n: 2, percent: 50 });
    assert.deepEqual(v110.nbaMvp, { count: 1, n: 1, percent: 100 });
    assert.deepEqual(v110.hallOfFame, { count: 1, n: 1, percent: 100 });
    assert.equal(v110.careerSeasonsAvg, 12);
    const v100 = filtered.versionCompare.find((v) => v.version === '1.0.0')!;
    assert.deepEqual(v100.nbaChampionship, { count: 1, n: 1, percent: 100 });
  }
);

test('storage report: levels, stale cleanup, and raw-only range note', () => {
  const MB = 1024 * 1024;
  const nowMs = Date.parse('2026-12-01T06:00:00Z'); // 15:00 KST
  const base = {
    schemaVersion: 3,
    storage: { dbBytes: 120 * MB, eventsBytes: 40 * MB, summaryBytes: 2 * MB, eventsLast24h: 10_000, eventsRetained: 100_000 },
    maintenance: { ranAt: '2026-11-30T19:00:05Z', result: { retainDays: 14, eventsDeleted: 9000 } },
    rawSince: '2026-11-16T15:00:10Z',
    prunedBefore: '2026-11-16T15:00:00Z',
  };

  const ok = buildStorageReport(base, '7d', nowMs);
  assert.equal(ok.available, true);
  assert.equal(ok.level, 'ok');
  assert.equal(ok.usedPercent, 24);
  assert.equal(ok.dailyGrowthBytes, 4 * MB);
  assert.equal(ok.daysUntilLimitIfNoCleanup, 95);
  assert.equal(ok.maintenance.hoursAgo, 10);
  assert.equal(ok.maintenance.stale, false);
  assert.equal(ok.maintenance.eventsDeleted, 9000);
  assert.equal(ok.rawLimited, false); // 7일은 원본 범위 안
  assert.equal(buildStorageReport(base, '30d', nowMs).rawLimited, true);
  assert.equal(buildStorageReport(base, 'all', nowMs).rawLimited, true);
  assert.equal(buildStorageReport({ ...base, prunedBefore: null }, 'all', nowMs).rawLimited, false);

  const warn = buildStorageReport({ ...base, storage: { ...base.storage, dbBytes: 320 * MB } }, '7d', nowMs);
  assert.equal(warn.level, 'warn');
  const danger = buildStorageReport({ ...base, storage: { ...base.storage, dbBytes: 450 * MB } }, '7d', nowMs);
  assert.equal(danger.level, 'danger');
  assert.equal(danger.limitBytes, DB_SIZE_LIMIT_BYTES);

  // 정리가 한 번도 안 돌았거나 오래되면 경고
  assert.equal(buildStorageReport({ ...base, maintenance: null }, '7d', nowMs).maintenance.stale, true);
  const old = buildStorageReport(
    { ...base, maintenance: { ranAt: '2026-11-29T10:00:00Z', result: {} } },
    '7d',
    nowMs
  );
  assert.equal(old.maintenance.stale, true);
  assert.equal(old.maintenance.hoursAgo, 44);

  // 예전 집계 함수(schemaVersion 2)는 설치 안내만
  const legacy = buildStorageReport({ schemaVersion: 2 }, 'all', nowMs);
  assert.equal(legacy.available, false);
  assert.equal(legacy.maintenance.stale, false);
  assert.equal(legacy.usedPercent, null);
  assert.equal(hasNaNDeep(legacy), false);

  const report = buildAdminAnalyticsReport(base, [], { range: '30d', version: 'all', league: 'all', nowMs });
  assert.equal(report.storage.rawLimited, true);
});

/** 같은 값끼리 순서만 다른 배열(동점 정렬)을 비교할 수 있게 정렬합니다. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sortDeep(v)])
    );
  }
  return value;
}

test(
  'capacity SQL: summaries keep long-term metrics after the 14-day prune',
  { skip: PSQL_COMMAND ? false : 'ANALYTICS_SQL_TEST_PSQL not set' },
  () => {
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    runPsql(`
      SET client_min_messages = warning;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;
      \\i ${path.join(migrationsDir, '20261124_create_analytics_events.sql')}
      \\i ${path.join(migrationsDir, '20261125_analytics_survey_event.sql')}
      \\i ${path.join(migrationsDir, '20261125_admin_analytics_report.sql')}
      \\i ${path.join(migrationsDir, '20261126_analytics_capacity.sql')}
      ${TRUNCATE_ANALYTICS_SQL}
    `);

    // when: 'old' = 20일 전 (정리 대상), 'new' = 1분 전
    const ins = (
      eventName: string,
      session: string,
      run: string | null,
      payload: Record<string, unknown>,
      version: string,
      anon: string,
      when: 'old' | 'new'
    ) =>
      `INSERT INTO public.analytics_events (event_name, anonymous_id, session_id, career_run_id, game_version, device_type, payload, created_at)
       VALUES ('${eventName}', '${anon}', '${session}', ${run ? `'${run}'` : 'NULL'}, '${version}', 'mobile', '${JSON.stringify(payload)}'::jsonb,
               now() - interval '${when === 'old' ? '20 days' : '1 minute'}');`;

    runPsql(
      [
        ins('session_start', 's-old', null, {}, '1.1.0', 'a-old', 'old'),
        ins('creation_started', 's-old', null, { hasExistingSave: false }, '1.1.0', 'a-old', 'old'),
        ins('career_created', 's-old', 'run-old', { position: 'PG', playstyle: 'SCORER' }, '1.1.0', 'a-old', 'old'),
        ins('draft_completed', 's-old', 'run-old', { draftType: 'NBA', drafted: true, round: 1, pickNumber: 5, overall: 80, hasTwoWayOffer: false }, '1.1.0', 'a-old', 'old'),
        ins('league_changed', 's-old', 'run-old', { fromLeague: 'NCAA', toLeague: 'NBA', changeReason: 'DRAFT' }, '1.1.0', 'a-old', 'old'),
        ins('season_completed', 's-old', 'run-old', { league: 'NBA', position: 'PG', overall: 80, ppg: 20, wonChampionship: true, wonMvp: true, wonFmvp: true, madePlayoffs: true, playoffResult: 'champion' }, '1.1.0', 'a-old', 'old'),
        ins('career_ended', 's-old', 'run-old', { endingType: 'NBA_VETERAN', hallOfFame: true, totalSeasons: 10 }, '1.1.0', 'a-old', 'old'),
        ins('survey_response', 's-old', 'run-old', { status: 'submitted', hasComment: false, hsPacingRating: 4 }, '1.1.0', 'a-old', 'old'),
        ins('session_start', 's-new', null, {}, '1.1.3', 'a-new', 'new'),
        ins('creation_started', 's-new', null, { hasExistingSave: false }, '1.1.3', 'a-new', 'new'),
        ins('career_created', 's-new', 'run-new', { position: 'C' }, '1.1.3', 'a-new', 'new'),
        ins('season_completed', 's-new', 'run-new', { league: 'HIGH_SCHOOL', overall: 55, wonChampionship: false, wonMvp: false, wonFmvp: false, madePlayoffs: false }, '1.1.3', 'a-new', 'new'),
        ins('career_reset', 's-new', 'run-new', { abandonedLeague: 'HIGH_SCHOOL', abandonedSeason: 1 }, '1.1.3', 'a-new', 'new'),
      ].join('\n')
    );

    const fetchRaw = () => JSON.parse(runPsql(`SELECT public.admin_analytics_report(NULL, NULL, NULL);`));
    const before = fetchRaw();
    assert.equal(before.schemaVersion, 3);
    assert.equal(before.prunedBefore, null);
    assert.equal(before.kpi.uniquePlayers, 2);
    assert.equal(before.creationFunnel.runs, 2);

    const result = JSON.parse(runPsql(`SELECT public.analytics_daily_maintenance(14);`));
    assert.equal(result.eventsDeleted, 7); // 설문 1건은 남김
    assert.equal(runPsql(`SELECT count(*) FROM public.analytics_events WHERE event_name = 'survey_response';`), '1');

    const after = fetchRaw();
    assert.notEqual(after.prunedBefore, null);
    // 요약 테이블에서 읽는 지표는 정리 전과 같습니다.
    for (const key of [
      'kpi', 'daily', 'devices', 'versions', 'availableVersions', 'leagues', 'positionsCreated',
      'positionSeasons', 'endings', 'created', 'creationFunnel', 'survey',
    ]) {
      assert.deepEqual(sortDeep(after[key]), sortDeep(before[key]), key);
    }
    assert.deepEqual(sortDeep(after.versionCompare), sortDeep(before.versionCompare));
    assert.equal(after.kpi.championships, 1);
    assert.equal(after.creationFunnel.nbaDrafted, 1);
    // 원본에서만 계산하는 섹션은 남은 원본(최근 14일)만 봅니다.
    assert.equal(before.leagueChanges.total, 1);
    assert.equal(after.leagueChanges.total, 0);

    const report = buildAdminAnalyticsReport(after, [], { range: 'all', version: 'all', league: 'all', nowMs: Date.now() });
    assert.equal(report.storage.available, true);
    assert.equal(report.storage.rawLimited, true);
    assert.equal(report.storage.maintenance.eventsDeleted, 7);
    assert.equal(report.storage.maintenance.stale, false);
    assert.equal(hasNaNDeep(report), false);

    // 두 번 돌려도 요약은 그대로
    runPsql(`SELECT public.analytics_daily_maintenance(14);`);
    assert.deepEqual(fetchRaw().kpi, before.kpi);

    // 보존 기간 하한과 권한
    assert.throws(() => runPsql(`SELECT public.analytics_daily_maintenance(3);`));
    assert.throws(() => runPsql(`SET ROLE anon; SELECT public.analytics_daily_maintenance(14);`));
    assert.throws(() => runPsql(`SET ROLE anon; SELECT count(*) FROM public.analytics_career_runs;`));
  }
);
