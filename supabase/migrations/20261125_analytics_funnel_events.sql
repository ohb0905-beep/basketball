-- ============================================================================
-- 로드 투 MVP 1.0.1 - 퍼널 이벤트 허용 목록 확장
-- - creation_started: 커리어 생성 화면 진입 (세션당 1회)
-- - draft_completed: NBA/KBL 드래프트 결과 확정 (지명·미지명)
-- - 기존 행은 변경하지 않습니다. CHECK 제약만 교체합니다.
-- - 1.0.1 클라이언트를 배포하기 전에 실행하세요. 먼저 배포하면 두 이벤트만 DB에서 거부되고
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
      'draft_completed'
    )
  );

COMMENT ON COLUMN public.analytics_events.event_name IS '허용된 마일스톤 이벤트명 (session_start, career_created, season_completed, league_changed, career_ended, career_reset, creation_started, draft_completed)';
