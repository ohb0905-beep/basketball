'use client';

import { GAME_VERSION } from '../config/appMeta';
import { detectDisplayMode } from './pwa';
import type {
  CareerState,
  HallOfFameEntry,
  LeagueId,
  SeasonBoxScore,
  ViewState,
} from '../types/game';
import type {
  AnalyticsDeviceType,
  AnalyticsEventName,
  AnalyticsEventPayloadMap,
  AnalyticsEventRequestBody,
  CoachChanceOutcome,
  LeagueChangeReason,
  LeagueHonorSummary,
  NormalizedPlayerRole,
  NormalizedPlayoffResult,
  SeasonAwardCode,
  SeasonCompletedPayload,
} from './analyticsSchema';

const ANALYTICS_ENDPOINT = '/api/analytics/event';

const ANONYMOUS_ID_STORAGE_KEY = 'road_to_mvp_analytics_anon_id_v1';
const SESSION_ID_STORAGE_KEY = 'road_to_mvp_analytics_session_id_v1';
const DEDUPE_STORAGE_KEY = 'road_to_mvp_analytics_dedupe_v1';
const PERSISTENT_DEDUPE_STORAGE_KEY = 'road_to_mvp_analytics_milestone_dedupe_v1';
const CAREER_RUN_MAP_STORAGE_KEY = 'road_to_mvp_analytics_career_runs_v1';

const MAX_TRACKED_CAREER_RUNS = 20;
const MAX_STORED_DEDUPE_KEYS = 120;
const MAX_PERSISTENT_DEDUPE_KEYS = 200;

const LEAGUE_TIER_RANK: Record<LeagueId, number> = {
  HIGH_SCHOOL: 1,
  U_LEAGUE: 2,
  NCAA: 3,
  KBL: 4,
  B_LEAGUE: 4,
  NBL: 4,
  GLEAGUE: 5,
  EUROLEAGUE: 5,
  NBA: 6,
};

let memoryAnonymousId: string | null = null;
let memorySessionId: string | null = null;
const memoryDedupeSet = new Set<string>();
const memoryPersistentDedupeSet = new Set<string>();
const memoryCareerRunMap = new Map<string, string>();

