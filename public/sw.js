/*
 * 로드 투 MVP 오프라인 캐시 (1.1.4)
 *
 * - 화면(HTML): 네트워크 우선. 인터넷이 되면 항상 최신 화면을 받고, 끊겼을 때만 저장본을 씁니다.
 * - 빌드 파일(/_next/static, 해시 포함)·아이콘·팀 로고·글꼴: 저장본 우선 (파일 이름이 바뀌면 새로 받음).
 * - /api, /admin 은 캐시하지 않습니다 (통계·피드백·관리자 화면은 항상 서버로).
 * - 캐시 이름에 게임 버전이 들어가서, 새 버전이 설치되면 예전 저장본은 지워집니다.
 *   버전은 등록 주소의 ?v= 값으로 받습니다 (src/components/pwa/PwaRegistrar.tsx).
 */

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_PREFIX = 'road-to-mvp-';
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const OFFLINE_FALLBACK_URL = '/';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const FONT_HOST = 'cdn.jsdelivr.net';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 페이지가 이미 불러온 빌드 파일·글꼴 목록을 보내면 미리 저장합니다.
// (첫 방문 때는 서비스 워커가 설치되기 전에 파일을 받아서 따로 넣어줘야 오프라인에서 열립니다.)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'CACHE_URLS' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((url) => typeof url === 'string' && isCacheFirst(new URL(url, self.location.origin)));
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urls.map((url) =>
          cache.match(url).then((hit) => (hit ? undefined : cache.add(url).catch(() => undefined)))
        )
      )
    )
  );
});

function isBypassed(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/api/') ||
      url.pathname === '/admin' ||
      url.pathname.startsWith('/admin/') ||
      url.pathname === '/sw.js')
  );
}

function isCacheFirst(url) {
  if (url.hostname === FONT_HOST) return true;
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/logos/') ||
    url.pathname === '/icon.png' ||
    url.pathname === '/apple-icon.png'
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: isNavigation });
    if (hit) return hit;
    if (isNavigation) {
      const fallback = await cache.match(OFFLINE_FALLBACK_URL);
      if (fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isBypassed(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true));
    return;
  }
  if (isCacheFirst(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, false));
  }
});
