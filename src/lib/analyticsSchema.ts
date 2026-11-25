import type {
  ContractType,
  GrowthDna,
  LeagueId,
  LegacyTierId,
  NationalityCode,
  PlayerTraitId,
  PlaystyleArchetype,
  Position,
  RetirementReason,
  TrainingFocus,
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
  // 1.0.1 퍼널 이벤트
  'creation_started',
  'draft_completed',
  // 1.1.2 난이도 설문 (1인 1회)
  'survey_response',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_DEVICE_TYPES = ['mobile', 'tablet', 'desktop'] as const;
export type AnalyticsDeviceType = (typeof ANALYTICS_DEVICE_TYPES)[number];

export type NormalizedPlayoffResult =
  | 'missed'
  | 'play_in'
  | 'round1'
  | 'quarterfinals'
  | 'semifinals'
  | 'finals_loss'
  | 'champion';

export type NormalizedPlayerRole =
  | 'garbage_time'
  | 'two_way'
  | 'bench'
  | 'sixth_man'
  | 'starter'
  | 'franchise_ace';

export type SeasonAwardCode =
  | 'ROY'
  | 'DPOY'
  | '6MOY'
  | 'MIP'
  | 'ALL_STAR'
  | 'ALL_LEAGUE_1ST'
  | 'ALL_LEAGUE_2ND'
  | 'ALL_LEAGUE_3RD';

export type LeagueChangeReason =
  | 'draft'
  | 'military_enlist'
  | 'military_discharge'
  | 'summer_league'
  | 'two_way'
  | 'promotion'
  | 'relegation'
  | 'free_agency';

export interface LeagueHonorSummary {
  seasons: number;
  championships: number;
  mvp: number;
  fmvp: number;
}

export const MAX_ANALYTICS_ID_LENGTH = 64;
export const MAX_ANALYTICS_VERSION_LENGTH = 32;
export const MAX_ANALYTICS_PAYLOAD_BYTES = 4096;
export const MAX_ANALYTICS_PAYLOAD_DEPTH = 3;
export const MAX_ANALYTICS_PAYLOAD_KEYS = 80;
export const MAX_ANALYTICS_ARRAY_LENGTH = 20;
export const MAX_ANALYTICS_STRING_VALUE_LENGTH = 120;

export interface SessionStartPayload {
  hasExistingSave: boolean;
  currentLeague: LeagueId | null;
  currentSeason: number | null;
  seasonYear: number | null;
  hofCount: number;
  /** 1.1.4: 홈 화면 앱으로 실행했는지 (standalone) 브라우저인지 */
  displayMode?: 'standalone' | 'browser';
}

export interface CareerCreatedPayload {
  position: Position;
  secondaryPosition: Position | null;
  heightCm: number;
  startingLeague: LeagueId;
  startingTeamId: string;
  /** 1.2.0: 선수 국적 코드 (예: 'KOR', 'USA'). 예전 버전 이벤트에는 없습니다. */
  nationality?: NationalityCode;
  startingAge: number;
  growthDna: GrowthDna | null;
  playstyle: PlaystyleArchetype | null;
  innateTrait: PlayerTraitId | null;
  trainingFocus: TrainingFocus;
  initialOvr: number;
}

// 1.1.3: 용량 절감을 위해 분석에 쓰지 않던 seasonYear, teamName, teamRank, spg, bpg,
// fgPct, threePtPct를 뺐습니다. 1.1.2 이하 행에는 남아 있습니다.
export interface SeasonCompletedPayload {
  // 기본 교차 분석 키
  league: LeagueId;
  position: Position;
  seasonNumber: number;
  age: number;

  // 우승 및 주요 수상 내역
  wonChampionship: boolean;
  wonMvp: boolean;
  wonFinalsMvp: boolean;
  allStarSelected: boolean;
  awards: SeasonAwardCode[];

  // 플레이오프 & 팀 성적
  madePlayoffs: boolean;
  playoffResult: NormalizedPlayoffResult;
  teamWins: number;
  teamLosses: number;

  // 선수 성장 & 벤치 → 주전 도약 지표
  overall: number;
  seasonOvr: number;
  overallDelta: number;
  role: NormalizedPlayerRole;
  isStarter: boolean;
  mpg: number;

  // 시즌 개인 성적 요약 (소수점 1자리 반올림)
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;

  // 메타 지표 (육성, 부상, 계약)
  trainingFocus: TrainingFocus;
  injuredGames: number;
  hadInjury: boolean;
  contractType: ContractType;
  salary: number;

  // 1.1.1: 1.1.0 신규 기능 추적 (없으면 생략 가능 → 이전 버전 행과 호환)
  /** 고교 '코치의 기회': 이번 시즌 제시됐는지, 잡았는지 */
  coachChance?: CoachChanceOutcome;
  /** NCAA 신입 적응 목표 달성 수 (NCAA 첫 시즌만, 0~2) */
  freshmanGoalsAchieved?: number | null;
  /** 이번 시즌을 '우승 도전팀 이적'으로 합류한 팀에서 뛰었는지 */
  contenderPathSeason?: boolean;
  /** 이번 시즌 종료 후 오프시즌에 '우승 도전팀 이적 요청' 카드가 제시됐는지 */
  contenderPathOffered?: boolean;
}

export type CoachChanceOutcome = 'none' | 'offered' | 'taken';

export interface LeagueChangedPayload {
  fromLeague: LeagueId;
  toLeague: LeagueId;
  position: Position;
  seasonNumber: number;
  seasonYear: number;
  overall: number;
  age: number;
  contractType: ContractType;
  changeReason: LeagueChangeReason;
  draftPick: number | null;
  draftRound: 1 | 2 | null;
}

export interface CareerEndedPayload {
  position: Position;
  totalSeasons: number;
  finalLeague: LeagueId;
  peakLeague: LeagueId;
  finalAge: number;
  peakOverall: number;
  finalOverall: number;
  totalGames: number;

  // 통산 영예 누적치 (1.0.0 초기 키 이름 유지: 구버전 행과 같은 키로 집계)
  totalAllLeague: number;
  totalDpoy: number;
  totalSixthMan: number;
  totalMip: number;
  mvpCount: number;
  championshipCount: number;
  nbaChampionshipCount: number;
  finalsMvpCount: number;
  allStarCount: number;
  leagueHonors: Partial<Record<LeagueId, LeagueHonorSummary>>;

  // 엔딩 & 통산 성적
  endingType: LegacyTierId | RetirementReason;
  retirementReason: RetirementReason;
  legacyTier: LegacyTierId | null;
  hallOfFame: boolean;
  jerseyRetired: boolean;
  careerPoints: number;
  careerPpg: number;
  careerRpg: number;
  careerApg: number;
}

export interface CareerResetPayload {
  position: Position;
  abandonedLeague: LeagueId;
  abandonedSeason: number;
  abandonedSeasonYear: number;
  abandonedAge: number;
  abandonedOverall: number;
  abandonedRole: NormalizedPlayerRole;
  wasStarter: boolean;
  hadWonChampionship: boolean;
  hadWonMvp: boolean;
  hadWonFmvp: boolean;
}

/** 커리어 생성 화면 진입 (세션당 1회) */
export interface CreationStartedPayload {
  hasExistingSave: boolean;
  hofCount: number;
}

/** 드래프트 결과 확정 (지명 또는 미지명) */
export interface DraftCompletedPayload {
  draftType: 'NBA' | 'KBL';
  fromLeague: LeagueId;
  position: Position;
  age: number;
  overall: number;
  /** null = 미지명 */
  pickNumber: number | null;
  round: 1 | 2 | null;
  drafted: boolean;
  hasTwoWayOffer: boolean;
  scoutingGrade: number | null;
}

export interface AnalyticsEventPayloadMap {
  session_start: SessionStartPayload;
  career_created: CareerCreatedPayload;
  season_completed: SeasonCompletedPayload;
  league_changed: LeagueChangedPayload;
  career_ended: CareerEndedPayload;
  career_reset: CareerResetPayload;
  creation_started: CreationStartedPayload;
  draft_completed: DraftCompletedPayload;
  survey_response: SurveyResponsePayload;
}

/** 설문 5단계 응답 (난이도: 1 너무 쉬움 ~ 5 너무 어려움 / 고교 속도: 1 너무 지루함 ~ 5 너무 빠름) */
export type SurveyAnswerValue = 1 | 2 | 3 | 4 | 5;

export interface SurveyResponsePayload {
  surveyId: string;
  /** submitted = 응답 제출, skipped = 건너뛰기 (응답률 계산용, 답변은 모두 null) */
  status: 'submitted' | 'skipped';
  militaryExemptionRating: SurveyAnswerValue | null;
  nbaEntryRating: SurveyAnswerValue | null;
  nbaPlayoffsRating: SurveyAnswerValue | null;
  kblOverseasRating: SurveyAnswerValue | null;
  hsPacingRating: SurveyAnswerValue | null;
  /** 의견 글을 피드백함에 남겼는지 (글 내용은 여기 담지 않습니다) */
  hasComment: boolean;

  // 답변과 비교할 실제 커리어 경험
  militaryExempt: boolean;
  reachedNba: boolean;
  nbaSeasons: number;
  nbaPlayoffSeasons: number;
  nbaChampionships: number;
  kblSeasons: number;
  overseasSeasons: number;
  highSchoolSeasons: number;
  seasonsPlayed: number;
  finalLeague: LeagueId;
  retirementReason: RetirementReason | null;
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
    if (node.length > MAX_ANALYTICS_ARRAY_LENGTH) {
      return {
        ok: false,
        error: `payload 배열 길이가 최대 허용치(${MAX_ANALYTICS_ARRAY_LENGTH}개)를 초과했습니다.`,
      };
    }
    const items: unknown[] = [];
    for (const item of node) {
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
  creation_started: { windowMs: 10 * 60 * 1000, maxCount: 3 },
  draft_completed: { windowMs: 60 * 1000, maxCount: 10 },
  survey_response: { windowMs: 10 * 60 * 1000, maxCount: 3 },
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

/** Vercel 미리보기(Preview) 배포에서 들어온 이벤트에 붙이는 버전 접미사 */
export const PREVIEW_GAME_VERSION_SUFFIX = '-preview';

/**
 * 미리보기 배포(VERCEL_ENV=preview)에서 수집된 이벤트는 game_version에 '-preview'를 붙여
 * 정식 배포 통계와 섞이지 않게 합니다. (예: 1.1.0 → 1.1.0-preview)
 */
export function tagPreviewGameVersion(
  gameVersion: string | null,
  vercelEnv: string | undefined
): string | null {
  if (vercelEnv !== 'preview') return gameVersion;
  const base = gameVersion ?? 'unknown';
  return base.endsWith(PREVIEW_GAME_VERSION_SUFFIX)
    ? base
    : `${base}${PREVIEW_GAME_VERSION_SUFFIX}`;
}
