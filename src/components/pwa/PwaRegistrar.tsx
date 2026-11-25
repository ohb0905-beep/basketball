'use client';

import { useEffect } from 'react';
import { GAME_VERSION } from '../../config/appMeta';
import {
  BeforeInstallPromptEvent,
  collectLoadedAssetUrls,
  setDeferredInstallPrompt,
} from '../../lib/pwa';

/**
 * 서비스 워커 등록 + 설치 프롬프트 보관 (화면에는 아무것도 그리지 않음)
 * - 개발 서버에서는 등록하지 않습니다 (캐시 때문에 수정이 안 보이는 일을 막기 위해).
 */
export function PwaRegistrar() {
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferredInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register(`/sw.js?v=${encodeURIComponent(GAME_VERSION)}`, { scope: '/' })
          .then(() => navigator.serviceWorker.ready)
          .then((registration) => {
            registration.active?.postMessage({
              type: 'CACHE_URLS',
              urls: collectLoadedAssetUrls(),
            });
          })
          .catch(() => {
            // 등록 실패해도 게임은 그대로 동작합니다.
          });
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return null;
}
