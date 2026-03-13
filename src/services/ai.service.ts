/**
 * AI 服务
 * 负责使用 AI 生成 QA 对、关键词和关联文章
 */

import { nanoid } from 'nanoid'
import type { Article, QAPair, LocalizedString } from '@/types'

// ============================================
// 类型定义
// ============================================

export interface QAGenerationResult {
  qaPairs: QAPair[]
}

export interface KeywordsGenerationResult {
  keywords: string[]
}

export interface RelatedGenerationResult {
  relatedIds: string[]
}

// ============================================
// AI 服务类
// ============================================

export class AIService {
  private apiUrl: string | null
  private apiKey: string | null
  private model: string

  constructor() {
    this.apiUrl = process.env.AI_API_URL || null
    this.apiKey = process.env.AI_API_KEY || null
    this.model = process.env.AI_MODEL || 'gpt-4o-mini'
  }

  /**
   * 生成 QA 对
   */
  async generateQAPairs(article: Article): Promise<QAGenerationResult> {
    if (!this.apiUrl || !this.apiKey) {
      console.warn('AI API not configured, returning empty QA pairs')
      return { qaPairs: [] }
    }

    try {
      const prompt = this.buildQAPrompt(article)
      const response = await this.callAI(prompt)
      const qaPairs = this.parseQAResponse(response)
      return { qaPairs }
    } catch (error) {
      console.error('Failed to generate QA pairs:', error)
      return { qaPairs: [] }
    }
  }

  /**
   * 生成关键词
   */
  async generateKeywords(article: Article): Promise<KeywordsGenerationResult> {
    if (!this.apiUrl || !this.apiKey) {
      console.warn('AI API not configured, returning empty keywords')
      return { keywords: [] }
    }

    try {
      const prompt = this.buildKeywordsPrompt(article)
      const response = await this.callAI(prompt)
      const keywords = this.parseKeywordsResponse(response)
      return { keywords }
    } catch (error) {
      console.error('Failed to generate keywords:', error)
      return { keywords: [] }
    }
  }

  /**
   * 生成关联文章 ID
   */
  async generateRelatedIds(
    article: Article,
    allArticles: Pick<Article, 'id' | 'title' | 'summary' | 'tags' | 'domain'>[]
  ): Promise<RelatedGenerationResult> {
    const fallbackRelatedIds = this.selectFallbackRelatedIds(article, allArticles)

    if (!this.apiUrl || !this.apiKey) {
      console.warn('AI API not configured, falling back to deterministic related IDs')
      return { relatedIds: fallbackRelatedIds }
    }

    if (allArticles.length === 0) {
      return { relatedIds: [] }
    }

    try {
      const prompt = this.buildRelatedPrompt(article, allArticles)
      const response = await this.callAI(prompt)
      const relatedIds = this.parseRelatedResponse(response, allArticles)
      if (relatedIds.length > 0) {
        return { relatedIds }
      }

      console.warn('AI related article response was empty, falling back to deterministic related IDs')
      return { relatedIds: fallbackRelatedIds }
    } catch (error) {
      console.error('Failed to generate related articles:', error)
      return { relatedIds: fallbackRelatedIds }
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 调用 AI API
   */
  private async callAI(prompt: string): Promise<string> {
    const response = await fetch(this.apiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates structured content for technical documentation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  /**
   * 构建 QA 提示
   */
  private buildQAPrompt(article: Article): string {
    return `Based on the following technical article, generate 3-5 Q&A pairs that would help users understand the content better.

Article Title (Chinese): ${article.title.zh}
Article Title (English): ${article.title.en}

Article Summary (Chinese): ${article.summary.zh}
Article Summary (English): ${article.summary.en}

Article Content (Chinese):
${article.content.zh.substring(0, 3000)}

Article Content (English):
${article.content.en.substring(0, 3000)}

Please respond in JSON format:
{
  "qaPairs": [
    {
      "question": { "zh": "问题（中文）", "en": "Question (English)" },
      "answer": { "zh": "答案（中文）", "en": "Answer (English)" }
    }
  ]
}

Make sure the questions are practical and answers are concise and helpful.`
  }

  /**
   * 构建关键词提示
   */
  private buildKeywordsPrompt(article: Article): string {
    return `Extract 5-10 relevant keywords/tags from the following technical article.

Article Title (Chinese): ${article.title.zh}
Article Title (English): ${article.title.en}

Article Summary (Chinese): ${article.summary.zh}
Article Summary (English): ${article.summary.en}

Article Content (Chinese):
${article.content.zh.substring(0, 2000)}

Article Tags: ${article.tags.join(', ')}

Please respond in JSON format:
{
  "keywords": ["keyword1", "keyword2", ...]
}

The keywords should be:
1. Technical and specific
2. Relevant to the article's domain (${article.domain})
3. Useful for search and categorization
4. In English (for consistency)`
  }

  /**
   * 构建关联文章提示
   */
  private buildRelatedPrompt(
    article: Article,
    allArticles: Pick<Article, 'id' | 'title' | 'summary' | 'tags' | 'domain'>[]
  ): string {
    const articleList = allArticles
      .filter(a => a.id !== article.id)
      .slice(0, 50)
      .map((a, i) => `${i + 1}. ID: ${a.id} | Title: ${a.title.en} | Domain: ${a.domain} | Tags: ${a.tags.join(', ')}`)
      .join('\n')

    return `Given the following article, identify which articles from the list would be most relevant to recommend as related reading.

Current Article:
- Title: ${article.title.en}
- Summary: ${article.summary.en}
- Domain: ${article.domain}
- Tags: ${article.tags.join(', ')}

Available Articles:
${articleList}

Please respond in JSON format with the IDs of the 3-5 most relevant articles:
{
  "relatedIds": ["id1", "id2", ...]
}

Consider:
1. Same domain
2. Overlapping tags
3. Related concepts
4. Complementary information`
  }

  /**
   * 解析 QA 响应
   */
  private parseQAResponse(response: string): QAPair[] {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return []

      const parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed.qaPairs)) return []

      return parsed.qaPairs.slice(0, 5).map((qa: { question: LocalizedString; answer: LocalizedString }) => ({
        id: `qa_${nanoid(8)}`,
        question: {
          zh: qa.question?.zh || '',
          en: qa.question?.en || '',
        },
        answer: {
          zh: qa.answer?.zh || '',
          en: qa.answer?.en || '',
        },
      }))
    } catch {
      return []
    }
  }

  /**
   * 解析关键词响应
   */
  private parseKeywordsResponse(response: string): string[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return []

      const parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed.keywords)) return []

