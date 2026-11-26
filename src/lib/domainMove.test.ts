import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CAREER_SAVE_KEY,
  CARRIED_STORAGE_KEYS,
  MOVE_RESOLVED_KEY,
  NEW_SITE_ORIGIN,
  applyMovePayload,
  buildMoveUrl,
  collectMovePayload,
  decideMove,
  decodeMovePayload,
  encodeMovePayload,
  isLegacyHost,
  isMovablePath,
  readEncodedFromHash,
  sanitizeReturnPath,
  summarizeCareerSave,
  validateMovePayload,
} from './domainMove';

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

function careerSave(name: string, age: number, hof = 0) {
  return JSON.stringify({
    state: {
      career: { name, age, seasonYear: 2030, team: { name: '삼일상고' }, seasonLogs: Array.from({ length: 30 }, (_, i) => ({ i, note: '시즌 기록'.repeat(20) })) },
      hofList: Array.from({ length: hof }, (_, i) => ({ id: `h${i}` })),
    },
    version: 0,
  });
}

const OLD_THEME = 'bench_to_mvp_theme';
const ANON_ID = 'road_to_mvp_analytics_anon_id_v1';

test('1.3.1 예전 주소만 이사를 시작하고, 관리자·API 경로는 옮기지 않는다', () => {
  assert.equal(isLegacyHost('roadtomvp.vercel.app'), true);
  assert.equal(isLegacyHost('RoadToMVP.vercel.app'), true);
  assert.equal(isLegacyHost('roadtomvp-git-main-team.vercel.app'), false);
  assert.equal(isLegacyHost('www.roadtomvp.com'), false);
  assert.equal(isMovablePath('/'), true);
  assert.equal(isMovablePath('/patch-notes'), true);
  assert.equal(isMovablePath('/admin'), false);
  assert.equal(isMovablePath('/admin/feedback'), false);
  assert.equal(isMovablePath('/api/analytics/event'), false);
});

test('1.3.1 이동할 경로는 같은 사이트 안으로만 허용한다', () => {
  assert.equal(sanitizeReturnPath('/patch-notes'), '/patch-notes');
  assert.equal(sanitizeReturnPath('/?autostart=1'), '/?autostart=1');
  assert.equal(sanitizeReturnPath('https://evil.example'), '/');
  assert.equal(sanitizeReturnPath('//evil.example'), '/');
  assert.equal(sanitizeReturnPath('/\\evil.example'), '/');
  assert.equal(sanitizeReturnPath('/move'), '/');
  assert.equal(sanitizeReturnPath(null), '/');
});

test('1.3.1 세이브가 없으면 묶지 않고, 있으면 정해진 값만 묶는다', () => {
  assert.equal(collectMovePayload(memoryStorage({ [OLD_THEME]: 'dark' }), { from: 'x', standalone: false }), null);

  const storage = memoryStorage({
    [CAREER_SAVE_KEY]: careerSave('홍길동', 19),
    [OLD_THEME]: 'dark',
    [ANON_ID]: 'anon-123',
    'road-to-mvp-install-guide-dismissed': '1',
    unrelated: 'x',
  });
  const payload = collectMovePayload(storage, { from: 'roadtomvp.vercel.app', standalone: true });
  assert.ok(payload);
  assert.deepEqual(Object.keys(payload.items).sort(), [ANON_ID, CAREER_SAVE_KEY, OLD_THEME].sort());
  assert.equal(payload.standalone, true);
});

test('1.3.1 묶음은 압축해 주소에 넣었다가 그대로 풀린다', async () => {
  const storage = memoryStorage({ [CAREER_SAVE_KEY]: careerSave('홍길동', 19, 2), [OLD_THEME]: 'light' });
  const payload = collectMovePayload(storage, { from: 'roadtomvp.vercel.app', standalone: false })!;
  const encoded = await encodeMovePayload(payload);
  assert.match(encoded, /^[zj][A-Za-z0-9_-]+$/);
  assert.ok(encoded.length < payload.items[CAREER_SAVE_KEY].length, '압축되어 원문보다 짧아야 함');

  const url = buildMoveUrl(encoded, '/patch-notes');
  assert.ok(url.startsWith(`${NEW_SITE_ORIGIN}/move?to=%2Fpatch-notes#d=`));
  const hash = url.slice(url.indexOf('#'));
  const decoded = await decodeMovePayload(readEncodedFromHash(hash)!);
  assert.deepEqual(decoded, payload);
});

