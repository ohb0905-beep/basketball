'use client';

import { useEffect } from 'react';
import { markPatchNotesSeen } from '../../lib/patchNotesSeen';

/** 패치노트 페이지를 열면 현재 버전을 확인한 것으로 기록해 푸터 NEW 배지를 끕니다. */
export function MarkPatchNotesSeen() {
  useEffect(() => {
    markPatchNotesSeen();
  }, []);
  return null;
}
