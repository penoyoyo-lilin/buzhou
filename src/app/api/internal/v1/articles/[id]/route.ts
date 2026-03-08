/**
 * 内部 API: 文章 CRUD
 * GET/PUT/DELETE /api/internal/v1/articles/[id]
 */

import { NextRequest } from 'next/server'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { articleService, UpdateArticleData } from '@/services/article.service'
import { z } from 'zod'

// 更新请求验证
const updateArticleRequestSchema = z.object({
  title: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }).optional(),
  summary: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }).optional(),
  content: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }).optional(),
  domain: z.enum(['agent', 'mcp', 'skill']).optional(),
  tags: z.array(z.string()).optional(),
  codeBlocks: z.array(z.any()).optional(),
  metadata: z.any().optional(),
  qaPairs: z.array(z.any()).optional(),
  relatedIds: z.array(z.string()).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET - 获取文章详情
 */
export async function GET(
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
    const article = await articleService.findById(id)

    if (!article) {
      return Response.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    return Response.json(successResponse(article))
  } catch (error) {
    console.error('Failed to get article:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取文章失败'),
      { status: 500 }
    )
  }
}

/**
 * PUT - 更新文章
 */
export async function PUT(
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
    const body = await request.json()
    const validated = updateArticleRequestSchema.parse(body)

    // 检查文章是否存在
    const existing = await articleService.findById(id)
    if (!existing) {
      return Response.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // 更新文章
    const article = await articleService.update(id, validated as UpdateArticleData)

    return Response.json(successResponse(article))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '输入验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to update article:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新文章失败'),
      { status: 500 }
    )
  }
}

/**
 * DELETE - 删除文章
 */
export async function DELETE(
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

    // 删除文章
    await articleService.delete(id)

    return Response.json(successResponse({ id, deleted: true }))
  } catch (error) {
    console.error('Failed to delete article:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '删除文章失败'),
      { status: 500 }
    )
  }
}