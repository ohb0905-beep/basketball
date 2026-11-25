import type { Metadata } from 'next';
import { AdminAnalyticsDashboard } from '../../../components/admin/AdminAnalyticsDashboard';
import { AdminLoginView } from '../../../components/admin/AdminLoginView';
import {
  getAdminAuthConfigStatus,
  isAdminSessionAuthenticated,
} from '../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '플레이 통계 · 로드 투 MVP',
  robots: {
    index: false,
    follow: false,
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const authenticated = await isAdminSessionAuthenticated();

  if (!authenticated) {
    const configStatus = getAdminAuthConfigStatus();
    return (
      <AdminLoginView
        envConfigured={configStatus.configured}
        title="플레이 통계 로그인"
        description="서버 환경변수에 등록된 관리자 비밀번호로 인증해야 익명 플레이 통계 대시보드를 조회할 수 있습니다."
      />
    );
  }

  const params = (await searchParams) ?? {};
  return (
    <AdminAnalyticsDashboard
      initialFilters={{
        range: firstParam(params.range),
        version: firstParam(params.version),
        league: firstParam(params.league),
      }}
    />
  );
}
