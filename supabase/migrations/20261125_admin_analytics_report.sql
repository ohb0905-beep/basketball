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
--
-- schemaVersion 2 (2026-11-25): creationFunnel(생성→드래프트 퍼널), survey(난이도 설문),
-- versionCompare(버전별 비교, 버전 필터 무시) 키를 추가했습니다. 기존 키는 그대로입니다.
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
),
-- ---------------------------------------------------------------------------
-- 2차 추가 (schemaVersion 2): 생성→드래프트 퍼널, 난이도 설문, 버전별 비교
-- ---------------------------------------------------------------------------
cstart AS (
  -- 생성 화면 진입은 세션당 1회만 기록되므로 세션 단위로 셉니다 (1.0.1부터 수집)
  SELECT DISTINCT session_id FROM base WHERE event_name = 'creation_started'
),
funnel_runs AS (
  -- 생성 화면 진입이 기록된 세션에서 만든 커리어만 (구버전 커리어 제외 → 같은 모수 유지)
  SELECT DISTINCT b.career_run_id
  FROM base b
  JOIN cstart cs ON cs.session_id = b.session_id
  WHERE b.event_name = 'career_created' AND b.career_run_id IS NOT NULL
),
run_progress AS (
  -- 커리어의 이후 이벤트는 기간·버전 필터와 무관하게 전체에서 찾습니다
  SELECT
    fr.career_run_id,
    bool_or(e.event_name = 'draft_completed') AS reached_draft,
    bool_or(e.event_name = 'draft_completed' AND e.payload->>'drafted' = 'true') AS drafted,
    bool_or(e.event_name = 'draft_completed' AND e.payload->>'drafted' = 'true'
            AND e.payload->>'draftType' = 'NBA') AS nba_drafted,
    bool_or(
      (e.event_name = 'season_completed' AND e.payload->>'league' = 'NBA')
      OR (e.event_name = 'league_changed' AND e.payload->>'toLeague' = 'NBA')
    ) AS reached_nba,
    bool_or(e.event_name = 'career_ended') AS ended,
    bool_or(e.event_name = 'career_reset') AS reset
  FROM funnel_runs fr
  LEFT JOIN public.analytics_events e ON e.career_run_id = fr.career_run_id
  GROUP BY fr.career_run_id
),
drafts AS (
  SELECT
    CASE WHEN jsonb_typeof(p->'draftType') = 'string' THEN p->>'draftType' END AS draft_type,
    CASE WHEN jsonb_typeof(p->'drafted') = 'boolean' THEN (p->>'drafted')::boolean END AS drafted,
    CASE WHEN jsonb_typeof(p->'round') = 'number' THEN (p->>'round')::int END AS round,
    CASE WHEN jsonb_typeof(p->'pickNumber') = 'number' THEN (p->>'pickNumber')::numeric END AS pick,
    CASE WHEN jsonb_typeof(p->'overall') = 'number' THEN (p->>'overall')::numeric END AS ovr,
    CASE WHEN jsonb_typeof(p->'hasTwoWayOffer') = 'boolean' THEN (p->>'hasTwoWayOffer')::boolean END AS two_way
  FROM base
  WHERE event_name = 'draft_completed'
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
vbase AS (
  -- 버전 비교는 기간 필터만 적용하고 버전 필터는 무시합니다
  SELECT e.event_name, e.anonymous_id, e.session_id, e.career_run_id,
         COALESCE(e.game_version, 'unknown') AS v, e.payload AS p
  FROM public.analytics_events e
  WHERE (p_since IS NULL OR e.created_at >= p_since)
),
vruns AS (
  SELECT DISTINCT ON (career_run_id) career_run_id, v
  FROM vbase
  WHERE event_name = 'career_created' AND career_run_id IS NOT NULL
  ORDER BY career_run_id, v
),
vrun_progress AS (
  SELECT
    vr.v,
    vr.career_run_id,
    bool_or(
      (e.event_name = 'season_completed' AND e.payload->>'league' = 'NBA')
      OR (e.event_name = 'league_changed' AND e.payload->>'toLeague' = 'NBA')
    ) AS reached_nba,
    bool_or(e.event_name = 'career_ended') AS ended,
    bool_or(e.event_name = 'career_reset') AS reset
  FROM vruns vr
  LEFT JOIN public.analytics_events e ON e.career_run_id = vr.career_run_id
  GROUP BY vr.v, vr.career_run_id
)
SELECT jsonb_build_object(
  'schemaVersion', 2,
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
  ),
  'creationFunnel', jsonb_build_object(
    'startedSessions', (SELECT count(*) FROM cstart),
    'createdSessions', (
      SELECT count(DISTINCT b.session_id)
      FROM base b JOIN cstart cs ON cs.session_id = b.session_id
      WHERE b.event_name = 'career_created'
    ),
    'runs', (SELECT count(*) FROM run_progress),
    'reachedDraft', (SELECT count(*) FROM run_progress WHERE reached_draft),
    'drafted', (SELECT count(*) FROM run_progress WHERE drafted),
    'nbaDrafted', (SELECT count(*) FROM run_progress WHERE nba_drafted),
    'reachedNba', (SELECT count(*) FROM run_progress WHERE reached_nba),
    'ended', (SELECT count(*) FROM run_progress WHERE ended),
    'reset', (SELECT count(*) FROM run_progress WHERE reset),
    'draftOutcomes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', k, 'count', n, 'ovrAvg', ovr, 'pickAvg', pick, 'twoWay', two_way
      ) ORDER BY k)
      FROM (
        SELECT COALESCE(draft_type, 'unknown') || '_' ||
                 CASE WHEN drafted IS NOT TRUE THEN 'UNDRAFTED'
                      WHEN round IS NULL THEN 'DRAFTED'
                      ELSE 'R' || round END AS k,
               count(*) AS n,
               round(avg(ovr), 1) AS ovr,
               round(avg(pick), 1) AS pick,
               count(*) FILTER (WHERE two_way) AS two_way
        FROM drafts GROUP BY 1
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
    SELECT jsonb_agg(jsonb_build_object(
      'version', ev.v,
      'players', ev.players, 'sessions', ev.sessions,
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
      SELECT v, count(DISTINCT anonymous_id) AS players,
             count(*) FILTER (WHERE event_name = 'session_start') AS sessions
      FROM vbase GROUP BY v
    ) ev
    LEFT JOIN (
      SELECT v, count(*) AS runs,
             count(*) FILTER (WHERE reached_nba) AS nba,
             count(*) FILTER (WHERE ended) AS ended,
             count(*) FILTER (WHERE reset) AS reset
      FROM vrun_progress GROUP BY v
    ) rp ON rp.v = ev.v
    LEFT JOIN (
      SELECT v, count(*) AS seasons,
             count(*) FILTER (WHERE p->>'league' = 'NBA') AS nba_seasons,
             count(*) FILTER (WHERE p->>'league' = 'NBA' AND jsonb_typeof(p->'wonChampionship') = 'boolean') AS nba_champ_n,
             count(*) FILTER (WHERE p->>'league' = 'NBA' AND p->>'wonChampionship' = 'true') AS nba_champs,
             count(*) FILTER (WHERE p->>'league' = 'NBA' AND jsonb_typeof(p->'wonMvp') = 'boolean') AS nba_mvp_n,
             count(*) FILTER (WHERE p->>'league' = 'NBA' AND p->>'wonMvp' = 'true') AS nba_mvps,
             count(*) FILTER (WHERE p->>'league' = 'NBA' AND jsonb_typeof(p->'madePlayoffs') = 'boolean') AS nba_po_n,
             count(*) FILTER (WHERE p->>'league' = 'NBA' AND p->>'madePlayoffs' = 'true') AS nba_po
      FROM vbase WHERE event_name = 'season_completed' GROUP BY v
    ) sv ON sv.v = ev.v
    LEFT JOIN (
      SELECT v, count(*) AS endings,
             count(*) FILTER (WHERE jsonb_typeof(p->'hallOfFame') = 'boolean') AS hof_n,
             count(*) FILTER (WHERE p->>'hallOfFame' = 'true') AS hof,
             round(avg(CASE WHEN jsonb_typeof(p->'totalSeasons') = 'number' THEN (p->>'totalSeasons')::numeric END), 1) AS seasons_avg
      FROM vbase WHERE event_name = 'career_ended' GROUP BY v
    ) en ON en.v = ev.v
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.admin_analytics_report(timestamptz, text, text)
  IS '관리자 플레이 통계 대시보드용 서버 집계 (service_role 전용, 읽기 전용)';

-- 서버 API(service_role)만 실행 가능하도록 권한 제한
REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_report(timestamptz, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_report(timestamptz, text, text) TO service_role;
