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

const CREATE_ARTICLE_DOMAINS = [
  'mcp',
  'skill',
  'foundation',
  'transport',
  'tools_filesystem',
  'tools_postgres',
  'tools_github',
  'error_codes',
  'scenarios',
] as const

const LEGACY_DOMAIN_ALIASES: Record<string, typeof CREATE_ARTICLE_DOMAINS[number]> = {
  'tools-filesystem': 'tools_filesystem',
  'tools-postgres': 'tools_postgres',
  'tools-github': 'tools_github',
  'error-codes': 'error_codes',
}

function normalizeArticleDomain(input: unknown): string {
  if (typeof input !== 'string') return ''
  const normalized = input.trim().toLowerCase()
  return LEGACY_DOMAIN_ALIASES[normalized] || normalized
}

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
  domain: z.preprocess(
    normalizeArticleDomain,
    z.enum(CREATE_ARTICLE_DOMAINS)
  ),
  priority: z.enum(['P0', 'P1']).optional().default('P1'),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  codeBlocks: z.array(z.any()).optional(),
  metadata: z.any().optional(),
  qaPairs: z.array(z.any()).optional(),
  relatedIds: z.array(z.string()).optional(),
  createdBy: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  status: z.enum(['draft', 'published']).optional().default('published'),
  skipVerification: z.boolean().optional(),
  // 新增：验证记录
  verificationRecords: z.array(verificationRecordSchema).optional(),
}).superRefine((data, ctx) => {
  if (!data.author && !data.createdBy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['author'],
      message: 'author 或 createdBy 至少提供一个',
    })
  }
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
    const isBatch = Array.isArray(body)
    const items = isBatch ? body : [body]
    const results: Array<{
      success: boolean
      article?: unknown
      error?: string
    }> = []

    for (const item of items) {
      const parsed = createArticleRequestSchema.safeParse(item)
      if (!parsed.success) {
        if (!isBatch) {
          return Response.json(
            errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', {
              errors: parsed.error.flatten().fieldErrors,
            }),
            { status: 400 }
          )
        }

        results.push({
          success: false,
          error: parsed.error.issues[0]?.message || '参数验证失败',
        })
        continue
      }

      try {
        const validated = parsed.data
        const shouldSkipVerification = validated.skipVerification === true
        const author = validated.author?.trim() || validated.createdBy?.trim()
        if (!author) {
          if (!isBatch) {
            return Response.json(
              errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', {
                errors: {
                  author: ['author 或 createdBy 至少提供一个'],
                },
              }),
              { status: 400 }
            )
          }

          results.push({
            success: false,
            error: 'author 或 createdBy 至少提供一个',
          })
          continue
        }

        // 沙盒验证（可选跳过）
        if (!shouldSkipVerification) {
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
            status: validated.status,
            createdBy: author,
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

        // 创建文章（先创建，再按目标状态决定是否发布）
        const createData: CreateArticleData = {
          slug: validated.slug,
          title: validated.title,
          summary: validated.summary,
          content: validated.content,
          domain: validated.domain,
          priority: validated.priority,
          tags: validated.tags,
          keywords: validated.keywords,
          codeBlocks: validated.codeBlocks,
          metadata: validated.metadata,
          qaPairs: validated.qaPairs,
          relatedIds: validated.relatedIds,
          createdBy: author,
          skipVerification: shouldSkipVerification,
        }

        const createdArticle = await articleService.create(createData)
        const article = validated.status === 'published'
          ? await articleService.publish(createdArticle.id, author)
          : createdArticle

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
            createdBy: author,
            status: article.status,
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
