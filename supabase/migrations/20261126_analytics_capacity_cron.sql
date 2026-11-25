-- ============================================================================
-- 로드 투 MVP - 통계 원본 매일 자동 정리 예약 (Supabase Cron = pg_cron)
-- - 먼저 20261126_analytics_capacity.sql을 실행해야 합니다.
-- - 매일 04:00 KST(19:00 UTC)에 analytics_daily_maintenance(14)를 실행합니다.
--   완료된 날짜를 요약한 뒤, 14일이 지난 원본 행을 지웁니다 (난이도 설문은 남김).
--   지운 원본은 되돌릴 수 없지만, 요약 테이블에 일별·커리어별 지표가 남습니다.
-- - 다시 실행해도 같은 이름의 예약 하나만 남습니다.
-- - 보존 기간을 바꾸려면 아래 (14)를 바꿔 다시 실행합니다 (7 이상).
-- - 예약 끄기: SELECT cron.unschedule('analytics-daily-maintenance');
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule(
  'analytics-daily-maintenance',
  '0 19 * * *',
  $$SELECT public.analytics_daily_maintenance(14)$$
);
