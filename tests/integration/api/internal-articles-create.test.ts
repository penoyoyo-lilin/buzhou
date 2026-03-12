import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createInternalArticle } from '@/app/api/internal/v1/articles/route'
import { GET as searchArticles } from '@/app/api/v1/search/route'
import { GET as getArticleSummary } from '@/app/api/v1/articles/[slug]/route'
import prisma from '@/core/db/client'

interface InternalCreateResponse {
  success: boolean
  data?: {
    results?: Array<{
      success: boolean
      article?: {
        id: string
        slug: string
        status: string
        publishedAt: string | null
      }
      error?: string
    }>
  }
}

interface SearchResponse {
  success: boolean
  data?: {
    items?: Array<{ id: string; slug: string }>
  }
}

interface ArticleSummaryResponse {
  success: boolean
  data?: {
    author?: string
  }
}

describe('Internal API create article behavior', () => {
  const internalApiKey = 'internal_test_key_for_create_route'
  const createdArticleIds: string[] = []

  beforeAll(async () => {
    await prisma.$connect()
    process.env.INTERNAL_API_KEY = internalApiKey

    await prisma.systemConfig.upsert({
      where: { key: 'internal_api_key' },
      update: { value: internalApiKey },
      create: { key: 'internal_api_key', value: internalApiKey },
    })
  })

  afterAll(async () => {
    if (createdArticleIds.length > 0) {
      await prisma.verificationRecord.deleteMany({
        where: { articleId: { in: createdArticleIds } },
      })
      await prisma.article.deleteMany({
        where: { id: { in: createdArticleIds } },
      })
    }

    await prisma.$disconnect()
  })

  it('should create published article by default and make it visible in homepage search', async () => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const slug = `internal-create-visible-${unique}`
    const keyword = `internal-create-visible-keyword-${unique}`
    const author = `integration-author-${unique}`

    const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${internalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug,
        title: { zh: `标题 ${keyword}`, en: `Title ${keyword}` },
        summary: { zh: `摘要 ${keyword}`, en: `Summary ${keyword}` },
        content: { zh: '# 内容', en: '# Content' },
        domain: 'foundation',
        author,
        skipVerification: true,
      }),
    })

    const createResponse = await createInternalArticle(request)
    const createPayload = await createResponse.json() as InternalCreateResponse

    expect(createResponse.status).toBe(200)
    expect(createPayload.success).toBe(true)

    const result = createPayload.data?.results?.[0]
    expect(result?.success).toBe(true)

    const article = result?.article
    expect(article?.id).toBeTruthy()
    if (!article?.id) {
      throw new Error('Article id missing in internal create response')
    }

    createdArticleIds.push(article.id)

    expect(article.status).toBe('published')

    const persistedArticle = await prisma.article.findUnique({
      where: { id: article.id },
      select: { status: true, publishedAt: true, createdBy: true },
    })

    expect(persistedArticle?.status).toBe('published')
    expect(persistedArticle?.publishedAt).not.toBeNull()
    expect(persistedArticle?.createdBy).toBe(author)

    const searchRequest = new NextRequest(
      `http://localhost:3000/api/v1/search?q=${encodeURIComponent(keyword)}&pageSize=20`
    )
    const searchResponse = await searchArticles(searchRequest)
    const searchPayload = await searchResponse.json() as SearchResponse

    expect(searchResponse.status).toBe(200)
    expect(searchPayload.success).toBe(true)

    const found = searchPayload.data?.items?.some((item) => item.id === article.id)
    expect(found).toBe(true)

    const articleRequest = new NextRequest(`http://localhost:3000/api/v1/articles/${slug}`)
    const articleResponse = await getArticleSummary(articleRequest, { params: { slug } })
    const articlePayload = await articleResponse.json() as ArticleSummaryResponse
    expect(articleResponse.status).toBe(200)
    expect(articlePayload.success).toBe(true)
    expect(articlePayload.data?.author).toBe(author)
  })
})
