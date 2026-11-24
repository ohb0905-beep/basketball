import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  clearFailedLoginAttempts,
  createAdminSessionToken,
  getAdminAuthConfigStatus,
  isLoginRateLimited,
  isSameOriginMutationRequest,
  recordFailedLoginAttempt,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from './adminAuth';
import {
  ADMIN_NOTE_MAX,
  formatFeedbackDateKst,
  formatStoredGameContextRows,
  isValidFeedbackStatus,
  isValidUuid,
  validateAdminFeedbackPatchInput,
} from './feedback';
import { POST as loginPost } from '../app/api/admin/auth/login/route';
import { POST as logoutPost } from '../app/api/admin/auth/logout/route';
import { GET as listFeedbackGet } from '../app/api/admin/feedback/route';
import { PATCH as patchFeedback } from '../app/api/admin/feedback/[id]/route';

test('getAdminAuthConfigStatus & verifyAdminPassword handle configured and missing env safely', () => {
  const emptyEnv = {} as NodeJS.ProcessEnv;
  const emptyStatus = getAdminAuthConfigStatus(emptyEnv);
  assert.equal(emptyStatus.configured, false);
  assert.deepEqual(emptyStatus.missingKeys, [
    'ADMIN_PASSWORD',
    'ADMIN_SESSION_SECRET',
  ]);
  assert.equal(verifyAdminPassword('anything', emptyEnv), false);

  const validEnv = {
    NODE_ENV: 'test',
    ADMIN_PASSWORD: 'super-secret-pass-2026!',
    ADMIN_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  } as NodeJS.ProcessEnv;
  assert.equal(getAdminAuthConfigStatus(validEnv).configured, true);
  assert.equal(verifyAdminPassword('super-secret-pass-2026!', validEnv), true);
  assert.equal(verifyAdminPassword('super-secret-pass-2026', validEnv), false);
  assert.equal(verifyAdminPassword('wrong', validEnv), false);
  assert.equal(verifyAdminPassword('', validEnv), false);
});

