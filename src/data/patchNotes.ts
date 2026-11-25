/**
 * 플레이어용 패치노트 (최신 버전이 맨 앞)
 *
 * 작성 원칙 (2026-11-25 결정: 요약 + 체감 방향형)
 * - 새 기능·개선은 플레이어가 체감하는 말로 3~5줄 이내로 적습니다.
 * - 밸런스 변경은 "무엇이 어느 방향으로, 왜" 바뀌었는지만 적고 정확한 수치는 적지 않습니다.
 * - 버그 수정은 한 줄씩 적습니다.
 * - 기존 세이브에 영향이 있는 변경(마이그레이션)은 saveImpact에 반드시 따로 적습니다.
 * - 새 버전을 낼 때는 src/config/appMeta.ts의 GAME_VERSION과 package.json version을 함께 올립니다.
 */

export interface PatchNoteBalanceChange {
  /** 바뀐 대상 (예: 'NBA 드래프트') */
  target: string;
  /** 체감 방향 */
  direction: 'harder' | 'easier' | 'changed';
  /** 무엇이 어떻게 달라지는지 + 이유 (수치 없이) */
  detail: string;
}

export interface PatchNote {
  version: string;
  /** 배포일 (YYYY-MM-DD) */
  date: string;
  title: string;
  /** 한 문장 요약 */
  summary: string;
  highlights: string[];
  balance?: PatchNoteBalanceChange[];
  fixes?: string[];
  /** 기존 세이브에 영향이 있을 때만 적습니다. */
  saveImpact?: string;
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '1.0.1',
    date: '2026-11-25',
    title: '패치노트를 시작합니다',
    summary:
      '앞으로 게임이 어떻게 바뀌는지 이 페이지에서 안내합니다. 이번 버전은 다음 업데이트를 준비하는 정비 패치입니다.',
    highlights: [
      '화면 아래 버전 표시 옆에 패치노트 링크가 생겼습니다. 새 버전이 나오면 한 번 NEW 표시가 붙습니다.',
      '다음 밸런스 조정을 정확하게 하기 위해 익명 플레이 통계를 정리했습니다. 선수 이름 같은 개인 입력값은 지금처럼 수집하지 않습니다.',
    ],
    fixes: ['플레이 통계에서 일부 선수 역할이 잘못 분류될 수 있던 문제를 고쳤습니다.'],
  },
  {
    version: '1.0.0',
    date: '2026-11-24',
    title: '정식 출시',
    summary:
      '고교 벤치 끝자리에서 NBA MVP와 영구결번까지, 농구 선수 한 명의 커리어를 처음부터 끝까지 키우는 시뮬레이션을 공개했습니다.',
    highlights: [
      '고교·대학·KBL·해외 리그·G리그·NBA를 오가는 커리어와 드래프트',
      '훈련·특별 캠프·퍼스널 케어로 직접 설계하는 성장',
      '플레이오프 대진과 결승 라이브 중계, 클러치 선택',
      '은퇴식, 영구결번, 명예의 전당과 기록집',
    ],
  },
];

export const BALANCE_DIRECTION_LABELS: Record<PatchNoteBalanceChange['direction'], string> = {
  harder: '어려워짐',
  easier: '쉬워짐',
  changed: '달라짐',
};

/** 패치노트 페이지를 마지막으로 확인한 버전을 저장하는 localStorage 키 */
export const PATCH_NOTES_SEEN_STORAGE_KEY = 'road-to-mvp-patch-notes-seen-version';

export const LATEST_PATCH_NOTE: PatchNote = PATCH_NOTES[0];
