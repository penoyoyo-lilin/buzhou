import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CodeBlock } from '@/components/ui/code-block'
import { Badge } from '@/components/ui/badge'
import { VerificationBadge, DomainBadge, RiskBadge } from '@/components/shared/verification-badge'
import { VerificationTimeline } from '@/components/shared/verification-timeline'
import { ArticleViewTabs } from '@/components/shared/article-view-tabs'
import { SchemaOrg, getArticleSchema, getTechArticleSchema, getFAQPageSchema, getBreadcrumbSchema } from '@/components/shared/schema-org'
import { articleService } from '@/services/article.service'
import { formatDateTime } from '@/lib/utils'
import { t, type Locale } from '@/lib/i18n/translations'
import { renderService } from '@/services/render.service'
import { getPublishedDisplayDate } from './meta-utils'

interface ArticlePageProps {
  params: {
    lang: Locale
    slug: string
  }
  searchParams: {
    format?: 'html' | 'markdown' | 'json'
  }
}

const SITE_URL = 'https://www.buzhou.io'

function buildArticleUrl(lang: Locale, slug: string): string {
  return `${SITE_URL}/${lang}/articles/${slug}`
}

const getPublishedArticleBySlug = cache(async (slug: string) => {
  return articleService.findBySlug(slug)
})

export async function generateStaticParams() {
  // 返回所有文章的 slug 参数
  return []
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { lang, slug } = params
  const article = await getPublishedArticleBySlug(slug)
  const canonicalUrl = buildArticleUrl(lang, slug)

  if (!article) {
    return {
      title: lang === 'zh' ? '文章不存在' : 'Article Not Found',
      description: lang === 'zh' ? '请求的文章不存在。' : 'The requested article was not found.',
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const title = lang === 'zh' ? article.title.zh : article.title.en
  const summary = lang === 'zh' ? article.summary.zh : article.summary.en
  const publishedDate = getPublishedDisplayDate(article)
  const language = lang === 'zh' ? 'zh-CN' : 'en-US'
  const keywords = [...article.tags, ...article.keywords]

  return {
    title,
    description: summary,
    keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'zh-CN': buildArticleUrl('zh', slug),
        'en-US': buildArticleUrl('en', slug),
        'x-default': buildArticleUrl('zh', slug),
      },
      types: {
        'application/json': `${SITE_URL}/api/v1/articles/${slug}?format=json&lang=${lang}`,
        'text/markdown': `${SITE_URL}/api/v1/articles/${slug}?format=markdown&lang=${lang}`,
      },
    },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title,
      description: summary,
      locale: lang === 'zh' ? 'zh_CN' : 'en_US',
      siteName: 'Buzhou',
      publishedTime: publishedDate,
      modifiedTime: article.updatedAt,
      tags: keywords,
      authors: [article.createdBy],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: summary,
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
    other: {
      'article:published_time': publishedDate,
      'article:modified_time': article.updatedAt,
      'article:author': article.createdBy,
      'article:section': article.domain,
      'content-language': language,
    },
  }
}