test('createAdminSessionToken & verifyAdminSessionToken validate HMAC signature and expiry', () => {
  const env = {
    NODE_ENV: 'test',
    ADMIN_PASSWORD: 'admin-password-test',
    ADMIN_SESSION_SECRET: 'session-signing-secret-32-chars-min',
  } as NodeJS.ProcessEnv;

  const now = 1_760_000_000_000;
  const token = createAdminSessionToken(now, env);
  assert.ok(token, 'Expected signed session token');

  const okResult = verifyAdminSessionToken(token, now + 60_000, env);
  assert.equal(okResult.authenticated, true);

  // Tampered payload
  const parts = token.split('.');
  const tamperedPayload = `${parts[0]}.${parts[1]}.${Number(parts[2]) + 9999}.${parts[3]}.${parts[4]}`;
  assert.equal(
    verifyAdminSessionToken(tamperedPayload, now + 60_000, env).authenticated,
    false
  );

  // Tampered signature
  const badSig = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}.${'A'.repeat(43)}`;
  assert.equal(verifyAdminSessionToken(badSig, now + 60_000, env).authenticated, false);

  // Expired token
  const afterExpiry = now + (ADMIN_SESSION_TTL_SECONDS + 10) * 1000;
  assert.equal(verifyAdminSessionToken(token, afterExpiry, env).authenticated, false);

  // Different secret
  const otherEnv = {
    ...env,
    ADMIN_SESSION_SECRET: 'different-signing-secret-32-chars!',
  } as NodeJS.ProcessEnv;
  assert.equal(verifyAdminSessionToken(token, now + 60_000, otherEnv).authenticated, false);

  // Missing env fails closed
  assert.equal(verifyAdminSessionToken(token, now + 60_000, {} as NodeJS.ProcessEnv).authenticated, false);
});

test('login rate limiter throttles repeated failures and resets on clear', () => {
  const ip = 'test-ip-unit-1';
  clearFailedLoginAttempts(ip);
  const now = Date.now();
  for (let i = 0; i < 8; i++) {
    assert.equal(isLoginRateLimited(ip, now), false);
    recordFailedLoginAttempt(ip, now);
  }
  assert.equal(isLoginRateLimited(ip, now), true);
  clearFailedLoginAttempts(ip);
  assert.equal(isLoginRateLimited(ip, now), false);
});

test('UUID, feedback status, admin_note patch validation, and KST/context formatting', () => {
  assert.equal(isValidUuid('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isValidUuid('not-a-uuid'), false);
  assert.equal(isValidUuid('550e8400-e29b-41d4-a716-446655440000,or(id.eq.1)'), false);

  assert.equal(isValidFeedbackStatus('received'), true);
  assert.equal(isValidFeedbackStatus('reviewing'), true);
  assert.equal(isValidFeedbackStatus('resolved'), true);
  assert.equal(isValidFeedbackStatus('rejected'), true);
  assert.equal(isValidFeedbackStatus('closed'), false);

  const validPatch = validateAdminFeedbackPatchInput({
    status: 'reviewing',
    admin_note: '재현 확인 완료, 다음 패치 반영 예정',
  });
  assert.equal(validPatch.ok, true);

  const invalidStatus = validateAdminFeedbackPatchInput({ status: 'invalid' });
  assert.equal(invalidStatus.ok, false);

  const invalidNoteType = validateAdminFeedbackPatchInput({ admin_note: 12345 });
  assert.equal(invalidNoteType.ok, false);

  const tooLongNote = validateAdminFeedbackPatchInput({
    admin_note: '가'.repeat(ADMIN_NOTE_MAX + 1),
  });
  assert.equal(tooLongNote.ok, false);

  const emptyPatch = validateAdminFeedbackPatchInput({});
  assert.equal(emptyPatch.ok, false);

  const kst = formatFeedbackDateKst('2026-11-24T00:15:00.000Z');
  assert.equal(kst, '2026.11.24 09:15');

  const rows = formatStoredGameContextRows({
    gameVersion: '1.0.0',
    view: 'DASHBOARD',
    activeTab: 'SEASON',
    pathname: '/',
    hasCareer: true,
    leagueName: 'KBL',
    seasonYear: 2028,
    seasonPhase: 'REGULAR_SEASON',
    player: { primaryPos: 'PG', age: 21, ovr: 78, teamName: '서울 SK' },
    device: { deviceType: 'desktop', viewport: '1440x900', browser: 'Chrome', os: 'macOS' },
  });
  assert.ok(rows.some((r) => r.label === '게임 버전' && r.value === 'v1.0.0'));
  assert.ok(rows.some((r) => r.label === '선수 정보' && r.value.includes('OVR 78')));
});

test('Admin API routes enforce 401 when unauthenticated and 503 when admin env is unset', async () => {
  const prevPass = process.env.ADMIN_PASSWORD;
  const prevSecret = process.env.ADMIN_SESSION_SECRET;

  try {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;

    // 1) Login when env unset -> 503
    const loginReq = new NextRequest('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'localhost:3000' },
      body: JSON.stringify({ password: 'test' }),
    });
    const loginRes = await loginPost(loginReq);
    assert.equal(loginRes.status, 503);

    // 2) Unauthenticated GET /api/admin/feedback -> 401
    const getReq = new NextRequest('http://localhost:3000/api/admin/feedback', {
      method: 'GET',
    });
    const getRes = await listFeedbackGet(getReq);
    assert.equal(getRes.status, 401);

    // 3) Unauthenticated PATCH /api/admin/feedback/[id] -> 401
    const patchReq = new NextRequest(
      'http://localhost:3000/api/admin/feedback/550e8400-e29b-41d4-a716-446655440000',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', host: 'localhost:3000' },
        body: JSON.stringify({ status: 'resolved' }),
      }
    );
    const patchRes = await patchFeedback(patchReq, {
      params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    assert.equal(patchRes.status, 401);

    // 4) Configure env -> wrong password -> 401; right password -> 200 + HttpOnly cookie
    process.env.ADMIN_PASSWORD = 'test-admin-password-999';
    process.env.ADMIN_SESSION_SECRET = 'test-session-secret-0123456789abcdef';

    const wrongPassReq = new NextRequest('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    const wrongPassRes = await loginPost(wrongPassReq);
    assert.equal(wrongPassRes.status, 401);

    const okPassReq = new NextRequest('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ password: 'test-admin-password-999' }),
    });
    const okPassRes = await loginPost(okPassReq);
    assert.equal(okPassRes.status, 200);
    const setCookie = okPassRes.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes(`${ADMIN_SESSION_COOKIE_NAME}=`));
    assert.ok(setCookie.toLowerCase().includes('httponly'));
    assert.ok(setCookie.toLowerCase().includes('samesite=lax'));

    // 5) Authenticated PATCH with invalid UUID -> 400 (passes auth, caught by UUID validator)
    const tokenMatch = setCookie.match(
      new RegExp(`${ADMIN_SESSION_COOKIE_NAME}=([^;]+)`)
    );
    assert.ok(tokenMatch?.[1]);

    const badUuidPatchReq = new NextRequest(
      'http://localhost:3000/api/admin/feedback/not-a-uuid',
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          cookie: `${ADMIN_SESSION_COOKIE_NAME}=${tokenMatch[1]}`,
        },
        body: JSON.stringify({ status: 'resolved' }),
      }
    );
    const badUuidRes = await patchFeedback(badUuidPatchReq, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    assert.equal(badUuidRes.status, 400);

    // 6) Cross-origin mutation rejected -> 403
    const crossOriginReq = new NextRequest('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'https://evil.example.com',
      },
    });
    assert.equal(isSameOriginMutationRequest(crossOriginReq), false);
    const crossOriginRes = await logoutPost(crossOriginReq);
    assert.equal(crossOriginRes.status, 403);

    // 7) Valid logout expires cookie
    const validLogoutReq = new NextRequest('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    });
    const logoutRes = await logoutPost(validLogoutReq);
    assert.equal(logoutRes.status, 200);
    const expiredCookie = logoutRes.headers.get('set-cookie') || '';
    assert.ok(expiredCookie.includes('Max-Age=0'));
  } finally {
    if (prevPass === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevPass;
    if (prevSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSecret;
  }
});
