-- ============================================================================
-- 로드 투 MVP - 관리자 집계 함수 v4 (기간·필터 손보기)
-- - 먼저 20261126_analytics_capacity.sql이 설치되어 있어야 합니다.
-- - 버전 필터 'release': 미리보기 배포(-preview)를 뺀 정식 버전 전체. NULL은 미리보기 포함 전체.
-- - 'hourly' 키: 기간이 3일 이내(최근 24시간, 오늘)일 때 KST 시간별 고유 플레이어·커리어·시즌.
-- - 일별 플레이어 요약에 정식 버전 합계('*release') 행을 추가합니다 (다음 매일 정리부터 쌓임).
-- - 테이블과 데이터는 바꾸지 않습니다. 다시 실행해도 안전합니다 (CREATE OR REPLACE).
-- ============================================================================

-- p_version: NULL = 전체, 'release' = 미리보기 제외, 그 밖에는 정확히 같은 버전
CREATE OR REPLACE FUNCTION public.analytics_version_matches(v text, p_version text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_version IS NULL
      OR (p_version = 'release' AND v NOT LIKE '%-preview')
      OR v = p_version
$$;

-- 일별 플레이어 요약에서 읽을 game_version 행
CREATE OR REPLACE FUNCTION public.analytics_players_bucket(p_version text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_version IS NULL THEN '*' WHEN p_version = 'release' THEN '*release' ELSE p_version END
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
  UNION ALL
  SELECT day, '*release', count(DISTINCT anonymous_id)::int FROM src
  WHERE game_version NOT LIKE '%-preview' GROUP BY 1
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.analytics_version_matches(text, text)',
    'public.analytics_players_bucket(text)',
    'public.analytics_summarize_players(timestamptz, timestamptz)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

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
  SELECT * FROM stats_all WHERE public.analytics_version_matches(game_version, p_version)
),
sseasons AS (
  SELECT * FROM stats WHERE event_name = 'season_completed'
),
daily_players AS (
  SELECT d.day, d.players
  FROM public.analytics_daily_players d, bounds b
  WHERE d.day < b.raw_day0
    AND (b.since_day IS NULL OR d.day >= b.since_day)
    AND d.game_version = public.analytics_players_bucket(p_version)
  UNION ALL
  SELECT x.day, x.players
  FROM raw_start rs, LATERAL public.analytics_summarize_players(rs.ts, NULL) x
  WHERE x.game_version = public.analytics_players_bucket(p_version)
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
  SELECT * FROM runs_all WHERE public.analytics_version_matches(game_version, p_version)
),
ended_all AS (
  SELECT * FROM public.analytics_career_runs
  WHERE ended_at IS NOT NULL AND (p_since IS NULL OR ended_at >= p_since)
),
ended AS (
  SELECT * FROM ended_all WHERE public.analytics_version_matches(ended_version, p_version)
),
-- ---------------------------------------------------------------------------
-- 원본에서만 계산하는 섹션 (원본 보존 기간까지만 보임)
-- ---------------------------------------------------------------------------
base AS (
  SELECT e.event_name, e.anonymous_id, e.session_id, e.career_run_id,
         e.game_version, e.device_type, e.payload AS p, e.created_at
  FROM public.analytics_events e
  WHERE (p_since IS NULL OR e.created_at >= p_since)
    AND public.analytics_version_matches(COALESCE(e.game_version, 'unknown'), p_version)
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
    AND public.analytics_version_matches(game_version, p_version)
),
hourly AS (
  -- 시간별 추이: 기간이 3일 이내일 때만 (원본에서 바로 계산)
  SELECT date_trunc('hour', created_at AT TIME ZONE 'Asia/Seoul') AS h,
         count(DISTINCT anonymous_id) AS players,
         count(*) FILTER (WHERE event_name = 'career_created') AS careers,
         count(*) FILTER (WHERE event_name = 'season_completed') AS seasons
  FROM base
  WHERE p_since IS NOT NULL AND p_since >= now() - interval '3 days'
  GROUP BY 1
),
funnel_runs AS (
  -- 생성 화면 진입이 기록된 세션에서 만든 커리어만 (구버전 커리어 제외 → 같은 모수 유지)
  SELECT r.* FROM runs r
  WHERE r.created_session_id IN (SELECT session_id FROM cstart)
)
SELECT jsonb_build_object(
  'schemaVersion', 4,
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
    'uniquePlayers', (SELECT count(DISTINCT anonymous_id) FROM pv WHERE public.analytics_version_matches(game_version, p_version)),
    'totalSessions', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'session_start'),
    'careersCreated', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'career_created'),
    'seasonsCompleted', (SELECT COALESCE(sum(events), 0) FROM sseasons),
    'careersEnded', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'career_ended'),
    'careersReset', (SELECT COALESCE(sum(events), 0) FROM stats WHERE event_name = 'career_reset'),
    'championships', (SELECT COALESCE(sum(champs), 0) FROM sseasons),
    'mvps', (SELECT COALESCE(sum(mvps), 0) FROM sseasons),
    'fmvps', (SELECT COALESCE(sum(fmvps), 0) FROM sseasons)
  ),
  'hourly', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'hour', to_char(h, 'YYYY-MM-DD"T"HH24'),
      'players', players, 'careers', careers, 'seasons', seasons
    ) ORDER BY h)
    FROM hourly
  ), '[]'::jsonb),
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
      FROM pv WHERE public.analytics_version_matches(game_version, p_version)
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
  IS '관리자 플레이 통계 대시보드용 서버 집계 v4 (요약 테이블 + 최근 원본, service_role 전용, 읽기 전용)';

REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_report(timestamptz, text, text) TO service_role;
