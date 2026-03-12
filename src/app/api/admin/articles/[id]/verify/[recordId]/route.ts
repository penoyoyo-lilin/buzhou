import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { verificationService } from '@/services/verification.service'
import { z } from 'zod'

// 验证记录更新验证
const updateRecordSchema = z.object({
  verifierId: z.string().min(1).optional(),
  result: z.enum(['passed', 'failed', 'partial']).optional(),
  environment: z.object({
    os: z.string(),
    runtime: z.string(),
    version: z.string(),
  }).optional(),
  notes: z.string().optional(),
})

/**
 * PUT /api/admin/articles/[id]/verify/[recordId]
 * 更新验证记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; recordId: string } }
) {
  try {
    const { id: articleId, recordId } = params
    const body = await request.json()

    // 验证输入
    const validated = updateRecordSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: validated.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    // 检查验证记录是否存在且属于该文章
    const existingRecord = await prisma.verificationRecord.findFirst({
      where: { id: recordId, articleId },
    })

    if (!existingRecord) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '验证记录不存在'),
        { status: 404 }
      )
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {}
    if (validated.data.verifierId) {
      updateData.verifierId = validated.data.verifierId
    }
    if (validated.data.result) {
      updateData.result = validated.data.result
    }
    if (validated.data.environment) {
      updateData.environment = validated.data.environment
    }
    if (validated.data.notes !== undefined) {
      updateData.notes = validated.data.notes
    }

    // 更新记录
    const record = await prisma.verificationRecord.update({
      where: { id: recordId },
      data: updateData,
    })

    // 更新文章验证状态与置信分数
    await verificationService.updateArticleStatus(articleId)

    return NextResponse.json(successResponse(record))
  } catch (error) {
    console.error('Update verification record error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新验证记录失败'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/articles/[id]/verify/[recordId]
 * 删除验证记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; recordId: string } }
) {
  try {
    const { id: articleId, recordId } = params

    // 检查验证记录是否存在且属于该文章
    const existingRecord = await prisma.verificationRecord.findFirst({
      where: { id: recordId, articleId },
    })

    if (!existingRecord) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '验证记录不存在'),
        { status: 404 }
      )
    }

    // 删除记录
    await prisma.verificationRecord.delete({
      where: { id: recordId },
    })

    // 更新文章验证状态与置信分数
    await verificationService.updateArticleStatus(articleId)

    return NextResponse.json(successResponse(null))
  } catch (error) {
    console.error('Delete verification record error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '删除验证记录失败'),
      { status: 500 }
    )
  }
}
