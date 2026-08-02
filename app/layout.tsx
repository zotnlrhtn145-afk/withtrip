import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Noto_Sans_KR } from 'next/font/google'
import Script from 'next/script'
import { AppShell } from '@/components/app-shell'
import './globals.css'

/**
 * 카카오톡 인앱 브라우저로 열렸으면 즉시 기기 기본 브라우저로 넘긴다.
 * `kakaotalk://web/openExternal`은 카카오톡이 공식으로 지원하는 탈출 스킴 —
 * iOS/Android 모두에서 동작한다. 데스크톱 카카오톡은 애초에 외부 브라우저로
 * 열어서 이 스크립트가 실행돼도 조건에 안 걸린다.
 */
const KAKAO_INAPP_ESCAPE_SCRIPT = `
(function () {
  try {
    var ua = navigator.userAgent || '';
    if (/KAKAOTALK/i.test(ua)) {
      location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
    }
  } catch (e) {}
})();
`

const _jakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })
const _notoKR = Noto_Sans_KR({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WITHTRIP · 위드트립 — 함께 만드는 여행 플랜',
  description:
    'WITHTRIP(위드트립)은 친구들과 여행 일정, 숙소, 가고 싶은 맛집과 바를 한곳에서 공유하는 여행 플랜 서비스입니다.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFC107' },
    { media: '(prefers-color-scheme: dark)', color: '#2a2418' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className="min-h-screen w-full bg-white"
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen w-full bg-white font-sans antialiased">
        <Script
          id="kakao-inapp-escape"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: KAKAO_INAPP_ESCAPE_SCRIPT }}
        />
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
