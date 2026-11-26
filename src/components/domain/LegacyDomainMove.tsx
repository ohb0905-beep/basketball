'use client';

import { useEffect } from 'react';
import { detectDisplayMode } from '../../lib/pwa';
import {
  MAX_MOVE_HASH_LENGTH,
  MOVE_STAY_SESSION_KEY,
  NEW_SITE_ORIGIN,
  buildMoveUrl,
  collectMovePayload,
  encodeMovePayload,
  isLegacyHost,
  isMovablePath,
} from '../../lib/domainMove';

/** 예전 주소에서 화면을 잠깐 가리는 표시 (app/layout.tsx 의 머리 스크립트가 붙입니다) */
export const DOMAIN_MOVE_PENDING_ATTR = 'data-domain-move';

function clearPending() {
  document.documentElement.removeAttribute(DOMAIN_MOVE_PENDING_ATTR);
}

/**
 * 1.3.1 예전 주소(roadtomvp.vercel.app)로 들어오면 세이브를 챙겨 새 주소로 옮깁니다.
 * - 세이브가 없으면 같은 경로의 새 주소로 바로 넘어갑니다.
 * - 오프라인이거나 주소가 너무 길어지면 옮기지 않고 예전 주소에서 계속 플레이합니다.
 * - ?stay=1 로 열면 이번 탭에서는 옮기지 않습니다 (가져오기 실패 시 돌아오는 길).
 * 화면에는 아무것도 그리지 않습니다.
 */
export function LegacyDomainMove() {
  useEffect(() => {
    const { hostname, pathname, search, hash } = window.location;
    if (!isLegacyHost(hostname) || !isMovablePath(pathname)) {
      clearPending();
      return;
    }

    try {
      const params = new URLSearchParams(search);
      if (params.get('stay') === '1') window.sessionStorage.setItem(MOVE_STAY_SESSION_KEY, '1');
      if (window.sessionStorage.getItem(MOVE_STAY_SESSION_KEY) === '1') {
        clearPending();
        return;
      }
    } catch {
      // sessionStorage를 못 쓰면 그냥 진행합니다.
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      clearPending();
      return;
    }

    let cancelled = false;
    const returnPath = `${pathname}${search}`;

    (async () => {
      let payload = null;
      try {
        payload = collectMovePayload(window.localStorage, {
          from: hostname,
          standalone: detectDisplayMode() === 'standalone',
        });
      } catch {
        payload = null;
      }

      if (!payload) {
        if (!cancelled) window.location.replace(`${NEW_SITE_ORIGIN}${returnPath}${hash}`);
        return;
      }

      const encoded = await encodeMovePayload(payload);
      if (cancelled) return;
      if (encoded.length > MAX_MOVE_HASH_LENGTH) {
        clearPending();
        return;
      }
      window.location.replace(buildMoveUrl(encoded, returnPath));
    })().catch(() => clearPending());

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
