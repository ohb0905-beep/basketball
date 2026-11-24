import { NextRequest, NextResponse } from 'next/server';
import { validateFeedbackInput } from '../../../lib/feedback';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 24 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const UPSTREAM_TIMEOUT_MS = 10_000;

const rateLimitStore = new Map<string, number[]>();

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown-client';
}

function checkRateLimit(clientKey: string, now: number): boolean {
  if (rateLimitStore.size > 500) {
    for (const [key, timestamps] of rateLimitStore.entries()) {
      const fresh = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, fresh);
    }
  }

  const recent = (rateLimitStore.get(clientKey) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(clientKey, recent);
    return false;
  }
  recent.push(now);
  rateLimitStore.set(clientKey, recent);
  return true;
}

function resolveSupabaseRestEndpoint(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const isHttps = parsed.protocol === 'https:';
    const isLocalDev =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isHttps && !isLocalDev) {
      return null;
    }
    return `${parsed.origin}/rest/v1/feedbacks`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  const clientKey = getClientKey(request);

  if (!checkRateLimit(clientKey, now)) {
    return NextResponse.json(
      {
        ok: false,
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 429 }
    );
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: '제출 용량이 너무 큽니다. 내용을 조금 줄여서 다시 시도해 주세요.',
        },
        { status: 413 }
      );
    }
  }

  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: '요청 데이터를 읽지 못했습니다. 다시 시도해 주세요.',
      },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: '제출 용량이 너무 큽니다. 내용을 조금 줄여서 다시 시도해 주세요.',
      },
      { status: 413 }
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: '잘못된 요청 형식입니다. 다시 시도해 주세요.',
      },
      { status: 400 }
    );
  }

  const validated = validateFeedbackInput(parsedBody);
  if (!validated.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: validated.error,
      },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          '피드백 저장 서버 설정이 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 503 }
    );
  }

  const endpoint = resolveSupabaseRestEndpoint(supabaseUrl);
  if (!endpoint) {
    return NextResponse.json(
      {
        ok: false,
        error:
          '피드백 저장 서버 주소 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.',
      },
      { status: 503 }
    );
  }

  const insertPayload = {
    type: validated.data.type,
    title: validated.data.title,
    content: validated.data.content,
    game_version: validated.data.gameVersion,
    game_context: validated.data.gameContext,
    status: 'received',
    admin_note: '',
  };

  try {
    const upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(insertPayload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!upstreamRes.ok) {
      console.error(
        `[api/feedback] Supabase insert failed with HTTP ${upstreamRes.status}`
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            '피드백 저장 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        },
        { status: 502 }
      );
    }

    let insertedId: string | null = null;
    let createdAt: string | null = null;
    try {
      const rows = (await upstreamRes.json()) as Array<{
        id?: string;
        created_at?: string;
      }>;
      if (Array.isArray(rows) && rows[0]) {
        insertedId = typeof rows[0].id === 'string' ? rows[0].id : null;
        createdAt =
          typeof rows[0].created_at === 'string' ? rows[0].created_at : null;
      }
    } catch {
      // ignore optional representation parsing errors
    }

    return NextResponse.json(
      {
        ok: true,
        id: insertedId,
        createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error(
      `[api/feedback] Supabase request failed (${isTimeout ? 'timeout' : 'network'})`
    );
    return NextResponse.json(
      {
        ok: false,
        error: isTimeout
          ? '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
          : '네트워크 오류로 피드백을 전송하지 못했습니다. 연결 상태를 확인 후 다시 시도해 주세요.',
      },
      { status: 502 }
    );
  }
}