      return parsed.keywords
        .filter((k: unknown) => typeof k === 'string')
        .slice(0, 10)
    } catch {
      return []
    }
  }

  /**
   * 解析关联文章响应
   */
  private parseRelatedResponse(
    response: string,
    allArticles: Pick<Article, 'id' | 'title' | 'summary' | 'tags' | 'domain'>[]
  ): string[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return []

      const parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed.relatedIds)) return []

      const validIds = new Set(allArticles.map(a => a.id))
      return parsed.relatedIds
        .filter((id: unknown) => typeof id === 'string' && validIds.has(id))
        .slice(0, 5)
    } catch {
      return []
    }
  }

  private selectFallbackRelatedIds(
    article: Article,
    allArticles: Pick<Article, 'id' | 'title' | 'summary' | 'tags' | 'domain'>[]
  ): string[] {
    const articleTagSet = new Set(article.tags.map((tag) => this.normalizeToken(tag)))
    const articleTitleTokens = this.extractTokens([article.title.zh, article.title.en])
    const articleSummaryTokens = this.extractTokens([article.summary.zh, article.summary.en])

    return allArticles
      .filter((candidate) => candidate.id !== article.id)
      .map((candidate) => {
        const candidateTagSet = new Set(candidate.tags.map((tag) => this.normalizeToken(tag)))
        const candidateTitleTokens = this.extractTokens([candidate.title.zh, candidate.title.en])
        const candidateSummaryTokens = this.extractTokens([candidate.summary.zh, candidate.summary.en])

        const tagOverlap = this.countOverlap(articleTagSet, candidateTagSet)
        const titleOverlap = this.countOverlap(articleTitleTokens, candidateTitleTokens)
        const summaryOverlap = this.countOverlap(articleSummaryTokens, candidateSummaryTokens)
        const sameDomain = candidate.domain === article.domain

        const score =
          (sameDomain ? 50 : 0) +
          tagOverlap * 15 +
          titleOverlap * 4 +
          summaryOverlap * 2

        return {
          id: candidate.id,
          score,
          sameDomain,
          tagOverlap,
          titleOverlap,
          summaryOverlap,
        }
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.tagOverlap !== a.tagOverlap) return b.tagOverlap - a.tagOverlap
        if (b.titleOverlap !== a.titleOverlap) return b.titleOverlap - a.titleOverlap
        if (b.summaryOverlap !== a.summaryOverlap) return b.summaryOverlap - a.summaryOverlap
        if (a.sameDomain !== b.sameDomain) return a.sameDomain ? -1 : 1
        return a.id.localeCompare(b.id)
      })
      .slice(0, 5)
      .map((candidate) => candidate.id)
  }

  private extractTokens(values: string[]): Set<string> {
    const tokens = new Set<string>()

    for (const value of values) {
      const matches = value.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []
      for (const match of matches) {
        const normalized = this.normalizeToken(match)
        if (!normalized) continue

        const hasCjk = /[\u3400-\u9fff]/.test(normalized)
        if (hasCjk || normalized.length >= 2) {
          tokens.add(normalized)
        }
      }
    }

    return tokens
  }

  private normalizeToken(value: string): string {
    return value.trim().toLowerCase()
  }

  private countOverlap(source: Set<string>, target: Set<string>): number {
    let count = 0

    for (const value of source) {
      if (target.has(value)) {
        count += 1
      }
    }

    return count
  }
}

// 导出单例
export const aiService = new AIService()
