import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'

/**
 * POST /api/admin/articles/[id]/feature
 * 置顶文章
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json().catch(() => ({}))

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

    // 更新置顶状态
    const featuredAt = body.featured ? new Date() : null

    const article = await prisma.article.update({
      where: { id },
      data: { featuredAt },
    })

    return NextResponse.json(
      successResponse({
        id: article.id,
        featured: !!featuredAt,
        featuredAt: article.featuredAt,
      })
    )
  } catch (error) {
    console.error('Feature article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '置顶操作失败'),
      { status: 500 }
    )
  }
}