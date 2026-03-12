export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { verifierQuerySchema } from '@/lib/validators'
import { toJsonValue } from '@/core/db/utils'
import { z } from 'zod'

// 创建验证人验证
const createVerifierSchema = z.object({
  type: z.enum(['official_bot', 'third_party_agent', 'human_expert']),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

/**
 * GET /api/admin/verifiers
 * 获取验证人列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const result = verifierQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
    })

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const { search, type, status, page, pageSize } = result.data

    // 构建查询条件
    const where: Record<string, unknown> = {}

    if (search) {
      // ID 为数字，仅对名称进行模糊搜索
      where.OR = [
        { name: { contains: search } },
      ]
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    // 查询总数
    const total = await prisma.verifier.count({ where })

    // 查询列表
    const verifiers = await prisma.verifier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return NextResponse.json(
      successResponse({
        items: verifiers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    )
  } catch (error) {
    console.error('Get verifiers error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取验证人列表失败'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/verifiers
 * 创建验证人（ID 自动递增）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = createVerifierSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const { type, name, description } = result.data

    // 创建验证人（ID 自动递增）
    const verifier = await prisma.verifier.create({
      data: {
        type,
        name,
        description: description || '',
        credentials: toJsonValue({ verified: false }) as any,
        reputationScore: 0,
        reputationLevel: 'beginner',
        totalVerifications: 0,
        passedCount: 0,
        failedCount: 0,
        partialCount: 0,
        status: 'active',
      },
    })

    return NextResponse.json(successResponse(verifier))
  } catch (error) {
    console.error('Create verifier error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '创建验证人失败'),
      { status: 500 }
    )
  }
}
