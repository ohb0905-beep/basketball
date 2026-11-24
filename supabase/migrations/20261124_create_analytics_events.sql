-- ============================================================================
-- 로드 투 MVP (Road to MVP) - 익명 게임 플레이 통계 이벤트 저장 테이블
-- 1단계: 클라이언트 마일스톤 트래커 -> Next.js 서버 API(service_role) -> Supabase 저장
-- - 개인 식별 정보(PII) 및 사용자 자유 입력 선수명 저장 금지
-- - 관리자 통계 대시보드(2단계)에서 시계열/퍼널/밸런스 집계에 활용
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL CHECK (
    event_name IN (
      'session_start',
      'career_created',
      'season_completed',
      'league_changed',
      'career_ended',
      'career_reset'
    )
  ),
  anonymous_id text NOT NULL CHECK (
    char_length(btrim(anonymous_id)) BETWEEN 1 AND 64
  ),
  session_id text NOT NULL CHECK (
    char_length(btrim(session_id)) BETWEEN 1 AND 64
  ),
  career_run_id text CHECK (
    career_run_id IS NULL OR char_length(btrim(career_run_id)) BETWEEN 1 AND 64
  ),
  game_version text CHECK (
    game_version IS NULL OR char_length(btrim(game_version)) BETWEEN 1 AND 32
  ),
  device_type text CHECK (
    device_type IS NULL OR device_type IN ('mobile', 'tablet', 'desktop')
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(payload) = 'object'
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analytics_events IS '로드 투 MVP 익명 게임 플레이 마일스톤 통계 이벤트 로그';
COMMENT ON COLUMN public.analytics_events.event_name IS '허용된 마일스톤 이벤트명 (session_start, career_created, season_completed, league_changed, career_ended, career_reset)';
COMMENT ON COLUMN public.analytics_events.anonymous_id IS '브라우저 단위 익명 식별자 (UUID, 개인정보 아님)';
COMMENT ON COLUMN public.analytics_events.session_id IS '탭 세션 단위 익명 식별자 (UUID)';
COMMENT ON COLUMN public.analytics_events.career_run_id IS '단일 커리어 플레이 단위 익명 실행 식별자';
COMMENT ON COLUMN public.analytics_events.device_type IS '기기 유형 (mobile, tablet, desktop)';
COMMENT ON COLUMN public.analytics_events.payload IS '비민감 게임 마일스톤 요약 정보 (JSONB 객체, 최대 4KB)';

-- 시계열, 이벤트별 집계, 익명 사용자 리텐션 및 커리어 퍼널 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at_desc
  ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_created_at_desc
  ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_anonymous_id_created_at_desc
  ON public.analytics_events (anonymous_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_career_run_id
  ON public.analytics_events (career_run_id, created_at DESC)
  WHERE career_run_id IS NOT NULL;

-- ============================================================================
-- Row Level Security (RLS) 보안 정책
-- - 클라이언트(anon / authenticated)의 직접 SELECT/INSERT/UPDATE/DELETE 전면 차단
-- - 서버 API Route의 service_role 키를 통해서만 INSERT/SELECT 가능 (service_role은 RLS 우회)
-- ============================================================================
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.analytics_events FROM anon, authenticated;
