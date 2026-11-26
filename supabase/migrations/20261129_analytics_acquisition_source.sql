-- ============================================================================
-- 로드 투 MVP 1.3.2 - 유입 경로별 신규 유저 집계
-- - 1.3.2부터 session_start payload에 source(처음 들어온 경로)가 담깁니다.
-- - 유저(익명 ID)마다 처음 경로를 한 줄씩 남기는 작은 요약 테이블을 만듭니다.
--   원본은 14일 뒤 지워져도 이 테이블은 남아서 긴 기간도 볼 수 있습니다.
-- - 관리자 화면용 집계 함수 admin_analytics_sources를 추가합니다.
-- - 이벤트 이름은 그대로라 CHECK 제약은 바꾸지 않습니다.
-- - 1.3.2 배포 전에 실행하세요. 먼저 배포해도 게임과 통계 저장에는 영향이 없고,
--   이 SQL을 실행한 시점부터 경로가 쌓입니다.
-- - 다시 실행해도 안전합니다.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_player_sources (
  anonymous_id text PRIMARY KEY,
  source text NOT NULL,
  first_at timestamptz NOT NULL
);

COMMENT ON TABLE public.analytics_player_sources IS '유저(익명)별 처음 들어온 경로 (1.3.2+, 정식 버전만). unknown = 1.3.2 이전부터 하던 유저';

CREATE INDEX IF NOT EXISTS analytics_player_sources_first_at_idx
  ON public.analytics_player_sources (first_at);

ALTER TABLE public.analytics_player_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.analytics_player_sources FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_player_sources TO service_role;

-- session_start가 들어올 때 처음 경로만 남깁니다 (이미 있으면 그대로).
CREATE OR REPLACE FUNCTION public.analytics_record_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF COALESCE(NEW.game_version, '') NOT LIKE '%-preview' THEN
      INSERT INTO public.analytics_player_sources (anonymous_id, source, first_at)
      VALUES (NEW.anonymous_id, left(NEW.payload->>'source', 64), NEW.created_at)
      ON CONFLICT (anonymous_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 경로 기록이 실패해도 원본 저장은 계속합니다.
    RAISE WARNING 'analytics_record_source failed (event %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_record_source() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_record_source() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_record_source() TO service_role;

DROP TRIGGER IF EXISTS trg_analytics_events_source ON public.analytics_events;
CREATE TRIGGER trg_analytics_events_source
  AFTER INSERT ON public.analytics_events
  FOR EACH ROW
  WHEN (NEW.event_name = 'session_start' AND NEW.payload ? 'source')
  EXECUTE FUNCTION public.analytics_record_source();

-- 기간 안에 처음 들어온 유저 수를 경로별로 셉니다. unknown(1.3.2 이전 유저)은 뺍니다.
CREATE OR REPLACE FUNCTION public.admin_analytics_sources(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'items',
    COALESCE(jsonb_agg(jsonb_build_object('key', source, 'count', players) ORDER BY players DESC, source), '[]'::jsonb)
  )
  FROM (
    SELECT source, count(*) AS players
    FROM public.analytics_player_sources
    WHERE source <> 'unknown'
      AND (p_since IS NULL OR first_at >= p_since)
    GROUP BY source
  ) s;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_sources(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_sources(timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_sources(timestamptz) TO service_role;
