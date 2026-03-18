/**
 * 文章事件处理器
 * 处理文章创建后的事件，异步生成 QA 对、关键词和关联文章
 */

import { eventBus } from '@/core/events'
import { articleService } from '@/services/article.service'
import { aiService } from '@/services/ai.service'
import { articleInspectionService } from '@/services/article-inspection.service'
import prisma from '@/core/db/client'

// ============================================
// 事件处理器注册
// ============================================

export function ensureArticleEventHandlersRegistered() {
  if (eventBus.hasHandlers('article:published')) {
    return
  }

  registerArticleEventHandlers()
}

export function registerArticleEventHandlers() {
  if (eventBus.hasHandlers('article:published')) {
    return
  }

  const materialInspectionFields = new Set([
    'title',
    'summary',
    'content',
    'tags',
    'keywords',
    'codeBlocks',
    'metadata',
    'qaPairs',
    'relatedIds',
  ])

  const isMissingArticleUpdateError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false

    const code = (error as { code?: string }).code
    if (code === 'P2025') {
      return true
    }

    const message = error instanceof Error ? error.message : String(error)
    return /record to update not found/i.test(message)
  }

  const updateArticleIfExists = async (
    articleId: string,
    patch: Parameters<typeof articleService.update>[1],
    reason: 'qaPairs' | 'tags' | 'relatedIds'
  ): Promise<boolean> => {
    try {
      await articleService.update(articleId, patch)
      return true
    } catch (error) {
      if (isMissingArticleUpdateError(error)) {
        console.warn(`[ArticleEventHandler] Skip ${reason} update for deleted article ${articleId}`)
        return false
      }
      throw error
    }
  }

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
              const updated = await updateArticleIfExists(articleId, {
                qaPairs: result.qaPairs,
              }, 'qaPairs')
              if (updated) {
                console.log(`[ArticleEventHandler] Generated ${result.qaPairs.length} QA pairs for ${articleId}`)
              }
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
              const updated = await updateArticleIfExists(articleId, {
                tags: Array.from(existingTags),
              }, 'tags')
              if (updated) {
                console.log(`[ArticleEventHandler] Generated ${result.keywords.length} keywords for ${articleId}`)
              }
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

            // PostgreSQL 的 Json 类型返回已解析的对象，无需 JSON.parse
            const parsedArticles = allArticles.map((a) => ({
              id: a.id,
              title: a.title ? JSON.parse(a.title as string) : { zh: '', en: '' },
              summary: a.summary ? JSON.parse(a.summary as string) : { zh: '', en: '' },
              tags: a.tags ? JSON.parse(a.tags as string) : [],
              domain: a.domain,
            })) as any[]
            const result = await aiService.generateRelatedIds(article, parsedArticles)
            if (result.relatedIds.length > 0) {
              const updated = await updateArticleIfExists(articleId, {
                relatedIds: result.relatedIds,
              }, 'relatedIds')
              if (updated) {
                console.log(`[ArticleEventHandler] Generated ${result.relatedIds.length} related articles for ${articleId}`)
              }
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

  // 监听文章发布事件 - 仅记录日志，不再自动生成 AI 内容
  eventBus.on('article:published', async (event) => {
    const { articleId, publishedAt, publishedBy } = event.payload as {
      articleId: string
      publishedAt: string
      publishedBy: string
    }

    console.log(`[ArticleEventHandler] Article published: ${articleId} by ${publishedBy} at ${publishedAt}`)
    await articleInspectionService.enqueueImmediateInspection(articleId, 'event_publish')
  })

  eventBus.on('article:updated', async (event) => {
    const { articleId, changes, updatedBy } = event.payload as {
      articleId: string
      updatedBy: string
      changes: string[]
    }

    if (event.source === 'inspection-repair') {
      console.log(`[ArticleEventHandler] Skip re-enqueue inspection for repair-originated update ${articleId}`)
      return
    }

    const hasMaterialChanges = changes.some((field) => materialInspectionFields.has(field))
    if (!hasMaterialChanges) {
      return
    }

    const article = await articleService.findById(articleId)
    if (!article || article.status !== 'published') {
      return
    }

    console.log(`[ArticleEventHandler] Article updated: ${articleId} by ${updatedBy}, enqueue inspection`)
    await articleInspectionService.enqueueImmediateInspection(articleId, 'event_update')
  })

  eventBus.on('article:inspection-requested', async (event) => {
    const { articleId, inspectionRunId, triggerSource } = event.payload as {
      articleId: string
      inspectionRunId: string
      triggerSource: string
    }

    console.log(`[ArticleEventHandler] Inspection queued for ${articleId} run=${inspectionRunId} source=${triggerSource}`)
  })

  eventBus.on('article:inspection-completed', async (event) => {
    const { articleId, inspectionRunId, status, findingsCount } = event.payload as {
      articleId: string
      inspectionRunId: string
      status: string
      findingsCount: number
    }

    console.log(`[ArticleEventHandler] Inspection completed for ${articleId} run=${inspectionRunId} status=${status} findings=${findingsCount}`)
  })

  eventBus.on('article:repair-applied', async (event) => {
    const { articleId, repairRunId, mode } = event.payload as {
      articleId: string
      repairRunId: string
      mode: string
    }

    console.log(`[ArticleEventHandler] Repair applied for ${articleId} repair=${repairRunId} mode=${mode}`)
  })

  eventBus.on('article:repair-failed', async (event) => {
    const { articleId, repairRunId, reason } = event.payload as {
      articleId: string
      repairRunId: string | null
      reason: string
    }

    console.warn(`[ArticleEventHandler] Repair failed for ${articleId} repair=${repairRunId || 'n/a'} reason=${reason}`)
  })
}

// 类型导入
import type { Article } from '@/types'
