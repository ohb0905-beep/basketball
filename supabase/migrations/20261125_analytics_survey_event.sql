-- ============================================================================
-- 로드 투 MVP 1.1.2 - 난이도 설문 이벤트 허용
-- - survey_response: 은퇴 화면 난이도 설문 응답/건너뛰기 (브라우저당 1회)
-- - 기존 행은 변경하지 않습니다. CHECK 제약만 교체합니다.
-- - 1.1.2 배포 전에 실행하세요. 먼저 배포하면 설문 응답만 DB에서 거부되고
--   (게임과 다른 이벤트에는 영향 없음) 이 마이그레이션을 실행한 시점부터 쌓입니다.
-- - 다시 실행해도 안전합니다.
-- ============================================================================

ALTER TABLE public.analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_event_name_check;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_event_name_check CHECK (
    event_name IN (
      'session_start',
      'career_created',
      'season_completed',
      'league_changed',
      'career_ended',
      'career_reset',
      'creation_started',
      'draft_completed',
      'survey_response'
    )
  );

COMMENT ON COLUMN public.analytics_events.event_name IS '허용된 마일스톤 이벤트명 (session_start, career_created, season_completed, league_changed, career_ended, career_reset, creation_started, draft_completed, survey_response)';
