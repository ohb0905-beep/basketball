-- ============================================================================
-- 로드 투 MVP - 통계 용량 대비 1단계: 요약 테이블 + 매일 정리 함수 + 집계 함수 v3
--
-- 왜: 무료 플랜 DB 한도(500MB)를 넘으면 통계와 피드백 저장이 모두 멈춥니다.
--     원본(analytics_events)은 최근 14일만 두고, 오래 볼 지표는 작은 요약 테이블에 영구 보관합니다.
--
-- 이 파일이 하는 일
-- 1. 요약 테이블 6개를 만듭니다 (커리어별 1행, 플레이어·버전·기기별 1행, 생성 화면 세션, 일별 집계 2개, 정리 기록).
-- 2. 새 이벤트가 들어올 때마다 커리어·플레이어 요약을 갱신하는 트리거를 겁니다.
--    트리거가 실패해도 이벤트 저장은 막지 않습니다 (경고만 남김).
-- 3. 지금 있는 원본으로 요약을 한 번 채웁니다 (다시 실행해도 결과가 같습니다).
-- 4. analytics_daily_maintenance(보존일수) 함수를 만듭니다. 실행하면
--    "완료된 날짜 요약 → 보존 기간이 지난 원본 삭제(난이도 설문은 남김)" 순서로 돕니다.
--    이 파일만 실행해서는 아무것도 지워지지 않습니다. 매일 자동 실행은 20261126_analytics_capacity_cron.sql.
-- 5. admin_analytics_report를 schemaVersion 3으로 바꿉니다.
--    - 요약 테이블에서 읽어 기간 제한이 없는 섹션: KPI, 일별 추이, 기기, 버전, 리그별·포지션별 수상률,
--      생성 포지션·플레이스타일 등, 은퇴 결말, 생성→드래프트 퍼널, 버전별 비교
--    - 원본에서만 읽어 최근 14일까지만 보이는 섹션: 리그 도달, 최고 시즌, 리셋 상세, 역할, 플레이오프 결과,
--      수상 내역, 리그 이동 (설문은 원본을 지우지 않으므로 전체 기간)
--    - storage(용량), rawSince(원본이 남아 있는 첫 시각), prunedBefore(이 시각 전 원본은 정리됨),
--      maintenance(마지막 정리) 키를 추가합니다.
--
-- 20261125_analytics_retention.sql(예전 30일 보존안)은 이 파일로 대체되어 아무 일도 하지 않습니다.
-- service_role(서버 API)만 함수를 실행하고 테이블에 접근할 수 있습니다. 다시 실행해도 안전합니다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 요약 테이블
-- ---------------------------------------------------------------------------

-- 커리어 1개당 1행. 값이 실제로 바뀌는 이벤트(생성, 드래프트, NBA 도달, 은퇴·리셋)에서만 갱신해
-- 시즌마다 행을 다시 쓰지 않습니다. 시즌 수 같은 시즌 단위 값은 일별 집계에 있습니다.
CREATE TABLE IF NOT EXISTS public.analytics_career_runs (
  career_run_id text PRIMARY KEY,
  anonymous_id text NOT NULL,
  game_version text NOT NULL DEFAULT 'unknown',
  has_created boolean NOT NULL DEFAULT false,
  created_session_id text,
  first_at timestamptz NOT NULL,
  position text,
  starting_league text,
  playstyle text,
  growth_dna text,
  training_focus text,
  reached_draft boolean NOT NULL DEFAULT false,
  drafted boolean NOT NULL DEFAULT false,
  nba_drafted boolean NOT NULL DEFAULT false,
  reached_nba boolean NOT NULL DEFAULT false,
  ended_at timestamptz,
  ended_version text,
  ending_type text,
  hall_of_fame boolean,
  total_seasons integer,
  reset_at timestamptz
) WITH (fillfactor = 80);

COMMENT ON TABLE public.analytics_career_runs IS '커리어별 요약 (원본 삭제 후에도 남음). game_version은 career_created 버전, 없으면 처음 본 이벤트 버전';

-- 플레이어 × 버전 × 기기 1행. last_at은 10분 단위로만 갱신해 쓰기를 줄입니다 (기간 필터 오차 최대 10분).
CREATE TABLE IF NOT EXISTS public.analytics_player_versions (
  anonymous_id text NOT NULL,
  game_version text NOT NULL,
  device_type text NOT NULL,
  first_at timestamptz NOT NULL,
  last_at timestamptz NOT NULL,
  PRIMARY KEY (anonymous_id, game_version, device_type)
) WITH (fillfactor = 80);

COMMENT ON TABLE public.analytics_player_versions IS '플레이어(익명)×버전×기기별 첫·마지막 활동 시각. 기간 안 고유 플레이어 = last_at >= 시작 시각';

-- 생성 화면에 들어온 세션 (퍼널 모수)
CREATE TABLE IF NOT EXISTS public.analytics_creation_sessions (
  session_id text PRIMARY KEY,
  game_version text NOT NULL,
  first_at timestamptz NOT NULL
);

-- 일별 이벤트 집계 (KST 날짜). 시즌은 리그·포지션별, 드래프트는 결과별로 나눕니다.
CREATE TABLE IF NOT EXISTS public.analytics_daily_stats (
  day date NOT NULL,
  game_version text NOT NULL,
  event_name text NOT NULL,
  league text NOT NULL DEFAULT '-',
  position text NOT NULL DEFAULT '-',
  draft_key text NOT NULL DEFAULT '-',
  events integer NOT NULL,
  v2 integer NOT NULL DEFAULT 0,
  champ_n integer NOT NULL DEFAULT 0,
  champs integer NOT NULL DEFAULT 0,
  mvp_n integer NOT NULL DEFAULT 0,
  mvps integer NOT NULL DEFAULT 0,
  fmvp_n integer NOT NULL DEFAULT 0,
  fmvps integer NOT NULL DEFAULT 0,
  po_n integer NOT NULL DEFAULT 0,
  pos integer NOT NULL DEFAULT 0,
  ovr_n integer NOT NULL DEFAULT 0,
  ovr_sum numeric NOT NULL DEFAULT 0,
  ppg_n integer NOT NULL DEFAULT 0,
  ppg_sum numeric NOT NULL DEFAULT 0,
  rpg_n integer NOT NULL DEFAULT 0,
  rpg_sum numeric NOT NULL DEFAULT 0,
  apg_n integer NOT NULL DEFAULT 0,
  apg_sum numeric NOT NULL DEFAULT 0,
  pick_n integer NOT NULL DEFAULT 0,
  pick_sum numeric NOT NULL DEFAULT 0,
  two_way integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, game_version, event_name, league, position, draft_key)
);

