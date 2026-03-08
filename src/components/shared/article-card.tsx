import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VerificationBadge, DomainBadge } from './verification-badge'
import type { ArticleDomain, VerificationStatus } from '@/types'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ArticleCardProps {
  id: string
  slug: string
  title: { zh: string; en: string }
  summary: { zh: string; en: string }
  domain: ArticleDomain
  tags: string[]
  verificationStatus: VerificationStatus
  createdAt: string
  updatedAt: string
  lang?: 'zh' | 'en'
  className?: string
}

export function ArticleCard({
  slug,
  title,
  summary,
  domain,
  tags,
  verificationStatus,
  createdAt,
  updatedAt,
  lang = 'zh',
  className,
}: ArticleCardProps) {
  const titleText = lang === 'zh' ? title.zh : title.en
  const summaryText = lang === 'zh' ? summary.zh : summary.en

  return (
    <Link href={`/${lang}/articles/${slug}`}>
      <Card className={cn(
        'group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50',
        className
      )}>
        <CardContent className="p-4">
          {/* 头部：验证状态和领域 */}
          <div className="flex items-center gap-2 mb-3">
            <DomainBadge domain={domain} />
            <VerificationBadge status={verificationStatus} />
          </div>

          {/* 标题 */}
          <h2 className="text-lg font-semibold line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {titleText}
          </h2>

          {/* 摘要 */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {summaryText}
          </p>

          {/* 标签 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 4}
              </Badge>
            )}
          </div>

          {/* 时间 */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>发布于 {formatRelativeTime(createdAt)}</span>
            {updatedAt !== createdAt && (
              <span>更新于 {formatRelativeTime(updatedAt)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// 文章列表组件
interface ArticleListItem {
  id: string
  slug: string
  title: { zh: string; en: string }
  summary: { zh: string; en: string }
  domain: ArticleDomain
  tags: string[]
  verificationStatus: VerificationStatus
  createdAt: string
  updatedAt: string
}

interface ArticleListProps {
  articles: ArticleListItem[]
  lang?: 'zh' | 'en'
  className?: string
}

export function ArticleList({ articles, lang = 'zh', className }: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">暂无文章</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
      {articles.map((article) => (
        <ArticleCard key={article.id} {...article} lang={lang} />
      ))}
    </div>
  )
}