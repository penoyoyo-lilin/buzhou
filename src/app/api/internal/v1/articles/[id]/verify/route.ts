/**
 * 内部 API: 添加验证记录
 * POST /api/internal/v1/articles/[id]/verify
 */

import { NextRequest } from 'next/server'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { verificationService, CreateVerificationData } from '@/services/verification.service'
import { articleService } from '@/services/article.service'
import { z } from 'zod'

// 请求体验证
const verifyRequestSchema = z.object({
  verifierId: z.number().int().positive(),
  result: z.enum(['passed', 'failed', 'partial']),
  environment: z.object({
    os: z.string(),
    runtime: z.string(),
    version: z.string(),
  }),
  notes: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  // 验证内部 API 认证
  if (!await verifyInternalAuth(request)) {
    return Response.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '无效的内部 API 密钥'),
      { status: 401 }
    )
  }

  const { id } = await params

  try {
    // 检查文章是否存在
    const existing = await articleService.findById(id)
    if (!existing) {
      return Response.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const validated = verifyRequestSchema.parse(body)

    // 创建验证记录
    const record = await verificationService.createRecord({
      articleId: id,
      verifierId: validated.verifierId,
      result: validated.result,
      environment: validated.environment,
      notes: validated.notes,
    } as CreateVerificationData)

    return Response.json(successResponse(record))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '输入验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to add verification:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '添加验证记录失败'),
      { status: 500 }
    )
  }
}