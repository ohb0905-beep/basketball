-- ============================================================================
-- 로드 투 MVP 1.1.3 - 거의 쓰지 않는 통계 인덱스 삭제 (용량 절감)
-- - idx_analytics_events_anonymous_id_created_at_desc는 2026-11-25 기준 사용 4회,
--   크기 약 1.1MB(통계 테이블의 약 10%)로 하루 약 2MB씩 늘고 있었습니다.
-- - 관리자 집계는 이 인덱스를 쓰지 않습니다 (전체를 한 번 훑어 집계).
-- - 데이터는 바뀌지 않습니다. 나중에 필요하면 아래 주석의 CREATE INDEX로 되살릴 수 있습니다.
-- - 다시 실행해도 안전합니다.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_analytics_events_anonymous_id_created_at_desc;

-- 되살리기:
-- CREATE INDEX IF NOT EXISTS idx_analytics_events_anonymous_id_created_at_desc
--   ON public.analytics_events (anonymous_id, created_at DESC);
