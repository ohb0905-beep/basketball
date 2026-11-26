/**
 * 1.3.1 새 주소(roadtomvp.com)로 이사하기
 *
 * 세이브는 브라우저 저장소(localStorage)에 주소(출처)별로 따로 저장됩니다.
 * 그래서 예전 주소(roadtomvp.vercel.app)의 세이브는 새 주소에서 보이지 않습니다.
 *
 * 흐름
 * 1. 예전 주소에서 페이지를 열면 세이브를 묶어(압축) 새 주소의 /move 로 보냅니다.
 *    세이브는 주소의 # 뒤(fragment)에 실려서 서버로는 전송되지 않습니다.
 * 2. 새 주소의 /move 가 세이브를 풀어서 저장한 뒤 게임 화면으로 이동합니다.
 *    새 주소에 이미 다른 세이브가 있으면 어느 쪽을 쓸지 묻습니다.
 * 3. 예전 주소는 지우지 않고 그대로 둡니다 (세이브도 지우지 않음).
 *
 * 브라우저 API는 인자로 받는 순수 함수 위주로 작성해 테스트할 수 있게 했습니다.
 */

import { PATCH_NOTES_SEEN_STORAGE_KEY } from '../data/patchNotes';
import { SURVEY_SEEN_STORAGE_KEY } from './survey';

/** 새 정식 주소 (Vercel 설정: roadtomvp.com → www.roadtomvp.com 으로 넘겨줌) */
export const NEW_SITE_ORIGIN = 'https://www.roadtomvp.com';

/** 이사를 시작하는 예전 주소 (미리보기 배포 주소는 넣지 않습니다) */
export const LEGACY_HOSTS: readonly string[] = ['roadtomvp.vercel.app'];

/** 커리어 세이브 (zustand persist 이름과 같아야 합니다: src/store/useCareerStore.ts) */
export const CAREER_SAVE_KEY = 'bench-to-mvp-career-storage-v1';

/**
 * 함께 옮기는 저장 값. 커리어 세이브 말고는 새 주소에 값이 없을 때만 채웁니다.
 * - 설치 안내 닫힘 기록은 옮기지 않습니다 (새 주소에서 앱을 다시 설치해야 하므로 안내가 다시 보여야 함).
 * - 로고 캐시, 분석 세션·중복 방지 값은 새로 만들어도 되므로 옮기지 않습니다.
 */
export const CARRIED_STORAGE_KEYS: readonly string[] = [
  CAREER_SAVE_KEY,
  'bench_to_mvp_theme',
  PATCH_NOTES_SEEN_STORAGE_KEY,
  'road_to_mvp_analytics_anon_id_v1',
  'road_to_mvp_analytics_career_runs_v1',
  'road_to_mvp_analytics_milestone_dedupe_v1',
  'road_to_mvp_analytics_source_v1',
  SURVEY_SEEN_STORAGE_KEY,
];

/** 새 주소에서 이미 처리(가져오기/거절)한 이사 묶음의 지문. 같은 묶음이 또 오면 묻지 않습니다. */
export const MOVE_RESOLVED_KEY = 'road-to-mvp-domain-move-resolved';
/** 예전 주소에서 이번 탭 동안 이사를 멈추는 표시 (sessionStorage, ?stay=1) */
export const MOVE_STAY_SESSION_KEY = 'road-to-mvp-domain-move-stay';

/** 주소 길이가 이보다 길면 이사를 시도하지 않고 예전 주소에서 계속 플레이합니다. */
export const MAX_MOVE_HASH_LENGTH = 1_500_000;

export interface MovePayload {
  v: 1;
  /** 묶은 시각 (ISO) */
  at: string;
  /** 예전 주소 호스트 */
  from: string;
  /** 홈 화면 앱(PWA)으로 실행 중이었는지 */
  standalone: boolean;
  items: Record<string, string>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isLegacyHost(hostname: string): boolean {
  return LEGACY_HOSTS.includes(hostname.toLowerCase());
}

/** 이사 대상 경로인지 (관리자 화면·API는 예전 주소에서 그대로 씁니다) */
export function isMovablePath(pathname: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return false;
  if (pathname.startsWith('/api/')) return false;
  return true;
}

/** /move 이후 이동할 경로. 다른 사이트로 넘어가는 주소는 막고 '/' 로 바꿉니다. */
export function sanitizeReturnPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/move')) return '/';
  return raw;
}

export function collectMovePayload(
  storage: StorageLike,
  meta: { from: string; standalone: boolean; now?: Date }
): MovePayload | null {
  const items: Record<string, string> = {};
  for (const key of CARRIED_STORAGE_KEYS) {
    try {
      const value = storage.getItem(key);
      if (typeof value === 'string' && value.length > 0) items[key] = value;
    } catch {
      // 읽을 수 없는 값은 건너뜁니다.
    }
  }
  if (!items[CAREER_SAVE_KEY]) return null;
  return {
    v: 1,
    at: (meta.now ?? new Date()).toISOString(),
    from: meta.from,
    standalone: meta.standalone,
    items,
  };
}

// ---------- 인코딩 (압축 + base64url) ----------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function hasCompression(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

/**
 * 묶음을 주소에 넣을 문자열로 바꿉니다.
 * 'z' + 압축본, 압축을 못 쓰는 오래된 브라우저는 'j' + 원문.
 */
