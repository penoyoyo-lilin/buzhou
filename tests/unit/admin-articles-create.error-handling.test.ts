import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const articleCreateMock = vi.fn()
const articlePublishMock = vi.fn()
const createVerificationRecordMock = vi.fn()
const eventEmitMock = vi.fn()

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

    articleCreateMock.mockResolvedValue({
      id: 'art_test_create_1',
      slug: 'test-create',
      domain: 'foundation',
      status: 'draft',
    })
    articlePublishMock.mockResolvedValue(undefined)
    createVerificationRecordMock.mockResolvedValue(undefined)
    eventEmitMock.mockResolvedValue(undefined)
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
})
