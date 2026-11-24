import {
  FeedbackRecord,
  FeedbackStatus,
  FeedbackStatusCounts,
  FeedbackType,
  ValidatedAdminFeedbackPatch,
} from './feedback';

const UPSTREAM_TIMEOUT_MS = 10_000;

interface SupabaseAdminConfig {
  restBaseUrl: string;
  serviceRoleKey: string;
}

export function resolveSupabaseAdminConfig(
  env: NodeJS.ProcessEnv = process.env
): { ok: true; config: SupabaseAdminConfig } | { ok: false; error: string } {
  const rawUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !serviceRoleKey) {
    return {
      ok: false,
      error:
        'Supabase 서버 환경변수(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.',
    };
  }

  try {
    const parsed = new URL(rawUrl);
    const isHttps = parsed.protocol === 'https:';
    const isLocalDev =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isHttps && !isLocalDev) {
      return {
        ok: false,
        error: 'SUPABASE_URL 형식이 올바르지 않습니다.',
      };
    }
    return {
      ok: true,
      config: {
        restBaseUrl: `${parsed.origin}/rest/v1/feedbacks`,
        serviceRoleKey,
      },
    };
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_URL 형식이 올바르지 않습니다.',
    };
  }
}

function buildSupabaseHeaders(
  serviceRoleKey: string,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function parseContentRangeTotal(header: string | null, fallbackLen: number): number {
  if (!header) return fallbackLen;
  const slashIdx = header.lastIndexOf('/');
  if (slashIdx === -1) return fallbackLen;
  const totalPart = header.slice(slashIdx + 1).trim();
  const parsed = Number(totalPart);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackLen;
}

export interface ListFeedbacksResult {
  items: FeedbackRecord[];
  totalFiltered: number;
  counts: FeedbackStatusCounts;
}

/**
 * 관리자 전용 피드백 목록 조회 및 상태별 요약 카운트 집계
 */
export async function listFeedbacksFromSupabase(params: {
  type?: FeedbackType | 'all';
  status?: FeedbackStatus | 'all';
  limit: number;
  offset: number;
}): Promise<
  | { ok: true; data: ListFeedbacksResult }
  | { ok: false; status: number; error: string }
> {
  const resolved = resolveSupabaseAdminConfig();
  if (!resolved.ok) {
    return { ok: false, status: 503, error: resolved.error };
  }
  const { restBaseUrl, serviceRoleKey } = resolved.config;

  const listUrl = new URL(restBaseUrl);
  listUrl.searchParams.set(
    'select',
    'id,type,title,content,game_version,game_context,status,admin_note,created_at'
  );
  listUrl.searchParams.set('order', 'created_at.desc');
  listUrl.searchParams.set('limit', String(params.limit));
  listUrl.searchParams.set('offset', String(params.offset));

  if (params.type && params.type !== 'all') {
    listUrl.searchParams.set('type', `eq.${params.type}`);
  }
  if (params.status && params.status !== 'all') {
    listUrl.searchParams.set('status', `eq.${params.status}`);
  }

  // 상태별 전체 요약 카운트 조회 (경량 status 컬럼만 조회)
  const countsUrl = new URL(restBaseUrl);
  countsUrl.searchParams.set('select', 'status');
  countsUrl.searchParams.set('limit', '5000');

  try {
    const [listRes, countsRes] = await Promise.all([
      fetch(listUrl.toString(), {
        method: 'GET',
        headers: buildSupabaseHeaders(serviceRoleKey, {
          Prefer: 'count=exact',
        }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      }),
      fetch(countsUrl.toString(), {
        method: 'GET',
        headers: buildSupabaseHeaders(serviceRoleKey),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      }),
    ]);

    if (!listRes.ok) {
      console.error(
        `[admin/feedback] Supabase list query failed with HTTP ${listRes.status}`
      );
      return {
        ok: false,
        status: 502,
        error: '피드백 목록을 불러오는 중 서버 오류가 발생했습니다.',
      };
    }

    const items = (await listRes.json()) as FeedbackRecord[];
    const safeItems = Array.isArray(items) ? items : [];
    const totalFiltered = parseContentRangeTotal(
      listRes.headers.get('content-range'),
      safeItems.length
    );

    const counts: FeedbackStatusCounts = {
      total: 0,
      received: 0,
      reviewing: 0,
      resolved: 0,
      rejected: 0,
    };

    if (countsRes.ok) {
      const statusRows = (await countsRes.json()) as Array<{ status?: string }>;
      if (Array.isArray(statusRows)) {
        counts.total = statusRows.length;
        for (const row of statusRows) {
          if (row.status === 'received') counts.received += 1;
          else if (row.status === 'reviewing') counts.reviewing += 1;
          else if (row.status === 'resolved') counts.resolved += 1;
          else if (row.status === 'rejected') counts.rejected += 1;
        }
      }
    }

    return {
      ok: true,
      data: {
        items: safeItems,
        totalFiltered,
        counts,
      },
    };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error(
      `[admin/feedback] Supabase list request failed (${isTimeout ? 'timeout' : 'network'})`
    );
    return {
      ok: false,
      status: 502,
      error: isTimeout
        ? '데이터베이스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
        : '데이터베이스 연결 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 관리자 전용 피드백 상태/메모 수정
 */
export async function updateFeedbackInSupabase(
  id: string,
  patch: ValidatedAdminFeedbackPatch
): Promise<
  | { ok: true; item: FeedbackRecord }
  | { ok: false; status: number; error: string }
> {
  const resolved = resolveSupabaseAdminConfig();
  if (!resolved.ok) {
    return { ok: false, status: 503, error: resolved.error };
  }
  const { restBaseUrl, serviceRoleKey } = resolved.config;

  const updateUrl = new URL(restBaseUrl);
  updateUrl.searchParams.set('id', `eq.${id}`);
  updateUrl.searchParams.set(
    'select',
    'id,type,title,content,game_version,game_context,status,admin_note,created_at'
  );

  const body: Record<string, unknown> = {};
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.admin_note !== undefined) body.admin_note = patch.admin_note;

  try {
    const res = await fetch(updateUrl.toString(), {
      method: 'PATCH',
      headers: buildSupabaseHeaders(serviceRoleKey, {
        Prefer: 'return=representation',
      }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(
        `[admin/feedback] Supabase update failed with HTTP ${res.status}`
      );
      return {
        ok: false,
        status: 502,
        error: '피드백 수정 중 서버 오류가 발생했습니다.',
      };
    }

    const rows = (await res.json()) as FeedbackRecord[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        ok: false,
        status: 404,
        error: '해당 피드백 항목을 찾을 수 없습니다.',
      };
    }

    return { ok: true, item: rows[0] };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error(
      `[admin/feedback] Supabase update request failed (${isTimeout ? 'timeout' : 'network'})`
    );
    return {
      ok: false,
      status: 502,
      error: isTimeout
        ? '데이터베이스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
        : '데이터베이스 연결 중 오류가 발생했습니다.',
    };
  }
}
