import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: '벤치에서 MVP까지 (From Bench to MVP)',
  description:
    '고교 농구 벤치 끝자리에서 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 하드코어 농구 선수 육성 시뮬레이션 웹 게임',
  openGraph: {
    title: '벤치에서 MVP까지 (From Bench to MVP)',
    description:
      '고교 농구 벤치 끝자리에서 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 하드코어 농구 선수 육성 시뮬레이션 웹 게임',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '벤치에서 MVP까지 (From Bench to MVP)',
    description:
      '고교 농구 벤치 끝자리에서 시작해 대학, KBL, 해외 리그, G리그, NCAA를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 하드코어 농구 선수 육성 시뮬레이션 웹 게임',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        suppressHydrationWarning
        className={`${notoSansKr.className} bg-[#F8FAFC] text-[#0F172A] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
