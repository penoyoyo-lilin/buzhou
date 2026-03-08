import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/admin/articles/[id]/generate/route'
import { articleService } from '@/services/article.service'
import { aiService } from '@/services/ai.service'
import prisma from '@/core/db/client'

// Mock dependencies
vi.mock('@/services/article.service', () => ({
  articleService: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/services/ai.service', () => ({
  aiService: {
    generateQAPairs: vi.fn(),
    generateKeywords: vi.fn(),
    generateRelatedIds: vi.fn(),
  },
}))

vi.mock('@/core/db/client', () => ({
  default: {
    article: {
      findMany: vi.fn(),
    },
  },
}))

describe('POST /api/admin/articles/[id]/generate', () => {
  const mockArticle = {
    id: 'art_test123',
    slug: 'test-article',
    title: { zh: '测试文章', en: 'Test Article' },
    summary: { zh: '测试摘要', en: 'Test Summary' },
    content: { zh: '测试内容', en: 'Test Content' },
    domain: 'agent' as const,
    tags: ['test'],
    keywords: [],
    priority: 'P1' as const,
    codeBlocks: [],
    metadata: {
      applicableVersions: [],
      confidenceScore: 0,
      riskLevel: 'low' as const,
      runtimeEnv: [],
    },
    qaPairs: [],
    relatedIds: [],
    verificationStatus: 'pending' as const,
    verificationRecords: [],
    status: 'draft' as const,
    createdBy: 'admin',
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    publishedAt: null,
  }

  const mockRequest = (body: unknown) => ({
    json: () => Promise.resolve(body),
  }) as Request

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 for invalid types', async () => {
    const request = mockRequest({ types: ['invalid'] })
    const params = { id: 'art_test123' }

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  it('should return 400 for empty types array', async () => {
    const request = mockRequest({ types: [] })
    const params = { id: 'art_test123' }

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  it('should return 404 when article not found', async () => {
    vi.mocked(articleService.findById).mockResolvedValue(null)

    const request = mockRequest({ types: ['qa'] })
    const params = { id: 'art_nonexistent' }

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error?.code).toBe('NOT_FOUND')
  })

  it('should generate QA pairs successfully', async () => {
    vi.mocked(articleService.findById).mockResolvedValue(mockArticle)
    vi.mocked(aiService.generateQAPairs).mockResolvedValue({
      qaPairs: [
        {
          id: 'qa_123',
          question: { zh: '问题?', en: 'Question?' },
          answer: { zh: '答案', en: 'Answer' },
        },
      ],
    })
    vi.mocked(articleService.update).mockResolvedValue(mockArticle)

    const request = mockRequest({ types: ['qa'] })
    const params = { id: 'art_test123' }

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(aiService.generateQAPairs).toHaveBeenCalledWith(mockArticle)
  })

  it('should generate keywords successfully', async () => {
    vi.mocked(articleService.findById).mockResolvedValue(mockArticle)
    vi.mocked(aiService.generateKeywords).mockResolvedValue({
      keywords: ['keyword1', 'keyword2'],
    })
    vi.mocked(articleService.update).mockResolvedValue(mockArticle)

    const request = mockRequest({ types: ['keywords'] })
    const params = { id: 'art_test123' }

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(aiService.generateKeywords).toHaveBeenCalledWith(mockArticle)
  })

  it('should generate related articles successfully', async () => {
    vi.mocked(articleService.findById).mockResolvedValue(mockArticle)
    vi.mocked(prisma.article.findMany).mockResolvedValue([
      {
        id: 'art_other',
        title: JSON.stringify({ zh: '其他文章', en: 'Other Article' }),
        summary: JSON.stringify({ zh: '其他摘要', en: 'Other Summary' }),
        tags: JSON.stringify(['test']),
        domain: 'agent',
      },
    ])
    vi.mocked(aiService.generateRelatedIds).mockResolvedValue({
      relatedIds: ['art_other'],
    })
    vi.mocked(articleService.update).mockResolvedValue(mockArticle)

    const request = mockRequest({ types: ['related'] })
    const params = { id: 'art_test123' }

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should generate all fields when types contains all options', async () => {
    vi.mocked(articleService.findById).mockResolvedValue(mockArticle)
    vi.mocked(aiService.generateQAPairs).mockResolvedValue({
      qaPairs: [{ id: 'qa_1', question: { zh: 'Q', en: 'Q' }, answer: { zh: 'A', en: 'A' } }],
    })
    vi.mocked(aiService.generateKeywords).mockResolvedValue({
      keywords: ['key1'],
    })
    vi.mocked(prisma.article.findMany).mockResolvedValue([])
    vi.mocked(aiService.generateRelatedIds).mockResolvedValue({
      relatedIds: [],
    })
    vi.mocked(articleService.update).mockResolvedValue(mockArticle)

    const request = mockRequest({ types: ['qa', 'keywords', 'related'] })
    const params = { id: 'art_test123' }

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(aiService.generateQAPairs).toHaveBeenCalled()
    expect(aiService.generateKeywords).toHaveBeenCalled()
    expect(aiService.generateRelatedIds).toHaveBeenCalled()
  })

  it('should handle AI service errors gracefully', async () => {
    vi.mocked(articleService.findById).mockResolvedValue(mockArticle)
    vi.mocked(aiService.generateQAPairs).mockRejectedValue(new Error('AI service error'))
    vi.mocked(articleService.update).mockResolvedValue(mockArticle)

    const request = mockRequest({ types: ['qa'] })
    const params = { id: 'art_test123' }

    // Should not throw, should handle error gracefully
    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})