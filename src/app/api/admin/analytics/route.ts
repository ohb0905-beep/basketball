import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthenticated } from '../../../../lib/adminAuth';
import {
  AnalyticsDateRange,
  buildAdminAnalyticsReport,
  getAnalyticsRangeStartIso,
  isValidAnalyticsDateRange,
  isValidAnalyticsLeagueFilter,
  isValidAnalyticsVersionFilter,
} from '../../../../lib/adminAnalytics';
import { fetchAdminAnalyticsFromSupabase } from '../../../../lib/supabaseAdmin';

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

  // 2. 쿼리 파라미터 검증 (range=7d|30d|90d|all, version=all|<semver>, league=all|<LeagueId>)
  const { searchParams } = request.nextUrl;
  const rawRange = (searchParams.get('range') || '7d').trim();
  const rawVersion = (searchParams.get('version') || 'all').trim();
  const rawLeague = (searchParams.get('league') || 'all').trim();

  if (!isValidAnalyticsDateRange(rawRange)) {
    return NextResponse.json(
      { ok: false, error: '유효하지 않은 기간 필터입니다. (7d, 30d, 90d, all)' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!isValidAnalyticsVersionFilter(rawVersion)) {
    return NextResponse.json(
      { ok: false, error: '유효하지 않은 게임 버전 필터입니다.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!isValidAnalyticsLeagueFilter(rawLeague)) {
    return NextResponse.json(
      { ok: false, error: '유효하지 않은 리그 필터입니다.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const range: AnalyticsDateRange = rawRange;
  const nowMs = Date.now();
  const sinceIso = getAnalyticsRangeStartIso(range, nowMs);

  // 3. Supabase 서버 집계 함수 호출 + 최근 마일스톤 로그 조회
  const result = await fetchAdminAnalyticsFromSupabase({
    sinceIso,
    version: rawVersion,
    league: rawLeague,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  // 4. 대시보드 리포트 생성 (비율·모수·인사이트 계산)
  const report = buildAdminAnalyticsReport(
    result.data.aggregate,
    result.data.recentRows,
    {
      range,
      version: rawVersion,
      league: rawLeague,
      nowMs,
      setupRequired: result.data.setupRequired,
      tableNotReady: result.data.tableNotReady,
      sources: result.data.sources,
    }
  );

  return NextResponse.json(
    { ok: true, report },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
