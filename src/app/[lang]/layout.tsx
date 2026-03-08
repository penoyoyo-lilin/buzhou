import { Header, Footer } from '@/components/layout'
import { prisma } from '@/core/db/client'

// 禁用静态生成，确保动态渲染
export const dynamic = 'force-dynamic'

export const generateStaticParams = async () => {
  return [{ lang: 'zh' }, { lang: 'en' }]
}

async function getFooterLinks() {
  try {
    const links = await prisma.footerLink.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    // 按分类分组
    const groupedLinks = links.reduce(
      (acc, link) => {
        if (!acc[link.category]) {
          acc[link.category] = []
        }
        acc[link.category].push({
          id: link.id,
          labelZh: link.labelZh,
          labelEn: link.labelEn,
          url: link.url,
          isExternal: link.isExternal,
        })
        return acc
      },
      {} as Record<string, any[]>
    )

    return groupedLinks
  } catch (error) {
    console.error('Failed to fetch footer links:', error)
    return {}
  }
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: 'zh' | 'en' }>
}) {
  const { lang } = await params
  const footerLinks = await getFooterLinks()

  return (
    <div className="flex min-h-screen flex-col">
      <Header lang={lang} />
      <main className="flex-1">{children}</main>
      <Footer lang={lang} footerLinks={footerLinks} />
    </div>
  )
}