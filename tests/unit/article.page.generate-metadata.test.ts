import { beforeEach, describe, expect, it, vi } from 'vitest'

const findBySlugMock = vi.fn()

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T) => fn,
  }
})

vi.mock('@/services/article.service', () => ({
  articleService: {
    findBySlug: findBySlugMock,
  },
}))

describe('Article page generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate canonical/hreflang/alternate format metadata for article page', async () => {
    findBySlugMock.mockResolvedValue({
      id: 'art_geo_001',
      slug: 'geo-meta-check',
      title: { zh: '中文标题', en: 'English Title' },
      summary: { zh: '中文摘要', en: 'English Summary' },
      content: { zh: '内容', en: 'Content' },
      domain: 'foundation',
      tags: ['mcp', 'troubleshooting'],
      keywords: ['agent', 'mcp'],
      priority: 'P1',
      codeBlocks: [],
      metadata: {
        confidenceScore: 95,
        riskLevel: 'low',
        applicableVersions: [],
        runtimeEnv: [],
      },
      qaPairs: [],
      relatedIds: [],
      verificationStatus: 'verified',
      verificationRecords: [],
      status: 'published',
      createdBy: 'tester',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
      publishedAt: '2026-03-10T00:00:00.000Z',
    })

    const { generateMetadata } = await import('@/app/[lang]/articles/[slug]/page')

    const metadata = await generateMetadata({
      params: { lang: 'zh', slug: 'geo-meta-check' },
      searchParams: {},
    })

    expect(metadata.alternates?.canonical).toBe('https://www.buzhou.io/zh/articles/geo-meta-check')
    expect(metadata.alternates?.languages).toEqual(
      expect.objectContaining({
        'zh-CN': 'https://www.buzhou.io/zh/articles/geo-meta-check',
        'en-US': 'https://www.buzhou.io/en/articles/geo-meta-check',
        'x-default': 'https://www.buzhou.io/zh/articles/geo-meta-check',
      })
    )
    expect(metadata.alternates?.types).toEqual(
      expect.objectContaining({
        'application/json': 'https://www.buzhou.io/api/v1/articles/geo-meta-check?format=json&lang=zh',
        'text/markdown': 'https://www.buzhou.io/api/v1/articles/geo-meta-check?format=markdown&lang=zh',
      })
    )
    expect((metadata.openGraph as { type?: string } | undefined)?.type).toBe('article')
    expect(metadata.robots).toEqual(
      expect.objectContaining({
        index: true,
        follow: true,
      })
    )
  })

  it('should return noindex metadata when article does not exist', async () => {
    findBySlugMock.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/[lang]/articles/[slug]/page')

    const metadata = await generateMetadata({
      params: { lang: 'en', slug: 'missing-slug' },
      searchParams: {},
    })

    expect(metadata.robots).toEqual(
      expect.objectContaining({
        index: false,
        follow: false,
      })
    )
    expect(metadata.alternates?.canonical).toBe('https://www.buzhou.io/en/articles/missing-slug')
  })
})
