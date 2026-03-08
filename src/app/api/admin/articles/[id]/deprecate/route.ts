import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'

/**
 * POST /api/admin/articles/[id]/deprecate
 * 标记文章失效
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // 检查文章是否存在
    const existing = await prisma.article.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // 更新失效状态
    const article = await prisma.article.update({
      where: { id },
      data: {
        status: 'deprecated',
        deprecatedAt: new Date(),
        deprecatedReason: body.reason || null,
      },
    })

    return NextResponse.json(
      successResponse({
        id: article.id,
        status: article.status,
        deprecatedAt: article.deprecatedAt,
        deprecatedReason: article.deprecatedReason,
      })
    )
  } catch (error) {
    console.error('Deprecate article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '标记失效失败'),
      { status: 500 }
    )
  }
}