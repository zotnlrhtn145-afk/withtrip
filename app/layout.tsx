import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Noto_Sans_KR } from 'next/font/google'
import { AppShell } from '@/components/app-shell'
import './globals.css'

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
    <html lang="ko" className="bg-background" data-scroll-behavior="smooth">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
