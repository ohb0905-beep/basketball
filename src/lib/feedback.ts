import { GAME_VERSION } from '../config/appMeta';
import { LEAGUE_CONFIG } from '../data/leagues';
import { CareerState, ViewState } from '../types/game';

export const FEEDBACK_TYPE_VALUES = [
  'bug',
  'balance',
  'content',
  'ui',
  'other',
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPE_VALUES)[number];

export interface FeedbackTypeOption {
  value: FeedbackType;
  label: string;
  shortLabel: string;
}

export const FEEDBACK_TYPE_OPTIONS: FeedbackTypeOption[] = [
  { value: 'bug', label: '버그 제보', shortLabel: '버그 제보' },
  { value: 'balance', label: '밸런스 및 게임 시스템 의견', shortLabel: '밸런스·시스템' },
  { value: 'content', label: '콘텐츠 추가 제안', shortLabel: '콘텐츠 제안' },
  { value: 'ui', label: 'UI 및 사용성 개선', shortLabel: 'UI·사용성' },
  { value: 'other', label: '기타', shortLabel: '기타' },
];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: '버그 제보',
  balance: '밸런스 및 게임 시스템 의견',
  content: '콘텐츠 추가 제안',
  ui: 'UI 및 사용성 개선',
  other: '기타',
};

export const FEEDBACK_TITLE_MAX = 100;
export const FEEDBACK_CONTENT_MAX = 3000;
export const FEEDBACK_CONTEXT_MAX_BYTES = 8192;

export type DashboardTabId = 'SEASON' | 'TRAINING' | 'HISTORY';

export interface FeedbackPlayerSummary {
  primaryPos: string;
  secondaryPos: string | null;
  age: number;
  ovr: number;
  role: string;
  teamName: string;
  contractType: string;
  contractYearsLeft: number;
  militaryExempt: boolean;
  militaryServiceSeasonsLeft: number;
  nationalTeamRetired: boolean;
}

export interface FeedbackDeviceSummary {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  viewport: string;
  browser: string;
  os: string;
  language: string;
}

export interface FeedbackGameContext {
  submittedAt: string;
  gameVersion: string;
  pathname: string;
  view: string;
  activeTab: DashboardTabId | null;
  hasCareer: boolean;
  league: string | null;
  leagueName: string | null;
  seasonYear: number | null;
  seasonsPlayed: number | null;
  seasonPhase: string | null;
  offseasonLocked: boolean | null;
  hasPendingEvent: boolean;
  hasLiveGame: boolean;
  player: FeedbackPlayerSummary | null;
  device: FeedbackDeviceSummary;
}

export interface ValidatedFeedbackPayload {
  type: FeedbackType;
  title: string;
  content: string;
  gameVersion: string;
  gameContext: Record<string, unknown>;
}

const VIEW_LABELS: Record<string, string> = {
  HOME: '홈 화면',
  CREATE: '선수 생성',
  DASHBOARD: '커리어 대시보드',
  DRAFT_COMBINE: '드래프트 컴바인',
  DRAFT_LIVE: '드래프트 라이브',
  RETIREMENT: '은퇴 회고',
};

const TAB_LABELS: Record<DashboardTabId, string> = {
  SEASON: '시즌 탭',
  TRAINING: '선수 탭',
  HISTORY: '기록 탭',
};

const PHASE_LABELS: Record<string, string> = {
  REGULAR_SEASON: '정규시즌',
  POSTSEASON_BRACKET: '플레이오프',
  LIVE_FINAL_BROADCAST: '결승 라이브 중계',
  OFFSEASON: '오프시즌',
};

