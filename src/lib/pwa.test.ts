import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  INSTALL_GUIDE_DISMISSED_KEY,
  isInstallGuideDismissed,
  markInstallGuideDismissed,
  resolveInstallGuideKind,
} from './pwa';
import manifest from '../../app/manifest';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

test('1.1.4 설치 안내는 휴대폰 브라우저에서만, 기기별로 다르게 보인다', () => {
  const kind = (userAgent: string, hasInstallPrompt = false, displayMode: 'browser' | 'standalone' = 'browser') =>
    resolveInstallGuideKind({ userAgent, displayMode, hasInstallPrompt });
  assert.equal(kind(ANDROID, true), 'android-prompt');
  assert.equal(kind(ANDROID, false), 'android-menu');
  assert.equal(kind(IPHONE), 'ios');
  assert.equal(kind(DESKTOP, true), null);
  assert.equal(kind(ANDROID, true, 'standalone'), null);
  assert.equal(kind(IPHONE, false, 'standalone'), null);
});

test('1.1.4 설치 안내를 닫으면 기억한다', () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  } as unknown as Storage;
  assert.equal(isInstallGuideDismissed(storage), false);
  markInstallGuideDismissed(storage);
  assert.equal(map.get(INSTALL_GUIDE_DISMISSED_KEY), '1');
  assert.equal(isInstallGuideDismissed(storage), true);
  assert.equal(isInstallGuideDismissed(null), false);
});

test('1.1.4 앱 정보(manifest)와 아이콘 파일이 설치 조건을 갖춘다', () => {
  const m = manifest();
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/');
  const icons = m.icons ?? [];
  for (const size of ['192x192', '512x512']) {
    assert.ok(icons.some((i) => i.sizes === size && i.purpose === 'any'), `${size} 아이콘 필요`);
  }
  assert.ok(icons.some((i) => i.purpose === 'maskable'));
  for (const icon of icons) {
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', icon.src)), `${icon.src} 파일 없음`);
  }
  assert.ok(fs.existsSync(path.join(process.cwd(), 'app/apple-icon.png')));
  assert.ok(fs.existsSync(path.join(process.cwd(), 'app/icon.png')));
});

test('1.1.4 오프라인 캐시는 통계·관리자 요청을 건드리지 않고 버전별로 캐시를 나눈다', () => {
  const sw = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /url\.pathname\.startsWith\('\/admin\/'\)/);
  assert.match(sw, /searchParams\.get\('v'\)/);
  assert.match(sw, /request\.mode === 'navigate'[\s\S]*networkFirst/);
});
