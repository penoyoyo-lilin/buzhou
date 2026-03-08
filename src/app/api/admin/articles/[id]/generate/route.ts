import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { articleService } from '@/services/article.service'
import { aiService } from '@/services/ai.service'
import prisma from '@/core/db/client'
import { z } from 'zod'
import type { ArticleDomain } from '@/types'

// 请求验证 schema
const generateSchema = z.object({
  types: z.array(z.enum(['qa', 'keywords', 'related'])).min(1),
})

/**
 * POST /api/admin/articles/[id]/generate
 * 手动触发 AI 生成字段
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // 验证输入
    const validated = generateSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: validated.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const { types } = validated.data

    // 获取文章
    const article = await articleService.findById(id)
    if (!article) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // 并行执行生成任务
    const results: {
      qaPairs?: number
      keywords?: number
      related?: number
    } = {}

    const tasks: Promise<void>[] = []

    // QA 对生成
    if (types.includes('qa')) {
      tasks.push(
        (async () => {
          const result = await aiService.generateQAPairs(article)
          if (result.qaPairs.length > 0) {
            await articleService.update(id, { qaPairs: result.qaPairs })
            results.qaPairs = result.qaPairs.length
          }
        })()
      )
    }

    // 关键词生成
    if (types.includes('keywords')) {
      tasks.push(
        (async () => {
          const result = await aiService.generateKeywords(article)
          if (result.keywords.length > 0) {
            const existingKeywords = new Set(article.keywords)
            result.keywords.forEach((k) => existingKeywords.add(k))
            await articleService.update(id, {
              keywords: Array.from(existingKeywords),
            })
            results.keywords = result.keywords.length
          }
        })()
      )
    }

    // 关联文章生成
    if (types.includes('related')) {
      tasks.push(
        (async () => {
          // 获取所有文章用于关联分析
          const allArticles = await prisma.article.findMany({
            where: { id: { not: id } },
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
            domain: a.domain as ArticleDomain,
          }))

          const result = await aiService.generateRelatedIds(article, parsedArticles)
          if (result.relatedIds.length > 0) {
            await articleService.update(id, { relatedIds: result.relatedIds })
            results.related = result.relatedIds.length
          }
        })()
      )
    }

    await Promise.allSettled(tasks)

    // 返回更新后的文章
    const updatedArticle = await articleService.findById(id)

    return NextResponse.json(
      successResponse({
        results,
        article: updatedArticle,
      })
    )
  } catch (error) {
    console.error('Generate AI fields error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'AI 字段生成失败'),
      { status: 500 }
    )
  }
}