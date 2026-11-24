import type { Metadata } from 'next';
import { AdminFeedbackDashboard } from '../../../components/admin/AdminFeedbackDashboard';
import { AdminLoginView } from '../../../components/admin/AdminLoginView';
import {
  getAdminAuthConfigStatus,
  isAdminSessionAuthenticated,
} from '../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '피드백 관리 · 로드 투 MVP',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminFeedbackPage() {
  const authenticated = await isAdminSessionAuthenticated();

  if (!authenticated) {
    const configStatus = getAdminAuthConfigStatus();
    return <AdminLoginView envConfigured={configStatus.configured} />;
  }

  return <AdminFeedbackDashboard />;
}
