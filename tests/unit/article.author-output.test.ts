import { describe, expect, it } from 'vitest'
import { renderService } from '@/services/render.service'
import { getArticleSchema, getTechArticleSchema } from '@/components/shared/schema-org'
import type { Article } from '@/types'

const mockArticle: Article = {
  id: 'art_author_test',
  slug: 'author-test-article',
  title: { zh: '作者字段测试', en: 'Author Field Test' },
  summary: { zh: '摘要', en: 'Summary' },
  content: { zh: '内容', en: 'Content' },
  domain: 'foundation',
  tags: ['author'],
  keywords: ['author', 'api'],
  priority: 'P1',
  codeBlocks: [],
  metadata: {
    applicableVersions: [],
    confidenceScore: 88,
    riskLevel: 'low',
    runtimeEnv: [],
  },
  qaPairs: [],
  relatedIds: [],
  verificationStatus: 'verified',
  verificationRecords: [],
  status: 'published',
  createdBy: 'unit-author',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  publishedAt: '2026-01-01T12:00:00.000Z',
}

describe('Author field output', () => {
  it('should include author in renderService json and markdown output', () => {
    const json = JSON.parse(renderService.toJsonResponse(mockArticle, 'zh')) as { author?: string }
    const markdown = renderService.toMarkdown(mockArticle, 'en')

    expect(json.author).toBe('unit-author')
    expect(markdown).toContain('**Author:** unit-author')
  })

  it('should inject author into schema.org builders', () => {
    const articleSchema = getArticleSchema({
      title: 'T',
      description: 'D',
      url: 'https://buzhou.io',
      datePublished: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-02T00:00:00.000Z',
      author: 'schema-author',
    }) as { author?: { name?: string } }

    const techSchema = getTechArticleSchema({
      title: 'T',
      description: 'D',
      url: 'https://buzhou.io',
      datePublished: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-02T00:00:00.000Z',
      author: 'schema-author',
    }) as { author?: { name?: string } }

    expect(articleSchema.author?.name).toBe('schema-author')
    expect(techSchema.author?.name).toBe('schema-author')
  })
})
