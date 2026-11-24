import { NextRequest, NextResponse } from 'next/server';
import {
  buildAdminSessionCookieOptions,
  isSameOriginMutationRequest,
} from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  if (!isSameOriginMutationRequest(request)) {
    return NextResponse.json(
      { ok: false, error: '허용되지 않은 요청 출처입니다.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: NO_STORE_HEADERS }
  );
  response.cookies.set({
    ...buildAdminSessionCookieOptions(0),
    value: '',
    expires: new Date(0),
  });
  return response;
}
