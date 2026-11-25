/**
 * 1.1.2 플레이어 난이도 설문
 *
 * 운영 원칙 (2026-11-25 결정)
 * - 업데이트 후 처음 완주한 커리어의 은퇴 화면에서 한 번만 띄웁니다.
 *   같은 브라우저에서는 응답하든 건너뛰든 다시 띄우지 않습니다 (1인 1회).
 * - 점수 답변은 플레이 통계(survey_response 이벤트)로, 선택 의견 글은 피드백함으로 보냅니다.
 * - 선수 이름 등 개인 입력값은 보내지 않습니다.
 */

import type { CareerState, LeagueId } from '../types/game';
import type { SurveyAnswerValue, SurveyResponsePayload } from './analyticsSchema';
import { normalizePlayoffResult } from './analytics';
import { isHighSchoolLeague } from '../data/leagues';

export const SURVEY_ID = 'difficulty_2026_11';

/** 설문을 이미 띄웠는지 기록하는 localStorage 키 (설문 id별) */
export const SURVEY_SEEN_STORAGE_KEY = `road-to-mvp-survey-seen-${SURVEY_ID}`;

export type SurveyQuestionId =
  | 'militaryExemption'
  | 'nbaEntry'
  | 'nbaPlayoffs'
  | 'kblOverseas'
  | 'hsPacing';

export interface SurveyOption {
  value: SurveyAnswerValue;
  label: string;
}

export interface SurveyQuestion {
  id: SurveyQuestionId;
  title: string;
  options: SurveyOption[];
}

/** 1 = 너무 쉬움 … 5 = 너무 어려움 */
const DIFFICULTY_OPTIONS: SurveyOption[] = [
  { value: 1, label: '너무 쉬움' },
  { value: 2, label: '쉬움' },
  { value: 3, label: '적당함' },
  { value: 4, label: '어려움' },
  { value: 5, label: '너무 어려움' },
];

/** 1 = 너무 지루함(느림) … 5 = 너무 빠름 */
const PACING_OPTIONS: SurveyOption[] = [
  { value: 1, label: '너무 지루함' },
  { value: 2, label: '조금 길다' },
  { value: 3, label: '적당함' },
  { value: 4, label: '조금 짧다' },
  { value: 5, label: '너무 빠름' },
];

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: 'militaryExemption', title: '병역특례 받기는 어땠나요?', options: DIFFICULTY_OPTIONS },
  { id: 'nbaEntry', title: 'NBA 진출은 어땠나요?', options: DIFFICULTY_OPTIONS },
  { id: 'nbaPlayoffs', title: 'NBA 플레이오프는 어땠나요?', options: DIFFICULTY_OPTIONS },
  { id: 'kblOverseas', title: 'KBL·해외 리그 난이도는 어땠나요?', options: DIFFICULTY_OPTIONS },
  { id: 'hsPacing', title: '고교 시절 진행 속도는 어땠나요?', options: PACING_OPTIONS },
];

export const SURVEY_COMMENT_MAX = 1000;

export type SurveyAnswers = Partial<Record<SurveyQuestionId, SurveyAnswerValue>>;

export function isSurveyComplete(answers: SurveyAnswers): boolean {
  return SURVEY_QUESTIONS.every((q) => typeof answers[q.id] === 'number');
}

const OVERSEAS_LEAGUES: LeagueId[] = ['B_LEAGUE', 'NBL', 'EUROLEAGUE'];

/**
 * 답변과 비교할 수 있도록 그 커리어에서 실제로 겪은 일을 요약합니다 (개인정보 없음).
 */
export function buildSurveyCareerContext(
  career: CareerState
): Pick<
  SurveyResponsePayload,
  | 'militaryExempt'
  | 'reachedNba'
  | 'nbaSeasons'
  | 'nbaPlayoffSeasons'
  | 'nbaChampionships'
  | 'kblSeasons'
  | 'overseasSeasons'
  | 'highSchoolSeasons'
  | 'seasonsPlayed'
  | 'finalLeague'
  | 'retirementReason'
> {
  const logs = career.seasonLogs ?? [];
  const nbaLogs = logs.filter((log) => log.league === 'NBA');
  const nbaPlayoffSeasons = nbaLogs.filter(
    (log) => normalizePlayoffResult(log.playoffResult, Boolean(log.wonChampionship)) !== 'missed'
  ).length;
  return {
    militaryExempt: Boolean(career.militaryExempt),
    reachedNba: nbaLogs.length > 0 || career.league === 'NBA',
    nbaSeasons: nbaLogs.length,
    nbaPlayoffSeasons,
    nbaChampionships: career.totals?.nbaChampionships ?? 0,
    kblSeasons: logs.filter((log) => log.league === 'KBL').length,
    overseasSeasons: logs.filter((log) => OVERSEAS_LEAGUES.includes(log.league)).length,
    highSchoolSeasons: logs.filter((log) => isHighSchoolLeague(log.league)).length,
    seasonsPlayed: career.seasonsPlayed,
    finalLeague: career.league,
    retirementReason: career.retirementReason ?? null,
  };
}

export function buildSurveyResponsePayload(params: {
  career: CareerState;
  status: 'submitted' | 'skipped';
  answers: SurveyAnswers;
  hasComment: boolean;
}): SurveyResponsePayload {
  const submitted = params.status === 'submitted';
  const pick = (id: SurveyQuestionId): SurveyAnswerValue | null =>
    submitted ? params.answers[id] ?? null : null;
  return {
    surveyId: SURVEY_ID,
    status: params.status,
    militaryExemptionRating: pick('militaryExemption'),
    nbaEntryRating: pick('nbaEntry'),
    nbaPlayoffsRating: pick('nbaPlayoffs'),
    kblOverseasRating: pick('kblOverseas'),
    hsPacingRating: pick('hsPacing'),
    hasComment: submitted && params.hasComment,
    ...buildSurveyCareerContext(params.career),
  };
}

/** 의견 글을 피드백함에 넣을 때 쓰는 제목 */
export const SURVEY_FEEDBACK_TITLE = '[설문] 난이도 설문 의견';

export function formatSurveyAnswersForFeedback(answers: SurveyAnswers): string {
  return SURVEY_QUESTIONS.map((q) => {
    const value = answers[q.id];
    const label = q.options.find((o) => o.value === value)?.label ?? '미응답';
    return `${q.title} ${label}`;
  }).join('\n');
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function hasSeenSurvey(storage: Storage | null = getStorage()): boolean {
  try {
    return storage?.getItem(SURVEY_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSurveySeen(storage: Storage | null = getStorage()): void {
  try {
    storage?.setItem(SURVEY_SEEN_STORAGE_KEY, '1');
  } catch {
    // 저장소를 쓸 수 없는 환경(사파리 비공개 모드 등)에서는 조용히 무시합니다.
  }
}
