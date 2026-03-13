import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const articleFindUniqueMock = vi.fn()
const articleUpdateMock = vi.fn()
const executeRawUnsafeMock = vi.fn()
const eventBusEmitMock = vi.fn()
const deleteCachePatternMock = vi.fn()
const originalDatabaseUrl = process.env.DATABASE_URL

vi.mock('@/core/db/client', () => ({
  prisma: {
    article: {
      findUnique: articleFindUniqueMock,
      update: articleUpdateMock,
    },
    $executeRawUnsafe: executeRawUnsafeMock,
  },
  default: {
    article: {
      findUnique: articleFindUniqueMock,
      update: articleUpdateMock,
    },
    $executeRawUnsafe: executeRawUnsafeMock,
  },
}))

vi.mock('@/core/events', () => ({
  eventBus: {
    emit: eventBusEmitMock,
  },
}))

vi.mock('@/core/cache', () => ({
  CacheKeys: {
    article: (id: string) => `article:${id}`,
    articleSlug: (slug: string) => `article:slug:${slug}`,
  },
  deleteCachePattern: deleteCachePatternMock,
}))

describe('Admin article update domain normalization', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DATABASE_URL = originalDatabaseUrl
    articleFindUniqueMock.mockResolvedValue({
      id: 'art_test_1',
      slug: 'article-slug',
      domain: 'foundation',
      status: 'published',
    })
    articleUpdateMock.mockResolvedValue({
      id: 'art_test_1',
      slug: 'article-slug',
      domain: 'tools_filesystem',
      status: 'published',
    })
    executeRawUnsafeMock.mockResolvedValue(1)
  })

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('should normalize legacy hyphen domain to underscore on update', async () => {
    const { PUT } = await import('@/app/api/admin/articles/[id]/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: 'tools-filesystem',
      }),
    })

    const response = await PUT(request, { params: { id: 'art_test_1' } })
    const payload = await response.json() as { success: boolean }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(articleUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'art_test_1' },
        data: expect.objectContaining({
          domain: 'tools_filesystem',
        }),
      })
    )
  })

  it('should return 400 when domain is invalid', async () => {
    const { PUT } = await import('@/app/api/admin/articles/[id]/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: 'invalid_domain',
      }),
    })

    const response = await PUT(request, { params: { id: 'art_test_1' } })
    const payload = await response.json() as { success: boolean; error?: { code?: string } }

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe('INVALID_INPUT')
    expect(articleUpdateMock).not.toHaveBeenCalled()
  })

  it('should fallback to legacy enum value when postgres enum drifts', async () => {
    process.env.DATABASE_URL = 'postgresql://pool.example.com:6543/postgres?pgbouncer=true'
    articleFindUniqueMock
      .mockResolvedValueOnce({
        id: 'art_test_1',
        domain: 'foundation',
      })
      .mockResolvedValueOnce({
        id: 'art_test_1',
        domain: 'error-codes',
      })

    articleUpdateMock.mockRejectedValueOnce(
      Object.assign(
        new Error('invalid input value for enum "ArticleDomain": "error_codes"'),
        { code: 'P2000' }
      )
    )

    executeRawUnsafeMock
      .mockRejectedValueOnce(
        Object.assign(
          new Error('new row for relation "articles" violates check constraint "articles_domain_check"'),
          { code: 'P2004' }
        )
      )
      .mockResolvedValueOnce(1)

    const { PUT } = await import('@/app/api/admin/articles/[id]/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: 'error_codes',
      }),
    })

    const response = await PUT(request, { params: { id: 'art_test_1' } })
    const payload = await response.json() as { success: boolean; data?: { domain?: string } }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.domain).toBe('error_codes')
    expect(executeRawUnsafeMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`SET "domain" = $1`),
      'error_codes',
      'art_test_1'
    )
    expect(executeRawUnsafeMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`SET "domain" = $1`),
      'error-codes',
      'art_test_1'
    )
  })

  it('should emit article updated event and invalidate caches for admin content updates', async () => {
    const { PUT } = await import('@/app/api/admin/articles/[id]/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: {
          zh: '更新后的标题',
          en: 'Updated title',
        },
        content: {
          zh: '更新后的内容',
          en: 'Updated content',
        },
      }),
    })

    const response = await PUT(request, { params: { id: 'art_test_1' } })
    const payload = await response.json() as { success: boolean }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(eventBusEmitMock).toHaveBeenCalledWith(
      'article:updated',
      expect.objectContaining({
        articleId: 'art_test_1',
        updatedBy: 'admin',
        changes: expect.arrayContaining(['title', 'content']),
      }),
      expect.objectContaining({
        aggregateId: 'art_test_1',
        aggregateType: 'Article',
        source: 'admin-panel',
      })
    )
    expect(deleteCachePatternMock).toHaveBeenCalledWith('article:art_test_1')
    expect(deleteCachePatternMock).toHaveBeenCalledWith('article:slug:article-slug')
    expect(deleteCachePatternMock).toHaveBeenCalledWith('render:*:art_test_1:*')
  })

  it('should set publishedAt and emit article published event for admin publish transition', async () => {
    const publishedAt = new Date('2026-03-13T10:00:00.000Z')

    articleFindUniqueMock.mockResolvedValueOnce({
      id: 'art_test_1',
      slug: 'article-slug',
      domain: 'foundation',
      status: 'draft',
    })
    articleUpdateMock.mockImplementation(async ({ data }) => ({
      id: 'art_test_1',
      slug: 'article-slug',
      domain: 'foundation',
      status: data.status,
      publishedAt: data.publishedAt ?? null,
    }))

    vi.useFakeTimers()
    vi.setSystemTime(publishedAt)

    try {
      const { PUT } = await import('@/app/api/admin/articles/[id]/route')

      const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'published',
        }),
      })

      const response = await PUT(request, { params: { id: 'art_test_1' } })
      const payload = await response.json() as { success: boolean }

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(articleUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'art_test_1' },
          data: expect.objectContaining({
            status: 'published',
            publishedAt,
          }),
        })
      )
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'article:published',
        expect.objectContaining({
          articleId: 'art_test_1',
          publishedAt: publishedAt.toISOString(),
          publishedBy: 'admin',
        }),
        expect.objectContaining({
          aggregateId: 'art_test_1',
          aggregateType: 'Article',
          source: 'admin-panel',
        })
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
