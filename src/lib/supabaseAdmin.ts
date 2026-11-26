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
  /** 피드백에 기록된 게임 버전 목록 (최신순) */
  versions: string[];
}

export type FeedbackSurveyFilter = 'all' | 'only' | 'exclude';

/** 설문 의견 글은 제목이 이 말로 시작합니다 (src/lib/survey.ts SURVEY_FEEDBACK_TITLE). */
const SURVEY_TITLE_PREFIX = '[설문]';

/**
 * PostgREST or=() 안에 넣을 검색어를 큰따옴표로 감쌉니다.
 * 쉼표·괄호·점 같은 구분 문자가 필터 문법으로 해석되지 않게 하고, \와 "는 이스케이프합니다.
 */
export function buildFeedbackSearchFilter(query: string): string | null {
  const q = query.trim().slice(0, 50);
  if (!q) return null;
  const escaped = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const value = `"*${escaped}*"`;
  return `(title.ilike.${value},content.ilike.${value},admin_note.ilike.${value})`;
}

/**
 * 관리자 전용 피드백 목록 조회 및 상태별 요약 카운트 집계
 * - 상태별 카운트는 행을 내려받지 않고 DB에서 바로 셉니다 (count=exact).
 */
export async function listFeedbacksFromSupabase(params: {
  type?: FeedbackType | 'all';
  status?: FeedbackStatus | 'all';
  q?: string;
  survey?: FeedbackSurveyFilter;
  version?: string;
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
  if (params.version && params.version !== 'all') {
    listUrl.searchParams.set('game_version', `eq.${params.version}`);
  }
  if (params.survey === 'only') {
    listUrl.searchParams.set('title', `like.${SURVEY_TITLE_PREFIX}*`);
  } else if (params.survey === 'exclude') {
    listUrl.searchParams.set('title', `not.like.${SURVEY_TITLE_PREFIX}*`);
  }
  const searchFilter = buildFeedbackSearchFilter(params.q ?? '');
  if (searchFilter) {
    listUrl.searchParams.set('or', searchFilter);
  }

  // 상태별 전체 카운트: 행 없이 개수만 받습니다.
  const countUrl = (status: FeedbackStatus | null) => {
    const url = new URL(restBaseUrl);
    url.searchParams.set('select', 'id');
    url.searchParams.set('limit', '1');
    if (status) url.searchParams.set('status', `eq.${status}`);
    return url.toString();
  };
  const countStatuses: Array<FeedbackStatus | null> = [null, 'received', 'reviewing', 'resolved', 'rejected'];

  const versionsUrl = new URL(restBaseUrl);
  versionsUrl.searchParams.set('select', 'game_version');
  versionsUrl.searchParams.set('game_version', 'not.is.null');
  versionsUrl.searchParams.set('order', 'created_at.desc');
  versionsUrl.searchParams.set('limit', '2000');

  const get = (url: string, prefer?: string) =>
    fetch(url, {
      method: 'GET',
      headers: buildSupabaseHeaders(serviceRoleKey, prefer ? { Prefer: prefer } : undefined),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });

  try {
    const [listRes, versionsRes, ...countResponses] = await Promise.all([
      get(listUrl.toString(), 'count=exact'),
      get(versionsUrl.toString()),
      ...countStatuses.map((st) => get(countUrl(st), 'count=exact')),
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

    const countOf = (res: Response | undefined) =>
      res && res.ok ? parseContentRangeTotal(res.headers.get('content-range'), 0) : 0;
    const counts: FeedbackStatusCounts = {
      total: countOf(countResponses[0]),
      received: countOf(countResponses[1]),
      reviewing: countOf(countResponses[2]),
      resolved: countOf(countResponses[3]),
      rejected: countOf(countResponses[4]),
    };

    let versions: string[] = [];
    if (versionsRes.ok) {
      const rows = (await versionsRes.json()) as Array<{ game_version?: string | null }>;
      if (Array.isArray(rows)) {
        versions = Array.from(
          new Set(rows.map((r) => r.game_version).filter((v): v is string => typeof v === 'string' && v.length > 0))
        );
      }
    }

    return {
      ok: true,
      data: {
        items: safeItems,
        totalFiltered,
        counts,
        versions,
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

const ANALYTICS_TABLE_MISSING_COOLDOWN_MS = 60_000;
let analyticsTableMissingUntilMs = 0;

export function __resetAnalyticsSupabaseCooldownForTest(): void {
  analyticsTableMissingUntilMs = 0;
}

/**
 * 익명 플레이 통계 이벤트를 Supabase analytics_events 테이블에 적재합니다.
 * - 서버 전용 service_role 키만 사용합니다.
 * - 환경변수 미설정 또는 테이블 마이그레이션 미적용(HTTP 404) 시에도
 *   예외나 오류 로그 없이 무해하게(stored: false) 반환하며,
 *   테이블 생성 후 최대 60초 이내에 자동으로 정상 적재를 재개합니다.
 */
export async function insertAnalyticsEventToSupabase(
  event: {
    event_name: string;
    anonymous_id: string;
    session_id: string;
    career_run_id: string | null;
    game_version: string | null;
    device_type: string | null;
    payload: Record<string, unknown>;
  },
  env: NodeJS.ProcessEnv = process.env
): Promise<
  | { ok: true; stored: true }
  | {
      ok: true;
      stored: false;
      reason: 'not_configured' | 'table_not_ready';
    }
  | { ok: false; status: number; error: string }
> {
  const resolved = resolveSupabaseAdminConfig(env);
  if (!resolved.ok) {
    return { ok: true, stored: false, reason: 'not_configured' };
  }

  const nowMs = Date.now();
  if (nowMs < analyticsTableMissingUntilMs) {
    return { ok: true, stored: false, reason: 'table_not_ready' };
  }

  let endpoint = '';
  try {
    const parsedOrigin = new URL(resolved.config.restBaseUrl).origin;
    endpoint = `${parsedOrigin}/rest/v1/analytics_events`;
  } catch {
    return { ok: true, stored: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: buildSupabaseHeaders(resolved.config.serviceRoleKey, {
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });

    if (res.status === 404) {
      analyticsTableMissingUntilMs = Date.now() + ANALYTICS_TABLE_MISSING_COOLDOWN_MS;
      return { ok: true, stored: false, reason: 'table_not_ready' };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        error: '통계 저장 중 일시적인 서버 오류가 발생했습니다.',
      };
    }

    analyticsTableMissingUntilMs = 0;
    return { ok: true, stored: true };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      ok: false,
      status: 502,
      error: isTimeout
        ? '통계 저장 응답이 지연되었습니다.'
        : '통계 저장 서버 연결에 실패했습니다.',
    };
  }
}

export const ADMIN_ANALYTICS_RPC_NAME = 'admin_analytics_report';
export const ADMIN_ANALYTICS_SOURCES_RPC_NAME = 'admin_analytics_sources';
export const ADMIN_ANALYTICS_RECENT_LIMIT = 30;
const ADMIN_ANALYTICS_RPC_TIMEOUT_MS = 20_000;

export interface AdminAnalyticsRecentRow {
  id: string;
  event_name: string;
  game_version: string | null;
  device_type: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface FetchAdminAnalyticsResult {
  /** admin_analytics_report 함수가 반환한 집계 JSON (미설치/미생성 시 null) */
  aggregate: unknown;
  recentRows: AdminAnalyticsRecentRow[];
  /** 1.3.2 유입 경로 집계 (admin_analytics_sources 미설치·실패 시 null) */
  sources: unknown;
  /** Supabase에 집계 함수가 아직 설치되지 않음 (SQL 실행 필요) */
  setupRequired: boolean;
  /** analytics_events 테이블 자체가 아직 없음 */
  tableNotReady: boolean;
}

async function readPostgrestErrorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { code?: unknown };
    return typeof body?.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

/**
 * 관리자 전용 플레이 통계 조회
 * - 집계는 Postgres 함수(admin_analytics_report)에서 끝내고 작은 JSON만 받아옵니다.
 *   (원본 행을 내려받지 않으므로 행 수가 늘어도 잘리지 않습니다.)
 * - 최근 마일스톤 로그 30건만 별도로 조회합니다 (session_start 제외).
 * - 함수 미설치(PGRST202) 또는 테이블 미생성 시 크래시 없이 안내 플래그를 반환합니다.
 */
export async function fetchAdminAnalyticsFromSupabase(
  params: {
    sinceIso: string | null;
    version: string;
    league: string;
  },
  env: NodeJS.ProcessEnv = process.env
): Promise<
  | { ok: true; data: FetchAdminAnalyticsResult }
  | { ok: false; status: number; error: string }
> {
  const resolved = resolveSupabaseAdminConfig(env);
  if (!resolved.ok) {
    return { ok: false, status: 503, error: resolved.error };
  }

  let origin = '';
  try {
    origin = new URL(resolved.config.restBaseUrl).origin;
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'SUPABASE_URL 형식이 올바르지 않습니다.',
    };
  }

  const { serviceRoleKey } = resolved.config;
  const versionFilter = params.version && params.version !== 'all' ? params.version : null;
  const leagueFilter = params.league && params.league !== 'all' ? params.league : null;

  const rpcUrl = `${origin}/rest/v1/rpc/${ADMIN_ANALYTICS_RPC_NAME}`;
  const recentUrl = new URL(`${origin}/rest/v1/analytics_events`);
  recentUrl.searchParams.set(
    'select',
    'id,event_name,game_version,device_type,payload,created_at'
  );
  recentUrl.searchParams.set('event_name', 'neq.session_start');
  recentUrl.searchParams.set('order', 'created_at.desc');
  recentUrl.searchParams.set('limit', String(ADMIN_ANALYTICS_RECENT_LIMIT));
  if (params.sinceIso) {
    recentUrl.searchParams.set('created_at', `gte.${params.sinceIso}`);
  }
  if (versionFilter === 'release') {
    // 정식 버전 전체: 미리보기 배포(-preview) 제외
    recentUrl.searchParams.set('game_version', 'not.like.*-preview');
  } else if (versionFilter) {
    recentUrl.searchParams.set('game_version', `eq.${versionFilter}`);
  }
  if (leagueFilter) {
    // 이벤트마다 리그가 담긴 키가 달라서 그중 하나라도 맞으면 보여 줍니다.
    const keys = ['league', 'toLeague', 'fromLeague', 'startingLeague', 'finalLeague', 'abandonedLeague'];
    recentUrl.searchParams.set(
      'or',
      `(${keys.map((k) => `payload->>${k}.eq.${leagueFilter}`).join(',')})`
    );
  }

  const callRpc = (pVersion: string | null) =>
    fetch(rpcUrl, {
      method: 'POST',
      headers: buildSupabaseHeaders(serviceRoleKey),
      body: JSON.stringify({
        p_since: params.sinceIso,
        p_version: pVersion,
        p_league: leagueFilter,
      }),
      signal: AbortSignal.timeout(ADMIN_ANALYTICS_RPC_TIMEOUT_MS),
      cache: 'no-store',
    });

  try {
    let [rpcRes, recentRes, sourcesRes] = await Promise.all([
      callRpc(versionFilter),
      fetch(recentUrl.toString(), {
        method: 'GET',
        headers: buildSupabaseHeaders(serviceRoleKey),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      }),
      // 경로 표는 덤이라 실패해도 대시보드 전체를 막지 않습니다.
      fetch(`${origin}/rest/v1/rpc/${ADMIN_ANALYTICS_SOURCES_RPC_NAME}`, {
        method: 'POST',
        headers: buildSupabaseHeaders(serviceRoleKey),
        body: JSON.stringify({ p_since: params.sinceIso }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      }).catch(() => null),
    ]);
    const sources: unknown = sourcesRes?.ok ? await sourcesRes.json().catch(() => null) : null;

    let tableNotReady = recentRes.status === 404;
    let recentRows: AdminAnalyticsRecentRow[] = [];
    if (recentRes.ok) {
      const parsed = (await recentRes.json()) as AdminAnalyticsRecentRow[];
      recentRows = Array.isArray(parsed) ? parsed : [];
    } else if (!tableNotReady) {
      console.error(
        `[admin/analytics] recent events query failed with HTTP ${recentRes.status}`
      );
    }

    let aggregate: unknown = null;
    let setupRequired = false;
    if (rpcRes.ok) {
      aggregate = await rpcRes.json();
      // 집계 함수 v4 전에는 'release'를 모르므로 (정확히 같은 버전만 찾아 0이 됨) 전체 버전으로 다시 조회합니다.
      const schemaVersion = Number((aggregate as { schemaVersion?: unknown } | null)?.schemaVersion ?? 0);
      if (versionFilter === 'release' && schemaVersion < 4) {
        rpcRes = await callRpc(null);
        aggregate = rpcRes.ok ? await rpcRes.json() : null;
      }
    }
    if (!rpcRes.ok) {
      const code = await readPostgrestErrorCode(rpcRes);
      if (code === 'PGRST202' || (rpcRes.status === 404 && code !== '42P01')) {
        // 함수 미설치: 집계 없이 최근 로그만 보여 주고 설치 안내를 표시합니다.
        setupRequired = true;
      } else if (code === '42P01') {
        tableNotReady = true;
      } else {
        console.error(
          `[admin/analytics] aggregate RPC failed with HTTP ${rpcRes.status}${code ? ` (${code})` : ''}`
        );
        return {
          ok: false,
          status: 502,
          error: '플레이 통계 집계 중 서버 오류가 발생했습니다.',
        };
      }
    }

    return {
      ok: true,
      data: { aggregate, recentRows, sources, setupRequired, tableNotReady },
    };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error(
      `[admin/analytics] Supabase request failed (${isTimeout ? 'timeout' : 'network'})`
    );
    return {
      ok: false,
      status: 502,
      error: isTimeout
        ? '통계 데이터베이스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
        : '통계 데이터베이스 연결 중 오류가 발생했습니다.',
    };
  }
}