COMMENT ON TABLE public.analytics_daily_stats IS '완료된 KST 날짜의 이벤트 집계. 원본이 남아 있는 날짜는 집계 함수가 원본에서 바로 계산합니다';

-- 일별 고유 플레이어 (game_version = ''*''는 모든 버전 합친 값)
CREATE TABLE IF NOT EXISTS public.analytics_daily_players (
  day date NOT NULL,
  game_version text NOT NULL,
  players integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, game_version)
);

-- 매일 정리 실행 기록 (90일 보관)
CREATE TABLE IF NOT EXISTS public.analytics_maintenance_log (
  id bigserial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  result jsonb NOT NULL
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'analytics_career_runs', 'analytics_player_versions', 'analytics_creation_sessions',
    'analytics_daily_stats', 'analytics_daily_players', 'analytics_maintenance_log'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

REVOKE ALL ON SEQUENCE public.analytics_maintenance_log_id_seq FROM anon, authenticated;
GRANT USAGE ON SEQUENCE public.analytics_maintenance_log_id_seq TO service_role;

-- ---------------------------------------------------------------------------
-- 2. 이벤트 1개를 요약에 반영 (트리거와 최초 채우기가 같이 씀)
--    같은 이벤트를 두 번 반영해도 결과가 같도록 OR / GREATEST / 처음 값 유지로만 합칩니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_apply_event(e public.analytics_events)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  p jsonb := e.payload;
  v text := COALESCE(e.game_version, 'unknown');
  is_created boolean := e.event_name = 'career_created';
  is_draft boolean := e.event_name = 'draft_completed';
  is_ended boolean := e.event_name = 'career_ended';
  s_league text;
  s_drafted boolean;
BEGIN
  INSERT INTO public.analytics_player_versions AS pv (anonymous_id, game_version, device_type, first_at, last_at)
  VALUES (e.anonymous_id, v, COALESCE(e.device_type, 'unknown'), e.created_at, e.created_at)
  ON CONFLICT (anonymous_id, game_version, device_type) DO UPDATE
    SET first_at = LEAST(pv.first_at, EXCLUDED.first_at),
        last_at = GREATEST(pv.last_at, EXCLUDED.last_at)
    WHERE EXCLUDED.last_at > pv.last_at + interval '10 minutes'
       OR EXCLUDED.first_at < pv.first_at;

  IF e.event_name = 'creation_started' THEN
    INSERT INTO public.analytics_creation_sessions AS cs (session_id, game_version, first_at)
    VALUES (e.session_id, v, e.created_at)
    ON CONFLICT (session_id) DO UPDATE
      SET first_at = EXCLUDED.first_at, game_version = EXCLUDED.game_version
      WHERE EXCLUDED.first_at < cs.first_at;
  END IF;

  IF e.career_run_id IS NULL THEN
    RETURN;
  END IF;

  s_league := CASE WHEN jsonb_typeof(p->'league') = 'string' THEN p->>'league' END;
  s_drafted := is_draft AND p->>'drafted' = 'true';

  INSERT INTO public.analytics_career_runs AS r (
    career_run_id, anonymous_id, game_version, has_created, created_session_id, first_at,
    position, starting_league, playstyle, growth_dna, training_focus,
    reached_draft, drafted, nba_drafted, reached_nba,
    ended_at, ended_version, ending_type, hall_of_fame, total_seasons, reset_at
  ) VALUES (
    e.career_run_id, e.anonymous_id, v, is_created,
    CASE WHEN is_created THEN e.session_id END,
    e.created_at,
    CASE WHEN is_created AND jsonb_typeof(p->'position') = 'string' THEN p->>'position' END,
    CASE WHEN is_created AND jsonb_typeof(p->'startingLeague') = 'string' THEN p->>'startingLeague' END,
    CASE WHEN is_created AND jsonb_typeof(p->'playstyle') = 'string' THEN p->>'playstyle' END,
    CASE WHEN is_created AND jsonb_typeof(p->'growthDna') = 'string' THEN p->>'growthDna' END,
    CASE WHEN is_created AND jsonb_typeof(p->'trainingFocus') = 'string' THEN p->>'trainingFocus' END,
    is_draft,
    s_drafted,
    s_drafted AND p->>'draftType' = 'NBA',
    (e.event_name = 'season_completed' AND s_league = 'NBA')
      OR (e.event_name = 'league_changed' AND p->>'toLeague' = 'NBA'),
    CASE WHEN is_ended THEN e.created_at END,
    CASE WHEN is_ended THEN v END,
    CASE WHEN is_ended AND jsonb_typeof(p->'endingType') = 'string' THEN p->>'endingType' END,
    CASE WHEN is_ended AND jsonb_typeof(p->'hallOfFame') = 'boolean' THEN (p->>'hallOfFame')::boolean END,
    CASE WHEN is_ended AND jsonb_typeof(p->'totalSeasons') = 'number' THEN floor((p->>'totalSeasons')::numeric)::int END,
    CASE WHEN e.event_name = 'career_reset' THEN e.created_at END
  )
  ON CONFLICT (career_run_id) DO UPDATE SET
    game_version = CASE
      WHEN EXCLUDED.has_created AND NOT r.has_created THEN EXCLUDED.game_version
      WHEN NOT r.has_created AND NOT EXCLUDED.has_created AND EXCLUDED.first_at < r.first_at THEN EXCLUDED.game_version
      ELSE r.game_version END,
    has_created = r.has_created OR EXCLUDED.has_created,
    created_session_id = COALESCE(r.created_session_id, EXCLUDED.created_session_id),
    first_at = LEAST(r.first_at, EXCLUDED.first_at),
    position = COALESCE(r.position, EXCLUDED.position),
    starting_league = COALESCE(r.starting_league, EXCLUDED.starting_league),
    playstyle = COALESCE(r.playstyle, EXCLUDED.playstyle),
    growth_dna = COALESCE(r.growth_dna, EXCLUDED.growth_dna),
    training_focus = COALESCE(r.training_focus, EXCLUDED.training_focus),
    reached_draft = r.reached_draft OR EXCLUDED.reached_draft,
    drafted = r.drafted OR EXCLUDED.drafted,
    nba_drafted = r.nba_drafted OR EXCLUDED.nba_drafted,
    reached_nba = r.reached_nba OR EXCLUDED.reached_nba,
    ended_version = CASE WHEN r.ended_at IS NULL OR EXCLUDED.ended_at < r.ended_at
                         THEN COALESCE(EXCLUDED.ended_version, r.ended_version) ELSE r.ended_version END,
    ending_type = CASE WHEN r.ended_at IS NULL OR EXCLUDED.ended_at < r.ended_at
                       THEN COALESCE(EXCLUDED.ending_type, r.ending_type) ELSE r.ending_type END,
    hall_of_fame = CASE WHEN r.ended_at IS NULL OR EXCLUDED.ended_at < r.ended_at
                        THEN COALESCE(EXCLUDED.hall_of_fame, r.hall_of_fame) ELSE r.hall_of_fame END,
    total_seasons = CASE WHEN r.ended_at IS NULL OR EXCLUDED.ended_at < r.ended_at
                         THEN COALESCE(EXCLUDED.total_seasons, r.total_seasons) ELSE r.total_seasons END,
    ended_at = LEAST(r.ended_at, EXCLUDED.ended_at),
    reset_at = LEAST(r.reset_at, EXCLUDED.reset_at)
  -- 바뀌는 값이 없으면 행을 다시 쓰지 않습니다 (대부분의 시즌 이벤트).
  WHERE (EXCLUDED.has_created AND NOT r.has_created)
     OR EXCLUDED.first_at < r.first_at
     OR (EXCLUDED.reached_draft AND NOT r.reached_draft)
     OR (EXCLUDED.drafted AND NOT r.drafted)
     OR (EXCLUDED.nba_drafted AND NOT r.nba_drafted)
     OR (EXCLUDED.reached_nba AND NOT r.reached_nba)
     OR (EXCLUDED.ended_at IS NOT NULL AND (r.ended_at IS NULL OR EXCLUDED.ended_at < r.ended_at))
     OR (EXCLUDED.reset_at IS NOT NULL AND (r.reset_at IS NULL OR EXCLUDED.reset_at < r.reset_at));
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_apply_event(public.analytics_events) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_apply_event(public.analytics_events) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_apply_event(public.analytics_events) TO service_role;

CREATE OR REPLACE FUNCTION public.analytics_events_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.analytics_apply_event(NEW);
  EXCEPTION WHEN OTHERS THEN
    -- 요약 갱신이 실패해도 원본 저장은 계속합니다.
    RAISE WARNING 'analytics_apply_event failed (event %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_events_after_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_events_after_insert() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_events_after_insert() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. 트리거 + 지금 있는 원본으로 요약 채우기
--    채우는 동안 새 이벤트 저장을 잠깐(보통 몇 초) 기다리게 해서 빠지는 행이 없게 합니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  ev public.analytics_events;
BEGIN
  LOCK TABLE public.analytics_events IN SHARE ROW EXCLUSIVE MODE;
  DROP TRIGGER IF EXISTS trg_analytics_events_summaries ON public.analytics_events;
  FOR ev IN SELECT * FROM public.analytics_events ORDER BY created_at, id LOOP
    PERFORM public.analytics_apply_event(ev);
  END LOOP;
  CREATE TRIGGER trg_analytics_events_summaries
    AFTER INSERT ON public.analytics_events
    FOR EACH ROW EXECUTE FUNCTION public.analytics_events_after_insert();
END $$;

-- ---------------------------------------------------------------------------
-- 4. 원본 → 일별 집계 계산 (정리 함수와 집계 함수가 같은 정의를 씁니다)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_summarize_events(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  day date, game_version text, event_name text, league text, "position" text, draft_key text,
  events integer, v2 integer,
  champ_n integer, champs integer, mvp_n integer, mvps integer, fmvp_n integer, fmvps integer,
  po_n integer, pos integer,
  ovr_n integer, ovr_sum numeric, ppg_n integer, ppg_sum numeric,
  rpg_n integer, rpg_sum numeric, apg_n integer, apg_sum numeric,
  pick_n integer, pick_sum numeric, two_way integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH src AS (
    SELECT
      (e.created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
      COALESCE(e.game_version, 'unknown') AS game_version,
      e.event_name,
      e.payload AS p,
      e.career_run_id
    FROM public.analytics_events e
    WHERE (p_from IS NULL OR e.created_at >= p_from)
      AND (p_to IS NULL OR e.created_at < p_to)
  ), x AS (
    SELECT
      s.day, s.game_version, s.event_name,
      CASE WHEN s.event_name = 'season_completed'
           THEN COALESCE(CASE WHEN jsonb_typeof(s.p->'league') = 'string' THEN s.p->>'league' END, 'unknown')
           ELSE '-' END AS league,
      CASE WHEN s.event_name = 'season_completed'
           THEN COALESCE(CASE WHEN jsonb_typeof(s.p->'position') = 'string' THEN s.p->>'position' END,
                         r.position, 'unknown')
           ELSE '-' END AS position,
      CASE WHEN s.event_name = 'draft_completed'
           THEN COALESCE(CASE WHEN jsonb_typeof(s.p->'draftType') = 'string' THEN s.p->>'draftType' END, 'unknown')
                || '_' ||
                CASE WHEN s.p->>'drafted' IS DISTINCT FROM 'true' THEN 'UNDRAFTED'
                     WHEN jsonb_typeof(s.p->'round') <> 'number' OR s.p->'round' IS NULL THEN 'DRAFTED'
                     ELSE 'R' || floor((s.p->>'round')::numeric)::int END
           ELSE '-' END AS draft_key,
      (s.p ? 'playoffResult') AS is_v2,
      CASE WHEN jsonb_typeof(s.p->'wonChampionship') = 'boolean' THEN (s.p->>'wonChampionship')::boolean END AS champ,
      CASE WHEN jsonb_typeof(s.p->'wonMvp') = 'boolean' THEN (s.p->>'wonMvp')::boolean END AS mvp,
      CASE
        WHEN jsonb_typeof(s.p->'wonFmvp') = 'boolean' THEN (s.p->>'wonFmvp')::boolean
        WHEN jsonb_typeof(s.p->'wonFinalsMvp') = 'boolean' THEN (s.p->>'wonFinalsMvp')::boolean
      END AS fmvp,
      CASE WHEN jsonb_typeof(s.p->'madePlayoffs') = 'boolean' THEN (s.p->>'madePlayoffs')::boolean END AS po,
      CASE WHEN jsonb_typeof(s.p->'overall') = 'number' THEN (s.p->>'overall')::numeric END AS ovr,
      CASE WHEN jsonb_typeof(s.p->'ppg') = 'number' THEN (s.p->>'ppg')::numeric END AS ppg,
      CASE WHEN jsonb_typeof(s.p->'rpg') = 'number' THEN (s.p->>'rpg')::numeric END AS rpg,
      CASE WHEN jsonb_typeof(s.p->'apg') = 'number' THEN (s.p->>'apg')::numeric END AS apg,
      CASE WHEN jsonb_typeof(s.p->'pickNumber') = 'number' THEN (s.p->>'pickNumber')::numeric END AS pick,
      CASE WHEN jsonb_typeof(s.p->'hasTwoWayOffer') = 'boolean' THEN (s.p->>'hasTwoWayOffer')::boolean END AS tw
    FROM src s
    LEFT JOIN public.analytics_career_runs r
      ON s.event_name = 'season_completed' AND r.career_run_id = s.career_run_id
  )
  SELECT
    day, game_version, event_name, league, position, draft_key,
    count(*)::int,
    count(*) FILTER (WHERE event_name = 'season_completed' AND is_v2)::int,
    count(champ)::int, count(*) FILTER (WHERE champ)::int,
    count(mvp)::int, count(*) FILTER (WHERE mvp)::int,
    count(fmvp)::int, count(*) FILTER (WHERE fmvp)::int,
    count(po)::int, count(*) FILTER (WHERE po)::int,
    count(ovr) FILTER (WHERE event_name IN ('season_completed', 'draft_completed'))::int,
    COALESCE(sum(ovr) FILTER (WHERE event_name IN ('season_completed', 'draft_completed')), 0),
    count(ppg)::int, COALESCE(sum(ppg), 0),
    count(rpg)::int, COALESCE(sum(rpg), 0),
    count(apg)::int, COALESCE(sum(apg), 0),
    count(pick) FILTER (WHERE event_name = 'draft_completed')::int,
    COALESCE(sum(pick) FILTER (WHERE event_name = 'draft_completed'), 0),
    count(*) FILTER (WHERE event_name = 'draft_completed' AND tw)::int
  FROM x
  GROUP BY day, game_version, event_name, league, position, draft_key
$$;

CREATE OR REPLACE FUNCTION public.analytics_summarize_players(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (day date, game_version text, players integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH src AS (
    SELECT (created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
           COALESCE(game_version, 'unknown') AS game_version, anonymous_id
    FROM public.analytics_events
    WHERE (p_from IS NULL OR created_at >= p_from)
      AND (p_to IS NULL OR created_at < p_to)
  )
  SELECT day, game_version, count(DISTINCT anonymous_id)::int FROM src GROUP BY 1, 2
  UNION ALL
  SELECT day, '*', count(DISTINCT anonymous_id)::int FROM src GROUP BY 1
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.analytics_summarize_events(timestamptz, timestamptz)',
    'public.analytics_summarize_players(timestamptz, timestamptz)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. 매일 정리: 완료된 날짜 요약 → 보존 기간이 지난 원본 삭제
--    난이도 설문(survey_response)은 하루 몇 건뿐이라 지우지 않습니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_daily_maintenance(p_retain_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_today_start timestamptz;
  v_cutoff timestamptz;
  v_stats integer := 0;
  v_players integer := 0;
  v_deleted integer := 0;
  v_result jsonb;
BEGIN
  IF p_retain_days IS NULL OR p_retain_days < 7 THEN
    RAISE EXCEPTION 'p_retain_days must be at least 7 (got %)', p_retain_days;
  END IF;

  -- KST 자정 기준으로 잘라 하루가 반만 지워지지 않게 합니다.
  v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
  v_cutoff := v_today_start - make_interval(days => p_retain_days);

  -- 원본에 남은 완료된 날짜를 모두 다시 요약합니다 (멱등). 이미 원본이 지워진 날짜의 요약은 그대로 남습니다.
  INSERT INTO public.analytics_daily_stats AS s (
    day, game_version, event_name, league, position, draft_key, events, v2,
    champ_n, champs, mvp_n, mvps, fmvp_n, fmvps, po_n, pos,
    ovr_n, ovr_sum, ppg_n, ppg_sum, rpg_n, rpg_sum, apg_n, apg_sum,
    pick_n, pick_sum, two_way, updated_at
  )
  SELECT x.*, now() FROM public.analytics_summarize_events(NULL, v_today_start) x
  ON CONFLICT (day, game_version, event_name, league, position, draft_key) DO UPDATE SET
    events = EXCLUDED.events, v2 = EXCLUDED.v2,
    champ_n = EXCLUDED.champ_n, champs = EXCLUDED.champs,
    mvp_n = EXCLUDED.mvp_n, mvps = EXCLUDED.mvps,
    fmvp_n = EXCLUDED.fmvp_n, fmvps = EXCLUDED.fmvps,
    po_n = EXCLUDED.po_n, pos = EXCLUDED.pos,
    ovr_n = EXCLUDED.ovr_n, ovr_sum = EXCLUDED.ovr_sum,
    ppg_n = EXCLUDED.ppg_n, ppg_sum = EXCLUDED.ppg_sum,
    rpg_n = EXCLUDED.rpg_n, rpg_sum = EXCLUDED.rpg_sum,
    apg_n = EXCLUDED.apg_n, apg_sum = EXCLUDED.apg_sum,
    pick_n = EXCLUDED.pick_n, pick_sum = EXCLUDED.pick_sum,
    two_way = EXCLUDED.two_way, updated_at = now()
  -- 원본이 설문만 남은 날짜는 설문 행만 다시 계산되고 나머지 요약은 건드리지 않습니다.
  ;
  GET DIAGNOSTICS v_stats = ROW_COUNT;

  INSERT INTO public.analytics_daily_players AS d (day, game_version, players, updated_at)
  SELECT x.*, now() FROM public.analytics_summarize_players(NULL, v_today_start) x
  -- 설문만 남은 옛 날짜는 다시 세지 않습니다 (이미 지워진 플레이어 수를 덮어쓰지 않도록).
  WHERE x.day >= (
    SELECT (min(created_at) AT TIME ZONE 'Asia/Seoul')::date
    FROM public.analytics_events WHERE event_name <> 'survey_response'
  )
  ON CONFLICT (day, game_version) DO UPDATE SET players = EXCLUDED.players, updated_at = now();
  GET DIAGNOSTICS v_players = ROW_COUNT;

  DELETE FROM public.analytics_events
  WHERE created_at < v_cutoff AND event_name <> 'survey_response';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.analytics_maintenance_log WHERE ran_at < now() - interval '90 days';

  v_result := jsonb_build_object(
    'retainDays', p_retain_days,
    'cutoff', v_cutoff,
    'statsRowsUpserted', v_stats,
    'playerRowsUpserted', v_players,
    'eventsDeleted', v_deleted
  );
  INSERT INTO public.analytics_maintenance_log (result) VALUES (v_result);
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.analytics_daily_maintenance(integer)
  IS '완료된 날짜 요약 후 보존 기간(기본 14일)이 지난 원본 삭제 (설문 제외, service_role 전용)';

REVOKE ALL ON FUNCTION public.analytics_daily_maintenance(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_daily_maintenance(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_daily_maintenance(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. 관리자 집계 함수 v3
--    원본이 남아 있는 날짜(raw_day0 이후)는 원본에서 바로 계산하고, 그 전 날짜는 일별 집계를 씁니다.
--    일별 집계는 날짜 단위라, 시작 시각이 원본 범위 밖이면 시작 날짜 하루가 통째로 들어갑니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_analytics_report(
  p_since timestamptz DEFAULT NULL,
  p_version text DEFAULT NULL,
  p_league text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH bounds AS (
  SELECT
    raw_from,
    COALESCE((raw_from AT TIME ZONE 'Asia/Seoul')::date, (now() AT TIME ZONE 'Asia/Seoul')::date) AS raw_day0,
    CASE WHEN p_since IS NULL THEN NULL ELSE (p_since AT TIME ZONE 'Asia/Seoul')::date END AS since_day
  FROM (
    SELECT min(created_at) AS raw_from
    FROM public.analytics_events
    WHERE event_name <> 'survey_response'
  ) m
),
raw_start AS (
  -- 원본에서 계산할 구간의 시작 (원본 첫 날짜의 KST 자정과 p_since 중 늦은 쪽)
  SELECT GREATEST(
    (b.raw_day0::timestamp AT TIME ZONE 'Asia/Seoul'),
    COALESCE(p_since, '-infinity'::timestamptz)
  ) AS ts
  FROM bounds b
),
stats_all AS (
  SELECT s.day, s.game_version, s.event_name, s.league, s.position, s.draft_key,
         s.events, s.v2, s.champ_n, s.champs, s.mvp_n, s.mvps, s.fmvp_n, s.fmvps, s.po_n, s.pos,
         s.ovr_n, s.ovr_sum, s.ppg_n, s.ppg_sum, s.rpg_n, s.rpg_sum, s.apg_n, s.apg_sum,
         s.pick_n, s.pick_sum, s.two_way
  FROM public.analytics_daily_stats s, bounds b
  WHERE s.day < b.raw_day0
    AND (b.since_day IS NULL OR s.day >= b.since_day)
  UNION ALL
  SELECT x.* FROM raw_start rs, LATERAL public.analytics_summarize_events(rs.ts, NULL) x
),
stats AS (
  SELECT * FROM stats_all WHERE p_version IS NULL OR game_version = p_version
),
sseasons AS (
  SELECT * FROM stats WHERE event_name = 'season_completed'
),
daily_players AS (
  SELECT d.day, d.players
  FROM public.analytics_daily_players d, bounds b
  WHERE d.day < b.raw_day0
    AND (b.since_day IS NULL OR d.day >= b.since_day)
    AND d.game_version = COALESCE(p_version, '*')
  UNION ALL
  SELECT x.day, x.players
  FROM raw_start rs, LATERAL public.analytics_summarize_players(rs.ts, NULL) x
  WHERE x.game_version = COALESCE(p_version, '*')
),
pv AS (
  SELECT * FROM public.analytics_player_versions
  WHERE p_since IS NULL OR last_at >= p_since
),
runs_all AS (
  -- 기간 안에 만든 커리어 (버전 필터 전)
  SELECT * FROM public.analytics_career_runs
  WHERE has_created AND (p_since IS NULL OR first_at >= p_since)
),
runs AS (
  SELECT * FROM runs_all WHERE p_version IS NULL OR game_version = p_version
),
ended_all AS (
  SELECT * FROM public.analytics_career_runs
  WHERE ended_at IS NOT NULL AND (p_since IS NULL OR ended_at >= p_since)
),
ended AS (
  SELECT * FROM ended_all WHERE p_version IS NULL OR ended_version = p_version
),
-- ---------------------------------------------------------------------------
-- 원본에서만 계산하는 섹션 (원본 보존 기간까지만 보임)
-- ---------------------------------------------------------------------------
base AS (
  SELECT e.event_name, e.anonymous_id, e.session_id, e.career_run_id,
         e.game_version, e.device_type, e.payload AS p, e.created_at
  FROM public.analytics_events e
  WHERE (p_since IS NULL OR e.created_at >= p_since)
    AND (p_version IS NULL OR e.game_version = p_version)
),
seasons AS (
  SELECT
    b.career_run_id,
    b.p->>'league' AS league,
    CASE WHEN jsonb_typeof(b.p->'playoffResult') = 'string' THEN b.p->>'playoffResult' END AS playoff_result,
    CASE WHEN jsonb_typeof(b.p->'role') = 'string' THEN b.p->>'role' END AS role,
    CASE WHEN jsonb_typeof(b.p->'awards') = 'array' THEN b.p->'awards' END AS awards,
    CASE WHEN jsonb_typeof(b.p->'seasonNumber') = 'number' THEN (b.p->>'seasonNumber')::numeric END AS season_number
  FROM base b
  WHERE b.event_name = 'season_completed'
),
fseasons AS (
  SELECT * FROM seasons WHERE p_league IS NULL OR league = p_league
),
resets AS (
  SELECT
    CASE WHEN jsonb_typeof(p->'abandonedLeague') = 'string' THEN p->>'abandonedLeague' END AS league,
    CASE WHEN jsonb_typeof(p->'abandonedSeason') = 'number' THEN (p->>'abandonedSeason')::numeric END AS season,
    CASE WHEN jsonb_typeof(p->'abandonedOverall') = 'number' THEN (p->>'abandonedOverall')::numeric END AS ovr,
    CASE WHEN jsonb_typeof(p->'abandonedRole') = 'string' THEN p->>'abandonedRole' END AS role,
    CASE WHEN jsonb_typeof(p->'hadWonChampionship') = 'boolean' THEN (p->>'hadWonChampionship')::boolean END AS had_champ,
    CASE WHEN jsonb_typeof(p->'hadWonMvp') = 'boolean' THEN (p->>'hadWonMvp')::boolean END AS had_mvp
  FROM base
  WHERE event_name = 'career_reset'
),
fresets AS (
  SELECT * FROM resets WHERE p_league IS NULL OR league = p_league
),
reach AS (
  SELECT career_run_id, lg AS league
  FROM base,
  LATERAL (VALUES
    (p->>'startingLeague'), (p->>'league'), (p->>'fromLeague'), (p->>'toLeague'),
    (p->>'finalLeague'), (p->>'peakLeague'), (p->>'abandonedLeague')
  ) AS v(lg)
  WHERE career_run_id IS NOT NULL AND lg IS NOT NULL
    AND event_name IN ('career_created', 'season_completed', 'league_changed', 'career_ended', 'career_reset')
),
surveys AS (
  SELECT
    p->>'status' AS status,
    (p->>'hasComment') = 'true' AS has_comment,
    p
  FROM base
  WHERE event_name = 'survey_response'
),
survey_answers AS (
  -- 질문별 점수(1~5)와 그 질문을 실제로 겪었는지 (hsPacing은 모두 겪으므로 NULL)
  SELECT q.ord, q.key,
         CASE WHEN jsonb_typeof(q.raw) = 'number' THEN (q.raw #>> '{}')::int END AS rating,
         q.experienced
  FROM surveys s,
  LATERAL (VALUES
    (1, 'militaryExemption', s.p->'militaryExemptionRating',
        CASE WHEN jsonb_typeof(s.p->'militaryExempt') = 'boolean' THEN (s.p->>'militaryExempt')::boolean END),
    (2, 'nbaEntry', s.p->'nbaEntryRating',
        CASE WHEN jsonb_typeof(s.p->'reachedNba') = 'boolean' THEN (s.p->>'reachedNba')::boolean END),
    (3, 'nbaPlayoffs', s.p->'nbaPlayoffsRating',
        CASE WHEN jsonb_typeof(s.p->'nbaPlayoffSeasons') = 'number' THEN (s.p->>'nbaPlayoffSeasons')::numeric > 0 END),
    (4, 'kblOverseas', s.p->'kblOverseasRating',
        CASE WHEN jsonb_typeof(s.p->'kblSeasons') = 'number' AND jsonb_typeof(s.p->'overseasSeasons') = 'number'
             THEN (s.p->>'kblSeasons')::numeric + (s.p->>'overseasSeasons')::numeric > 0 END),
    (5, 'hsPacing', s.p->'hsPacingRating', NULL::boolean)
  ) AS q(ord, key, raw, experienced)
  WHERE s.status = 'submitted'
),
-- ---------------------------------------------------------------------------
-- 생성→드래프트 퍼널 (요약 테이블)
-- ---------------------------------------------------------------------------
cstart AS (
  SELECT session_id FROM public.analytics_creation_sessions
  WHERE (p_since IS NULL OR first_at >= p_since)
    AND (p_version IS NULL OR game_version = p_version)
),
funnel_runs AS (
  -- 생성 화면 진입이 기록된 세션에서 만든 커리어만 (구버전 커리어 제외 → 같은 모수 유지)
  SELECT r.* FROM runs r
  WHERE r.created_session_id IN (SELECT session_id FROM cstart)
)
SELECT jsonb_build_object(
  'schemaVersion', 3,
  'rawSince', (SELECT raw_from FROM bounds),
  -- 이 시각 전의 원본은 정리되어 요약만 남았습니다 (정리 전이면 NULL)
  'prunedBefore', (
    SELECT (b.raw_day0::timestamp AT TIME ZONE 'Asia/Seoul')
    FROM bounds b
    WHERE EXISTS (SELECT 1 FROM public.analytics_daily_stats s WHERE s.day < b.raw_day0)
  ),
  'storage', jsonb_build_object(
    'dbBytes', pg_database_size(current_database()),
    'eventsBytes', pg_total_relation_size('public.analytics_events'),
    'summaryBytes', pg_total_relation_size('public.analytics_career_runs')
                    + pg_total_relation_size('public.analytics_player_versions')
                    + pg_total_relation_size('public.analytics_creation_sessions')
                    + pg_total_relation_size('public.analytics_daily_stats')
                    + pg_total_relation_size('public.analytics_daily_players'),
    'eventsLast24h', (SELECT count(*) FROM public.analytics_events WHERE created_at >= now() - interval '24 hours'),
    'eventsRetained', (SELECT count(*) FROM public.analytics_events)
  ),
  'maintenance', (
    SELECT jsonb_build_object('ranAt', ran_at, 'result', result)
    FROM public.analytics_maintenance_log ORDER BY ran_at DESC LIMIT 1
  ),
  'kpi', jsonb_build_object(
    'totalEvents', (SELECT COALESCE(sum(events), 0) FROM stats),
    'uniquePlayers', (SELECT count(DISTINCT anonymous_id) FROM pv WHERE p_version IS NULL OR game_version = p_version),
    'totalSessions', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'session_start'),
    'careersCreated', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'career_created'),
    'seasonsCompleted', (SELECT COALESCE(sum(events), 0) FROM sseasons),
    'careersEnded', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'career_ended'),
    'careersReset', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'career_reset'),
    'championships', (SELECT COALESCE(sum(champs), 0) FROM sseasons),
    'mvps', (SELECT COALESCE(sum(mvps), 0) FROM sseasons),
    'fmvps', (SELECT COALESCE(sum(fmvps), 0) FROM sseasons)
  ),
  'daily', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'date', to_char(d.day, 'YYYY-MM-DD'),
      'players', COALESCE(dp.players, 0),
      'careers', d.careers, 'seasons', d.seasons
    ) ORDER BY d.day)
    FROM (
      SELECT day,
             COALESCE(sum(events) FILTER (WHERE event_name = 'career_created'), 0) AS careers,
             COALESCE(sum(events) FILTER (WHERE event_name = 'season_completed'), 0) AS seasons
      FROM stats GROUP BY day
    ) d
    LEFT JOIN daily_players dp ON dp.day = d.day
  ), '[]'::jsonb),
  'devices', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (
      SELECT device_type AS k, count(DISTINCT anonymous_id) AS n
      FROM pv WHERE p_version IS NULL OR game_version = p_version
      GROUP BY 1
    ) t
  ), '[]'::jsonb),
  'versions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (SELECT game_version AS k, sum(events) AS n FROM stats GROUP BY 1) t
  ), '[]'::jsonb),
  'availableVersions', COALESCE((
    SELECT jsonb_agg(v ORDER BY v DESC)
    FROM (SELECT DISTINCT game_version AS v FROM public.analytics_player_versions WHERE game_version <> 'unknown') t
  ), '[]'::jsonb),
  'leagues', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'league', league,
      'seasons', seasons, 'v2Seasons', v2,
      'champN', champ_n, 'champs', champs,
      'mvpN', mvp_n, 'mvps', mvps,
      'fmvpN', fmvp_n, 'fmvps', fmvps,
      'playoffN', po_n, 'playoffs', pos,
      'ovrAvg', ovr, 'ppgAvg', ppg, 'rpgAvg', rpg, 'apgAvg', apg
    ) ORDER BY seasons DESC)
    FROM (
      SELECT league,
             sum(events) AS seasons, sum(v2) AS v2,
             sum(champ_n) AS champ_n, sum(champs) AS champs,
             sum(mvp_n) AS mvp_n, sum(mvps) AS mvps,
             sum(fmvp_n) AS fmvp_n, sum(fmvps) AS fmvps,
             sum(po_n) AS po_n, sum(pos) AS pos,
             round(sum(ovr_sum) / NULLIF(sum(ovr_n), 0), 1) AS ovr,
             round(sum(ppg_sum) / NULLIF(sum(ppg_n), 0), 1) AS ppg,
             round(sum(rpg_sum) / NULLIF(sum(rpg_n), 0), 1) AS rpg,
             round(sum(apg_sum) / NULLIF(sum(apg_n), 0), 1) AS apg
      FROM sseasons GROUP BY 1
    ) t
  ), '[]'::jsonb),
  'positionsCreated', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (SELECT COALESCE(position, 'unknown') AS k, count(*) AS n FROM runs GROUP BY 1) t
  ), '[]'::jsonb),
  'positionSeasons', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'position', position,
      'seasons', seasons,
      'champN', champ_n, 'champs', champs,
      'mvpN', mvp_n, 'mvps', mvps,
      'fmvpN', fmvp_n, 'fmvps', fmvps,
      'ovrAvg', ovr, 'ppgAvg', ppg, 'rpgAvg', rpg, 'apgAvg', apg
    ) ORDER BY seasons DESC)
    FROM (
      SELECT position,
             sum(events) AS seasons,
             sum(champ_n) AS champ_n, sum(champs) AS champs,
             sum(mvp_n) AS mvp_n, sum(mvps) AS mvps,
             sum(fmvp_n) AS fmvp_n, sum(fmvps) AS fmvps,
             round(sum(ovr_sum) / NULLIF(sum(ovr_n), 0), 1) AS ovr,
             round(sum(ppg_sum) / NULLIF(sum(ppg_n), 0), 1) AS ppg,
             round(sum(rpg_sum) / NULLIF(sum(rpg_n), 0), 1) AS rpg,
             round(sum(apg_sum) / NULLIF(sum(apg_n), 0), 1) AS apg
      FROM sseasons
      WHERE p_league IS NULL OR league = p_league
      GROUP BY 1
    ) t
  ), '[]'::jsonb),
  'leagueReach', jsonb_build_object(
    'runs', (SELECT count(DISTINCT career_run_id) FROM reach),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', league, 'count', n) ORDER BY n DESC)
      FROM (SELECT league, count(DISTINCT career_run_id) AS n FROM reach GROUP BY 1) t
    ), '[]'::jsonb)
  ),
  'maxSeason', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', s, 'count', n) ORDER BY s)
    FROM (
      SELECT s, count(*) AS n FROM (
        SELECT career_run_id, max(season_number)::int AS s
        FROM seasons WHERE career_run_id IS NOT NULL AND season_number IS NOT NULL
        GROUP BY 1
      ) r GROUP BY 1
    ) t
  ), '[]'::jsonb),
  'resets', jsonb_build_object(
    'total', (SELECT count(*) FROM fresets),
    'roleN', (SELECT count(role) FROM fresets),
    'champN', (SELECT count(had_champ) FROM fresets),
    'hadChamp', (SELECT count(*) FROM fresets WHERE had_champ),
    'mvpN', (SELECT count(had_mvp) FROM fresets),
    'hadMvp', (SELECT count(*) FROM fresets WHERE had_mvp),
    'byLeague', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT COALESCE(league, 'unknown') AS k, count(*) AS n FROM fresets GROUP BY 1) t
    ), '[]'::jsonb),
    'bySeason', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY k)
      FROM (SELECT season::int AS k, count(*) AS n FROM fresets WHERE season IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb),
    'byOvr', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY k)
      FROM (SELECT (floor(ovr / 10) * 10)::int AS k, count(*) AS n FROM fresets WHERE ovr IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb),
    'byRole', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT role AS k, count(*) AS n FROM fresets WHERE role IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb)
  ),
  'roles', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (SELECT role AS k, count(*) AS n FROM fseasons WHERE role IS NOT NULL GROUP BY 1) t
  ), '[]'::jsonb),
  'playoffResults', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (SELECT playoff_result AS k, count(*) AS n FROM fseasons WHERE playoff_result IS NOT NULL GROUP BY 1) t
  ), '[]'::jsonb),
  'awardSeasons', (SELECT count(*) FROM fseasons WHERE awards IS NOT NULL),
  'awards', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (
      SELECT a AS k, count(*) AS n
      FROM fseasons, LATERAL jsonb_array_elements_text(awards) AS a
      WHERE awards IS NOT NULL GROUP BY 1
    ) t
  ), '[]'::jsonb),
  'endings', jsonb_build_object(
    'total', (SELECT count(*) FROM ended),
    'hofN', (SELECT count(hall_of_fame) FROM ended),
    'hof', (SELECT count(*) FROM ended WHERE hall_of_fame),
    'byType', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT ending_type AS k, count(*) AS n FROM ended WHERE ending_type IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb)
  ),
  'created', jsonb_build_object(
    'playstyle', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT playstyle AS k, count(*) AS n FROM runs WHERE playstyle IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb),
    'growthDna', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT growth_dna AS k, count(*) AS n FROM runs WHERE growth_dna IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb),
    'trainingFocus', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT training_focus AS k, count(*) AS n FROM runs WHERE training_focus IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb),
    'startingLeague', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT starting_league AS k, count(*) AS n FROM runs WHERE starting_league IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb)
  ),
  'leagueChanges', jsonb_build_object(
    'total', (SELECT count(*) FROM base WHERE event_name = 'league_changed'),
    'byReason', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT p->>'changeReason' AS k, count(*) AS n FROM base
            WHERE event_name = 'league_changed' AND jsonb_typeof(p->'changeReason') = 'string' GROUP BY 1) t
    ), '[]'::jsonb),
    'byDraftRound', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY k)
      FROM (SELECT (p->>'draftRound')::int AS k, count(*) AS n FROM base
            WHERE event_name = 'league_changed' AND jsonb_typeof(p->'draftRound') = 'number' GROUP BY 1) t
    ), '[]'::jsonb)
  ),
  'creationFunnel', jsonb_build_object(
    'startedSessions', (SELECT count(*) FROM cstart),
    'createdSessions', (SELECT count(DISTINCT created_session_id) FROM funnel_runs),
    'runs', (SELECT count(*) FROM funnel_runs),
    'reachedDraft', (SELECT count(*) FROM funnel_runs WHERE reached_draft),
    'drafted', (SELECT count(*) FROM funnel_runs WHERE drafted),
    'nbaDrafted', (SELECT count(*) FROM funnel_runs WHERE nba_drafted),
    'reachedNba', (SELECT count(*) FROM funnel_runs WHERE reached_nba),
    'ended', (SELECT count(*) FROM funnel_runs WHERE ended_at IS NOT NULL),
    'reset', (SELECT count(*) FROM funnel_runs WHERE reset_at IS NOT NULL),
    'draftOutcomes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', draft_key, 'count', n, 'ovrAvg', ovr, 'pickAvg', pick, 'twoWay', two_way
      ) ORDER BY draft_key)
      FROM (
        SELECT draft_key,
               sum(events) AS n,
               round(sum(ovr_sum) / NULLIF(sum(ovr_n), 0), 1) AS ovr,
               round(sum(pick_sum) / NULLIF(sum(pick_n), 0), 1) AS pick,
               sum(two_way) AS two_way
        FROM stats WHERE event_name = 'draft_completed' GROUP BY 1
      ) t
    ), '[]'::jsonb)
  ),
  'survey', jsonb_build_object(
    'total', (SELECT count(*) FROM surveys),
    'submitted', (SELECT count(*) FROM surveys WHERE status = 'submitted'),
    'skipped', (SELECT count(*) FROM surveys WHERE status = 'skipped'),
    'withComment', (SELECT count(*) FROM surveys WHERE has_comment),
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'n', n, 'avg', avg_all,
        'dist', dist,
        'expN', exp_n, 'expAvg', exp_avg,
        'noExpN', noexp_n, 'noExpAvg', noexp_avg
      ) ORDER BY ord)
      FROM (
        SELECT ord, key,
               count(rating) AS n,
               round(avg(rating), 2) AS avg_all,
               jsonb_build_array(
                 count(*) FILTER (WHERE rating = 1), count(*) FILTER (WHERE rating = 2),
                 count(*) FILTER (WHERE rating = 3), count(*) FILTER (WHERE rating = 4),
                 count(*) FILTER (WHERE rating = 5)
               ) AS dist,
               count(rating) FILTER (WHERE experienced) AS exp_n,
               round(avg(rating) FILTER (WHERE experienced), 2) AS exp_avg,
               count(rating) FILTER (WHERE experienced IS FALSE) AS noexp_n,
               round(avg(rating) FILTER (WHERE experienced IS FALSE), 2) AS noexp_avg
        FROM survey_answers
        GROUP BY ord, key
      ) t
    ), '[]'::jsonb)
  ),
  'versionCompare', COALESCE((
    -- 버전 비교는 기간 필터만 적용하고 버전 필터는 무시합니다
    SELECT jsonb_agg(jsonb_build_object(
      'version', ev.v,
      'players', ev.players, 'sessions', COALESCE(sv.sessions, 0),
      'runs', COALESCE(rp.runs, 0), 'reachedNba', COALESCE(rp.nba, 0),
      'ended', COALESCE(rp.ended, 0), 'reset', COALESCE(rp.reset, 0),
      'seasons', COALESCE(sv.seasons, 0),
      'nbaSeasons', COALESCE(sv.nba_seasons, 0),
      'nbaChampN', COALESCE(sv.nba_champ_n, 0), 'nbaChamps', COALESCE(sv.nba_champs, 0),
      'nbaMvpN', COALESCE(sv.nba_mvp_n, 0), 'nbaMvps', COALESCE(sv.nba_mvps, 0),
      'nbaPlayoffN', COALESCE(sv.nba_po_n, 0), 'nbaPlayoffs', COALESCE(sv.nba_po, 0),
      'endings', COALESCE(en.endings, 0), 'hofN', COALESCE(en.hof_n, 0), 'hof', COALESCE(en.hof, 0),
      'careerSeasonsAvg', en.seasons_avg
    ))
    FROM (
      SELECT game_version AS v, count(DISTINCT anonymous_id) AS players FROM pv GROUP BY 1
    ) ev
    LEFT JOIN (
      SELECT game_version AS v, count(*) AS runs,
             count(*) FILTER (WHERE reached_nba) AS nba,
             count(*) FILTER (WHERE ended_at IS NOT NULL) AS ended,
             count(*) FILTER (WHERE reset_at IS NOT NULL) AS reset
      FROM runs_all GROUP BY 1
    ) rp ON rp.v = ev.v
    LEFT JOIN (
      SELECT game_version AS v,
             sum(events) FILTER (WHERE event_name = 'session_start') AS sessions,
             sum(events) FILTER (WHERE event_name = 'season_completed') AS seasons,
             sum(events) FILTER (WHERE event_name = 'season_completed' AND league = 'NBA') AS nba_seasons,
             sum(champ_n) FILTER (WHERE event_name = 'season_completed' AND league = 'NBA') AS nba_champ_n,
             sum(champs) FILTER (WHERE event_name = 'season_completed' AND league = 'NBA') AS nba_champs,
             sum(mvp_n) FILTER (WHERE event_name = 'season_completed' AND league = 'NBA') AS nba_mvp_n,
             sum(mvps) FILTER (WHERE event_name = 'season_completed' AND league = 'NBA') AS nba_mvps,
             sum(po_n) FILTER (WHERE event_name = 'season_completed' AND league = 'NBA') AS nba_po_n,
             sum(pos) FILTER (WHERE event_name = 'season_completed' AND league = 'NBA') AS nba_po
      FROM stats_all GROUP BY 1
    ) sv ON sv.v = ev.v
    LEFT JOIN (
      SELECT ended_version AS v, count(*) AS endings,
             count(hall_of_fame) AS hof_n,
             count(*) FILTER (WHERE hall_of_fame) AS hof,
             round(avg(total_seasons), 1) AS seasons_avg
      FROM ended_all GROUP BY 1
    ) en ON en.v = ev.v
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.admin_analytics_report(timestamptz, text, text)
  IS '관리자 플레이 통계 대시보드용 서버 집계 v3 (요약 테이블 + 최근 원본, service_role 전용, 읽기 전용)';

REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_report(timestamptz, text, text) TO service_role;
