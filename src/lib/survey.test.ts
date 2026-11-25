import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURVEY_QUESTIONS,
  SURVEY_SEEN_STORAGE_KEY,
  buildSurveyResponsePayload,
  formatSurveyAnswersForFeedback,
  hasSeenSurvey,
  isSurveyComplete,
  markSurveySeen,
} from './survey';
import { validateAnalyticsEventPayload } from './analyticsSchema';
import type { CareerState, SeasonBoxScore } from '../types/game';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

function career(logs: Partial<SeasonBoxScore>[], overrides: Partial<CareerState> = {}): CareerState {
  return {
    id: 'c1',
    name: '비공개 이름',
    league: 'NBA',
    seasonsPlayed: logs.length,
    militaryExempt: true,
    retirementReason: 'VOLUNTARY_HONOR',
    totals: { nbaChampionships: 1 },
    seasonLogs: logs as SeasonBoxScore[],
    ...overrides,
  } as unknown as CareerState;
}

const sampleCareer = career([
  { league: 'HIGH_SCHOOL', playoffResult: '' },
  { league: 'HIGH_SCHOOL', playoffResult: '' },
  { league: 'KBL', playoffResult: '4강' },
  { league: 'EUROLEAGUE', playoffResult: 'PO 탈락' },
  { league: 'NBA', playoffResult: 'PO 탈락' },
  { league: 'NBA', playoffResult: '1R 탈락' },
  { league: 'NBA', playoffResult: '', wonChampionship: true },
]);

test('1.1.2 설문은 병역·NBA 진출·NBA PO·KBL/해외·고교 속도 5문항이고 "못 겪어봄" 보기가 없다', () => {
  assert.deepEqual(
    SURVEY_QUESTIONS.map((q) => q.id),
    ['militaryExemption', 'nbaEntry', 'nbaPlayoffs', 'kblOverseas', 'hsPacing']
  );
  assert.equal(SURVEY_QUESTIONS[2].title, 'NBA 플레이오프는 어땠나요?');
  for (const q of SURVEY_QUESTIONS) {
    assert.equal(q.options.length, 5);
    assert.ok(!q.options.some((o) => o.label.includes('못 겪')));
  }
});

test('1.1.2 설문 응답 payload에 실제 커리어 경험이 담기고 개인 입력값은 빠진다', () => {
  const answers = { militaryExemption: 4, nbaEntry: 3, nbaPlayoffs: 5, kblOverseas: 2, hsPacing: 1 } as const;
  assert.equal(isSurveyComplete({ ...answers, hsPacing: undefined }), false);
  assert.equal(isSurveyComplete(answers), true);

  const payload = buildSurveyResponsePayload({
    career: sampleCareer,
    status: 'submitted',
    answers,
    hasComment: true,
  });
  assert.equal(payload.nbaPlayoffsRating, 5);
  assert.equal(payload.hsPacingRating, 1);
  assert.equal(payload.hasComment, true);
  assert.equal(payload.reachedNba, true);
  assert.equal(payload.nbaSeasons, 3);
  assert.equal(payload.nbaPlayoffSeasons, 2);
  assert.equal(payload.nbaChampionships, 1);
  assert.equal(payload.kblSeasons, 1);
  assert.equal(payload.overseasSeasons, 1);
  assert.equal(payload.highSchoolSeasons, 2);
  assert.equal(payload.militaryExempt, true);
  assert.ok(!JSON.stringify(payload).includes('비공개 이름'));

  const validated = validateAnalyticsEventPayload({
    event_name: 'survey_response',
    anonymous_id: 'anon-1',
    session_id: 'sess-1',
    game_version: '1.1.2',
    payload,
  });
  assert.equal(validated.ok, true);

  const skipped = buildSurveyResponsePayload({
    career: sampleCareer,
    status: 'skipped',
    answers,
    hasComment: true,
  });
  assert.equal(skipped.nbaEntryRating, null);
  assert.equal(skipped.hasComment, false);

  assert.match(formatSurveyAnswersForFeedback(answers), /NBA 플레이오프는 어땠나요\? 너무 어려움/);
});

test('1.1.2 설문은 한 번 띄우면 같은 브라우저에서 다시 띄우지 않는다', () => {
  const storage = memoryStorage();
  assert.equal(hasSeenSurvey(storage), false);
  markSurveySeen(storage);
  assert.equal(hasSeenSurvey(storage), true);
  assert.equal(storage.getItem(SURVEY_SEEN_STORAGE_KEY), '1');
  // 저장소를 쓸 수 없어도 오류 없이 동작
  assert.equal(hasSeenSurvey(null), false);
  markSurveySeen(null);
});
