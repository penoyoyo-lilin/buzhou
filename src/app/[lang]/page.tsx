'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'
import { PopularTags } from '@/components/shared/search-bar'
import { FilterBar } from '@/components/shared/filter-bar'
import { ArticleList } from '@/components/shared/article-card'
import { DataWall } from '@/components/shared/data-wall'
import { Skeleton } from '@/components/ui/skeleton'
import { SchemaOrg, getOrganizationSchema, getWebsiteSchema } from '@/components/shared/schema-org'
import { t, type Locale } from '@/lib/i18n/translations'
import type { ArticleDomain, VerificationStatus, Article } from '@/types'

// API 返回的文章类型
interface ArticleApiResponse {
  id: string
  slug: string
  title: { zh: string; en: string }
  summary: { zh: string; en: string }
  domain: string
  tags: string[]
  verificationStatus: string
  confidenceScore: number
  createdAt: string
  updatedAt: string
}

interface SearchResponseData {
  items: ArticleApiResponse[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// 热门标签类型
interface TagCount {
  name: string
  count: number
}

function HomeContent({ lang }: { lang: 'zh' | 'en' }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [articles, setArticles] = useState<Article[]>([])
  const [totalArticles, setTotalArticles] = useState(0)
  const [popularTags, setPopularTags] = useState<TagCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // 记录页面访问
  useEffect(() => {
    fetch('/api/v1/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer,
      }),
    }).catch(() => {
      // 静默失败
    })
  }, [])

  // 同步 URL 参数到 searchQuery
  useEffect(() => {
    const q = searchParams.get('q') || ''
    setSearchQuery(q)
  }, [searchParams])

  // 筛选参数
  const domain = searchParams.get('domain') as ArticleDomain | null
  const status = searchParams.get('status') as VerificationStatus | null

  const normalizeArticles = useCallback((items: ArticleApiResponse[]) => (
    items.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      domain: item.domain as ArticleDomain,
      tags: item.tags,
      verificationStatus: item.verificationStatus as VerificationStatus,
      priority: 'P1' as const,
      content: { zh: '', en: '' },
      codeBlocks: [],
      keywords: [],
      metadata: {
        applicableVersions: [],
        confidenceScore: item.confidenceScore,
        riskLevel: 'low',
        runtimeEnv: [],
      },
      qaPairs: [],
      relatedIds: [],
      status: 'published',
      createdBy: '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })) as Article[]
  ), [])

  const fetchArticles = useCallback(async (nextPage: number, append: boolean) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (domain) params.set('domain', domain)
      if (status) params.set('status', status)
      params.set('pageSize', '20')
      params.set('page', String(nextPage))

      const res = await fetch(`/api/v1/search?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        const payload = data.data as SearchResponseData
        const items = normalizeArticles(payload.items)

        setArticles((current) => append ? [...current, ...items] : items)
        setTotalArticles(payload.pagination.total)
        setPage(payload.pagination.page)
        setHasMore(payload.pagination.page < payload.pagination.totalPages)

        if (!append) {
          const tagCounts: Record<string, number> = {}
          items.forEach((article: Article) => {
            article.tags?.forEach((tag: string) => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1
            })
          })
          const tags = Object.entries(tagCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
          setPopularTags(tags)
        }
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
      if (!append) {
        setArticles([])
        setTotalArticles(0)
        setHasMore(false)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [searchQuery, domain, status, normalizeArticles])

  useEffect(() => {
    fetchArticles(1, false)
  }, [fetchArticles])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || isLoading || isLoadingMore || !hasMore) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !isLoadingMore && hasMore) {
        fetchArticles(page + 1, true)
      }
    }, { rootMargin: '200px' })

    observer.observe(target)
    return () => observer.disconnect()
  }, [fetchArticles, hasMore, isLoading, isLoadingMore, page])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    router.push(`/${lang}?${params.toString()}`)
  }, [lang, searchParams, router])

  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(tag)
    if (tag) {
      router.push(`/${lang}?q=${encodeURIComponent(tag)}`)
    } else {
      router.push(`/${lang}`)
    }
  }, [lang, router])

  return (
    <>
      {/* Schema.org 结构化数据 */}
      <SchemaOrg data={[getOrganizationSchema(), getWebsiteSchema()]} />

      <div className="container py-8">
        {/* Hero 区 */}
      <section className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          {t(lang, 'home.title')}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t(lang, 'home.subtitle')}
        </p>
      </section>

      {/* 数据墙 */}
      <DataWall className="mb-8" lang={lang} />

      {/* 筛选区 */}
      <section className="mb-6">
        <FilterBar lang={lang} />
      </section>

      {/* 热门标签 */}
      <section className="mb-8">
        <p className="text-sm text-muted-foreground mb-2">{t(lang, 'home.popularTags')}</p>
        <PopularTags
          tags={popularTags}
          onTagClick={handleTagClick}
          selectedTag={searchQuery}
        />
      </section>

      {/* 文章列表 */}
      <section>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-lg border p-4">
                <Skeleton className="h-4 w-20 mb-4" />
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t(lang, 'home.articleCount', { count: totalArticles })}
            </p>
            <ArticleList articles={articles} lang={lang} />
            <div ref={loadMoreRef} className="flex justify-center py-6">
              {isLoadingMore ? (
                <LoaderBlock />
              ) : hasMore ? (
                <span className="text-sm text-muted-foreground">下滑加载更多</span>
              ) : articles.length > 0 ? (
                <span className="text-sm text-muted-foreground">已加载全部文章</span>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
    </>
  )
}

function LoaderBlock() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Skeleton className="h-4 w-4 rounded-full" />
      <span>正在加载更多文章...</span>
    </div>
  )
}

function HomeLoading() {
  return (
    <div className="container py-8">
      <section className="text-center mb-12">
        <Skeleton className="h-10 w-40 mx-auto mb-4" />
        <Skeleton className="h-6 w-96 mx-auto mb-8" />
        <Skeleton className="h-12 w-full max-w-xl mx-auto mb-6" />
      </section>
      <section className="mb-8">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
      </section>
      <section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <Skeleton className="h-4 w-20 mb-4" />
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function HomePage() {
  const params = useParams<{ lang: 'zh' | 'en' }>()
  const lang = params.lang || 'zh'

  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent lang={lang} />
    </Suspense>
  )
}
