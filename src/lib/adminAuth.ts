import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE_NAME = 'road_to_mvp_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12시간

const TOKEN_VERSION = 'v1';
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10분
const LOGIN_MAX_FAILURES = 8;

const failedLoginStore = new Map<string, number[]>();

export interface AdminAuthConfigStatus {
  configured: boolean;
  missingKeys: ('ADMIN_PASSWORD' | 'ADMIN_SESSION_SECRET')[];
}

/**
 * 관리자 인증에 필요한 서버 전용 환경변수 설정 여부를 확인합니다.
 * 환경변수 값 자체는 절대 노출하지 않습니다.
 */
export function getAdminAuthConfigStatus(
  env: NodeJS.ProcessEnv = process.env
): AdminAuthConfigStatus {
  const missingKeys: ('ADMIN_PASSWORD' | 'ADMIN_SESSION_SECRET')[] = [];
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.trim().length === 0) {
    missingKeys.push('ADMIN_PASSWORD');
  }
  if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.trim().length === 0) {
    missingKeys.push('ADMIN_SESSION_SECRET');
  }
  return {
    configured: missingKeys.length === 0,
    missingKeys,
  };
}

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

/**
 * 입력 비밀번호와 서버 ADMIN_PASSWORD를 고정 길이 SHA-256 다이제스트로 변환한 뒤
 * crypto.timingSafeEqual로 비교하여 길이·문자별 타이밍 누출을 방지합니다.
 */
export function verifyAdminPassword(
  inputPassword: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const configuredPassword = env.ADMIN_PASSWORD;
  if (!configuredPassword || configuredPassword.trim().length === 0) {
    return false;
  }
  if (typeof inputPassword !== 'string' || inputPassword.length === 0) {
    return false;
  }

  const expectedDigest = sha256Buffer(configuredPassword);
  const actualDigest = sha256Buffer(inputPassword);
  return crypto.timingSafeEqual(expectedDigest, actualDigest);
}

function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64url');
}

/**
 * 만료 시각과 난수 nonce가 포함된 HMAC-SHA256 서명 세션 토큰을 생성합니다.
 */
export function createAdminSessionToken(
  nowMs: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const secret = env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) return null;

  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ADMIN_SESSION_TTL_SECONDS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${TOKEN_VERSION}.${iat}.${exp}.${nonce}`;
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export interface VerifiedAdminSession {
  authenticated: boolean;
  iat?: number;
  exp?: number;
}

/**
 * 세션 쿠키 토큰의 형식, HMAC 서명(timingSafeEqual), 만료 시각을 검증합니다.
 * 서버 환경변수(ADMIN_PASSWORD, ADMIN_SESSION_SECRET)가 미설정된 경우 항상 거부합니다.
 */
export function verifyAdminSessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): VerifiedAdminSession {
  const config = getAdminAuthConfigStatus(env);
  if (!config.configured) {
    return { authenticated: false };
  }
  if (typeof token !== 'string' || token.length === 0 || token.length > 512) {
    return { authenticated: false };
  }

  const parts = token.split('.');
  if (parts.length !== 5) {
    return { authenticated: false };
  }

  const [version, iatRaw, expRaw, nonce, providedSig] = parts;
  if (
    version !== TOKEN_VERSION ||
    !/^\d+$/.test(iatRaw) ||
    !/^\d+$/.test(expRaw) ||
    !/^[0-9a-f]{32}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(providedSig)
  ) {
    return { authenticated: false };
  }

  const iat = Number(iatRaw);
  const exp = Number(expRaw);
  const nowSec = Math.floor(nowMs / 1000);

  if (
    !Number.isSafeInteger(iat) ||
    !Number.isSafeInteger(exp) ||
    exp <= nowSec ||
    iat > nowSec + 60 ||
    exp - iat > ADMIN_SESSION_TTL_SECONDS + 60
  ) {
    return { authenticated: false };
  }

  const secret = env.ADMIN_SESSION_SECRET!.trim();
  const payload = `${version}.${iatRaw}.${expRaw}.${nonce}`;
  const expectedSig = signPayload(payload, secret);

  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const providedBuf = Buffer.from(providedSig, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return { authenticated: false };
  }

  const sigMatch = crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!sigMatch) {
    return { authenticated: false };
  }

  return { authenticated: true, iat, exp };
}

/**
 * Route Handler(NextRequest)에서 관리자 세션 쿠키를 검증합니다.
 */
export function isAdminRequestAuthenticated(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token, Date.now(), env).authenticated;
}

/**
 * Next.js Server Component / Route Handler에서 cookies()로 관리자 세션을 검증합니다.
 */
export async function isAdminSessionAuthenticated(
  env: NodeJS.ProcessEnv = process.env
): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token, Date.now(), env).authenticated;
}

/**
 * 세션 쿠키 발급/만료 공통 옵션
 * - HttpOnly, SameSite=Lax, 프로덕션 환경 Secure 적용
 */
export function buildAdminSessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: ADMIN_SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * 상태 변경 요청(POST/PATCH)의 Origin 헤더가 현재 호스트와 일치하는지 검증하여
 * 교차 출처 요청 위조(CSRF)를 추가로 차단합니다.
 */
export function isSameOriginMutationRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    // 동일 출처 비-브라우저 도구(curl 등)나 일부 클라이언트는 Origin 헤더를 생략할 수 있음
    return true;
  }

  let originHost = '';
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();
  const host = request.headers.get('host')?.trim().toLowerCase();

  if (forwardedHost && originHost === forwardedHost) return true;
  if (host && originHost === host) return true;
  return false;
}

export function getAdminClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown-admin-client';
}

export function isLoginRateLimited(clientKey: string, nowMs: number = Date.now()): boolean {
  const recent = (failedLoginStore.get(clientKey) || []).filter(
    (ts) => nowMs - ts < LOGIN_WINDOW_MS
  );
  if (recent.length === 0) {
    failedLoginStore.delete(clientKey);
    return false;
  }
  failedLoginStore.set(clientKey, recent);
  return recent.length >= LOGIN_MAX_FAILURES;
}

export function recordFailedLoginAttempt(
  clientKey: string,
  nowMs: number = Date.now()
): void {
  if (failedLoginStore.size > 500) {
    for (const [k, list] of failedLoginStore.entries()) {
      const fresh = list.filter((ts) => nowMs - ts < LOGIN_WINDOW_MS);
      if (fresh.length === 0) failedLoginStore.delete(k);
      else failedLoginStore.set(k, fresh);
    }
  }
  const recent = (failedLoginStore.get(clientKey) || []).filter(
    (ts) => nowMs - ts < LOGIN_WINDOW_MS
  );
  recent.push(nowMs);
  failedLoginStore.set(clientKey, recent);
}

export function clearFailedLoginAttempts(clientKey: string): void {
  failedLoginStore.delete(clientKey);
}
