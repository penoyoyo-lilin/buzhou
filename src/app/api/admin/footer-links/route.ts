export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { z } from 'zod'

/**
 * URL 格式化函数
 * - 外部链接：自动补全 https:// 协议前缀（如未指定）
 * - 内部链接：确保以 / 开头
 */
function normalizeFooterLinkUrl(url: string, isExternal: boolean): string {
  if (!url) return url

  if (isExternal) {
    // 外部链接：确保有协议前缀
    if (!url.match(/^https?:\/\//i)) {
      return `https://${url}`
    }
  } else {
    // 内部链接：确保以 / 开头
    if (!url.startsWith('/')) {
      return `/${url}`
    }
  }

  return url
}

const FooterLinkSchema = z.object({
  category: z.string().min(1),
  labelZh: z.string().min(1),
  labelEn: z.string().min(1),
  url: z.string().min(1),
  isExternal: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

/**
 * GET /api/admin/footer-links
 * 获取所有 Footer 链接（管理端）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const where = category ? { category } : {}

    const links = await prisma.footerLink.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    return NextResponse.json(successResponse(links))
  } catch (error) {
    console.error('Get footer links error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取页脚链接失败'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/footer-links
 * 创建 Footer 链接
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = FooterLinkSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '输入验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    // 格式化 URL
    const normalizedUrl = normalizeFooterLinkUrl(result.data.url, result.data.isExternal)

    const link = await prisma.footerLink.create({
      data: {
        ...result.data,
        url: normalizedUrl,
      },
    })

    return NextResponse.json(successResponse(link), { status: 201 })
  } catch (error) {
    console.error('Create footer link error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '创建页脚链接失败'),
      { status: 500 }
    )
  }
}