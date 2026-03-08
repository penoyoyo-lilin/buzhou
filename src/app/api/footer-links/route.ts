import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'

/**
 * GET /api/footer-links
 * 获取 Footer 链接配置（公开接口，无需认证）
 */
export async function GET() {
  try {
    const links = await prisma.footerLink.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    // 按分类分组
    const groupedLinks = links.reduce(
      (acc, link) => {
        if (!acc[link.category]) {
          acc[link.category] = []
        }
        acc[link.category].push({
          id: link.id,
          labelZh: link.labelZh,
          labelEn: link.labelEn,
          url: link.url,
          isExternal: link.isExternal,
        })
        return acc
      },
      {} as Record<string, any[]>
    )

    return NextResponse.json(successResponse(groupedLinks))
  } catch (error) {
    console.error('Get footer links error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取页脚链接失败'),
      { status: 500 }
    )
  }
}