function round1(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

/**
 * 시즌 시뮬레이터가 실제로 기록하는 역할 문자열 → 분석용 역할 코드 (정확히 일치할 때 우선 사용)
 */
const ENGINE_ROLE_CODES: Record<string, NormalizedPlayerRole> = {
  '프랜차이즈 1옵션 에이스': 'franchise_ace',
  '주전 스타터': 'starter',
  '주전급 코어 유망주 (1라운드 픽)': 'starter',
  '핵심 식스맨': 'sixth_man',
  '핵심 유망주 로테이션 (1라운드 픽)': 'bench',
  '벤치 로테이션': 'bench',
  '투웨이 콜업 로테이션': 'two_way',
  '가비지 타임 (벤치 끝자리)': 'garbage_time',
};

/**
 * 게임 엔진의 한국어 역할 문자열을 분석용 표준 역할 코드로 정규화합니다.
 * - 알려진 엔진 문자열은 정확히 매핑하고, 그 밖의 문자열은 키워드로 추정합니다.
 * - '벤치 에이스', '세컨드 유닛 에이스'처럼 벤치 역할을 꾸미는 '에이스'는 프랜차이즈 에이스로 보지 않습니다.
 */
export function normalizePlayerRole(rawRole: string | null | undefined): NormalizedPlayerRole {
  const text = (rawRole || '').trim();
  const exact = ENGINE_ROLE_CODES[text];
  if (exact) return exact;

  if (text.includes('가비지') || text.includes('끝자리')) {
    return 'garbage_time';
  }
  if (text.includes('투웨이')) {
    return 'two_way';
  }
  if (text.includes('식스맨') || text.includes('세컨드 유닛')) {
    return 'sixth_man';
  }
  if (text.includes('벤치') || text.includes('후보')) {
    return 'bench';
  }
  if (text.includes('프랜차이즈') || text.includes('에이스') || text.includes('1옵션')) {
    return 'franchise_ace';
  }
  if (text.includes('주전') || text.includes('스타터')) {
    return 'starter';
  }
  return 'bench';
}

export function isStarterRole(role: NormalizedPlayerRole): boolean {
  return role === 'starter' || role === 'franchise_ace';
}

/**
 * 실제 플레이오프 결과 문자열 및 우승 여부를 표준 코드로 정규화합니다.
 */
export function normalizePlayoffResult(
  rawResult: string | null | undefined,
  wonChampionship: boolean
): NormalizedPlayoffResult {
  if (wonChampionship) return 'champion';
  const text = (rawResult || '').trim();
  if (!text) return 'missed';

  if (text.includes('준우승')) return 'finals_loss';
  if (text.includes('우승')) return 'champion';
  if (
    text.includes('컨퍼런스 파이널') ||
    text.includes('세미파이널') ||
    text.includes('Final Four') ||
    text.includes('4강')
  ) {
    return 'semifinals';
  }
  if (text.includes('8강')) return 'quarterfinals';
  if (text.includes('플레이인')) return 'play_in';
  if (
    text.includes('1R') ||
    text.includes('6강') ||
    text.includes('16강') ||
    text.includes('진출')
  ) {
    return 'round1';
  }
  if (text.includes('PO 탈락') || text.includes('토너먼트 탈락')) {
    return 'missed';
  }
  return 'missed';
}

/**
 * 실제 SeasonBoxScore에 존재하는 시즌 수상 내역을 표준 코드 배열로 추출합니다.
 */
export function extractSeasonAwards(
  log: SeasonBoxScore | null | undefined
): SeasonAwardCode[] {
  if (!log) return [];
  const awards: SeasonAwardCode[] = [];
  if (log.wonRookieOfYear) awards.push('ROY');
  if (log.wonDpoy) awards.push('DPOY');
  if (log.wonSixthMan) awards.push('6MOY');
  if (log.wonMip) awards.push('MIP');
  if (log.allStarSelected) awards.push('ALL_STAR');
  if (log.allLeagueTeam === 1) awards.push('ALL_LEAGUE_1ST');
  else if (log.allLeagueTeam === 2) awards.push('ALL_LEAGUE_2ND');
  else if (log.allLeagueTeam === 3) awards.push('ALL_LEAGUE_3RD');
  return awards;
}

/**
 * 1.1.0 신규 기능(코치의 기회 · NCAA 신입 적응 · 우승 도전팀 이적) 추적 필드
 * - prevCareer: 시즌 정산 직전 상태 (방금 끝난 시즌의 팀/연도)
 * - nextCareer: 정산 직후 상태 (다음 오프시즌 선택지 포함)
 */
export function buildUpdate110SeasonFields(
  prevCareer: CareerState,
  nextCareer: CareerState,
  latestLog: SeasonBoxScore | null
): Pick<
  SeasonCompletedPayload,
  'coachChance' | 'freshmanGoalsAchieved' | 'contenderPathSeason' | 'contenderPathOffered'
> {
  const seasonYear = latestLog?.year ?? prevCareer.seasonYear;
  let coachChance: CoachChanceOutcome = 'none';
  if (prevCareer.coachChanceRotationYear === seasonYear) {
    coachChance = 'taken';
  } else if (prevCareer.coachChanceOfferedYear === seasonYear) {
    coachChance = 'offered';
  }

  const freshman = latestLog?.freshmanAdaptation;
  return {
    coachChance,
    freshmanGoalsAchieved: freshman ? freshman.achievedCount : null,
    contenderPathSeason: Boolean(
      prevCareer.contenderPathTeamId &&
        prevCareer.contenderPathTeamId === prevCareer.team.id
    ),
    contenderPathOffered: (nextCareer.offseasonOptions ?? []).some((option) =>
      Boolean(option.contenderPath)
    ),
  };
}

/**
 * 리그 변경 전/후 커리어 상태를 바탕으로 이동 사유를 추론합니다.
 */
export function inferLeagueChangeReason(
  prev: TrackableCareerStoreSnapshot,
  next: TrackableCareerStoreSnapshot
): LeagueChangeReason {
  const prevCareer = prev.career;
  const nextCareer = next.career;
  if (!prevCareer || !nextCareer) return 'free_agency';

  if (nextCareer.contractType === 'MILITARY_SERVICE' || nextCareer.team.isMilitaryTeam) {
    return 'military_enlist';
  }
  if (prevCareer.contractType === 'MILITARY_SERVICE' || prevCareer.team.isMilitaryTeam) {
    return 'military_discharge';
  }
  if (
    prev.view === 'DRAFT_LIVE' ||
    Boolean(prevCareer.draftResult) ||
    (nextCareer.draftPedigreePick != null && prevCareer.draftPedigreePick == null)
  ) {
    return 'draft';
  }
  if (nextCareer.contractType === 'SUMMER_LEAGUE_INVITE') {
    return 'summer_league';
  }
  if (nextCareer.contractType === 'TWO_WAY') {
    return 'two_way';
  }

  const fromRank = LEAGUE_TIER_RANK[prevCareer.league] ?? 0;
  const toRank = LEAGUE_TIER_RANK[nextCareer.league] ?? 0;
  if (toRank > fromRank) return 'promotion';
  if (toRank < fromRank) return 'relegation';
  return 'free_agency';
}

/**
 * 커리어 시즌 로그와 현재 리그 중 도달한 최고 위상 리그를 계산합니다.
 */
export function resolvePeakLeague(career: CareerState): LeagueId {
  let peak: LeagueId = career.league;
  let peakRank = LEAGUE_TIER_RANK[peak] ?? 0;
  for (const log of career.seasonLogs) {
    const rank = LEAGUE_TIER_RANK[log.league] ?? 0;
    if (rank > peakRank) {
      peakRank = rank;
      peak = log.league;
    }
  }
  return peak;
}

/**
 * 커리어 시즌 로그에서 리그별 시즌 수·우승·MVP·FMVP 영예를 집계합니다.
 */
export function buildLeagueHonorsSummary(
  seasonLogs: SeasonBoxScore[]
): Partial<Record<LeagueId, LeagueHonorSummary>> {
  const honors: Partial<Record<LeagueId, LeagueHonorSummary>> = {};
  for (const log of seasonLogs) {
    const existing = honors[log.league] ?? {
      seasons: 0,
      championships: 0,
      mvp: 0,
      fmvp: 0,
    };
    existing.seasons += 1;
    if (log.wonChampionship) existing.championships += 1;
    if (log.wonMvp) existing.mvp += 1;
    if (log.wonFinalsMvp) existing.fmvp += 1;
    honors[log.league] = existing;
  }
  return honors;
}

function generateAnonymousUuid(): string {
  try {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // fallback below
  }
  const timePart = Date.now().toString(36);
  const randA = Math.random().toString(36).slice(2, 10);
  const randB = Math.random().toString(36).slice(2, 10);
  return `rtm-${timePart}-${randA}-${randB}`;
}

function safeStorageGet(
  storage: Storage | undefined,
  key: string
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(
  storage: Storage | undefined,
  key: string,
  value: string
): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // 프라이빗 브라우징/저장소 제한 환경에서는 메모리 폴백으로 무해하게 동작
  }
}