test('1.3.1 깨지거나 조작된 묶음은 받지 않고, 허용되지 않은 값은 버린다', async () => {
  assert.equal(await decodeMovePayload('zzzz-not-valid'), null);
  assert.equal(await decodeMovePayload('xabc'), null);
  assert.equal(readEncodedFromHash('#other=1'), null);
  assert.equal(validateMovePayload({ v: 1, items: { [CAREER_SAVE_KEY]: 'not json' } }), null);
  assert.equal(validateMovePayload({ v: 2, items: { [CAREER_SAVE_KEY]: careerSave('a', 1) } }), null);

  const cleaned = validateMovePayload({
    v: 1,
    at: '2026-11-26T00:00:00.000Z',
    from: 'roadtomvp.vercel.app',
    standalone: false,
    items: { [CAREER_SAVE_KEY]: careerSave('a', 16), 'admin-token': 'x', [OLD_THEME]: 42 },
  });
  assert.ok(cleaned);
  assert.deepEqual(Object.keys(cleaned.items), [CAREER_SAVE_KEY]);
});

test('1.3.1 새 주소에 세이브가 없으면 바로 가져오고, 다른 세이브가 있으면 묻는다', () => {
  const incoming = careerSave('홍길동', 22, 1);
  const payload = validateMovePayload({ v: 1, items: { [CAREER_SAVE_KEY]: incoming, [OLD_THEME]: 'dark', [ANON_ID]: 'old-anon' } })!;

  const empty = memoryStorage();
  assert.equal(decideMove(payload, empty).kind, 'import');
  applyMovePayload(payload, empty, true);
  assert.equal(empty.data[CAREER_SAVE_KEY], incoming);
  assert.equal(empty.data[OLD_THEME], 'dark');
  assert.equal(empty.data[ANON_ID], 'old-anon');
  // 같은 묶음이 다시 오면 아무것도 하지 않음
  assert.equal(decideMove(payload, empty).kind, 'skip');

  const other = memoryStorage({ [CAREER_SAVE_KEY]: careerSave('새선수', 15), [ANON_ID]: 'new-anon' });
  const decision = decideMove(payload, other);
  assert.equal(decision.kind, 'ask');
  if (decision.kind === 'ask') {
    assert.equal(decision.incoming?.playerName, '홍길동');
    assert.equal(decision.existing.playerName, '새선수');
  }
  // 이 주소의 기록을 고르면 세이브는 그대로, 비어 있던 값만 채우고 다음엔 묻지 않음
  applyMovePayload(payload, other, false);
  assert.equal(JSON.parse(other.data[CAREER_SAVE_KEY]).state.career.name, '새선수');
  assert.equal(other.data[ANON_ID], 'new-anon');
  assert.equal(other.data[OLD_THEME], 'dark');
  assert.ok(other.data[MOVE_RESOLVED_KEY]);
  assert.equal(decideMove(payload, other).kind, 'skip');
});

test('1.3.1 커리어도 명예의 전당도 없는 세이브는 덮어써도 되는 빈 세이브로 본다', () => {
  const blank = JSON.stringify({ state: { career: null, hofList: [] }, version: 0 });
  assert.equal(summarizeCareerSave(blank), null);
  const payload = validateMovePayload({ v: 1, items: { [CAREER_SAVE_KEY]: careerSave('a', 16) } })!;
  assert.equal(decideMove(payload, memoryStorage({ [CAREER_SAVE_KEY]: blank })).kind, 'import');
  assert.equal(summarizeCareerSave(JSON.stringify({ state: { career: null, hofList: [{}, {}] } }))?.hallOfFameCount, 2);
});

test('1.3.1 옮기는 저장 키가 실제 코드의 키와 같다', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf8');
  assert.ok(read('../store/useCareerStore.ts').includes(`name: '${CAREER_SAVE_KEY}'`));
  assert.ok(read('../hooks/useTheme.ts').includes(`'${OLD_THEME}'`));
  const analytics = read('./analytics.ts');
  for (const key of CARRIED_STORAGE_KEYS.filter((k) => k.startsWith('road_to_mvp_analytics'))) {
    assert.ok(analytics.includes(`'${key}'`), key);
  }
  // 머리 스크립트의 예전 주소·멈춤 키도 같은 값이어야 함
  const layout = read('../../app/layout.tsx');
  assert.ok(layout.includes("'roadtomvp.vercel.app'"));
  assert.ok(layout.includes("'road-to-mvp-domain-move-stay'"));
});
