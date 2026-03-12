export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * 内部 API: 验证人列表和创建
 * GET/POST /api/internal/v1/verifiers
 */

import { NextRequest } from 'next/server'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { verifierService, CreateVerifierData } from '@/services/verifier.service'
import { z } from 'zod'

// 创建请求验证
const createVerifierRequestSchema = z.object({
  type: z.enum(['official_bot', 'third_party_agent', 'human_expert']),
  name: z.string().min(1),
  description: z.string().min(1),
  credentials: z.object({
    publicKey: z.string().optional(),
    certificateUrl: z.string().optional(),
    verified: z.boolean().optional(),
  }).optional(),
})

// 查询参数验证
const querySchema = z.object({
  type: z.enum(['official_bot', 'third_party_agent', 'human_expert']).optional(),
  status: z.enum(['active', 'suspended', 'retired']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * GET - 获取验证人列表
 */
export async function GET(request: NextRequest) {
  // 验证内部 API 认证
  if (!await verifyInternalAuth(request)) {
    return Response.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '无效的内部 API 密钥'),
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = querySchema.parse({
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 20,
    })

    const { verifiers, total } = await verifierService.list(params)

    return Response.json(
      successResponse({
        verifiers,
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          total,
          totalPages: Math.ceil(total / params.pageSize),
        },
      })
    )
  } catch (error) {
    console.error('Failed to list verifiers:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取验证人列表失败'),
      { status: 500 }
    )
  }
}

/**
 * POST - 创建验证人
 */
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
    const validated = createVerifierRequestSchema.parse(body)

    const verifier = await verifierService.create(validated as CreateVerifierData)

    return Response.json(successResponse(verifier))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '输入验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to create verifier:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '创建验证人失败'),
      { status: 500 }
    )
  }
}