import Link from 'next/link'
import { t, type Locale } from '@/lib/i18n/translations'

interface FooterLink {
  id: string
  labelZh: string
  labelEn: string
  url: string
  isExternal: boolean
}

interface FooterLinksData {
  [category: string]: FooterLink[]
}

interface FooterProps {
  lang?: 'zh' | 'en'
  footerLinks?: FooterLinksData
}

// 分类名称映射
const categoryNames: Record<string, { zh: string; en: string }> = {
  about: { zh: '关于', en: 'About' },
  resources: { zh: '资源', en: 'Resources' },
  developers: { zh: '开发者', en: 'Developers' },
  community: { zh: '社区', en: 'Community' },
}

// 默认链接配置（当数据库无数据时使用）
const defaultFooterLinks: FooterLinksData = {
  about: [
    { id: '1', labelZh: '项目介绍', labelEn: 'About Us', url: '/about', isExternal: false },
    { id: '2', labelZh: 'API 文档', labelEn: 'API Docs', url: '/api-docs', isExternal: false },
  ],
  resources: [
    { id: '3', labelZh: '文章库', labelEn: 'Articles', url: '/articles', isExternal: false },
    { id: '4', labelZh: '标签索引', labelEn: 'Tags', url: '/tags', isExternal: false },
  ],
  developers: [
    { id: '5', labelZh: 'API 接入', labelEn: 'API Access', url: '/api-docs', isExternal: false },
    { id: '6', labelZh: 'GitHub', labelEn: 'GitHub', url: 'https://github.com/buzhou-ai', isExternal: true },
  ],
  community: [
    { id: '7', labelZh: 'Discord', labelEn: 'Discord', url: 'https://discord.gg/buzhou', isExternal: true },
    { id: '8', labelZh: 'Twitter', labelEn: 'Twitter', url: 'https://twitter.com/buzhou_ai', isExternal: true },
  ],
}

export function Footer({ lang = 'zh', footerLinks }: FooterProps) {
  const currentYear = new Date().getFullYear()

  // 使用传入的链接配置或默认配置
  const links = footerLinks && Object.keys(footerLinks).length > 0
    ? footerLinks
    : defaultFooterLinks

  return (
    <footer className="border-t py-8 md:py-12">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h3 className="font-semibold mb-4">
                {categoryNames[category]?.[lang] || category}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.isExternal ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                      >
                        {lang === 'zh' ? item.labelZh : item.labelEn}
                      </a>
                    ) : (
                      <Link
                        href={`/${lang}${item.url}`}
                        className="hover:text-foreground transition-colors"
                      >
                        {lang === 'zh' ? item.labelZh : item.labelEn}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 版权信息 */}
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            © {currentYear} Buzhou.{' '}
            {t(lang, 'footer.copyright')}
          </p>
          <p className="mt-2">
            {t(lang, 'footer.tagline')}
          </p>
        </div>
      </div>
    </footer>
  )
}