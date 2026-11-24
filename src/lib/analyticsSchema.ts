import type {
  ContractType,
  GrowthDna,
  LeagueId,
  LegacyTierId,
  PlayerTraitId,
  PlaystyleArchetype,
  Position,
  RetirementReason,
} from '../types/game';

/**
 * 허용된 마일스톤 분석 이벤트 목록 (Allowlist)
 * - 고빈도 클릭/스크롤/훈련 버튼 이벤트는 수집하지 않습니다.
 */
export const ANALYTICS_EVENT_NAMES = [
  'session_start',
  'career_created',
  'season_completed',
  'league_changed',
  'career_ended',
  'career_reset',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_DEVICE_TYPES = ['mobile', 'tablet', 'desktop'] as const;
export type AnalyticsDeviceType = (typeof ANALYTICS_DEVICE_TYPES)[number];

export const MAX_ANALYTICS_ID_LENGTH = 64;
export const MAX_ANALYTICS_VERSION_LENGTH = 32;
export const MAX_ANALYTICS_PAYLOAD_BYTES = 4096;
export const MAX_ANALYTICS_PAYLOAD_DEPTH = 3;
export const MAX_ANALYTICS_PAYLOAD_KEYS = 40;
export const MAX_ANALYTICS_STRING_VALUE_LENGTH = 120;

export interface SessionStartPayload {
  hasExistingSave: boolean;
  currentLeague: LeagueId | null;
  currentSeason: number | null;
  seasonYear: number | null;
  hofCount: number;
}

export interface CareerCreatedPayload {
  position: Position;
  secondaryPosition: Position | null;
  heightCm: number;
  startingLeague: LeagueId;
  startingTeamId: string;
  growthDna: GrowthDna | null;
  playstyle: PlaystyleArchetype | null;
  innateTrait: PlayerTraitId | null;
  initialOvr: number;
}

export interface SeasonCompletedPayload {
  seasonNumber: number;
  seasonYear: number;
  league: LeagueId;
  teamName: string;
  overall: number;
  seasonOvr: number;
  age: number;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  wonChampionship: boolean;
  wonMvp: boolean;
  wonFinalsMvp: boolean;
  allStarSelected: boolean;
}

export interface LeagueChangedPayload {
  fromLeague: LeagueId;
  toLeague: LeagueId;
  seasonNumber: number;
  seasonYear: number;
  overall: number;
  age: number;
  contractType: ContractType;
}

export interface CareerEndedPayload {
  totalSeasons: number;
  finalLeague: LeagueId;
  finalAge: number;
  peakOverall: number;
  finalOverall: number;
  totalGames: number;
  mvpCount: number;
  championshipCount: number;
  nbaChampionshipCount: number;
  finalsMvpCount: number;
  allStarCount: number;
  retirementReason: RetirementReason;
  legacyTier: LegacyTierId | null;
  jerseyRetired: boolean;
}

export interface CareerResetPayload {
  abandonedLeague: LeagueId;
  abandonedSeason: number;
  abandonedSeasonYear: number;
  abandonedAge: number;
  abandonedOverall: number;
}

export interface AnalyticsEventPayloadMap {
  session_start: SessionStartPayload;
  career_created: CareerCreatedPayload;
  season_completed: SeasonCompletedPayload;
  league_changed: LeagueChangedPayload;
  career_ended: CareerEndedPayload;
  career_reset: CareerResetPayload;
}

export interface AnalyticsEventRequestBody<
  E extends AnalyticsEventName = AnalyticsEventName,
> {
  event_name: E;
  anonymous_id: string;
  session_id: string;
  career_run_id?: string | null;
  game_version?: string | null;
  device_type?: AnalyticsDeviceType | null;
  payload?: AnalyticsEventPayloadMap[E];
}

export interface ValidatedAnalyticsEvent {
  event_name: AnalyticsEventName;
  anonymous_id: string;
  session_id: string;
  career_run_id: string | null;
  game_version: string | null;
  device_type: AnalyticsDeviceType | null;
  payload: Record<string, unknown>;
}

const EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);
const DEVICE_TYPE_SET = new Set<string>(ANALYTICS_DEVICE_TYPES);
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const SAFE_VERSION_PATTERN = /^[0-9A-Za-z._+-]{1,32}$/;

/**
 * 개인 식별 정보(PII), 사용자 자유 입력 선수명, 인증/세이브 덤프 키 차단 목록
 */
