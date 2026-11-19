import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '벤치에서 MVP까지 (From Bench to MVP)',
  description:
    '고교 농구 벤치 끝자리에서 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 농구 커리어 시뮬레이션',
  openGraph: {
    title: '벤치에서 MVP까지 (From Bench to MVP)',
    description:
      '고교 농구 벤치 끝자리에서 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 농구 커리어 시뮬레이션',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '벤치에서 MVP까지 (From Bench to MVP)',
    description:
      '고교 농구 벤치 끝자리에서 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 농구 커리어 시뮬레이션',
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
      </head>
      <body
        suppressHydrationWarning
        className="bg-[var(--t-bg)] text-[var(--t-g900)] antialiased selection:bg-[var(--t-accent-soft)] selection:text-[var(--t-accent-ink)]"
      >
        {children}
      </body>
    </html>
  );
}
