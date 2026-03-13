import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const articleCreateMock = vi.fn()
const articlePublishMock = vi.fn()
const createVerificationRecordMock = vi.fn()
const eventEmitMock = vi.fn()
const queryRawUnsafeMock = vi.fn()
const executeRawUnsafeMock = vi.fn()
const originalDatabaseUrl = process.env.DATABASE_URL

vi.mock('@/core/db/client', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
  },
  default: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
  },
}))

vi.mock('@/services/article.service', () => ({
  articleService: {
    create: articleCreateMock,
    publish: articlePublishMock,
  },
}))

vi.mock('@/services/verification.service', () => ({
  verificationService: {
    createRecord: createVerificationRecordMock,
  },
}))

vi.mock('@/core/events', () => ({
  eventBus: {
    emit: eventEmitMock,
  },
}))

describe('Admin articles create route error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = originalDatabaseUrl

    articleCreateMock.mockResolvedValue({
      id: 'art_test_create_1',
      slug: 'test-create',
      domain: 'foundation',
      status: 'draft',
    })
    articlePublishMock.mockResolvedValue(undefined)
    createVerificationRecordMock.mockResolvedValue(undefined)
    eventEmitMock.mockResolvedValue(undefined)
    queryRawUnsafeMock.mockResolvedValue([])
    executeRawUnsafeMock.mockResolvedValue(1)
  })

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('should normalize legacy hyphen domain before create', async () => {
    const { POST } = await import('@/app/api/admin/articles/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'admin-create-normalize-domain',
        title: { zh: '标题', en: 'Title' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'tools-filesystem',
        author: 'admin-test',
      }),
    })

    const response = await POST(request)
    const payload = await response.json() as { success: boolean }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(articleCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'tools_filesystem',
      })
    )
  })

  it('should return 409 when slug already exists instead of 500', async () => {
    const { POST } = await import('@/app/api/admin/articles/route')

    const duplicateSlugError = Object.assign(
      new Error('Unique constraint failed on the fields: (`slug`)'),
      {
        code: 'P2002',
        meta: { target: ['slug'] },
      }
    )
    articleCreateMock.mockRejectedValueOnce(duplicateSlugError)

    const request = new NextRequest('http://localhost:3000/api/admin/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'already-exists-slug',
        title: { zh: '标题', en: 'Title' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'foundation',
        author: 'admin-test',
      }),
    })

    const response = await POST(request)
    const payload = await response.json() as { success: boolean; error?: { code?: string } }

    expect(response.status).toBe(409)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe('ALREADY_EXISTS')
  })

  it('should fallback to SQL insert when Prisma create fails due schema drift', async () => {
    process.env.DATABASE_URL = 'postgresql://pool.example.com:6543/postgres?pgbouncer=true'
    articleCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('column "keywords" does not exist'), { code: 'P2022' })
    )

    queryRawUnsafeMock.mockResolvedValueOnce([
      { column_name: 'id' },
      { column_name: 'slug' },
      { column_name: 'title' },
      { column_name: 'summary' },
      { column_name: 'content' },
      { column_name: 'domain' },
      { column_name: 'created_by' },
      { column_name: 'status' },
      { column_name: 'created_at' },
      { column_name: 'updated_at' },
    ])

    const { POST } = await import('@/app/api/admin/articles/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'schema-drift-fallback-create',
        title: { zh: '标题', en: 'Title' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'error_codes',
        author: 'admin-test',
      }),
    })

    const response = await POST(request)
    const payload = await response.json() as {
      success: boolean
      data?: { id?: string; slug?: string; domain?: string }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.domain).toBe('error_codes')
    expect(executeRawUnsafeMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "articles"'),
      expect.any(String),
      'schema-drift-fallback-create',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'admin-test',
      'draft',
      expect.any(Date),
      expect.any(Date),
      'error_codes'
    )
  })
})
