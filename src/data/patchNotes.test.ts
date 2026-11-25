import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_VERSION } from '../config/appMeta';
import { LATEST_PATCH_NOTE, PATCH_NOTES } from './patchNotes';

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

test('최신 패치노트는 현재 GAME_VERSION과 같아야 한다 (버전을 올리면 노트도 함께 작성)', () => {
  assert.equal(LATEST_PATCH_NOTE.version, GAME_VERSION);
});

test('패치노트는 버전 내림차순이고, 버전과 날짜 형식이 올바르다', () => {
  for (let i = 0; i < PATCH_NOTES.length; i += 1) {
    const note = PATCH_NOTES[i];
    assert.match(note.version, /^\d+\.\d+\.\d+$/);
    assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(note.title.trim().length > 0);
    assert.ok(note.summary.trim().length > 0);
    if (i > 0) {
      assert.ok(
        compareSemver(PATCH_NOTES[i - 1].version, note.version) > 0,
        `${PATCH_NOTES[i - 1].version}가 ${note.version}보다 앞에 와야 합니다`
      );
      assert.ok(PATCH_NOTES[i - 1].date >= note.date);
    }
  }
});

test('밸런스 항목에는 정확한 수치(%)를 적지 않는다 (요약 + 체감 방향형 원칙)', () => {
  for (const note of PATCH_NOTES) {
    for (const change of note.balance ?? []) {
      assert.equal(/\d+(\.\d+)?\s*%/.test(change.detail), false, change.detail);
    }
  }
});