function detectBrowserAndOs(ua: string): { browser: string; os: string } {
  const s = ua || '';
  let browser = '기타 브라우저';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/Whale\//i.test(s)) browser = 'Whale';
  else if (/SamsungBrowser\//i.test(s)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Safari\//i.test(s)) browser = 'Safari';

  let os = '기타 OS';
  if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/Windows/i.test(s)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  return { browser, os };
}

function detectDeviceType(
  width: number | null,
  ua: string
): FeedbackDeviceSummary['deviceType'] {
  if (width === null || !Number.isFinite(width) || width <= 0) {
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
    return 'unknown';
  }
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * 실제 존재하는 Zustand 상태 및 브라우저 환경에서 디버깅에 필요한 최소 요약 정보만 안전하게 수집합니다.
 * - 개인 식별 정보, 인증 토큰, 전체 세이브 덤프는 절대 수집하지 않습니다.
 * - SSR 또는 커리어 초기화 전 상태에서도 예외를 발생시키지 않습니다.
 */
export function collectFeedbackGameContext(params: {
  view?: ViewState | string | null;
  activeTab?: DashboardTabId | null;
  career?: CareerState | null;
  now?: Date;
}): FeedbackGameContext {
  const submittedAt = (params.now ?? new Date()).toISOString();
  const safeView = typeof params.view === 'string' && params.view ? params.view : 'HOME';
  const safeTab =
    safeView === 'DASHBOARD' &&
    (params.activeTab === 'SEASON' ||
      params.activeTab === 'TRAINING' ||
      params.activeTab === 'HISTORY')
      ? params.activeTab
      : null;

  let pathname = '/';
  let viewport = 'unknown';
  let width: number | null = null;
  let ua = '';
  let language = 'ko-KR';

  if (typeof window !== 'undefined') {
    try {
      pathname = window.location?.pathname || '/';
      if (
        typeof window.innerWidth === 'number' &&
        typeof window.innerHeight === 'number'
      ) {
        width = window.innerWidth;
        viewport = `${window.innerWidth}x${window.innerHeight}`;
      }
    } catch {
      // ignore browser access errors
    }
  }

  if (typeof navigator !== 'undefined') {
    try {
      ua = navigator.userAgent || '';
      language = navigator.language || 'ko-KR';
    } catch {
      // ignore navigator access errors
    }
  }

  const { browser, os } = detectBrowserAndOs(ua);
  const deviceType = detectDeviceType(width, ua);

  const career = params.career ?? null;
  if (!career) {
    return {
      submittedAt,
      gameVersion: GAME_VERSION,
      pathname,
      view: safeView,
      activeTab: safeTab,
      hasCareer: false,
      league: null,
      leagueName: null,
      seasonYear: null,
      seasonsPlayed: null,
      seasonPhase: null,
      offseasonLocked: null,
      hasPendingEvent: false,
      hasLiveGame: false,
      player: null,
      device: {
        deviceType,
        viewport,
        browser,
        os,
        language,
      },
    };
  }

  const leagueMeta = LEAGUE_CONFIG[career.league];

  return {
    submittedAt,
    gameVersion: GAME_VERSION,
    pathname,
    view: safeView,
    activeTab: safeTab,
    hasCareer: true,
    league: career.league || null,
    leagueName: leagueMeta?.shortName || career.league || null,
    seasonYear: typeof career.seasonYear === 'number' ? career.seasonYear : null,
    seasonsPlayed:
      typeof career.seasonsPlayed === 'number' ? career.seasonsPlayed : null,
    seasonPhase: career.seasonPhase || 'REGULAR_SEASON',
    offseasonLocked: Boolean(career.offseasonLocked),
    hasPendingEvent: Boolean(career.pendingEvent),
    hasLiveGame: Boolean(career.liveGame),
    player: {
      primaryPos: career.primaryPos || '',
      secondaryPos: career.secondaryPos ?? null,
      age: typeof career.age === 'number' ? career.age : 0,
      ovr: typeof career.ovr === 'number' ? career.ovr : 0,
      role: career.role || '',
      teamName: career.team?.name || '',
      contractType: career.contractType || '',
      contractYearsLeft:
        typeof career.contractYearsLeft === 'number'
          ? career.contractYearsLeft
          : 0,
      militaryExempt: Boolean(career.militaryExempt),
      militaryServiceSeasonsLeft:
        typeof career.militaryServiceSeasonsLeft === 'number'
          ? career.militaryServiceSeasonsLeft
          : 0,
      nationalTeamRetired: Boolean(career.nationalTeamRetired),
    },
    device: {
      deviceType,
      viewport,
      browser,
      os,
      language,
    },
  };
}

export interface ContextPreviewRow {
  label: string;
  value: string;
}

/**
 * FeedbackModal 하단 아코디언에 표시할 사용자 친화적 요약 행을 생성합니다.
 */
export function formatGameContextPreviewRows(
  ctx: FeedbackGameContext
): ContextPreviewRow[] {
  const screenLabel =
    ctx.view === 'DASHBOARD' && ctx.activeTab
      ? `${VIEW_LABELS[ctx.view] || ctx.view} · ${TAB_LABELS[ctx.activeTab]}`
      : VIEW_LABELS[ctx.view] || ctx.view;

  const deviceLabel =
    ctx.device.deviceType === 'mobile'
      ? '모바일'
      : ctx.device.deviceType === 'tablet'
      ? '태블릿'
      : ctx.device.deviceType === 'desktop'
      ? '데스크톱'
      : '알 수 없음';

  const rows: ContextPreviewRow[] = [
    { label: '게임 버전', value: `v${ctx.gameVersion}` },
    { label: '현재 화면', value: `${screenLabel} (${ctx.pathname})` },
  ];

  if (ctx.hasCareer && ctx.player) {
    const posStr = ctx.player.secondaryPos
      ? `${ctx.player.primaryPos}/${ctx.player.secondaryPos}`
      : ctx.player.primaryPos;
    const phaseLabel =
      PHASE_LABELS[ctx.seasonPhase || 'REGULAR_SEASON'] ||
      ctx.seasonPhase ||
      '정규시즌';
    rows.push({
      label: '리그 · 시즌',
      value: `${ctx.leagueName || ctx.league || '-'} · ${
        ctx.seasonYear ?? '-'
      }시즌 (${phaseLabel})`,
    });
    rows.push({
      label: '선수 요약',
      value: `${posStr} · 만 ${ctx.player.age}세 · OVR ${ctx.player.ovr} · ${
        ctx.player.teamName || '무소속'
      }`,
    });
  } else {
    rows.push({ label: '커리어 상태', value: '진행 중인 커리어 없음' });
  }

  rows.push({
    label: '접속 환경',
    value: `${deviceLabel} · ${ctx.device.viewport} · ${ctx.device.browser} (${ctx.device.os})`,
  });

  return rows;
}

export function isValidFeedbackType(value: unknown): value is FeedbackType {
  return (
    typeof value === 'string' &&
    (FEEDBACK_TYPE_VALUES as readonly string[]).includes(value)
  );
}

function sanitizeShortString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : null;
}

function sanitizeFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 클라이언트에서 전달된 game_context 중 허용된 비민감 필드만 화이트리스트 방식으로 정제합니다.
 */
export function sanitizeGameContext(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const src = raw as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  const submittedAt = sanitizeShortString(src.submittedAt, 40);
  if (submittedAt) safe.submittedAt = submittedAt;

  const gameVersion = sanitizeShortString(src.gameVersion, 32);
  if (gameVersion) safe.gameVersion = gameVersion;

  const pathname = sanitizeShortString(src.pathname, 120);
  if (pathname) safe.pathname = pathname;

  const view = sanitizeShortString(src.view, 40);
  if (view) safe.view = view;

  const activeTab = sanitizeShortString(src.activeTab, 24);
  if (activeTab) safe.activeTab = activeTab;

  if (typeof src.hasCareer === 'boolean') safe.hasCareer = src.hasCareer;

  const league = sanitizeShortString(src.league, 32);
  if (league) safe.league = league;

  const leagueName = sanitizeShortString(src.leagueName, 40);
  if (leagueName) safe.leagueName = leagueName;

  const seasonYear = sanitizeFiniteNumber(src.seasonYear);
  if (seasonYear !== null) safe.seasonYear = seasonYear;

  const seasonsPlayed = sanitizeFiniteNumber(src.seasonsPlayed);
  if (seasonsPlayed !== null) safe.seasonsPlayed = seasonsPlayed;

  const seasonPhase = sanitizeShortString(src.seasonPhase, 40);
  if (seasonPhase) safe.seasonPhase = seasonPhase;

  if (typeof src.offseasonLocked === 'boolean') {
    safe.offseasonLocked = src.offseasonLocked;
  }
  if (typeof src.hasPendingEvent === 'boolean') {
    safe.hasPendingEvent = src.hasPendingEvent;
  }
  if (typeof src.hasLiveGame === 'boolean') {
    safe.hasLiveGame = src.hasLiveGame;
  }

  if (src.player && typeof src.player === 'object' && !Array.isArray(src.player)) {
    const p = src.player as Record<string, unknown>;
    const safePlayer: Record<string, unknown> = {};
    const primaryPos = sanitizeShortString(p.primaryPos, 12);
    if (primaryPos) safePlayer.primaryPos = primaryPos;
    const secondaryPos = sanitizeShortString(p.secondaryPos, 12);
    if (secondaryPos) safePlayer.secondaryPos = secondaryPos;
    const age = sanitizeFiniteNumber(p.age);
    if (age !== null) safePlayer.age = age;
    const ovr = sanitizeFiniteNumber(p.ovr);
    if (ovr !== null) safePlayer.ovr = ovr;
    const role = sanitizeShortString(p.role, 40);
    if (role) safePlayer.role = role;
    const teamName = sanitizeShortString(p.teamName, 60);
    if (teamName) safePlayer.teamName = teamName;
    const contractType = sanitizeShortString(p.contractType, 32);
    if (contractType) safePlayer.contractType = contractType;
    const contractYearsLeft = sanitizeFiniteNumber(p.contractYearsLeft);
    if (contractYearsLeft !== null) {
      safePlayer.contractYearsLeft = contractYearsLeft;
    }
    if (typeof p.militaryExempt === 'boolean') {
      safePlayer.militaryExempt = p.militaryExempt;
    }
    const milLeft = sanitizeFiniteNumber(p.militaryServiceSeasonsLeft);
    if (milLeft !== null) safePlayer.militaryServiceSeasonsLeft = milLeft;
    if (typeof p.nationalTeamRetired === 'boolean') {
      safePlayer.nationalTeamRetired = p.nationalTeamRetired;
    }
    if (Object.keys(safePlayer).length > 0) {
      safe.player = safePlayer;
    }
  }

  if (src.device && typeof src.device === 'object' && !Array.isArray(src.device)) {
    const d = src.device as Record<string, unknown>;
    const safeDevice: Record<string, unknown> = {};
    const deviceType = sanitizeShortString(d.deviceType, 16);
    if (deviceType) safeDevice.deviceType = deviceType;
    const viewport = sanitizeShortString(d.viewport, 24);
    if (viewport) safeDevice.viewport = viewport;
    const browser = sanitizeShortString(d.browser, 32);
    if (browser) safeDevice.browser = browser;
    const os = sanitizeShortString(d.os, 32);
    if (os) safeDevice.os = os;
    const language = sanitizeShortString(d.language, 24);
    if (language) safeDevice.language = language;
    if (Object.keys(safeDevice).length > 0) {
      safe.device = safeDevice;
    }
  }

  const serialized = JSON.stringify(safe);
  if (serialized.length > FEEDBACK_CONTEXT_MAX_BYTES) {
    return {
      submittedAt: safe.submittedAt ?? new Date().toISOString(),
      gameVersion: safe.gameVersion ?? GAME_VERSION,
      truncated: true,
    };
  }

  return safe;
}

/**
 * 서버/클라이언트 공용 피드백 입력 검증
 */
export function validateFeedbackInput(raw: unknown):
  | { ok: true; data: ValidatedFeedbackPayload }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '올바른 요청 형식이 아닙니다.' };
  }

  const body = raw as Record<string, unknown>;

  if (!isValidFeedbackType(body.type)) {
    return { ok: false, error: '제보 유형을 선택해 주세요.' };
  }

  if (typeof body.title !== 'string') {
    return { ok: false, error: '제목을 입력해 주세요.' };
  }
  const title = body.title.trim();
  if (title.length === 0) {
    return { ok: false, error: '제목을 입력해 주세요.' };
  }
  if (title.length > FEEDBACK_TITLE_MAX) {
    return {
      ok: false,
      error: `제목은 최대 ${FEEDBACK_TITLE_MAX}자까지 입력할 수 있습니다.`,
    };
  }

  if (typeof body.content !== 'string') {
    return { ok: false, error: '상세 내용을 입력해 주세요.' };
  }
  const content = body.content.trim();
  if (content.length === 0) {
    return { ok: false, error: '상세 내용을 입력해 주세요.' };
  }
  if (content.length > FEEDBACK_CONTENT_MAX) {
    return {
      ok: false,
      error: `상세 내용은 최대 ${FEEDBACK_CONTENT_MAX.toLocaleString()}자까지 입력할 수 있습니다.`,
    };
  }

  const rawVersion =
    typeof body.gameVersion === 'string'
      ? body.gameVersion
      : typeof body.game_version === 'string'
      ? body.game_version
      : GAME_VERSION;
  const trimmedVersion = rawVersion.trim();
  const gameVersion =
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(trimmedVersion) &&
    trimmedVersion.length <= 32
      ? trimmedVersion
      : GAME_VERSION;

  const gameContext = sanitizeGameContext(body.gameContext ?? body.game_context);

  return {
    ok: true,
    data: {
      type: body.type,
      title,
      content,
      gameVersion,
      gameContext,
    },
  };
}

