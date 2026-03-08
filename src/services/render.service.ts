/**
 * 渲染服务
 * 负责双模渲染（人类 HTML / Agent Markdown/JSON）
 */

import { marked } from 'marked'
import hljs from 'highlight.js'
import {
  getCache,
  setCache,
  deleteCachePattern,
  CacheKeys,
  CacheTTL,
} from '@/core/cache'
import type { Article, CodeBlock, QAPair } from '@/types'

// ============================================
// 配置
// ============================================

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
})

// ============================================
// 类型定义
// ============================================

export type ViewType = 'human' | 'agent'
export type AgentFormat = 'markdown' | 'json'

export interface RenderedContent {
  content: string
  contentType: 'text/html' | 'text/markdown' | 'application/json'
  cached: boolean
  renderTime: number
}

export interface ArticleJsonResponse {
  // 基本信息
  id: string
  slug: string
  title: string
  summary: string
  content: string
  lang: 'zh' | 'en'

  // 分类和标签
  domain: string
  tags: string[]
  keywords: string[]

  // 验证和元数据
  verificationStatus: string
  confidenceScore: number
  riskLevel: string
  applicableVersions: string[]
  runtimeEnv: Array<{ name: string; version: string }>

  // 代码和 QA
  codeBlocks: Array<{
    id: string
    language: string
    filename: string | null
    content: string
    description: string
  }>
  qaPairs: Array<{
    id: string
    question: string
    answer: string
  }>

  // 验证记录
  verificationRecords: unknown[]

  // 相关文章
  relatedIds: string[]

  // 时间信息
  publishedAt: string | null
  updatedAt: string
  createdAt: string

  // API 接入引导
  apiAccess: {
    endpoints: {
      search: string
      json: string
      markdown: string
    }
    exampleUsage: string
  }
}

// ============================================
// RenderService 类
// ============================================

export class RenderService {
  /**
   * 渲染人类视图（HTML）
   */
  async renderHuman(
    article: Article,
    lang: 'zh' | 'en' = 'zh'
  ): Promise<RenderedContent> {
    const cacheKey = CacheKeys.renderHuman(article.id, lang)
    const startTime = Date.now()

    // 检查缓存
    const cached = await getCache<string>(cacheKey)
    if (cached) {
      return {
        content: cached,
        contentType: 'text/html',
        cached: true,
        renderTime: Date.now() - startTime,
      }
    }

    // 获取内容
    const content = lang === 'zh' ? article.content.zh : article.content.en
    const title = lang === 'zh' ? article.title.zh : article.title.en
    const summary = lang === 'zh' ? article.summary.zh : article.summary.en

    // 渲染 Markdown 为 HTML
    const html = await this.markdownToHtml(content, title, summary)

    // 缓存结果
    await setCache(cacheKey, html, CacheTTL.long)

    return {
      content: html,
      contentType: 'text/html',
      cached: false,
      renderTime: Date.now() - startTime,
    }
  }

  /**
   * 渲染 Agent 视图（Markdown 或 JSON）
   */
  async renderAgent(
    article: Article,
    format: AgentFormat = 'markdown',
    lang: 'zh' | 'en' = 'en'
  ): Promise<RenderedContent> {
    const cacheKey = CacheKeys.renderAgent(article.id, format)
    const startTime = Date.now()

    // 检查缓存
    const cached = await getCache<string>(cacheKey)
    if (cached) {
      return {
        content: cached,
        contentType:
          format === 'json' ? 'application/json' : 'text/markdown',
        cached: true,
        renderTime: Date.now() - startTime,
      }
    }

    // 渲染内容
    const content =
      format === 'json'
        ? this.toJsonResponse(article, lang)
        : this.toMarkdown(article, lang)

    // 缓存结果
    await setCache(cacheKey, content, CacheTTL.long)

    return {
      content,
      contentType:
        format === 'json' ? 'application/json' : 'text/markdown',
      cached: false,
      renderTime: Date.now() - startTime,
    }
  }

