import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthenticated } from '../../../../lib/adminAuth';
import {
  AnalyticsDateRange,
  aggregateAnalyticsEvents,
  getAnalyticsRangeStartIso,
  isValidAnalyticsDateRange,
  isValidAnalyticsVersionFilter,
} from '../../../../lib/adminAnalytics';
import { queryAnalyticsEventsFromSupabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  // 1. 서버 관리자 세션 인증 최우선 검증 (미인증 시 데이터 조회 없이 즉시 401 반환)
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json(
      { ok: false, error: '관리자 인증이 필요합니다.' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  // 2. 쿼리 파라미터 검증 (range=7d|30d|all, version=all|<semver>)
  const { searchParams } = request.nextUrl;
  const rawRange = (searchParams.get('range') || '7d').trim();
  const rawVersion = (searchParams.get('version') || 'all').trim();

  if (!isValidAnalyticsDateRange(rawRange)) {
    return NextResponse.json(
      {
        ok: false,
        error: '유효하지 않은 기간 필터입니다. (7d, 30d, all)',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!isValidAnalyticsVersionFilter(rawVersion)) {
    return NextResponse.json(
      {
        ok: false,
        error: '유효하지 않은 게임 버전 필터입니다.',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const range: AnalyticsDateRange = rawRange;
  const nowMs = Date.now();
  const sinceIso = getAnalyticsRangeStartIso(range, nowMs);

  // 3. Supabase 서버 조회 (상한 보호 포함)
  const queryResult = await queryAnalyticsEventsFromSupabase({
    sinceIso,
    version: rawVersion,
  });

  if (!queryResult.ok) {
    return NextResponse.json(
      { ok: false, error: queryResult.error },
      { status: queryResult.status, headers: NO_STORE_HEADERS }
    );
  }

  // 4. 서버 집계 리포트 생성
  const report = aggregateAnalyticsEvents(queryResult.data.rows, {
    range,
    version: rawVersion,
    availableVersions: queryResult.data.availableVersions,
    nowMs,
    totalMatchingRows: queryResult.data.totalMatchingRows,
    scanLimit: queryResult.data.scanLimit,
    tableNotReady: queryResult.data.tableNotReady,
  });

  return NextResponse.json(
    {
      ok: true,
      report,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
