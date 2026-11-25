import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCardFileName,
  detectShareSupport,
  parseUnicodeRange,
  textNeedsFontFace,
} from './careerCardExport';

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

test('parseUnicodeRange: 단일·범위·와일드카드를 구간으로 바꾼다', () => {
  assert.deepEqual(parseUnicodeRange('U+0000-00FF, U+0131, U+4??'), [
    [0x0, 0xff],
    [0x131, 0x131],
    [0x400, 0x4ff],
  ]);
  assert.deepEqual(parseUnicodeRange(''), [[0, 0x10ffff]]);
});

test('textNeedsFontFace: 카드 글자가 구간에 하나라도 있으면 true', () => {
  const ranges = parseUnicodeRange('U+AC00-AC7F');
  assert.equal(textNeedsFontFace('가나', ranges), true); // 가 = U+AC00
  assert.equal(textNeedsFontFace('abc', ranges), false);
});