  /**
   * 清除文章渲染缓存
   */
  async invalidateCache(articleId: string): Promise<void> {
    await deleteCachePattern(`render:*:${articleId}:*`)
  }

  /**
   * 批量预渲染
   */
  async preRender(articleIds: string[]): Promise<void> {
    for (const id of articleIds) {
      try {
        // 这里可以调用 ArticleService 获取文章并预渲染
        // 暂时跳过实际实现
        console.log(`Pre-rendering article: ${id}`)
      } catch (error) {
        console.error(`Failed to pre-render article ${id}:`, error)
      }
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * Markdown 转 HTML
   */
  private async markdownToHtml(
    markdown: string,
    title: string,
    summary: string
  ): Promise<string> {
    const contentHtml = await marked.parse(markdown)

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'Fira Code', monospace; }
    .summary { color: #666; font-style: italic; margin-bottom: 2rem; }
    .hljs { background: #f4f4f4; }
  </style>
</head>
<body>
  <article>
    <h1>${this.escapeHtml(title)}</h1>
    <p class="summary">${this.escapeHtml(summary)}</p>
    <div class="content">${contentHtml}</div>
  </article>
</body>
</html>`
  }

  // ============================================
  // 公开方法：内容转换
  // ============================================

  /**
   * 转换为 Markdown（公开方法）
   */
  toMarkdown(article: Article, lang: 'zh' | 'en'): string {
    const title = lang === 'zh' ? article.title.zh : article.title.en
    const summary = lang === 'zh' ? article.summary.zh : article.summary.en
    const content = lang === 'zh' ? article.content.zh : article.content.en
    const codeBlocks = article.codeBlocks as CodeBlock[]
    const qaPairs = article.qaPairs as QAPair[]

    let markdown = `# ${title}\n\n`
    markdown += `> ${summary}\n\n`
    markdown += `---\n\n`
    markdown += `## Content\n\n${content}\n\n`

    // 代码块
    if (codeBlocks && codeBlocks.length > 0) {
      markdown += `## Code Blocks\n\n`
      for (const block of codeBlocks) {
        const desc = lang === 'zh' ? block.description.zh : block.description.en
        markdown += `### ${desc}\n\n`
        markdown += `\`\`\`${block.language}\n${block.content}\n\`\`\`\n\n`
      }
    }

    // QA 对
    if (qaPairs && qaPairs.length > 0) {
      markdown += `## Q&A\n\n`
      for (const qa of qaPairs) {
        const question = lang === 'zh' ? qa.question.zh : qa.question.en
        const answer = lang === 'zh' ? qa.answer.zh : qa.answer.en
        markdown += `**Q: ${question}**\n\n${answer}\n\n`
      }
    }

    // 元数据
    markdown += `---\n\n`
    markdown += `## Metadata\n\n`
    markdown += `- **ID:** ${article.id}\n`
    markdown += `- **Domain:** ${article.domain}\n`
    markdown += `- **Tags:** ${article.tags.join(', ')}\n`
    markdown += `- **Keywords:** ${article.keywords.join(', ')}\n`
    markdown += `- **Verification Status:** ${article.verificationStatus}\n`
    markdown += `- **Confidence Score:** ${article.metadata.confidenceScore}%\n`
    markdown += `- **Risk Level:** ${article.metadata.riskLevel}\n`
    if (article.metadata.applicableVersions.length > 0) {
      markdown += `- **Applicable Versions:** ${article.metadata.applicableVersions.join(', ')}\n`
    }
    if (article.metadata.runtimeEnv && article.metadata.runtimeEnv.length > 0) {
      markdown += `- **Runtime Environment:** ${article.metadata.runtimeEnv.map(e => `${e.name} ${e.version}`).join(', ')}\n`
    }
    // 时间信息
    markdown += `- **Published At:** ${article.publishedAt || 'N/A'}\n`
    markdown += `- **Updated At:** ${article.updatedAt}\n`
    markdown += `- **Created At:** ${article.createdAt}\n`

    // 验证记录
    if (article.verificationRecords && article.verificationRecords.length > 0) {
      markdown += `\n## Verification Records\n\n`
      for (const record of article.verificationRecords) {
        const r = record as { verifier?: { name: string }; result: string; verifiedAt: string; notes?: string }
        const verifierName = r.verifier?.name || 'Unknown Verifier'
        markdown += `- **${verifierName}** (${r.result}) - ${r.verifiedAt}\n`
        if (r.notes) {
          markdown += `  - Notes: ${r.notes}\n`
        }
      }
    }

    // 相关文章
    if (article.relatedIds && article.relatedIds.length > 0) {
      markdown += `\n## Related Articles\n\n`
      markdown += `Related article IDs: ${article.relatedIds.join(', ')}\n`
    }

    // API 接入引导
    markdown += `\n---\n\n`
    markdown += `## API Access\n\n`
    markdown += `### Endpoints\n\n`
    markdown += `| Format | Endpoint |\n`
    markdown += `|--------|----------|\n`
    markdown += `| JSON | \`/api/v1/articles/${article.slug}?format=json\` |\n`
    markdown += `| Markdown | \`/api/v1/articles/${article.slug}?format=markdown\` |\n`
    markdown += `| Search | \`/api/v1/search?slug=${article.slug}\` |\n`
    markdown += `\n### Example Usage\n\n`
    markdown += `\`\`\`bash\n`
    markdown += `# Get this article in JSON format\n`
    markdown += `curl "https://buzhou.ai/api/v1/articles/${article.slug}?format=json"\n`
    markdown += `\n`
    markdown += `# Get this article in Markdown format\n`
    markdown += `curl "https://buzhou.ai/api/v1/articles/${article.slug}?format=markdown"\n`
    markdown += `\`\`\`\n`

    return markdown
  }

  /**
   * 转换为 JSON（公开方法）
   */
  toJsonResponse(article: Article, lang: 'zh' | 'en'): string {
    // 根据语言选择内容
    const title = lang === 'zh' ? article.title.zh : article.title.en
    const summary = lang === 'zh' ? article.summary.zh : article.summary.en
    const content = lang === 'zh' ? article.content.zh : article.content.en

    // 转换代码块为语言特定格式
    const codeBlocks = article.codeBlocks.map(block => ({
      id: block.id,
      language: block.language,
      filename: block.filename,
      content: block.content,
      description: lang === 'zh' ? block.description.zh : block.description.en,
    }))

    // 转换 QA 对为语言特定格式
    const qaPairs = article.qaPairs.map(qa => ({
      id: qa.id,
      question: lang === 'zh' ? qa.question.zh : qa.question.en,
      answer: lang === 'zh' ? qa.answer.zh : qa.answer.en,
    }))

    const response: ArticleJsonResponse = {
      // 基本信息
      id: article.id,
      slug: article.slug,
      title,
      summary,
      content,
      lang,

      // 分类和标签
      domain: article.domain,
      tags: article.tags,
      keywords: article.keywords,

      // 验证和元数据
      verificationStatus: article.verificationStatus,
      confidenceScore: article.metadata.confidenceScore,
      riskLevel: article.metadata.riskLevel,
      applicableVersions: article.metadata.applicableVersions,
      runtimeEnv: article.metadata.runtimeEnv,

      // 代码和 QA
      codeBlocks,
      qaPairs,

      // 验证记录
      verificationRecords: article.verificationRecords,

      // 相关文章
      relatedIds: article.relatedIds,

      // 时间信息
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      createdAt: article.createdAt,

      // API 接入引导
      apiAccess: {
        endpoints: {
          search: `/api/v1/search?slug=${article.slug}`,
          json: `/api/v1/articles/${article.slug}?format=json&lang=${lang}`,
          markdown: `/api/v1/articles/${article.slug}?format=markdown&lang=${lang}`,
        },
        exampleUsage: `curl "https://buzhou.ai/api/v1/articles/${article.slug}?format=json&lang=${lang}"`,
      },
    }

    return JSON.stringify(response, null, 2)
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}

// 导出单例
export const renderService = new RenderService()