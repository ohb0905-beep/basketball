-- ============================================================================
-- 로드 투 MVP (Bench to MVP) - 게임 내 버그 제보 및 피드백 저장 테이블
-- 1단계: 사용자 제보 제출 -> Next.js 서버 API(service_role) -> Supabase 저장
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bug', 'balance', 'content', 'ui', 'other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 3000),
  game_version text,
  game_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received' CHECK (
    status IN ('received', 'reviewing', 'resolved', 'rejected')
  ),
  admin_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feedbacks IS '로드 투 MVP 인게임 익명 버그 제보 및 사용자 피드백';
COMMENT ON COLUMN public.feedbacks.type IS '제보 유형 코드 (bug, balance, content, ui, other)';
COMMENT ON COLUMN public.feedbacks.game_context IS '자동 수집된 비민감 게임 진행 및 환경 요약 정보 (JSONB)';
COMMENT ON COLUMN public.feedbacks.status IS '처리 상태 (received, reviewing, resolved, rejected)';

-- 조회 및 필터링 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at_desc
  ON public.feedbacks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedbacks_status
  ON public.feedbacks (status);

CREATE INDEX IF NOT EXISTS idx_feedbacks_type
  ON public.feedbacks (type);

-- ============================================================================
-- Row Level Security (RLS) 보안 정책
-- - 클라이언트(anon / authenticated)의 직접 SELECT/INSERT/UPDATE/DELETE 전면 차단
-- - 서버 API Route의 service_role 키를 통해서만 접근 가능 (service_role은 RLS 우회)
-- ============================================================================
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.feedbacks FROM anon, authenticated;
