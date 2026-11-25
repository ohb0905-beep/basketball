-- ============================================================================
-- 로드 투 MVP 1.0.1 - 플레이 통계 일별 요약 + 원본 보존 기간
-- - 무료 플랜(500MB)에서 analytics_events가 하루 약 14MB씩 늘어나므로(2026-11-25 기준),
--   오래된 원본 행을 일별 요약으로 옮기고 지웁니다.
-- - 이 파일은 테이블과 함수만 만듭니다. 원본 삭제는 함수를 직접 실행할 때만 일어납니다.
--     SELECT public.analytics_rollup_and_prune();        -- 기본 30일 보존
--     SELECT public.analytics_rollup_and_prune(60);      -- 60일 보존
-- - 요약은 삭제 직전에 갱신되므로, 지워진 날짜도 일별 지표는 남습니다.
-- - /admin/analytics 대시보드는 원본 행만 읽으므로, 보존 기간 밖의 날짜는 대시보드에서 사라집니다.
-- - service_role만 실행할 수 있습니다. 다시 실행해도 안전합니다.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_daily_summary (
  day date NOT NULL,
  game_version text NOT NULL DEFAULT 'unknown',
  event_name text NOT NULL,
  league text NOT NULL DEFAULT '-',
  device_type text NOT NULL DEFAULT 'unknown',
  events integer NOT NULL,
  players integer NOT NULL,
  careers integer NOT NULL,
  championships integer NOT NULL DEFAULT 0,
  mvps integer NOT NULL DEFAULT 0,
  finals_mvps integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, game_version, event_name, league, device_type)
);

COMMENT ON TABLE public.analytics_daily_summary IS 'analytics_events 일별 요약 (KST 기준 날짜, 원본 삭제 후에도 남는 지표)';
COMMENT ON COLUMN public.analytics_daily_summary.league IS 'season_completed는 payload.league, 그 밖의 이벤트는 -';

ALTER TABLE public.analytics_daily_summary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.analytics_daily_summary FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.analytics_rollup_and_prune(p_retain_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
  v_rolled integer := 0;
  v_deleted integer := 0;
BEGIN
  IF p_retain_days IS NULL OR p_retain_days < 7 THEN
    RAISE EXCEPTION 'p_retain_days must be at least 7 (got %)', p_retain_days;
  END IF;

  -- KST 자정 기준으로 잘라 하루가 반만 지워지지 않게 합니다.
  v_cutoff := (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') - make_interval(days => p_retain_days))
              AT TIME ZONE 'Asia/Seoul';

  -- 지울 날짜를 포함해 보존 기간 안의 완료된 날짜까지 모두 다시 요약합니다 (멱등).
  WITH src AS (
    SELECT
      (created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
      coalesce(game_version, 'unknown') AS game_version,
      event_name,
      CASE WHEN event_name = 'season_completed' AND jsonb_typeof(payload->'league') = 'string'
           THEN payload->>'league' ELSE '-' END AS league,
      coalesce(device_type, 'unknown') AS device_type,
      anonymous_id,
      career_run_id,
      payload
    FROM public.analytics_events
    WHERE created_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul'
  ), agg AS (
    SELECT
      day, game_version, event_name, league, device_type,
      count(*)::int AS events,
      count(DISTINCT anonymous_id)::int AS players,
      count(DISTINCT career_run_id)::int AS careers,
      count(*) FILTER (WHERE payload->>'wonChampionship' = 'true')::int AS championships,
      count(*) FILTER (WHERE payload->>'wonMvp' = 'true')::int AS mvps,
      count(*) FILTER (WHERE coalesce(payload->>'wonFinalsMvp', payload->>'wonFmvp') = 'true')::int AS finals_mvps
    FROM src
    GROUP BY 1, 2, 3, 4, 5
  )
  INSERT INTO public.analytics_daily_summary AS s
    (day, game_version, event_name, league, device_type, events, players, careers,
     championships, mvps, finals_mvps, updated_at)
  SELECT day, game_version, event_name, league, device_type, events, players, careers,
         championships, mvps, finals_mvps, now()
  FROM agg
  ON CONFLICT (day, game_version, event_name, league, device_type) DO UPDATE
    SET events = EXCLUDED.events,
        players = EXCLUDED.players,
        careers = EXCLUDED.careers,
        championships = EXCLUDED.championships,
        mvps = EXCLUDED.mvps,
        finals_mvps = EXCLUDED.finals_mvps,
        updated_at = now()
    -- 이미 원본이 지워진 날짜는 남은 행이 없으므로 이 INSERT에 나타나지 않아 덮어쓰이지 않습니다.
  ;
  GET DIAGNOSTICS v_rolled = ROW_COUNT;

  DELETE FROM public.analytics_events WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff', v_cutoff,
    'summaryRowsUpserted', v_rolled,
    'eventsDeleted', v_deleted
  );
END;
$$;

COMMENT ON FUNCTION public.analytics_rollup_and_prune(integer)
  IS '완료된 날짜의 analytics_events를 일별 요약으로 옮기고 보존 기간(기본 30일)보다 오래된 원본을 삭제 (service_role 전용)';

REVOKE ALL ON FUNCTION public.analytics_rollup_and_prune(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_rollup_and_prune(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_rollup_and_prune(integer) TO service_role;