// ============================================================================
// 2단계: 관리자 피드백 조회·수정 공용 상수, 타입 및 검증 유틸리티
// ============================================================================

export const FEEDBACK_STATUS_VALUES = [
  'received',
  'reviewing',
  'resolved',
  'rejected',
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUS_VALUES)[number];

export interface FeedbackStatusOption {
  value: FeedbackStatus;
  label: string;
}

export const FEEDBACK_STATUS_OPTIONS: FeedbackStatusOption[] = [
  { value: 'received', label: '접수' },
  { value: 'reviewing', label: '확인 중' },
  { value: 'resolved', label: '해결 완료' },
  { value: 'rejected', label: '반영 불가' },
];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  received: '접수',
  reviewing: '확인 중',
  resolved: '해결 완료',
  rejected: '반영 불가',
};

export const ADMIN_NOTE_MAX = 2000;

export interface FeedbackRecord {
  id: string;
  type: FeedbackType;
  title: string;
  content: string;
  game_version: string | null;
  game_context: Record<string, unknown> | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
}

export interface FeedbackStatusCounts {
  total: number;
  received: number;
  reviewing: number;
  resolved: number;
  rejected: number;
}

export interface ValidatedAdminFeedbackPatch {
  status?: FeedbackStatus;
  admin_note?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidFeedbackStatus(value: unknown): value is FeedbackStatus {
  return (
    typeof value === 'string' &&
    (FEEDBACK_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

/**
 * 관리자 피드백 수정(PATCH) 요청 본문 검증
 */
export function validateAdminFeedbackPatchInput(raw: unknown):
  | { ok: true; data: ValidatedAdminFeedbackPatch }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '올바른 요청 형식이 아닙니다.' };
  }

  const body = raw as Record<string, unknown>;
  const patch: ValidatedAdminFeedbackPatch = {};

  if (body.status !== undefined) {
    if (!isValidFeedbackStatus(body.status)) {
      return {
        ok: false,
        error:
          '유효하지 않은 상태 값입니다. (received, reviewing, resolved, rejected 중 선택)',
      };
    }
    patch.status = body.status;
  }

  if (body.admin_note !== undefined) {
    if (typeof body.admin_note !== 'string') {
      return {
        ok: false,
        error: '관리자 메모는 문자열 형식이어야 합니다.',
      };
    }
    if (body.admin_note.length > ADMIN_NOTE_MAX) {
      return {
        ok: false,
        error: `관리자 메모는 최대 ${ADMIN_NOTE_MAX.toLocaleString()}자까지 입력할 수 있습니다.`,
      };
    }
    patch.admin_note = body.admin_note;
  }

  if (patch.status === undefined && patch.admin_note === undefined) {
    return {
      ok: false,
      error: '수정할 상태 또는 관리자 메모를 전달해 주세요.',
    };
  }

  return { ok: true, data: patch };
}

/**
 * ISO 8601 타임스탬프를 한국 시간(Asia/Seoul) 기준 가독성 높은 형식으로 변환합니다.
 */
export function formatFeedbackDateKst(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  try {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const map: Record<string, string> = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }
    return `${map.year}.${map.month}.${map.day} ${map.hour}:${map.minute}`;
  } catch {
    return isoString;
  }
}