export async function encodeMovePayload(payload: MovePayload): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  if (hasCompression()) {
    try {
      const compressed = await pipeThrough(raw, new CompressionStream('deflate-raw'));
      return `z${bytesToBase64Url(compressed)}`;
    } catch {
      // 압축 실패 시 원문으로
    }
  }
  return `j${bytesToBase64Url(raw)}`;
}

/** 주소에서 받은 문자열을 묶음으로 풉니다. 형식이 맞지 않으면 null. */
export async function decodeMovePayload(encoded: string): Promise<MovePayload | null> {
  if (!encoded || encoded.length < 2) return null;
  try {
    const kind = encoded[0];
    let bytes = base64UrlToBytes(encoded.slice(1));
    if (kind === 'z') {
      if (!hasCompression()) return null;
      bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind !== 'j') {
      return null;
    }
    return validateMovePayload(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

/** 받은 묶음에서 정해진 저장 키·문자열 값만 남깁니다 (임의 값 저장 방지). */
export function validateMovePayload(input: unknown): MovePayload | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  if (obj.v !== 1 || !obj.items || typeof obj.items !== 'object') return null;
  const items: Record<string, string> = {};
  for (const key of CARRIED_STORAGE_KEYS) {
    const value = (obj.items as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.length > 0) items[key] = value;
  }
  const career = items[CAREER_SAVE_KEY];
  if (!career) return null;
  try {
    const parsed = JSON.parse(career);
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return null;
  } catch {
    return null;
  }
  return {
    v: 1,
    at: typeof obj.at === 'string' ? obj.at : '',
    from: typeof obj.from === 'string' ? obj.from : '',
    standalone: obj.standalone === true,
    items,
  };
}

/** 이사 묶음 지문 (같은 세이브가 다시 왔는지 확인용, 보안용 아님) */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

// ---------- 새 주소에서 가져오기 ----------

export interface CareerSaveSummary {
  playerName: string | null;
  age: number | null;
  seasonYear: number | null;
  teamName: string | null;
  hallOfFameCount: number;
}

/** 세이브 원문에서 선택 화면에 보여 줄 요약을 뽑습니다. 진행 중 커리어도, 명예의 전당도 없으면 null. */
export function summarizeCareerSave(raw: string | null | undefined): CareerSaveSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const state = parsed?.state ?? {};
    const career = (state.career ?? null) as Record<string, unknown> | null;
    const hofList = Array.isArray(state.hofList) ? state.hofList : [];
    if (!career && hofList.length === 0) return null;
    const team = (career?.team ?? null) as Record<string, unknown> | null;
    return {
      playerName: typeof career?.name === 'string' ? career.name : null,
      age: typeof career?.age === 'number' ? career.age : null,
      seasonYear: typeof career?.seasonYear === 'number' ? career.seasonYear : null,
      teamName: typeof team?.name === 'string' ? team.name : null,
      hallOfFameCount: hofList.length,
    };
  } catch {
    return null;
  }
}

export type MoveDecision =
  /** 새 주소에 세이브가 없거나 같은 세이브 → 묻지 않고 가져옴 */
  | { kind: 'import' }
  /** 이미 처리한 묶음 → 아무것도 하지 않음 */
  | { kind: 'skip' }
  /** 새 주소에 다른 세이브가 있음 → 사용자에게 물어봄 */
  | { kind: 'ask'; incoming: CareerSaveSummary | null; existing: CareerSaveSummary };

export function decideMove(payload: MovePayload, storage: StorageLike): MoveDecision {
  const incomingRaw = payload.items[CAREER_SAVE_KEY];
  const resolved = safeGet(storage, MOVE_RESOLVED_KEY);
  if (resolved && resolved === fingerprint(incomingRaw)) return { kind: 'skip' };
  const existingRaw = safeGet(storage, CAREER_SAVE_KEY);
  if (existingRaw === incomingRaw) return { kind: 'skip' };
  const existing = summarizeCareerSave(existingRaw);
  if (!existing) return { kind: 'import' };
  return { kind: 'ask', incoming: summarizeCareerSave(incomingRaw), existing };
}

/**
 * 묶음을 새 주소 저장소에 씁니다.
 * - useIncoming=true: 커리어 세이브를 옮겨 온 것으로 바꿉니다.
 * - 나머지 값(테마, 분석 익명 id 등)은 새 주소에 값이 없을 때만 채웁니다.
 * - 처리한 묶음의 지문을 남겨 같은 묶음이 다시 와도 묻지 않습니다.
 */
export function applyMovePayload(payload: MovePayload, storage: StorageLike, useIncoming: boolean): void {
  const incomingRaw = payload.items[CAREER_SAVE_KEY];
  for (const [key, value] of Object.entries(payload.items)) {
    if (key === CAREER_SAVE_KEY) continue;
    if (safeGet(storage, key) === null) storage.setItem(key, value);
  }
  if (useIncoming) storage.setItem(CAREER_SAVE_KEY, incomingRaw);
  storage.setItem(MOVE_RESOLVED_KEY, fingerprint(incomingRaw));
}

/** 예전 주소에서 보낼 /move 주소 */
export function buildMoveUrl(encoded: string, returnPath: string): string {
  const to = sanitizeReturnPath(returnPath);
  const query = to === '/' ? '' : `?to=${encodeURIComponent(to)}`;
  return `${NEW_SITE_ORIGIN}/move${query}#d=${encoded}`;
}

/** /move 주소의 # 부분에서 묶음 문자열을 꺼냅니다. */
export function readEncodedFromHash(hash: string): string | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!text.startsWith('d=')) return null;
  const value = text.slice(2);
  return value.length > 0 ? value : null;
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
