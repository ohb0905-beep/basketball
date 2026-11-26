import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegistrar } from '../src/components/pwa/PwaRegistrar';
import { LegacyDomainMove } from '../src/components/domain/LegacyDomainMove';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: '로드 투 MVP',
  description:
    '고교 신입생으로 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 농구 커리어 시뮬레이션',
  openGraph: {
    title: '로드 투 MVP',
    description:
      '고교 신입생으로 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 농구 커리어 시뮬레이션',
    type: 'website',
  },
  applicationName: '로드 투 MVP',
  appleWebApp: {
    capable: true,
    title: '로드투MVP',
    statusBarStyle: 'black-translucent',
  },
  twitter: {
    card: 'summary_large_image',
    title: '로드 투 MVP',
    description:
      '고교 신입생으로 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 농구 커리어 시뮬레이션',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f4f6' },
    { media: '(prefers-color-scheme: dark)', color: '#101013' },
  ],
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('bench_to_mvp_theme');
    var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  } catch (e) {}
})();
`;

// 1.3.1 예전 주소(roadtomvp.vercel.app)에서는 새 주소로 옮길 때까지 화면을 잠깐 가립니다.
// 실제 이동은 LegacyDomainMove가 하고, 문제가 생겨도 몇 초 뒤에는 화면이 다시 보입니다.
const DOMAIN_MOVE_INIT_SCRIPT = `
(function() {
  try {
    var l = window.location;
    if (l.hostname !== 'roadtomvp.vercel.app') return;
    if (l.pathname === '/admin' || l.pathname.indexOf('/admin/') === 0 || l.pathname.indexOf('/api/') === 0) return;
    if (/[?&]stay=1(&|$)/.test(l.search)) return;
    if (sessionStorage.getItem('road-to-mvp-domain-move-stay') === '1') return;
    if (navigator.onLine === false) return;
    var root = document.documentElement;
    root.setAttribute('data-domain-move', 'pending');
    setTimeout(function() { root.removeAttribute('data-domain-move'); }, 4000);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: DOMAIN_MOVE_INIT_SCRIPT }} />
      </head>
      <body
        suppressHydrationWarning
        className="bg-[var(--t-bg)] text-[var(--t-g900)] antialiased selection:bg-[var(--t-accent-soft)] selection:text-[var(--t-accent-ink)]"
      >
        {children}
        <PwaRegistrar />
        <LegacyDomainMove />
        <SpeedInsights />
      </body>
    </html>
  );
}
