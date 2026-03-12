import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const findBySlugMock = vi.fn()
const toJsonResponseMock = vi.fn()
const toMarkdownMock = vi.fn()

vi.mock('@/services/article.service', () => ({
  articleService: {
    findBySlug: findBySlugMock,
  },
}))

vi.mock('@/services/render.service', () => ({
  renderService: {
    toJsonResponse: toJsonResponseMock,
    toMarkdown: toMarkdownMock,
  },
}))

describe('Public article route GEO headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findBySlugMock.mockResolvedValue({
      id: 'art_geo_headers',
      slug: 'geo-headers',
      title: { zh: '标题', en: 'Title' },
      summary: { zh: '摘要', en: 'Summary' },
      domain: 'foundation',
      tags: ['mcp'],
      keywords: ['agent'],
      verificationStatus: 'verified',
      metadata: {
        confidenceScore: 95,
        riskLevel: 'low',
        applicableVersions: [],
      },
      createdBy: 'tester',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
      publishedAt: '2026-03-10T00:00:00.000Z',
    })
    toJsonResponseMock.mockReturnValue('{"ok":true}')
    toMarkdownMock.mockReturnValue('# markdown')
  })

  it('should include Link alternates and discovery headers for summary response', async () => {
    const { GET } = await import('@/app/api/v1/articles/[slug]/route')
    const request = new NextRequest('http://localhost:3000/api/v1/articles/geo-headers?lang=zh')

    const response = await GET(request, { params: { slug: 'geo-headers' } })
    expect(response.status).toBe(200)

    expect(response.headers.get('x-agent-api-endpoint')).toBe('http://localhost:3000/api/v1/articles/geo-headers')
    expect(response.headers.get('x-agent-api-docs')).toBe('http://localhost:3000/zh/api-docs')
    expect(response.headers.get('link')).toContain('rel="alternate"; type="application/json"')
    expect(response.headers.get('link')).toContain('rel="alternate"; type="text/markdown"')
  })

  it('should include same discovery headers for json and markdown formats', async () => {
    const { GET } = await import('@/app/api/v1/articles/[slug]/route')
    const jsonRequest = new NextRequest('http://localhost:3000/api/v1/articles/geo-headers?format=json&lang=en')
    const markdownRequest = new NextRequest('http://localhost:3000/api/v1/articles/geo-headers?format=markdown&lang=en')

    const jsonResponse = await GET(jsonRequest, { params: { slug: 'geo-headers' } })
    const markdownResponse = await GET(markdownRequest, { params: { slug: 'geo-headers' } })

    expect(jsonResponse.status).toBe(200)
    expect(jsonResponse.headers.get('content-type')).toContain('application/json')
    expect(jsonResponse.headers.get('x-agent-api-docs')).toBe('http://localhost:3000/en/api-docs')
    expect(jsonResponse.headers.get('link')).toContain('format=markdown&lang=en')

    expect(markdownResponse.status).toBe(200)
    expect(markdownResponse.headers.get('content-type')).toContain('text/markdown')
    expect(markdownResponse.headers.get('x-agent-api-docs')).toBe('http://localhost:3000/en/api-docs')
    expect(markdownResponse.headers.get('link')).toContain('format=json&lang=en')
  })
})
