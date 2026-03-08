/**
 * 内部 API: 验证人详情和更新
 * GET/PUT /api/internal/v1/verifiers/[id]
 */

import { NextRequest } from 'next/server'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { verifierService, UpdateVerifierData } from '@/services/verifier.service'
import { z } from 'zod'

// 更新请求验证
const updateVerifierRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['active', 'suspended', 'retired']).optional(),
  credentials: z.object({
    publicKey: z.string().optional(),
    certificateUrl: z.string().optional(),
    verified: z.boolean().optional(),
  }).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET - 获取验证人详情
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

  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (isNaN(id)) {
    return Response.json(
      errorResponse(ErrorCodes.INVALID_INPUT, '无效的验证人ID'),
      { status: 400 }
    )
  }

  try {
    const verifier = await verifierService.findById(id)

    if (!verifier) {
      return Response.json(
        errorResponse(ErrorCodes.NOT_FOUND, '验证人不存在'),
        { status: 404 }
      )
    }

    // 获取统计信息
    const stats = await verifierService.getStats(id)

    return Response.json(
      successResponse({
        ...verifier,
        stats,
      })
    )
  } catch (error) {
    console.error('Failed to get verifier:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取验证人失败'),
      { status: 500 }
    )
  }
}

/**
 * PUT - 更新验证人
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

  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (isNaN(id)) {
    return Response.json(
      errorResponse(ErrorCodes.INVALID_INPUT, '无效的验证人ID'),
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const validated = updateVerifierRequestSchema.parse(body)

    // 检查验证人是否存在
    const existing = await verifierService.findById(id)
    if (!existing) {
      return Response.json(
        errorResponse(ErrorCodes.NOT_FOUND, '验证人不存在'),
        { status: 404 }
      )
    }

    // 更新验证人
    const verifier = await verifierService.update(id, validated as UpdateVerifierData)

    return Response.json(successResponse(verifier))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '输入验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to update verifier:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新验证人失败'),
      { status: 500 }
    )
  }
}