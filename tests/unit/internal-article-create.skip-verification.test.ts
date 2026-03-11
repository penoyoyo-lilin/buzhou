import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const verifyInternalAuthMock = vi.fn()
const articleCreateMock = vi.fn()
const articlePublishMock = vi.fn()
const createVerificationRecordMock = vi.fn()
const sandboxVerifyMock = vi.fn()
const eventEmitMock = vi.fn()

vi.mock('@/lib/internal-auth', () => ({
  verifyInternalAuth: verifyInternalAuthMock,
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

vi.mock('@/services/sandbox.service', () => ({
  sandboxService: {
    verify: sandboxVerifyMock,
  },
}))

vi.mock('@/core/events', () => ({
  eventBus: {
    emit: eventEmitMock,
  },
}))

describe('Internal create route - skipVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    verifyInternalAuthMock.mockResolvedValue(true)
    sandboxVerifyMock.mockResolvedValue('failed')

    articleCreateMock.mockResolvedValue({
      id: 'art_mock',
      slug: 'art-mock',
      title: { zh: '标题', en: 'Title' },
      summary: { zh: '摘要', en: 'Summary' },
      content: { zh: '内容', en: 'Content' },
      domain: 'foundation',
      tags: [],
      keywords: [],
      priority: 'P1',
      codeBlocks: [],
      metadata: {},
      qaPairs: [],
      relatedIds: [],
      verificationStatus: 'pending',
      verificationRecords: [],
      status: 'draft',
      createdBy: 'test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      publishedAt: null,
    })

    articlePublishMock.mockResolvedValue({
      id: 'art_mock',
      slug: 'art-mock',
      status: 'published',
      publishedAt: '2026-01-02T00:00:00.000Z',
    })

    createVerificationRecordMock.mockResolvedValue(undefined)
    eventEmitMock.mockResolvedValue(undefined)
  })

  it('should skip sandbox verification when skipVerification=true even with dangerous codeBlocks', async () => {
    const { POST } = await import('@/app/api/internal/v1/articles/route')

    const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'internal-skip-verification',
        title: { zh: '标题', en: 'Title' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'foundation',
        createdBy: 'unit-test',
        skipVerification: true,
        codeBlocks: [
          {
            id: 'cb_1',
            language: 'javascript',
            filename: null,
            content: 'eval("dangerous")',
            description: { zh: '危险', en: 'dangerous' },
          },
        ],
      }),
    })

    const response = await POST(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        results?: Array<{ success: boolean }>
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.results?.[0]?.success).toBe(true)

    expect(sandboxVerifyMock).not.toHaveBeenCalled()
    expect(articleCreateMock).toHaveBeenCalledTimes(1)
  })

  it('should fail creation when skipVerification=false and sandbox verification fails', async () => {
    const { POST } = await import('@/app/api/internal/v1/articles/route')

    const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'internal-require-verification',
        title: { zh: '标题', en: 'Title' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'foundation',
        createdBy: 'unit-test',
        skipVerification: false,
        codeBlocks: [
          {
            id: 'cb_1',
            language: 'javascript',
            filename: null,
            content: 'eval("dangerous")',
            description: { zh: '危险', en: 'dangerous' },
          },
        ],
      }),
    })

    const response = await POST(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        results?: Array<{ success: boolean; error?: string }>
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.results?.[0]?.success).toBe(false)
    expect(payload.data?.results?.[0]?.error).toBe('Sandbox verification failed')

    expect(sandboxVerifyMock).toHaveBeenCalledTimes(1)
    expect(articleCreateMock).not.toHaveBeenCalled()
  })
})