const FORBIDDEN_PII_KEYS = new Set<string>([
  'name',
  'playername',
  'player_name',
  'username',
  'user_name',
  'fullname',
  'full_name',
  'email',
  'phone',
  'phonenumber',
  'phone_number',
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'cookie',
  'ip',
  'ipaddress',
  'ip_address',
  'savedata',
  'save_data',
  'rawsave',
  'raw_save',
  'fullstate',
  'full_state',
  'career',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function getUtf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function sanitizePayloadNode(
  node: unknown,
  depth: number,
  keyCounter: { count: number }
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (node === null || typeof node === 'boolean') {
    return { ok: true, value: node };
  }

  if (typeof node === 'number') {
    if (!Number.isFinite(node)) {
      return { ok: true, value: null };
    }
    return { ok: true, value: Math.round(node * 1000) / 1000 };
  }

  if (typeof node === 'string') {
    const trimmed = node.trim();
    return {
      ok: true,
      value:
        trimmed.length > MAX_ANALYTICS_STRING_VALUE_LENGTH
          ? trimmed.slice(0, MAX_ANALYTICS_STRING_VALUE_LENGTH)
          : trimmed,
    };
  }

  if (Array.isArray(node)) {
    if (depth >= MAX_ANALYTICS_PAYLOAD_DEPTH) {
      return { ok: false, error: 'payload 중첩 깊이가 허용 범위를 초과했습니다.' };
    }
    const items: unknown[] = [];
    for (const item of node.slice(0, 20)) {
      const sanitizedItem = sanitizePayloadNode(item, depth + 1, keyCounter);
      if (!sanitizedItem.ok) return sanitizedItem;
      items.push(sanitizedItem.value);
    }
    return { ok: true, value: items };
  }

  if (isPlainObject(node)) {
    if (depth >= MAX_ANALYTICS_PAYLOAD_DEPTH) {
      return { ok: false, error: 'payload 중첩 깊이가 허용 범위를 초과했습니다.' };
    }
    const result: Record<string, unknown> = {};
    for (const [rawKey, rawVal] of Object.entries(node)) {
      const key = rawKey.trim();
      if (!key || key.length > 64) continue;
      if (FORBIDDEN_PII_KEYS.has(key.toLowerCase())) continue;
      if (rawVal === undefined) continue;

      keyCounter.count += 1;
      if (keyCounter.count > MAX_ANALYTICS_PAYLOAD_KEYS) {
        return {
          ok: false,
          error: 'payload 항목 수가 허용 범위를 초과했습니다.',
        };
      }

      const sanitizedVal = sanitizePayloadNode(rawVal, depth + 1, keyCounter);
      if (!sanitizedVal.ok) return sanitizedVal;
      result[key] = sanitizedVal.value;
    }
    return { ok: true, value: result };
  }

  return { ok: false, error: 'payload에 허용되지 않은 데이터 형식이 포함되어 있습니다.' };
}

/**
 * 분석 이벤트 요청 본문을 엄격하게 검증하고 PII 키를 제거합니다.
 */
export function validateAnalyticsEventPayload(
  raw: unknown
): { ok: true; data: ValidatedAnalyticsEvent } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: '요청 본문은 JSON 객체여야 합니다.' };
  }

  const eventName =
    typeof raw.event_name === 'string' ? raw.event_name.trim() : '';
  if (!EVENT_NAME_SET.has(eventName)) {
    return { ok: false, error: '허용되지 않은 event_name 입니다.' };
  }

  const anonymousId =
    typeof raw.anonymous_id === 'string' ? raw.anonymous_id.trim() : '';
  if (!SAFE_ID_PATTERN.test(anonymousId)) {
    return { ok: false, error: 'anonymous_id 형식이 올바르지 않습니다.' };
  }

  const sessionId =
    typeof raw.session_id === 'string' ? raw.session_id.trim() : '';
  if (!SAFE_ID_PATTERN.test(sessionId)) {
    return { ok: false, error: 'session_id 형식이 올바르지 않습니다.' };
  }

  let careerRunId: string | null = null;
  if (raw.career_run_id !== undefined && raw.career_run_id !== null && raw.career_run_id !== '') {
    if (typeof raw.career_run_id !== 'string') {
      return { ok: false, error: 'career_run_id 형식이 올바르지 않습니다.' };
    }
    const trimmedRunId = raw.career_run_id.trim();
    if (!SAFE_ID_PATTERN.test(trimmedRunId)) {
      return { ok: false, error: 'career_run_id 형식이 올바르지 않습니다.' };
    }
    careerRunId = trimmedRunId;
  }

  let gameVersion: string | null = null;
  if (raw.game_version !== undefined && raw.game_version !== null && raw.game_version !== '') {
    if (typeof raw.game_version !== 'string') {
      return { ok: false, error: 'game_version 형식이 올바르지 않습니다.' };
    }
    const trimmedVersion = raw.game_version.trim();
    if (!SAFE_VERSION_PATTERN.test(trimmedVersion)) {
      return { ok: false, error: 'game_version 형식이 올바르지 않습니다.' };
    }
    gameVersion = trimmedVersion;
  }

  let deviceType: AnalyticsDeviceType | null = null;
  if (raw.device_type !== undefined && raw.device_type !== null && raw.device_type !== '') {
    if (typeof raw.device_type !== 'string') {
      return { ok: false, error: 'device_type 형식이 올바르지 않습니다.' };
    }
    const trimmedDevice = raw.device_type.trim();
    if (!DEVICE_TYPE_SET.has(trimmedDevice)) {
      return { ok: false, error: 'device_type 값이 올바르지 않습니다.' };
    }
    deviceType = trimmedDevice as AnalyticsDeviceType;
  }

  let sanitizedPayload: Record<string, unknown> = {};
  if (raw.payload !== undefined) {
    if (!isPlainObject(raw.payload)) {
      return { ok: false, error: 'payload는 JSON 객체여야 합니다.' };
    }
    const sanitized = sanitizePayloadNode(raw.payload, 0, { count: 0 });
    if (!sanitized.ok) {
      return sanitized;
    }
    sanitizedPayload = sanitized.value as Record<string, unknown>;
  }

  let serializedPayload = '{}';
  try {
    serializedPayload = JSON.stringify(sanitizedPayload);
  } catch {
    return { ok: false, error: 'payload 직렬화에 실패했습니다.' };
  }

  if (getUtf8ByteLength(serializedPayload) > MAX_ANALYTICS_PAYLOAD_BYTES) {
    return {
      ok: false,
      error: `payload 크기가 최대 허용치(${MAX_ANALYTICS_PAYLOAD_BYTES}바이트)를 초과했습니다.`,
    };
  }

  return {
    ok: true,
    data: {
      event_name: eventName as AnalyticsEventName,
      anonymous_id: anonymousId,
      session_id: sessionId,
      career_run_id: careerRunId,
      game_version: gameVersion,
      device_type: deviceType,
      payload: sanitizedPayload,
    },
  };
}

