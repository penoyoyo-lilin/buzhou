/**
 * 文章事件处理器
 * 处理文章创建后的事件，异步生成 QA 对、关键词和关联文章
 */

import { eventBus } from '@/core/events'
import { articleService } from '@/services/article.service'
import { aiService } from '@/services/ai.service'
import prisma from '@/core/db/client'

// ============================================
// 事件处理器注册
// ============================================

export function registerArticleEventHandlers() {
  // 监听文章创建事件
  eventBus.on('article:created', async (event) => {
    const { articleId, needsQAGeneration, needsRelatedGeneration, needsKeywordsGeneration } = event.payload as {
      articleId: string
      needsQAGeneration?: boolean
      needsRelatedGeneration?: boolean
      needsKeywordsGeneration?: boolean
    }

    console.log(`[ArticleEventHandler] Processing article:created for ${articleId}`)

    try {
      // 获取文章详情
      const article = await articleService.findById(articleId)
      if (!article) {
        console.warn(`[ArticleEventHandler] Article not found: ${articleId}`)
        return
      }

      // 并行执行生成任务
      const tasks = []

      // QA 对生成
      if (needsQAGeneration) {
        tasks.push(
          aiService.generateQAPairs(article).then(async (result) => {
            if (result.qaPairs.length > 0) {
              await articleService.update(articleId, {
                qaPairs: result.qaPairs,
              })
              console.log(`[ArticleEventHandler] Generated ${result.qaPairs.length} QA pairs for ${articleId}`)
            }
          })
        )
      }

      // 关键词生成
      if (needsKeywordsGeneration) {
        tasks.push(
          aiService.generateKeywords(article).then(async (result) => {
            if (result.keywords.length > 0) {
              const existingTags = new Set(article.tags)
              result.keywords.forEach((k) => existingTags.add(k))
              await articleService.update(articleId, {
                tags: Array.from(existingTags),
              })
              console.log(`[ArticleEventHandler] Generated ${result.keywords.length} keywords for ${articleId}`)
            }
          })
        )
      }

      // 关联文章生成
      if (needsRelatedGeneration) {
        tasks.push(
          (async () => {
            // 获取所有文章（简化版）
            const allArticles = await prisma.article.findMany({
              where: { id: { not: articleId } },
              select: {
                id: true,
                title: true,
                summary: true,
                tags: true,
                domain: true,
              },
            })

            const parsedArticles = allArticles.map((a) => ({
              id: a.id,
              title: JSON.parse(a.title),
              summary: JSON.parse(a.summary),
              tags: JSON.parse(a.tags),
              domain: a.domain,
            })) as Pick<Article, 'id' | 'title' | 'summary' | 'tags' | 'domain'>[]

            const result = await aiService.generateRelatedIds(article, parsedArticles)
            if (result.relatedIds.length > 0) {
              await articleService.update(articleId, {
                relatedIds: result.relatedIds,
              })
              console.log(`[ArticleEventHandler] Generated ${result.relatedIds.length} related articles for ${articleId}`)
            }
          })()
        )
      }

      await Promise.allSettled(tasks)
      console.log(`[ArticleEventHandler] Completed processing article:created for ${articleId}`)
    } catch (error) {
      console.error(`[ArticleEventHandler] Error processing article:created for ${articleId}:`, error)
    }
  })

  // 监听文章发布事件 - 自动触发 AI 生成
  eventBus.on('article:published', async (event) => {
    const { articleId, publishedBy } = event.payload as {
      articleId: string
      publishedAt: string
      publishedBy: string
    }

    console.log(`[ArticleEventHandler] Processing article:published for ${articleId}`)

    try {
      // 获取文章详情
      const article = await articleService.findById(articleId)
      if (!article) {
        console.warn(`[ArticleEventHandler] Article not found: ${articleId}`)
        return
      }

      // 检查是否已有 AI 生成内容，如果没有则生成
      const needsGeneration = article.qaPairs.length === 0 || article.keywords.length === 0 || article.relatedIds.length === 0

      if (!needsGeneration) {
        console.log(`[ArticleEventHandler] Article ${articleId} already has AI generated content, skipping`)
        return
      }

      // 并行执行生成任务
      const tasks = []

      // QA 对生成
      if (article.qaPairs.length === 0) {
        tasks.push(
          aiService.generateQAPairs(article).then(async (result) => {
            if (result.qaPairs.length > 0) {
              await articleService.update(articleId, {
                qaPairs: result.qaPairs,
              })
              console.log(`[ArticleEventHandler] Generated ${result.qaPairs.length} QA pairs for ${articleId}`)
            }
          })
        )
      }

      // 关键词生成
      if (article.keywords.length === 0) {
        tasks.push(
          aiService.generateKeywords(article).then(async (result) => {
            if (result.keywords.length > 0) {
              const existingKeywords = new Set(article.keywords)
              result.keywords.forEach((k) => existingKeywords.add(k))
              await articleService.update(articleId, {
                keywords: Array.from(existingKeywords),
              })
              console.log(`[ArticleEventHandler] Generated ${result.keywords.length} keywords for ${articleId}`)
            }
          })
        )
      }

      // 关联文章生成
      if (article.relatedIds.length === 0) {
        tasks.push(
          (async () => {
            const allArticles = await prisma.article.findMany({
              where: { id: { not: articleId }, status: 'published' },
              select: {
                id: true,
                title: true,
                summary: true,
                tags: true,
                domain: true,
              },
            })

            const parsedArticles = allArticles.map((a) => ({
              id: a.id,
              title: JSON.parse(a.title),
              summary: JSON.parse(a.summary),
              tags: JSON.parse(a.tags),
              domain: a.domain,
            })) as Pick<Article, 'id' | 'title' | 'summary' | 'tags' | 'domain'>[]

            const result = await aiService.generateRelatedIds(article, parsedArticles)
            if (result.relatedIds.length > 0) {
              await articleService.update(articleId, {
                relatedIds: result.relatedIds,
              })
              console.log(`[ArticleEventHandler] Generated ${result.relatedIds.length} related articles for ${articleId}`)
            }
          })()
        )
      }

      await Promise.allSettled(tasks)
      console.log(`[ArticleEventHandler] Completed processing article:published for ${articleId}`)
    } catch (error) {
      console.error(`[ArticleEventHandler] Error processing article:published for ${articleId}:`, error)
    }
  })
}

// 类型导入
import type { Article } from '@/types'