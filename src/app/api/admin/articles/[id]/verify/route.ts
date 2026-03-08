import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { verificationService } from '@/services/verification.service'
import { z } from 'zod'

// 验证记录输入验证
const verifySchema = z.object({
  verifierId: z.number().int().positive(),
  result: z.enum(['passed', 'failed', 'partial']),
  environment: z.object({
    os: z.string(),
    runtime: z.string(),
    version: z.string(),
  }),
  notes: z.string().optional(),
})

/**
 * POST /api/admin/articles/[id]/verify
 * 为文章添加验证记录
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: articleId } = params
    const body = await request.json()

    // 验证输入
    const validated = verifySchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: validated.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    // 检查文章是否存在
    const article = await prisma.article.findUnique({
      where: { id: articleId },
    })

    if (!article) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // 创建验证记录
    const record = await verificationService.createRecord({
      articleId,
      verifierId: validated.data.verifierId,
      result: validated.data.result,
      environment: validated.data.environment,
      notes: validated.data.notes,
    })

    return NextResponse.json(successResponse(record))
  } catch (error) {
    console.error('Add verification record error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '添加验证记录失败'),
      { status: 500 }
    )
  }
}