/**
 * 서버 메모리 기반 경량 이벤트 도배 방지 리미터
 * - 외부 인프라 없이 세션+이벤트 단위 및 클라이언트 IP 버스트를 제한합니다.
 */
interface RateRule {
  windowMs: number;
  maxCount: number;
}

const SESSION_EVENT_RULES: Record<AnalyticsEventName, RateRule> = {
  session_start: { windowMs: 10 * 60 * 1000, maxCount: 3 },
  career_created: { windowMs: 60 * 1000, maxCount: 10 },
  season_completed: { windowMs: 60 * 1000, maxCount: 30 },
  league_changed: { windowMs: 60 * 1000, maxCount: 30 },
  career_ended: { windowMs: 60 * 1000, maxCount: 10 },
  career_reset: { windowMs: 60 * 1000, maxCount: 10 },
};

const IP_BURST_RULE: RateRule = {
  windowMs: 60 * 1000,
  maxCount: 60,
};

export function createAnalyticsRateLimiter() {
  const sessionEventBuckets = new Map<string, number[]>();
  const ipBuckets = new Map<string, number[]>();

  function pruneBucket(
    store: Map<string, number[]>,
    maxWindowMs: number,
    nowMs: number
  ) {
    if (store.size <= 1000) return;
    for (const [key, timestamps] of store.entries()) {
      const fresh = timestamps.filter((ts) => nowMs - ts < maxWindowMs);
      if (fresh.length === 0) store.delete(key);
      else store.set(key, fresh);
    }
  }

  function consume(
    store: Map<string, number[]>,
    key: string,
    rule: RateRule,
    nowMs: number
  ): boolean {
    const fresh = (store.get(key) || []).filter((ts) => nowMs - ts < rule.windowMs);
    if (fresh.length >= rule.maxCount) {
      store.set(key, fresh);
      return false;
    }
    fresh.push(nowMs);
    store.set(key, fresh);
    return true;
  }

  return {
    checkAndConsume(
      params: {
        clientIp: string;
        sessionId: string;
        eventName: AnalyticsEventName;
      },
      nowMs: number = Date.now()
    ): boolean {
      pruneBucket(ipBuckets, IP_BURST_RULE.windowMs, nowMs);
      pruneBucket(sessionEventBuckets, 10 * 60 * 1000, nowMs);

      const sessionKey = `${params.sessionId}:${params.eventName}`;
      const sessionRule = SESSION_EVENT_RULES[params.eventName];

      // 먼저 두 한도 모두 여유가 있는지 검사한 뒤 소비
      const ipFresh = (ipBuckets.get(params.clientIp) || []).filter(
        (ts) => nowMs - ts < IP_BURST_RULE.windowMs
      );
      if (ipFresh.length >= IP_BURST_RULE.maxCount) {
        ipBuckets.set(params.clientIp, ipFresh);
        return false;
      }

      const sessionFresh = (sessionEventBuckets.get(sessionKey) || []).filter(
        (ts) => nowMs - ts < sessionRule.windowMs
      );
      if (sessionFresh.length >= sessionRule.maxCount) {
        sessionEventBuckets.set(sessionKey, sessionFresh);
        return false;
      }

      consume(ipBuckets, params.clientIp, IP_BURST_RULE, nowMs);
      consume(sessionEventBuckets, sessionKey, sessionRule, nowMs);
      return true;
    },
    reset() {
      sessionEventBuckets.clear();
      ipBuckets.clear();
    },
  };
}
