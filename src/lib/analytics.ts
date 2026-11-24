'use client';

import { GAME_VERSION } from '../config/appMeta';
import type { CareerState, HallOfFameEntry, ViewState } from '../types/game';
import type {
  AnalyticsDeviceType,
  AnalyticsEventName,
  AnalyticsEventPayloadMap,
  AnalyticsEventRequestBody,
} from './analyticsSchema';

const ANALYTICS_ENDPOINT = '/api/analytics/event';

const ANONYMOUS_ID_STORAGE_KEY = 'road_to_mvp_analytics_anon_id_v1';
const SESSION_ID_STORAGE_KEY = 'road_to_mvp_analytics_session_id_v1';
const DEDUPE_STORAGE_KEY = 'road_to_mvp_analytics_dedupe_v1';
const CAREER_RUN_MAP_STORAGE_KEY = 'road_to_mvp_analytics_career_runs_v1';

const MAX_TRACKED_CAREER_RUNS = 20;
const MAX_STORED_DEDUPE_KEYS = 120;

let memoryAnonymousId: string | null = null;
let memorySessionId: string | null = null;
const memoryDedupeSet = new Set<string>();
const memoryCareerRunMap = new Map<string, string>();

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

function readSessionDedupeKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = safeStorageGet(window.sessionStorage, DEDUPE_STORAGE_KEY);
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

function hasAndMarkDedupeKey(dedupeKey: string): boolean {
  if (memoryDedupeSet.has(dedupeKey)) {
    return true;
  }

  const persisted = readSessionDedupeKeys();
  if (persisted.includes(dedupeKey)) {
    memoryDedupeSet.add(dedupeKey);
    return true;
  }

  memoryDedupeSet.add(dedupeKey);
  if (typeof window !== 'undefined') {
    const nextKeys = [...persisted, dedupeKey].slice(-MAX_STORED_DEDUPE_KEYS);
    safeStorageSet(
      window.sessionStorage,
      DEDUPE_STORAGE_KEY,
      JSON.stringify(nextKeys)
    );
  }
  return false;
}

export interface TrackGameEventOptions {
  careerRunId?: string | null;
  dedupeKey?: string;
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
      const scopedKey = `${sessionId}:${options.dedupeKey}`;
      if (hasAndMarkDedupeKey(scopedKey)) {
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
        growthDna: nextCareer.growthDna ?? null,
        playstyle: nextCareer.playstyle ?? null,
        innateTrait: nextCareer.traits?.[0] ?? null,
        initialOvr: nextCareer.ovr,
      },
      {
        careerRunId,
        dedupeKey: `career_created:${careerRunId}`,
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

    dispatcher.track(
      'season_completed',
      {
        seasonNumber: latestLog?.seasonNumber ?? nextCareer.seasonsPlayed,
        seasonYear: latestLog?.year ?? nextCareer.seasonYear,
        league: latestLog?.league ?? nextCareer.league,
        teamName:
          latestLog?.teamShortName ||
          latestLog?.teamName ||
          nextCareer.team.shortName ||
          nextCareer.team.name,
        overall: nextCareer.ovr,
        seasonOvr: latestLog?.ovr ?? nextCareer.ovr,
        age: latestLog?.age ?? nextCareer.age,
        gamesPlayed: latestLog?.gp ?? 0,
        ppg: latestLog?.ppg ?? 0,
        rpg: latestLog?.rpg ?? 0,
        apg: latestLog?.apg ?? 0,
        wonChampionship: Boolean(latestLog?.wonChampionship),
        wonMvp: Boolean(latestLog?.wonMvp),
        wonFinalsMvp: Boolean(latestLog?.wonFinalsMvp),
        allStarSelected: Boolean(latestLog?.allStarSelected),
      },
      {
        careerRunId,
        dedupeKey: `season_completed:${careerRunId}:${nextCareer.seasonsPlayed}`,
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
    dispatcher.track(
      'league_changed',
      {
        fromLeague: prevCareer.league,
        toLeague: nextCareer.league,
        seasonNumber: nextCareer.seasonsPlayed,
        seasonYear: nextCareer.seasonYear,
        overall: nextCareer.ovr,
        age: nextCareer.age,
        contractType: nextCareer.contractType,
      },
      {
        careerRunId,
        dedupeKey: `league_changed:${careerRunId}:${nextCareer.seasonsPlayed}:${prevCareer.league}:${nextCareer.league}`,
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
    dispatcher.track(
      'career_ended',
      {
        totalSeasons: nextCareer.seasonsPlayed,
        finalLeague: nextCareer.league,
        finalAge: nextCareer.age,
        peakOverall: nextCareer.peakOvr,
        finalOverall: nextCareer.ovr,
        totalGames: nextCareer.totals.gp,
        mvpCount: nextCareer.totals.mvps,
        championshipCount: nextCareer.totals.championships,
        nbaChampionshipCount: nextCareer.totals.nbaChampionships,
        finalsMvpCount: nextCareer.totals.finalsMvps,
        allStarCount: nextCareer.totals.allStars,
        retirementReason: nextCareer.retirementReason ?? 'VOLUNTARY_HONOR',
        legacyTier: nextCareer.legacyEvaluation?.tierId ?? null,
        jerseyRetired: Boolean(nextCareer.legacyEvaluation?.jerseyRetired),
      },
      {
        careerRunId,
        dedupeKey: `career_ended:${careerRunId}`,
      }
    );
  }

  // 5. 진행 중 커리어 중도 초기화 (정상 은퇴 완료 후 홈 복귀는 제외)
  if (
    prevCareer &&
    !prevCareer.retirementReason &&
    prev.view !== 'RETIREMENT' &&
    nextCareer === null
  ) {
    const prevCareerRunId = dispatcher.resolveCareerRunId(prevCareer.id);
    dispatcher.track(
      'career_reset',
      {
        abandonedLeague: prevCareer.league,
        abandonedSeason: prevCareer.seasonsPlayed,
        abandonedSeasonYear: prevCareer.seasonYear,
        abandonedAge: prevCareer.age,
        abandonedOverall: prevCareer.ovr,
      },
      {
        careerRunId: prevCareerRunId,
        dedupeKey: `career_reset:${prevCareerRunId}`,
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
      },
      {
        careerRunId: initialCareerRunId,
        dedupeKey: 'session_start',
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
  memoryCareerRunMap.clear();
}
