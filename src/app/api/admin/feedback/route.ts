import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthenticated } from '../../../../lib/adminAuth';
import {
  FeedbackStatus,
  FeedbackType,
  isValidFeedbackStatus,
  isValidFeedbackType,
} from '../../../../lib/feedback';
import { listFeedbacksFromSupabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  // 1. 서버 관리자 세션 인증 최우선 검증
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json(
      { ok: false, error: '관리자 인증이 필요합니다.' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  // 2. 쿼리 파라미터 검증 (type, status, limit, offset)
  const { searchParams } = request.nextUrl;
  const rawType = searchParams.get('type') || 'all';
  const rawStatus = searchParams.get('status') || 'all';
  const rawLimit = searchParams.get('limit');
  const rawOffset = searchParams.get('offset');

  let typeFilter: FeedbackType | 'all' = 'all';
  if (rawType !== 'all') {
    if (!isValidFeedbackType(rawType)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            '유효하지 않은 제보 유형 필터입니다. (all, bug, balance, content, ui, other)',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    typeFilter = rawType;
  }

  let statusFilter: FeedbackStatus | 'all' = 'all';
  if (rawStatus !== 'all') {
    if (!isValidFeedbackStatus(rawStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            '유효하지 않은 상태 필터입니다. (all, received, reviewing, resolved, rejected)',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    statusFilter = rawStatus;
  }

  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null && rawLimit.trim() !== '') {
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error: `조회 개수(limit)는 1~${MAX_LIMIT} 사이의 정수여야 합니다.`,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    limit = parsedLimit;
  }

  let offset = 0;
  if (rawOffset !== null && rawOffset.trim() !== '') {
    const parsedOffset = Number(rawOffset);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0 || parsedOffset > 50_000) {
      return NextResponse.json(
        {
          ok: false,
          error: '페이지 오프셋(offset) 값이 올바르지 않습니다.',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    offset = parsedOffset;
  }

  // 3. Supabase 서버 조회
  const result = await listFeedbacksFromSupabase({
    type: typeFilter,
    status: statusFilter,
    limit,
    offset,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      items: result.data.items,
      totalFiltered: result.data.totalFiltered,
      counts: result.data.counts,
      limit,
      offset,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
