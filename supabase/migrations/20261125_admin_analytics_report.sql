-- ============================================================================
-- 로드 투 MVP (Road to MVP) - 관리자 플레이 통계 서버 집계 함수
-- - analytics_events 테이블과 기존 행은 전혀 변경하지 않습니다 (함수만 추가).
-- - 원본 행을 내려받아 JS로 집계하던 방식은 5,000행 상한에 걸려 잘렸기 때문에,
--   집계를 Postgres 안에서 끝내고 작은 JSON 한 개만 반환합니다.
-- - service_role(서버 API)만 실행할 수 있고 anon/authenticated는 실행할 수 없습니다.
-- - 다시 실행해도 안전합니다 (CREATE OR REPLACE).
--
-- 구버전 payload(1차 고도화 이전) 호환 규칙:
-- - FMVP: wonFmvp가 없으면 wonFinalsMvp를 사용합니다.
-- - 시즌 포지션: payload.position이 없으면 같은 career_run_id의 career_created 포지션을 사용합니다.
-- - 비율의 모수(*N)는 해당 필드가 실제로 들어 있는 행 수만 셉니다.
-- ============================================================================

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
WITH base AS (
  SELECT e.event_name, e.anonymous_id, e.session_id, e.career_run_id,
         e.game_version, e.device_type, e.payload AS p, e.created_at
  FROM public.analytics_events e
  WHERE (p_since IS NULL OR e.created_at >= p_since)
    AND (p_version IS NULL OR e.game_version = p_version)
),
created_pos AS (
  -- 커리어 생성 시 포지션 (기간 필터와 무관하게 전체 기간에서 조회)
  SELECT DISTINCT ON (career_run_id) career_run_id, payload->>'position' AS position
  FROM public.analytics_events
  WHERE event_name = 'career_created'
    AND career_run_id IS NOT NULL
    AND jsonb_typeof(payload->'position') = 'string'
  ORDER BY career_run_id, created_at
),
seasons AS (
  SELECT
    b.career_run_id,
    b.p->>'league' AS league,
    COALESCE(
      CASE WHEN jsonb_typeof(b.p->'position') = 'string' THEN b.p->>'position' END,
      cp.position
    ) AS position,
    (b.p ? 'playoffResult') AS is_v2,
    CASE WHEN jsonb_typeof(b.p->'wonChampionship') = 'boolean' THEN (b.p->>'wonChampionship')::boolean END AS champ,
    CASE WHEN jsonb_typeof(b.p->'wonMvp') = 'boolean' THEN (b.p->>'wonMvp')::boolean END AS mvp,
    CASE
      WHEN jsonb_typeof(b.p->'wonFmvp') = 'boolean' THEN (b.p->>'wonFmvp')::boolean
      WHEN jsonb_typeof(b.p->'wonFinalsMvp') = 'boolean' THEN (b.p->>'wonFinalsMvp')::boolean
    END AS fmvp,
    CASE WHEN jsonb_typeof(b.p->'madePlayoffs') = 'boolean' THEN (b.p->>'madePlayoffs')::boolean END AS playoffs,
    CASE WHEN jsonb_typeof(b.p->'isStarter') = 'boolean' THEN (b.p->>'isStarter')::boolean END AS starter,
    CASE WHEN jsonb_typeof(b.p->'playoffResult') = 'string' THEN b.p->>'playoffResult' END AS playoff_result,
    CASE WHEN jsonb_typeof(b.p->'role') = 'string' THEN b.p->>'role' END AS role,
    CASE WHEN jsonb_typeof(b.p->'awards') = 'array' THEN b.p->'awards' END AS awards,
    CASE WHEN jsonb_typeof(b.p->'seasonNumber') = 'number' THEN (b.p->>'seasonNumber')::numeric END AS season_number,
    CASE WHEN jsonb_typeof(b.p->'overall') = 'number' THEN (b.p->>'overall')::numeric END AS ovr,
    CASE WHEN jsonb_typeof(b.p->'overallDelta') = 'number' THEN (b.p->>'overallDelta')::numeric END AS ovr_delta,
    CASE WHEN jsonb_typeof(b.p->'ppg') = 'number' THEN (b.p->>'ppg')::numeric END AS ppg,
    CASE WHEN jsonb_typeof(b.p->'rpg') = 'number' THEN (b.p->>'rpg')::numeric END AS rpg,
    CASE WHEN jsonb_typeof(b.p->'apg') = 'number' THEN (b.p->>'apg')::numeric END AS apg,
    CASE WHEN jsonb_typeof(b.p->'mpg') = 'number' THEN (b.p->>'mpg')::numeric END AS mpg
  FROM base b
  LEFT JOIN created_pos cp ON cp.career_run_id = b.career_run_id
  WHERE b.event_name = 'season_completed'
),
fseasons AS (
  -- 리그 필터가 적용되는 시즌 단위 분석용
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
endings AS (
  SELECT
    CASE WHEN jsonb_typeof(p->'endingType') = 'string' THEN p->>'endingType' END AS ending_type,
    CASE WHEN jsonb_typeof(p->'hallOfFame') = 'boolean' THEN (p->>'hallOfFame')::boolean END AS hof
  FROM base
  WHERE event_name = 'career_ended'
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'kpi', (
    SELECT jsonb_build_object(
      'totalEvents', count(*),
      'uniquePlayers', count(DISTINCT anonymous_id),
      'totalSessions', count(*) FILTER (WHERE event_name = 'session_start'),
      'careersCreated', count(*) FILTER (WHERE event_name = 'career_created'),
      'seasonsCompleted', count(*) FILTER (WHERE event_name = 'season_completed'),
      'careersEnded', count(*) FILTER (WHERE event_name = 'career_ended'),
      'careersReset', count(*) FILTER (WHERE event_name = 'career_reset'),
      'championships', (SELECT count(*) FROM seasons WHERE champ),
      'mvps', (SELECT count(*) FROM seasons WHERE mvp),
      'fmvps', (SELECT count(*) FROM seasons WHERE fmvp)
    )
    FROM base
  ),
  'daily', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('date', d, 'players', players, 'careers', careers, 'seasons', seasons) ORDER BY d)
    FROM (
      SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS d,
             count(DISTINCT anonymous_id) AS players,
             count(*) FILTER (WHERE event_name = 'career_created') AS careers,
             count(*) FILTER (WHERE event_name = 'season_completed') AS seasons
      FROM base GROUP BY 1
    ) t
  ), '[]'::jsonb),
  'devices', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (SELECT COALESCE(device_type, 'unknown') AS k, count(DISTINCT anonymous_id) AS n FROM base GROUP BY 1) t
  ), '[]'::jsonb),
  'versions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (SELECT COALESCE(game_version, 'unknown') AS k, count(*) AS n FROM base GROUP BY 1) t
  ), '[]'::jsonb),
  'availableVersions', COALESCE((
    SELECT jsonb_agg(v ORDER BY v DESC)
    FROM (SELECT DISTINCT game_version AS v FROM public.analytics_events WHERE game_version IS NOT NULL) t
  ), '[]'::jsonb),
  'leagues', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'league', league,
      'seasons', seasons, 'v2Seasons', v2,
      'champN', champ_n, 'champs', champs,
      'mvpN', mvp_n, 'mvps', mvps,
      'fmvpN', fmvp_n, 'fmvps', fmvps,
      'playoffN', playoff_n, 'playoffs', playoffs,
      'ovrAvg', ovr, 'ppgAvg', ppg, 'rpgAvg', rpg, 'apgAvg', apg
    ) ORDER BY seasons DESC)
    FROM (
      SELECT COALESCE(league, 'unknown') AS league,
             count(*) AS seasons, count(*) FILTER (WHERE is_v2) AS v2,
             count(champ) AS champ_n, count(*) FILTER (WHERE champ) AS champs,
             count(mvp) AS mvp_n, count(*) FILTER (WHERE mvp) AS mvps,
             count(fmvp) AS fmvp_n, count(*) FILTER (WHERE fmvp) AS fmvps,
             count(playoffs) AS playoff_n, count(*) FILTER (WHERE playoffs) AS playoffs,
             round(avg(ovr), 1) AS ovr, round(avg(ppg), 1) AS ppg,
             round(avg(rpg), 1) AS rpg, round(avg(apg), 1) AS apg
      FROM seasons GROUP BY 1
    ) t
  ), '[]'::jsonb),
  'positionsCreated', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
    FROM (
      SELECT COALESCE(p->>'position', 'unknown') AS k, count(*) AS n
      FROM base WHERE event_name = 'career_created' GROUP BY 1
    ) t
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
      SELECT COALESCE(position, 'unknown') AS position,
             count(*) AS seasons,
             count(champ) AS champ_n, count(*) FILTER (WHERE champ) AS champs,
             count(mvp) AS mvp_n, count(*) FILTER (WHERE mvp) AS mvps,
             count(fmvp) AS fmvp_n, count(*) FILTER (WHERE fmvp) AS fmvps,
             round(avg(ovr), 1) AS ovr, round(avg(ppg), 1) AS ppg,
             round(avg(rpg), 1) AS rpg, round(avg(apg), 1) AS apg
      FROM fseasons GROUP BY 1
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
    'total', (SELECT count(*) FROM endings),
    'hofN', (SELECT count(hof) FROM endings),
    'hof', (SELECT count(*) FROM endings WHERE hof),
    'byType', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT ending_type AS k, count(*) AS n FROM endings WHERE ending_type IS NOT NULL GROUP BY 1) t
    ), '[]'::jsonb)
  ),
  'created', jsonb_build_object(
    'playstyle', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT p->>'playstyle' AS k, count(*) AS n FROM base
            WHERE event_name = 'career_created' AND jsonb_typeof(p->'playstyle') = 'string' GROUP BY 1) t
    ), '[]'::jsonb),
    'growthDna', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT p->>'growthDna' AS k, count(*) AS n FROM base
            WHERE event_name = 'career_created' AND jsonb_typeof(p->'growthDna') = 'string' GROUP BY 1) t
    ), '[]'::jsonb),
    'trainingFocus', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT p->>'trainingFocus' AS k, count(*) AS n FROM base
            WHERE event_name = 'career_created' AND jsonb_typeof(p->'trainingFocus') = 'string' GROUP BY 1) t
    ), '[]'::jsonb),
    'startingLeague', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC)
      FROM (SELECT p->>'startingLeague' AS k, count(*) AS n FROM base
            WHERE event_name = 'career_created' AND jsonb_typeof(p->'startingLeague') = 'string' GROUP BY 1) t
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
  )
);
$$;

COMMENT ON FUNCTION public.admin_analytics_report(timestamptz, text, text)
  IS '관리자 플레이 통계 대시보드용 서버 집계 (service_role 전용, 읽기 전용)';

-- 서버 API(service_role)만 실행 가능하도록 권한 제한
REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_report(timestamptz, text, text) TO service_role;
