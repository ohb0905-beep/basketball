import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCardFileName, detectShareSupport } from './careerCardExport';

const file = new File([new Uint8Array([1])], 'card.png', { type: 'image/png' });

test('buildCardFileName: 공백·금지 문자는 -로, 빈 이름은 career', () => {
  assert.equal(buildCardFileName('홍 길동'), 'road-to-mvp-홍-길동.png');
  assert.equal(buildCardFileName('a/b'), 'road-to-mvp-a-b.png');
  assert.equal(buildCardFileName(''), 'road-to-mvp-career.png');
});

test('detectShareSupport: 파일 공유를 지원할 때만 files', () => {
  assert.equal(detectShareSupport(undefined, file), 'none');
  assert.equal(detectShareSupport({ share: async () => {} } as never, file), 'none');
  assert.equal(
    detectShareSupport({ share: async () => {}, canShare: () => false } as never, file),
    'none'
  );
  assert.equal(
    detectShareSupport({ share: async () => {}, canShare: () => true } as never, file),
    'files'
  );
});
