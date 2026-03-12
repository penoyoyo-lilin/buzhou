import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const SITE_URL = 'https://www.buzhou.io'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Buzhou - AI Agent Knowledge Hub',
    template: '%s | Buzhou',
  },
  description: 'AI Agent 的可执行知识中枢与技能交易网络',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    title: 'Buzhou - AI Agent Knowledge Hub',
    description: 'AI Agent 的可执行知识中枢与技能交易网络',
    siteName: 'Buzhou',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buzhou - AI Agent Knowledge Hub',
    description: 'AI Agent 的可执行知识中枢与技能交易网络',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const requestHeaders = headers()
  const htmlLang = requestHeaders.get('x-buzhou-lang') === 'en-US' ? 'en-US' : 'zh-CN'

  return (
    <html lang={htmlLang}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
