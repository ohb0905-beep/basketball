import { GAME_VERSION } from '../config/appMeta';
import { PATCH_NOTES_SEEN_STORAGE_KEY } from '../data/patchNotes';

const PATCH_NOTES_SEEN_EVENT = 'road-to-mvp:patch-notes-seen';

/** useSyncExternalStore용 구독: 같은 탭의 확인 기록과 다른 탭의 storage 변경을 모두 감지합니다. */
export function subscribePatchNotesSeen(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PATCH_NOTES_SEEN_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(PATCH_NOTES_SEEN_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * 현재 버전의 패치노트를 아직 확인하지 않았는지 반환합니다.
 * localStorage를 쓸 수 없는 환경(SSR, 시크릿 모드 차단 등)에서는 false를 돌려 배지를 띄우지 않습니다.
 */
export function hasUnseenPatchNotes(currentVersion: string = GAME_VERSION): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PATCH_NOTES_SEEN_STORAGE_KEY) !== currentVersion;
  } catch {
    return false;
  }
}

export function markPatchNotesSeen(currentVersion: string = GAME_VERSION): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PATCH_NOTES_SEEN_STORAGE_KEY, currentVersion);
    window.dispatchEvent(new Event(PATCH_NOTES_SEEN_EVENT));
  } catch {
    // 저장 실패는 무시합니다 (배지가 다시 보일 뿐 게임에는 영향 없음)
  }
}
