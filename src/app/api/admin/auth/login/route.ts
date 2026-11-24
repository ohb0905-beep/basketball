import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_TTL_SECONDS,
  buildAdminSessionCookieOptions,
  clearFailedLoginAttempts,
  createAdminSessionToken,
  getAdminAuthConfigStatus,
  getAdminClientIp,
  isLoginRateLimited,
  isSameOriginMutationRequest,
  recordFailedLoginAttempt,
  verifyAdminPassword,
} from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

const MAX_LOGIN_BODY_BYTES = 4 * 1024;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  if (!isSameOriginMutationRequest(request)) {
    return NextResponse.json(
      { ok: false, error: '허용되지 않은 요청 출처입니다.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const configStatus = getAdminAuthConfigStatus();
  if (!configStatus.configured) {
    return NextResponse.json(
      {
        ok: false,
        code: 'ADMIN_ENV_NOT_CONFIGURED',
        error:
          '관리자 인증 환경변수(ADMIN_PASSWORD, ADMIN_SESSION_SECRET)가 서버에 설정되지 않았습니다. 환경변수를 설정한 뒤 다시 시도해 주세요.',
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const clientIp = getAdminClientIp(request);
  if (isLoginRateLimited(clientIp)) {
    return NextResponse.json(
      {
        ok: false,
        error: '로그인 실패가 반복되어 잠시 제한되었습니다. 10분 후 다시 시도해 주세요.',
      },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: '요청 본문을 읽지 못했습니다.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_LOGIN_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: '요청 크기가 허용 범위를 초과했습니다.' },
      { status: 413, headers: NO_STORE_HEADERS }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { ok: false, error: '잘못된 JSON 요청 형식입니다.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const password =
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    typeof (parsed as Record<string, unknown>).password === 'string'
      ? ((parsed as Record<string, unknown>).password as string)
      : '';

  if (password.length === 0) {
    return NextResponse.json(
      { ok: false, error: '관리자 비밀번호를 입력해 주세요.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const valid = verifyAdminPassword(password);
  if (!valid) {
    recordFailedLoginAttempt(clientIp);
    return NextResponse.json(
      { ok: false, error: '관리자 비밀번호가 올바르지 않습니다.' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        code: 'ADMIN_ENV_NOT_CONFIGURED',
        error: '세션 서명 키 설정이 올바르지 않습니다.',
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  clearFailedLoginAttempts(clientIp);

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: NO_STORE_HEADERS }
  );
  response.cookies.set({
    ...buildAdminSessionCookieOptions(ADMIN_SESSION_TTL_SECONDS),
    value: token,
  });
  return response;
}
