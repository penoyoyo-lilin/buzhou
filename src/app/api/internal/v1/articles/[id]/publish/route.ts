/**
 * 内部 API: 发布文章
 * POST /api/internal/v1/articles/[id]/publish
 */

import { NextRequest } from 'next/server'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { articleService } from '@/services/article.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  // 验证内部 API 认证
  if (!verifyInternalAuth(request)) {
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

    // 检查文章状态
    if (existing.status === 'published') {
      return Response.json(
        errorResponse(ErrorCodes.OPERATION_FAILED, '文章已发布'),
        { status: 400 }
      )
    }

    // 发布文章
    const article = await articleService.publish(id, 'internal-api')

    return Response.json(successResponse(article))
  } catch (error) {
    console.error('Failed to publish article:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '发布文章失败'),
      { status: 500 }
    )
  }
}