export function getOrCreateAnonymousId(): string {
  if (memoryAnonymousId) return memoryAnonymousId;
  if (typeof window === 'undefined') {
    memoryAnonymousId = generateAnonymousUuid();
    return memoryAnonymousId;
  }

  const stored = safeStorageGet(window.localStorage, ANONYMOUS_ID_STORAGE_KEY);
  if (stored && stored.trim().length > 0 && stored.trim().length <= 64) {
    memoryAnonymousId = stored.trim();
    return memoryAnonymousId;
  }

  const created = generateAnonymousUuid();
  memoryAnonymousId = created;
  safeStorageSet(window.localStorage, ANONYMOUS_ID_STORAGE_KEY, created);
  return created;
}

export function getOrCreateSessionId(): string {
  if (memorySessionId) return memorySessionId;
  if (typeof window === 'undefined') {
    memorySessionId = generateAnonymousUuid();
    return memorySessionId;
  }

  const stored = safeStorageGet(window.sessionStorage, SESSION_ID_STORAGE_KEY);
  if (stored && stored.trim().length > 0 && stored.trim().length <= 64) {
    memorySessionId = stored.trim();
    return memorySessionId;
  }

  const created = generateAnonymousUuid();
  memorySessionId = created;
  safeStorageSet(window.sessionStorage, SESSION_ID_STORAGE_KEY, created);
  return created;
}

/**
 * 기존 세이브 스키마(bench-to-mvp-career-storage-v1)를 전혀 수정하지 않고,
 * CareerState.id -> 익명 career_run_id 매핑을 별도 저장소에서 관리합니다.
 */
