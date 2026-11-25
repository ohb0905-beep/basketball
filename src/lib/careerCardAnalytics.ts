/**
 * 1.3.0 커리어 카드 저장·공유 통계
 * - 저장이 시작됐거나 공유에 성공했을 때만 부릅니다 (취소·미지원·로고 실패는 보내지 않음).
 * - 성공할 때마다 한 번씩 세므로 중복 차단 키를 쓰지 않습니다.
 */
import { trackGameEvent } from './analytics';
import type { CareerCardSharedPayload } from './analyticsSchema';
import type { CareerRetrospective } from '../types/game';

export function buildCareerCardSharedPayload(
  retro: CareerRetrospective,
  action: 'save' | 'share',
  isReplay: boolean
): CareerCardSharedPayload {
  return {
    action,
    legacyTierId: retro.legacyTierId,
    seasonsPlayed: retro.seasonsPlayed,
    reachedNba: retro.totals.nbaGp > 0,
    isReplay,
  };
}

export function trackCareerCardShared(
  retro: CareerRetrospective,
  action: 'save' | 'share',
  isReplay: boolean
): void {
  trackGameEvent('career_card_shared', buildCareerCardSharedPayload(retro, action, isReplay));
}
