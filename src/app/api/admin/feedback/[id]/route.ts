import { NextRequest, NextResponse } from 'next/server';
import {
  isAdminRequestAuthenticated,
  isSameOriginMutationRequest,
} from '../../../../../lib/adminAuth';
import {
  isValidUuid,
  validateAdminFeedbackPatchInput,
} from '../../../../../lib/feedback';
import { updateFeedbackInSupabase } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MAX_PATCH_BODY_BYTES = 16 * 1024;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. 서버 관리자 세션 인증 최우선 검증
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json(
      { ok: false, error: '관리자 인증이 필요합니다.' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!isSameOriginMutationRequest(request)) {
    return NextResponse.json(
      { ok: false, error: '허용되지 않은 요청 출처입니다.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  // 2. id UUID 형식 검증
  const params = await context.params;
  const rawId = typeof params?.id === 'string' ? params.id.trim() : '';
  if (!isValidUuid(rawId)) {
    return NextResponse.json(
      { ok: false, error: '올바른 피드백 ID(UUID) 형식이 아닙니다.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 3. 본문 크기 및 형식 검증
  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: '요청 데이터를 읽지 못했습니다.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_PATCH_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: '요청 용량이 허용 범위를 초과했습니다.' },
      { status: 413, headers: NO_STORE_HEADERS }
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { ok: false, error: '잘못된 JSON 요청 형식입니다.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const validated = validateAdminFeedbackPatchInput(parsedBody);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 4. Supabase 업데이트 수행
  const updated = await updateFeedbackInSupabase(rawId, validated.data);
  if (!updated.ok) {
    return NextResponse.json(
      { ok: false, error: updated.error },
      { status: updated.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      item: updated.item,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
