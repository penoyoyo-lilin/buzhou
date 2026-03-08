import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { updateVerifierSchema } from '@/lib/validators'

/**
 * GET /api/admin/verifiers/[id]
 * 获取验证人详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '无效的验证人ID'),
        { status: 400 }
      )
    }

    const verifier = await prisma.verifier.findUnique({
      where: { id },
      include: {
        verificationRecords: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: { verifiedAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!verifier) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '验证人不存在'),
        { status: 404 }
      )
    }

    // 解析 JSON 字段
    const parsedVerifier = {
      ...verifier,
      credentials: verifier.credentials
        ? (verifier.credentials as { publicKey?: string; verified?: boolean; certificateUrl?: string })
        : {},
      reputation: {
        score: verifier.reputationScore,
        level: verifier.reputationLevel,
      },
      stats: {
        totalVerifications: verifier.totalVerifications,
        passedCount: verifier.passedCount,
        failedCount: verifier.failedCount,
        partialCount: verifier.partialCount,
      },
    }

    return NextResponse.json(successResponse(parsedVerifier))
  } catch (error) {
    console.error('Get verifier error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取验证人详情失败'),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/verifiers/[id]
 * 更新验证人
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '无效的验证人ID'),
        { status: 400 }
      )
    }

    const body = await request.json()

    const result = updateVerifierSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    // 检查验证人是否存在
    const existing = await prisma.verifier.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '验证人不存在'),
        { status: 404 }
      )
    }

    const verifier = await prisma.verifier.update({
      where: { id },
      data: result.data,
    })

    return NextResponse.json(successResponse(verifier))
  } catch (error) {
    console.error('Update verifier error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新验证人失败'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/verifiers/[id]
 * 删除验证人
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '无效的验证人ID'),
        { status: 400 }
      )
    }

    // 检查验证人是否存在
    const existing = await prisma.verifier.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '验证人不存在'),
        { status: 404 }
      )
    }

    // 删除关联的验证记录
    await prisma.verificationRecord.deleteMany({
      where: { verifierId: id },
    })

    // 删除验证人
    await prisma.verifier.delete({
      where: { id },
    })

    return NextResponse.json(successResponse(null))
  } catch (error) {
    console.error('Delete verifier error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '删除验证人失败'),
      { status: 500 }
    )
  }
}