export function getOrCreateCareerRunId(careerId: string): string {
  const existingMem = memoryCareerRunMap.get(careerId);
  if (existingMem) return existingMem;

  if (typeof window !== 'undefined') {
    const rawMap = safeStorageGet(
      window.localStorage,
      CAREER_RUN_MAP_STORAGE_KEY
    );
    if (rawMap) {
      try {
        const parsed = JSON.parse(rawMap) as Record<string, unknown>;
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed[careerId] === 'string' &&
          parsed[careerId].trim().length > 0
        ) {
          const found = parsed[careerId].trim();
          memoryCareerRunMap.set(careerId, found);
          return found;
        }
      } catch {
        // 손상된 매핑은 무시하고 새로 생성
      }
    }
  }

  const created = generateAnonymousUuid();
  memoryCareerRunMap.set(careerId, created);

  if (typeof window !== 'undefined') {
    try {
      const rawMap = safeStorageGet(
        window.localStorage,
        CAREER_RUN_MAP_STORAGE_KEY
      );
      const nextMap: Record<string, string> = {};
      if (rawMap) {
        const parsed = JSON.parse(rawMap) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          const entries = Object.entries(parsed)
            .filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && entry[1].length > 0
            )
            .slice(-(MAX_TRACKED_CAREER_RUNS - 1));
          for (const [k, v] of entries) {
            nextMap[k] = v;
          }
        }
      }
      nextMap[careerId] = created;
      safeStorageSet(
        window.localStorage,
        CAREER_RUN_MAP_STORAGE_KEY,
        JSON.stringify(nextMap)
      );
    } catch {
      // ignore storage errors
    }
  }

  return created;
}

export function detectAnalyticsDeviceType(): AnalyticsDeviceType {
  if (typeof window === 'undefined') return 'desktop';
  try {
    const width = window.innerWidth || 1024;
    const ua = navigator.userAgent || '';
    const isTabletUa = /iPad|Tablet|PlayBook|Silk/i.test(ua);
    const isMobileUa =
      /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) &&
      !isTabletUa;

    if (isTabletUa || (width >= 640 && width < 1024 && /Mobile|Touch|Android/i.test(ua))) {
      return 'tablet';
    }
    if (isMobileUa || width < 640) {
      return 'mobile';
    }
    if (width < 1024) {
      return 'tablet';
    }
    return 'desktop';
  } catch {
    return 'desktop';
  }
}

function readDedupeKeys(storage: Storage | undefined, key: string): string[] {
  if (typeof window === 'undefined') return [];
  const raw = safeStorageGet(storage, key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // ignore malformed dedupe cache
  }
  return [];
}

function hasAndMarkDedupeKey(
  dedupeKey: string,
  scope: 'session' | 'persistent'
): boolean {
  const memSet =
    scope === 'persistent' ? memoryPersistentDedupeSet : memoryDedupeSet;
  if (memSet.has(dedupeKey)) {
    return true;
  }

  const storage =
    typeof window !== 'undefined'
      ? scope === 'persistent'
        ? window.localStorage
        : window.sessionStorage
      : undefined;
  const storageKey =
    scope === 'persistent' ? PERSISTENT_DEDUPE_STORAGE_KEY : DEDUPE_STORAGE_KEY;
  const maxKeys =
    scope === 'persistent' ? MAX_PERSISTENT_DEDUPE_KEYS : MAX_STORED_DEDUPE_KEYS;

  const persisted = readDedupeKeys(storage, storageKey);
  if (persisted.includes(dedupeKey)) {
    memSet.add(dedupeKey);
    return true;
  }

  memSet.add(dedupeKey);
  if (typeof window !== 'undefined') {
    const nextKeys = [...persisted, dedupeKey].slice(-maxKeys);
    safeStorageSet(storage, storageKey, JSON.stringify(nextKeys));
  }
  return false;
}

export interface TrackGameEventOptions {
  careerRunId?: string | null;
  dedupeKey?: string;
  /**
   * 'session': 탭 세션 단위 중복 차단 (session_start용)
   * 'persistent': 동일 커리어·동일 시즌의 재진입/새로고침/새 탭 중복 차단 (마일스톤용)
   */
  dedupeScope?: 'session' | 'persistent';
}

/**
 * 게임 플레이 통계 이벤트 단일 전송 진입점 (Fire-and-Forget & Fail-Safe)
 * - 네트워크 오류/오프라인/서버 미설정 시에도 게임 진행에 일절 영향을 주지 않으며
 *   사용자에게 어떤 토스트/오류도 노출하지 않습니다.
 */
