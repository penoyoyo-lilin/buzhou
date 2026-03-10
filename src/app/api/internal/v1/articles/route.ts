/**
 * 内部 API: 批量创建文章
 * POST /api/internal/v1/articles
 */

import { NextRequest } from 'next/server'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { articleService, CreateArticleData } from '@/services/article.service'
import { verificationService, CreateVerificationData } from '@/services/verification.service'
import { sandboxService } from '@/services/sandbox.service'
import { eventBus } from '@/core/events'
import { z } from 'zod'

// 验证记录验证
const verificationRecordSchema = z.object({
  verifierId: z.number().int().positive(),
  result: z.enum(['passed', 'failed', 'partial']),
  environment: z.object({
    os: z.string(),
    runtime: z.string(),
    version: z.string(),
  }),
  notes: z.string().optional(),
})

// 请求体验证
const createArticleRequestSchema = z.object({
  slug: z.string().optional(),
  title: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }),
  summary: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }),
  content: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }),
  domain: z.enum([
    // 原有领域分类
    'agent', 'mcp', 'skill',
    // MVP 内容分类
    'foundation', 'transport',
    'tools_filesystem', 'tools_postgres', 'tools_github',
    'error_codes', 'scenarios'
  ]),
  priority: z.enum(['P0', 'P1']).optional().default('P1'),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  codeBlocks: z.array(z.any()).optional(),
  metadata: z.any().optional(),
  qaPairs: z.array(z.any()).optional(),
  relatedIds: z.array(z.string()).optional(),
  createdBy: z.string().min(1),
  skipVerification: z.boolean().optional(),
  // 新增：验证记录
  verificationRecords: z.array(verificationRecordSchema).optional(),
})

export async function POST(request: NextRequest) {
  // 验证内部 API 认证
  if (!await verifyInternalAuth(request)) {
    return Response.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '无效的内部 API 密钥'),
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // 支持单个或批量创建
    const items = Array.isArray(body) ? body : [body]
    const results: Array<{
      success: boolean
      article?: unknown
      error?: string
    }> = []

    for (const item of items) {
      try {
        // 验证输入
        const validated = createArticleRequestSchema.parse(item)

        // 沙盒验证（可选跳过）
        if (!validated.skipVerification) {
          const tempArticle = {
            id: 'temp',
            slug: validated.slug || '',
            title: validated.title,
            summary: validated.summary,
            content: validated.content,
            domain: validated.domain,
            tags: validated.tags || [],
            keywords: validated.keywords || [],
            priority: validated.priority,
            codeBlocks: validated.codeBlocks || [],
            metadata: validated.metadata || {},
            qaPairs: validated.qaPairs || [],
            relatedIds: validated.relatedIds || [],
            verificationStatus: 'pending' as const,
            verificationRecords: [],
            status: 'draft' as const,
            createdBy: validated.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: null,
          }

          const verificationResult = await sandboxService.verify(tempArticle)
          if (verificationResult === 'failed') {
            results.push({
              success: false,
              error: 'Sandbox verification failed',
            })
            continue
          }
        }

        // 创建文章
        const article = await articleService.create(validated as CreateArticleData)

        // 如果有验证记录，创建验证记录
        if (validated.verificationRecords && validated.verificationRecords.length > 0) {
          for (const record of validated.verificationRecords) {
            await verificationService.createRecord({
              articleId: article.id,
              verifierId: record.verifierId,
              result: record.result,
              environment: record.environment,
              notes: record.notes,
            } as CreateVerificationData)
          }
        }

        // 发布事件触发异步生成任务
        await eventBus.emit(
          'article:created',
          {
            articleId: article.id,
            domain: validated.domain,
            createdBy: validated.createdBy,
            status: 'draft',
            needsQAGeneration: true,
            needsRelatedGeneration: true,
            needsKeywordsGeneration: true,
          },
          {
            aggregateId: article.id,
            aggregateType: 'Article',
            source: 'internal-api',
          }
        )

        results.push({ success: true, article })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.push({ success: false, error: message })
      }
    }

    // 返回结果
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return Response.json(
      successResponse({
        results,
        summary: {
          total: items.length,
          success: successCount,
          failed: failCount,
        },
      })
    )
  } catch (error) {
    console.error('Failed to create articles:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '创建文章失败'),
      { status: 500 }
    )
  }
}