export default async function ArticlePage({ params, searchParams }: ArticlePageProps) {
  const { lang, slug } = params
  await Promise.resolve(searchParams)
  const article = await getPublishedArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  // markdown 和 json 格式通过 API 路由提供
  // 页面组件只处理 HTML 格式

  // 获取验证记录
  const verificationRecords = article.verificationRecords || []

  // 获取相关文章
  const relatedArticles = article.relatedIds.length > 0
    ? await articleService.findByIds(article.relatedIds.slice(0, 5))
    : []

  const title = lang === 'zh' ? article.title.zh : article.title.en
  const summary = lang === 'zh' ? article.summary.zh : article.summary.en
  const content = lang === 'zh' ? article.content.zh : article.content.en

  // 生成 Markdown 和 JSON 内容
  const contentHtml = await renderService.renderArticleBodyHtml(content)
  const markdownContent = renderService.toMarkdown(article, lang)
  const jsonContent = renderService.toJsonResponse(article, lang)

  // 构建 Schema.org 结构化数据
  const articleUrl = buildArticleUrl(lang, slug)
  const publishedDate = getPublishedDisplayDate(article)
  const articleLanguage = lang === 'zh' ? 'zh-CN' : 'en-US'
  const schemaKeywords = [...article.tags, ...article.keywords]

  const articleSchemas = [
    getArticleSchema({
      title,
      description: summary,
      url: articleUrl,
      datePublished: publishedDate,
      dateModified: article.updatedAt,
      author: article.createdBy,
      dateCreated: article.createdAt,
      inLanguage: articleLanguage,
      keywords: schemaKeywords,
      articleSection: article.domain,
      mainEntityOfPage: articleUrl,
      isAccessibleForFree: true,
      about: schemaKeywords,
    }),
    getTechArticleSchema({
      title,
      description: summary,
      url: articleUrl,
      datePublished: publishedDate,
      dateModified: article.updatedAt,
      author: article.createdBy,
      dependencies: article.metadata.runtimeEnv?.map(e => `${e.name} ${e.version}`),
      proficiencyLevel: 'Intermediate',
      inLanguage: articleLanguage,
      keywords: schemaKeywords,
      mainEntityOfPage: articleUrl,
      isAccessibleForFree: true,
    }),
    getBreadcrumbSchema({
      lang,
      title,
      url: articleUrl,
    }),
    ...(article.qaPairs.length > 0
      ? [
          getFAQPageSchema({
            url: articleUrl,
            items: article.qaPairs.map((qa) => ({
              question: lang === 'zh' ? qa.question.zh : qa.question.en,
              answer: lang === 'zh' ? qa.answer.zh : qa.answer.en,
            })),
          }),
        ]
      : []),
  ]

  // HTML 内容组件
  const htmlContent = (
    <div className="space-y-8">
      {/* 正文内容 */}
      <section className="prose prose-neutral dark:prose-invert max-w-none [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-primary/60 [&_a]:break-all [&_a:hover]:text-primary/80 [&_a:hover]:decoration-primary">
        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </section>

      {/* 代码块 */}
      {article.codeBlocks.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">{t(lang, 'article.codeExample')}</h2>
          <div className="space-y-4">
            {article.codeBlocks.map((block) => (
              <CodeBlock
                key={block.id}
                code={block.content}
                language={block.language}
                filename={block.filename}
              />
            ))}
          </div>
        </section>
      )}

      {/* QA 问答对 */}
      {article.qaPairs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">{t(lang, 'article.qa')}</h2>
          <div className="space-y-4">
            {article.qaPairs.map((qa, index) => {
              const question = lang === 'zh' ? qa.question.zh : qa.question.en
              const answer = lang === 'zh' ? qa.answer.zh : qa.answer.en

              return (
                <details
                  key={qa.id}
                  className="group rounded-lg border p-4"
                  open={index === 0}
                >
                  <summary className="flex items-center justify-between cursor-pointer list-none font-medium">
                    <span>{question}</span>
                    <span className="text-muted-foreground group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <p className="mt-4 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-primary/60 [&_a]:break-all [&_a:hover]:text-primary/80 [&_a:hover]:decoration-primary">
                    {answer}
                  </p>
                </details>
              )
            })}
          </div>
        </section>
      )}

      {/* 验证时间轴 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'article.verificationRecords')}</h2>
        <VerificationTimeline records={verificationRecords} locale={lang} />
      </section>

      {/* 标签 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'article.tags')}</h2>
        <div className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Link key={tag} href={`/${lang}?q=${encodeURIComponent(tag)}`}>
              <Badge variant="outline" className="hover:bg-muted transition-colors">
                {tag}
              </Badge>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )

  return (
    <>
      {/* Schema.org 结构化数据 */}
      <SchemaOrg data={articleSchemas} />

      <article className="container py-8">
      {/* 头部 */}
      <header className="mb-8">
        {/* 面包屑 */}
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href={`/${lang}`} className="hover:text-foreground">
            {t(lang, 'common.home')}
          </Link>
          <span className="mx-2">/</span>
          <span>{title}</span>
        </nav>

        {/* 标题 */}
        <h1 className="text-3xl font-bold mb-4">{title}</h1>

        {/* 摘要 */}
        <p className="text-lg text-muted-foreground mb-4">{summary}</p>

        {article.verificationStatus === 'partial' && article.metadata.lastInspectedAt && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            {t(lang, 'article.autoUpdatePendingReview')}
          </div>
        )}

        {/* 元数据 */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{t(lang, 'article.author')} {article.createdBy}</span>
          <span>{t(lang, 'article.publishedAt')} {formatDateTime(publishedDate)}</span>
          {article.updatedAt !== article.createdAt && (
            <span>{t(lang, 'article.updatedAt')} {formatDateTime(article.updatedAt)}</span>
          )}
          <DomainBadge domain={article.domain} locale={lang} />
          <VerificationBadge status={article.verificationStatus} locale={lang} />
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        {/* 主内容 */}
        <div className="space-y-8">
          {/* 视图切换 Tab */}
          <ArticleViewTabs
            htmlContent={htmlContent}
            markdownContent={markdownContent}
            jsonContent={jsonContent}
            locale={lang}
          />
        </div>

        {/* 侧边栏 */}
        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          {/* AI 快速上下文卡 */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h3 className="font-semibold mb-4">{t(lang, 'article.articleInfo')}</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t(lang, 'article.articleId')}</dt>
                <dd className="font-mono mt-1 break-all">{article.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t(lang, 'article.author')}</dt>
                <dd className="mt-1">{article.createdBy}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted-foreground">{t(lang, 'article.confidenceScore')}</dt>
                  <dd className="mt-1">{article.metadata.confidenceScore}%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t(lang, 'article.riskLevel')}</dt>
                  <dd className="mt-1">
                    <RiskBadge risk={article.metadata.riskLevel} locale={lang} />
                  </dd>
                </div>
              </div>
              {article.metadata.lastInspectedAt && (
                <div>
                  <dt className="text-muted-foreground">{t(lang, 'article.lastInspectedAt')}</dt>
                  <dd className="mt-1">{formatDateTime(article.metadata.lastInspectedAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">{t(lang, 'article.applicableVersions')}</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {article.metadata.applicableVersions.map((v) => (
                    <Badge key={v} variant="outline" className="text-xs">
                      {v}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t(lang, 'article.apiAccess')}</dt>
                <dd className="font-mono mt-1 break-all">/api/v1/search?q={article.slug}</dd>
              </div>
            </dl>
          </div>

          {/* API 引导区 */}
          <div className="rounded-lg border p-4 bg-gradient-to-br from-primary/5 to-blue-500/5">
            <h3 className="font-semibold mb-2">{t(lang, 'article.apiAccess')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t(lang, 'article.apiAccessDesc')}
            </p>
            <div className="rounded bg-muted p-3 font-mono text-xs overflow-x-auto">
              <div className="text-muted-foreground">GET</div>
              <div className="text-primary">/api/v1/search?q={article.slug}</div>
            </div>
            <Link
              href={`/${lang}/api-docs`}
              className="block mt-4 text-sm text-primary hover:underline"
            >
              {t(lang, 'article.viewApiDocs')}
            </Link>
          </div>

          {/* 相关文章 */}
          {relatedArticles.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4">{t(lang, 'article.relatedArticles')}</h3>
              <div className="space-y-2">
                {relatedArticles.map((relatedArticle) => {
                  const relatedTitle = lang === 'zh' ? relatedArticle.title.zh : relatedArticle.title.en

                  return (
                    <Link
                      key={relatedArticle.id}
                      href={`/${lang}/articles/${relatedArticle.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <div className="font-medium">{relatedTitle}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {relatedArticle.domain} · {t(lang, `verification.${relatedArticle.verificationStatus}`)}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* 关键词 - 用于辅助决策 */}
          {article.keywords && article.keywords.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4">{t(lang, 'article.keywords')}</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t(lang, 'article.keywordsDesc')}
              </p>
              <div className="flex flex-wrap gap-2">
                {article.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </article>
    </>
  )
}