export function trackGameEvent<E extends AnalyticsEventName>(
  eventName: E,
  payload: AnalyticsEventPayloadMap[E],
  options: TrackGameEventOptions = {}
): void {
  if (typeof window === 'undefined') return;

  try {
    const sessionId = getOrCreateSessionId();
    if (options.dedupeKey) {
      const scope = options.dedupeScope ?? 'session';
      const resolvedKey =
        scope === 'persistent'
          ? options.dedupeKey
          : `${sessionId}:${options.dedupeKey}`;
      if (hasAndMarkDedupeKey(resolvedKey, scope)) {
        return;
      }
    }

    const body: AnalyticsEventRequestBody<E> = {
      event_name: eventName,
      anonymous_id: getOrCreateAnonymousId(),
      session_id: sessionId,
      career_run_id: options.careerRunId ?? null,
      game_version: GAME_VERSION,
      device_type: detectAnalyticsDeviceType(),
      payload,
    };

    const fetchPromise = window.fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'same-origin',
    });

    if (fetchPromise && typeof fetchPromise.catch === 'function') {
      fetchPromise.catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[analytics] 이벤트 전송 실패(게임 영향 없음):', err);
        }
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[analytics] 이벤트 준비 중 예외(무시됨):', err);
    }
  }
}

export interface TrackableCareerStoreSnapshot {
  view: ViewState;
  career: CareerState | null;
  hofList: HallOfFameEntry[];
}

export interface AnalyticsTransitionDispatcher {
  track: <E extends AnalyticsEventName>(
    eventName: E,
    payload: AnalyticsEventPayloadMap[E],
    options?: TrackGameEventOptions
  ) => void;
  resolveCareerRunId: (careerId: string) => string;
}

/**
 * Zustand 스토어 스냅샷 변화에서 마일스톤 이벤트만 정밀하게 추출합니다.
 * - 게임 엔진/세이브 스키마를 수정하지 않고 순수 구독(Observer) 방식으로 동작합니다.
 * - 사용자 자유 입력 선수명(career.name)은 절대 수집하지 않습니다.
 */