/**
 * DB에 저장된 game_context JSONB 객체를 관리자 상세 패널용 읽기 쉬운 요약 행으로 변환합니다.
 */
export function formatStoredGameContextRows(
  rawContext: Record<string, unknown> | null | undefined
): ContextPreviewRow[] {
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    return [];
  }

  const rows: ContextPreviewRow[] = [];

  if (typeof rawContext.gameVersion === 'string' && rawContext.gameVersion) {
    rows.push({ label: '게임 버전', value: `v${rawContext.gameVersion}` });
  }

  const viewKey = typeof rawContext.view === 'string' ? rawContext.view : '';
  const tabKey =
    rawContext.activeTab === 'SEASON' ||
    rawContext.activeTab === 'TRAINING' ||
    rawContext.activeTab === 'HISTORY'
      ? rawContext.activeTab
      : null;
  const pathname = typeof rawContext.pathname === 'string' ? rawContext.pathname : '';

  if (viewKey || pathname) {
    const viewLabel =
      viewKey === 'DASHBOARD' && tabKey
        ? `${VIEW_LABELS[viewKey] || viewKey} · ${TAB_LABELS[tabKey]}`
        : VIEW_LABELS[viewKey] || viewKey || '알 수 없음';
    rows.push({
      label: '제보 화면',
      value: pathname ? `${viewLabel} (${pathname})` : viewLabel,
    });
  }

  if (rawContext.hasCareer === false) {
    rows.push({ label: '커리어 상태', value: '진행 중인 커리어 없음' });
  } else if (rawContext.hasCareer === true) {
    const leagueName =
      typeof rawContext.leagueName === 'string' && rawContext.leagueName
        ? rawContext.leagueName
        : typeof rawContext.league === 'string'
        ? rawContext.league
        : '-';
    const seasonYear =
      typeof rawContext.seasonYear === 'number' ? `${rawContext.seasonYear}시즌` : '-';
    const phaseKey =
      typeof rawContext.seasonPhase === 'string' ? rawContext.seasonPhase : '';
    const phaseLabel = phaseKey ? PHASE_LABELS[phaseKey] || phaseKey : '';
    rows.push({
      label: '리그 · 시즌',
      value: phaseLabel
        ? `${leagueName} · ${seasonYear} (${phaseLabel})`
        : `${leagueName} · ${seasonYear}`,
    });

    if (typeof rawContext.seasonsPlayed === 'number') {
      const flags: string[] = [];
      if (rawContext.offseasonLocked === true) flags.push('오프시즌 잠금');
      if (rawContext.hasPendingEvent === true) flags.push('대기 이벤트 있음');
      if (rawContext.hasLiveGame === true) flags.push('라이브 중계 중');
      rows.push({
        label: '진행 요약',
        value:
          flags.length > 0
            ? `${rawContext.seasonsPlayed}시즌 소화 · ${flags.join(', ')}`
            : `${rawContext.seasonsPlayed}시즌 소화`,
      });
    }

    if (
      rawContext.player &&
      typeof rawContext.player === 'object' &&
      !Array.isArray(rawContext.player)
    ) {
      const p = rawContext.player as Record<string, unknown>;
      const primaryPos = typeof p.primaryPos === 'string' ? p.primaryPos : '';
      const secondaryPos =
        typeof p.secondaryPos === 'string' && p.secondaryPos ? p.secondaryPos : '';
      const posStr = secondaryPos ? `${primaryPos}/${secondaryPos}` : primaryPos;
      const parts: string[] = [];
      if (posStr) parts.push(posStr);
      if (typeof p.age === 'number') parts.push(`만 ${p.age}세`);
      if (typeof p.ovr === 'number') parts.push(`OVR ${p.ovr}`);
      if (typeof p.teamName === 'string' && p.teamName) parts.push(p.teamName);
      if (typeof p.role === 'string' && p.role) parts.push(p.role);
      if (parts.length > 0) {
        rows.push({ label: '선수 정보', value: parts.join(' · ') });
      }

      const statusBits: string[] = [];
      if (typeof p.contractType === 'string' && p.contractType) {
        const yrs =
          typeof p.contractYearsLeft === 'number' ? ` (${p.contractYearsLeft}년)` : '';
        statusBits.push(`계약 ${p.contractType}${yrs}`);
      }
      if (p.militaryExempt === true) statusBits.push('병역 특례');
      else if (
        typeof p.militaryServiceSeasonsLeft === 'number' &&
        p.militaryServiceSeasonsLeft > 0
      ) {
        statusBits.push(`군복무 잔여 ${p.militaryServiceSeasonsLeft}시즌`);
      }
      if (p.nationalTeamRetired === true) statusBits.push('국대 은퇴');
      if (statusBits.length > 0) {
        rows.push({ label: '계약 · 상태', value: statusBits.join(' · ') });
      }
    }
  }

  if (
    rawContext.device &&
    typeof rawContext.device === 'object' &&
    !Array.isArray(rawContext.device)
  ) {
    const d = rawContext.device as Record<string, unknown>;
    const deviceLabel =
      d.deviceType === 'mobile'
        ? '모바일'
        : d.deviceType === 'tablet'
        ? '태블릿'
        : d.deviceType === 'desktop'
        ? '데스크톱'
        : typeof d.deviceType === 'string'
        ? d.deviceType
        : '';
    const bits: string[] = [];
    if (deviceLabel) bits.push(deviceLabel);
    if (typeof d.viewport === 'string' && d.viewport) bits.push(d.viewport);
    if (typeof d.browser === 'string' && d.browser) {
      const osStr = typeof d.os === 'string' && d.os ? ` (${d.os})` : '';
      bits.push(`${d.browser}${osStr}`);
    }
    if (typeof d.language === 'string' && d.language) bits.push(d.language);
    if (bits.length > 0) {
      rows.push({ label: '접속 환경', value: bits.join(' · ') });
    }
  }

  if (typeof rawContext.submittedAt === 'string' && rawContext.submittedAt) {
    rows.push({
      label: '클라이언트 시각',
      value: formatFeedbackDateKst(rawContext.submittedAt),
    });
  }

  return rows;
}

