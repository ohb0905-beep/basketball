import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminClientIp,
  isSameOriginMutationRequest,
} from '../../../../lib/adminAuth';
import {
  createAnalyticsRateLimiter,
  tagPreviewGameVersion,
  validateAnalyticsEventPayload,
} from '../../../../lib/analyticsSchema';
import { insertAnalyticsEventToSupabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MAX_ANALYTICS_BODY_BYTES = 8 * 1024;
const rateLimiter = createAnalyticsRateLimiter();

function jsonNoStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutationRequest(request)) {
    return jsonNoStore(
      { ok: false, error: '허용되지 않은 출처의 요청입니다.' },
      403
    );
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_ANALYTICS_BODY_BYTES
    ) {
      return jsonNoStore(
        { ok: false, error: '요청 본문 크기가 허용 범위를 초과했습니다.' },
        413
      );
    }
  }

  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    return jsonNoStore(
      { ok: false, error: '요청 본문을 읽을 수 없습니다.' },
      400
    );
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_ANALYTICS_BODY_BYTES) {
    return jsonNoStore(
      { ok: false, error: '요청 본문 크기가 허용 범위를 초과했습니다.' },
      413
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    return jsonNoStore(
      { ok: false, error: '올바른 JSON 형식이 아닙니다.' },
      400
    );
  }

  const validated = validateAnalyticsEventPayload(parsedBody);
  if (!validated.ok) {
    return jsonNoStore({ ok: false, error: validated.error }, 400);
  }

  const clientIp = getAdminClientIp(request);
  const allowed = rateLimiter.checkAndConsume({
    clientIp,
    sessionId: validated.data.session_id,
    eventName: validated.data.event_name,
  });

  if (!allowed) {
    return jsonNoStore(
      { ok: false, error: '단시간 내 과도한 이벤트 요청이 제한되었습니다.' },
      429
    );
  }

  // 미리보기 배포에서 들어온 이벤트는 정식 통계와 분리 (game_version에 '-preview')
  const eventToStore = {
    ...validated.data,
    game_version: tagPreviewGameVersion(validated.data.game_version, process.env.VERCEL_ENV),
  };
  const result = await insertAnalyticsEventToSupabase(eventToStore);
  if (!result.ok) {
    return jsonNoStore(
      { ok: false, stored: false, error: result.error },
      result.status
    );
  }

  if (!result.stored) {
    return jsonNoStore(
      { ok: true, stored: false, reason: result.reason },
      202
    );
  }

  return jsonNoStore({ ok: true, stored: true }, 201);
}