export function emitCareerStateTransitionEvents(
  prev: TrackableCareerStoreSnapshot,
  next: TrackableCareerStoreSnapshot,
  dispatcher: AnalyticsTransitionDispatcher = {
    track: trackGameEvent,
    resolveCareerRunId: getOrCreateCareerRunId,
  }
): void {
  const prevCareer = prev.career;
  const nextCareer = next.career;

  // 1. 새 커리어 생성 (초기 하이드레이션과 구분하기 위해 seasonsPlayed===0 & seasonLogs===0 확인)
  if (
    nextCareer &&
    nextCareer.id !== prevCareer?.id &&
    nextCareer.seasonsPlayed === 0 &&
    nextCareer.seasonLogs.length === 0
  ) {
    const careerRunId = dispatcher.resolveCareerRunId(nextCareer.id);
    dispatcher.track(
      'career_created',
      {
        position: nextCareer.primaryPos,
        secondaryPosition: nextCareer.secondaryPos,
        heightCm: nextCareer.heightCm,
        startingLeague: nextCareer.league,
        startingTeamId: nextCareer.team.id,
        startingAge: nextCareer.age,
        growthDna: nextCareer.growthDna ?? null,
        playstyle: nextCareer.playstyle ?? null,
        innateTrait: nextCareer.traits?.[0] ?? null,
        trainingFocus: nextCareer.trainingFocus,
        initialOvr: nextCareer.ovr,
      },
      {
        careerRunId,
        dedupeKey: `career_created:${careerRunId}`,
        dedupeScope: 'persistent',
      }
    );
  }

  // 2. 시즌 완료 (seasonsPlayed가 증가한 정확한 순간)
  if (
    prevCareer &&
    nextCareer &&
    prevCareer.id === nextCareer.id &&
    nextCareer.seasonsPlayed > prevCareer.seasonsPlayed
  ) {
    const careerRunId = dispatcher.resolveCareerRunId(nextCareer.id);
    const latestLog =
      nextCareer.seasonLogs[nextCareer.seasonLogs.length - 1] ?? null;

    const wonChampionship = Boolean(latestLog?.wonChampionship);
    const wonMvp = Boolean(latestLog?.wonMvp);
    const wonFmvp = Boolean(latestLog?.wonFinalsMvp);
    const playoffResult = normalizePlayoffResult(
      latestLog?.playoffResult,
      wonChampionship
    );
    const madePlayoffs = playoffResult !== 'missed';
    const normalizedRole = normalizePlayerRole(latestLog?.role ?? nextCareer.role);
    const injuredGames = Math.max(0, Math.round(latestLog?.injuredGamesMissed ?? 0));
    const hadInjury =
      injuredGames > 0 ||
      (Boolean(latestLog?.injurySeverity) && latestLog?.injurySeverity !== 'NONE');

    dispatcher.track(
      'season_completed',
      {
        league: latestLog?.league ?? nextCareer.league,
        position: nextCareer.primaryPos,
        seasonNumber: latestLog?.seasonNumber ?? nextCareer.seasonsPlayed,
        age: latestLog?.age ?? nextCareer.age,

        wonChampionship,
        wonMvp,
        wonFinalsMvp: wonFmvp,
        allStarSelected: Boolean(latestLog?.allStarSelected),
        awards: extractSeasonAwards(latestLog),

        madePlayoffs,
        playoffResult,
        teamWins: latestLog?.wins ?? 0,
        teamLosses: latestLog?.losses ?? 0,

        overall: nextCareer.ovr,
        seasonOvr: latestLog?.ovr ?? nextCareer.ovr,
        overallDelta: Math.round(nextCareer.ovr - prevCareer.ovr),
        role: normalizedRole,
        isStarter: isStarterRole(normalizedRole),
        mpg: round1(latestLog?.mpg ?? 0),

        gamesPlayed: latestLog?.gp ?? 0,
        ppg: round1(latestLog?.ppg ?? 0),
        rpg: round1(latestLog?.rpg ?? 0),
        apg: round1(latestLog?.apg ?? 0),

        trainingFocus: prevCareer.trainingFocus ?? nextCareer.trainingFocus,
        injuredGames,
        hadInjury,
        contractType: latestLog?.contractType ?? nextCareer.contractType,
        salary: Math.round(latestLog?.salaryEarned ?? nextCareer.annualSalary ?? 0),

        ...buildUpdate110SeasonFields(prevCareer, nextCareer, latestLog),
      },
      {
        careerRunId,
        dedupeKey: `season_completed:${careerRunId}:${nextCareer.seasonsPlayed}`,
        dedupeScope: 'persistent',
      }
    );
  }

  // 3. 리그 승격 / 이적 / 드래프트 / 상무 입대·전역 등 리그 변경
  if (
    prevCareer &&
    nextCareer &&
    prevCareer.id === nextCareer.id &&
    prevCareer.league !== nextCareer.league
  ) {
    const careerRunId = dispatcher.resolveCareerRunId(nextCareer.id);
    const changeReason = inferLeagueChangeReason(prev, next);
    const draftSource = prevCareer.draftResult ?? nextCareer.draftResult;
    const draftPick =
      draftSource?.pickNumber ??
      (nextCareer.draftPedigreePick != null && prevCareer.draftPedigreePick == null
        ? nextCareer.draftPedigreePick
        : null);
    const draftRound =
      draftSource?.round ??
      (nextCareer.draftPedigreeRound != null && prevCareer.draftPedigreeRound == null
        ? nextCareer.draftPedigreeRound
        : null);

    dispatcher.track(
      'league_changed',
      {
        fromLeague: prevCareer.league,
        toLeague: nextCareer.league,
        position: nextCareer.primaryPos,
        seasonNumber: nextCareer.seasonsPlayed,
        seasonYear: nextCareer.seasonYear,
        overall: nextCareer.ovr,
        age: nextCareer.age,
        contractType: nextCareer.contractType,
        changeReason,
        draftPick,
        draftRound,
      },
      {
        careerRunId,
        dedupeKey: `league_changed:${careerRunId}:${nextCareer.seasonsPlayed}:${prevCareer.league}:${nextCareer.league}`,
        dedupeScope: 'persistent',
      }
    );
  }

  // 4. 커리어 종료 / 은퇴 진입
  const enteredRetirement =
    Boolean(nextCareer) &&
    ((!prevCareer?.retirementReason && Boolean(nextCareer?.retirementReason)) ||
      (prev.view !== 'RETIREMENT' && next.view === 'RETIREMENT'));

  if (nextCareer && enteredRetirement) {
    const careerRunId = dispatcher.resolveCareerRunId(nextCareer.id);
    const gp = nextCareer.totals.gp ?? 0;
    const points = nextCareer.totals.points ?? 0;
    const rebounds = nextCareer.totals.rebounds ?? 0;
    const assists = nextCareer.totals.assists ?? 0;
    const legacyTier = nextCareer.legacyEvaluation?.tierId ?? null;
    const retirementReason = nextCareer.retirementReason ?? 'VOLUNTARY_HONOR';
    const hallOfFame =
      legacyTier === 'GOAT' || legacyTier === 'FIRST_BALLOT_HOF';

    dispatcher.track(
      'career_ended',
      {
        position: nextCareer.primaryPos,
        totalSeasons: nextCareer.seasonsPlayed,
        finalLeague: nextCareer.league,
        peakLeague: resolvePeakLeague(nextCareer),
        finalAge: nextCareer.age,
        peakOverall: nextCareer.peakOvr,
        finalOverall: nextCareer.ovr,
        totalGames: gp,

        totalAllLeague: nextCareer.totals.allLeagueSelections ?? 0,
        totalDpoy: nextCareer.totals.dpoys ?? 0,
        totalSixthMan: nextCareer.totals.sixthManAwards ?? 0,
        totalMip: nextCareer.totals.mips ?? 0,
        mvpCount: nextCareer.totals.mvps ?? 0,
        championshipCount: nextCareer.totals.championships ?? 0,
        nbaChampionshipCount: nextCareer.totals.nbaChampionships ?? 0,
        finalsMvpCount: nextCareer.totals.finalsMvps ?? 0,
        allStarCount: nextCareer.totals.allStars ?? 0,
        leagueHonors: buildLeagueHonorsSummary(nextCareer.seasonLogs),

        endingType: legacyTier ?? retirementReason,
        retirementReason,
        legacyTier,
        hallOfFame,
        jerseyRetired: Boolean(nextCareer.legacyEvaluation?.jerseyRetired),
        careerPoints: Math.round(points),
        careerPpg: gp > 0 ? round1(points / gp) : 0,
        careerRpg: gp > 0 ? round1(rebounds / gp) : 0,
        careerApg: gp > 0 ? round1(assists / gp) : 0,
      },
      {
        careerRunId,
        dedupeKey: `career_ended:${careerRunId}`,
        dedupeScope: 'persistent',
      }
    );
  }

  // 5. 커리어 생성 화면 진입 (세션당 1회, 시작 화면 이탈 측정용)
  if (prev.view !== 'CREATE' && next.view === 'CREATE') {
    dispatcher.track(
      'creation_started',
      {
        hasExistingSave: Boolean(nextCareer),
        hofCount: Array.isArray(next.hofList) ? next.hofList.length : 0,
      },
      {
        careerRunId: null,
        dedupeKey: 'creation_started',
        dedupeScope: 'session',
      }
    );
  }

  // 6. 드래프트 결과 확정
  if (
    nextCareer &&
    nextCareer.draftResult &&
    prevCareer?.id === nextCareer.id &&
    prevCareer.draftResult !== nextCareer.draftResult &&
    (prevCareer.draftResult === null ||
      prevCareer.draftResult.draftType !== nextCareer.draftResult.draftType)
  ) {
    const careerRunId = dispatcher.resolveCareerRunId(nextCareer.id);
    const draft = nextCareer.draftResult;
    dispatcher.track(
      'draft_completed',
      {
        draftType: draft.draftType,
        fromLeague: prevCareer.league,
        position: nextCareer.primaryPos,
        age: nextCareer.age,
        overall: nextCareer.ovr,
        pickNumber: draft.pickNumber,
        round: draft.round,
        drafted: draft.pickNumber !== null,
        hasTwoWayOffer: Boolean(draft.twoWayOfferTeam),
        scoutingGrade:
          typeof draft.scoutingGrade === 'number' ? round1(draft.scoutingGrade) : null,
      },
      {
        careerRunId,
        dedupeKey: `draft_completed:${careerRunId}:${nextCareer.seasonsPlayed}:${draft.draftType}`,
        dedupeScope: 'persistent',
      }
    );
  }

  // 7. 진행 중 커리어 중도 초기화 (정상 은퇴 완료 후 홈 복귀는 제외)
  if (
    prevCareer &&
    !prevCareer.retirementReason &&
    prev.view !== 'RETIREMENT' &&
    nextCareer === null
  ) {
    const prevCareerRunId = dispatcher.resolveCareerRunId(prevCareer.id);
    const abandonedRole = normalizePlayerRole(prevCareer.role);
    const hadWonChampionship =
      (prevCareer.totals.championships ?? 0) > 0 ||
      prevCareer.seasonLogs.some((l) => l.wonChampionship);
    const hadWonMvp =
      (prevCareer.totals.mvps ?? 0) > 0 ||
      prevCareer.seasonLogs.some((l) => l.wonMvp);
    const hadWonFmvp =
      (prevCareer.totals.finalsMvps ?? 0) > 0 ||
      prevCareer.seasonLogs.some((l) => l.wonFinalsMvp);

    dispatcher.track(
      'career_reset',
      {
        position: prevCareer.primaryPos,
        abandonedLeague: prevCareer.league,
        abandonedSeason: prevCareer.seasonsPlayed,
        abandonedSeasonYear: prevCareer.seasonYear,
        abandonedAge: prevCareer.age,
        abandonedOverall: prevCareer.ovr,
        abandonedRole,
        wasStarter: isStarterRole(abandonedRole),
        hadWonChampionship,
        hadWonMvp,
        hadWonFmvp,
      },
      {
        careerRunId: prevCareerRunId,
        dedupeKey: `career_reset:${prevCareerRunId}`,
        dedupeScope: 'persistent',
      }
    );
  }
}

export interface SubscribableCareerStore {
  getState: () => TrackableCareerStoreSnapshot;
  subscribe: (
    listener: (
      state: TrackableCareerStoreSnapshot,
      prevState: TrackableCareerStoreSnapshot
    ) => void
  ) => () => void;
  persist?: {
    hasHydrated?: () => boolean;
    onFinishHydration?: (
      fn: (state: TrackableCareerStoreSnapshot) => void
    ) => () => void;
  };
}

/**
 * Zustand 커리어 스토어에 비침투형 마일스톤 통계 트래커를 연결합니다.
 * - persist 하이드레이션 완료 이후에만 활성화되어 기존 세이브 복원을 새 커리어 생성으로 오인하지 않습니다.
 * - React StrictMode의 이중 마운트 환경에서도 session_start가 중복 전송되지 않습니다.
 */
export function attachCareerAnalyticsTracker(
  store: SubscribableCareerStore,
  dispatcher: AnalyticsTransitionDispatcher = {
    track: trackGameEvent,
    resolveCareerRunId: getOrCreateCareerRunId,
  }
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let disposed = false;
  let unsubscribeStore: (() => void) | null = null;
  let unsubscribeHydration: (() => void) | null = null;

  const activate = () => {
    if (disposed || unsubscribeStore) return;

    const initialState = store.getState();
    const initialCareerRunId = initialState.career
      ? dispatcher.resolveCareerRunId(initialState.career.id)
      : null;

    dispatcher.track(
      'session_start',
      {
        hasExistingSave: Boolean(initialState.career),
        currentLeague: initialState.career?.league ?? null,
        currentSeason: initialState.career
          ? initialState.career.seasonsPlayed
          : null,
        seasonYear: initialState.career ? initialState.career.seasonYear : null,
        hofCount: Array.isArray(initialState.hofList)
          ? initialState.hofList.length
          : 0,
        displayMode: detectDisplayMode(),
      },
      {
        careerRunId: initialCareerRunId,
        dedupeKey: 'session_start',
        dedupeScope: 'session',
      }
    );

    unsubscribeStore = store.subscribe((next, prev) => {
      try {
        emitCareerStateTransitionEvents(prev, next, dispatcher);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[analytics] 상태 구독 처리 중 예외(무시됨):', err);
        }
      }
    });
  };

  try {
    const hasHydrated = store.persist?.hasHydrated?.() ?? true;
    if (hasHydrated) {
      activate();
    } else if (store.persist?.onFinishHydration) {
      unsubscribeHydration = store.persist.onFinishHydration(() => {
        activate();
      });
    } else {
      activate();
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[analytics] 트래커 초기화 중 예외(무시됨):', err);
    }
  }

  return () => {
    disposed = true;
    try {
      unsubscribeHydration?.();
    } catch {
      // ignore cleanup error
    }
    try {
      unsubscribeStore?.();
    } catch {
      // ignore cleanup error
    }
    unsubscribeHydration = null;
    unsubscribeStore = null;
  };
}

/**
 * 단위 테스트 전용 메모리 상태 초기화 헬퍼
 */
export function __resetAnalyticsClientMemoryForTest(): void {
  memoryAnonymousId = null;
  memorySessionId = null;
  memoryDedupeSet.clear();
  memoryPersistentDedupeSet.clear();
  memoryCareerRunMap.clear();
}
