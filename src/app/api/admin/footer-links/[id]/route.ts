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

const UpdateFooterLinkSchema = z.object({
  category: z.string().min(1).optional(),
  labelZh: z.string().min(1).optional(),
  labelEn: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  isExternal: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

type Params = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/footer-links/[id]
 * 获取单个 Footer 链接
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const link = await prisma.footerLink.findUnique({
      where: { id },
    })

    if (!link) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '页脚链接不存在'),
        { status: 404 }
      )
    }

    return NextResponse.json(successResponse(link))
  } catch (error) {
    console.error('Get footer link error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取页脚链接失败'),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/footer-links/[id]
 * 更新 Footer 链接
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const result = UpdateFooterLinkSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '输入验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    // 获取现有数据以确定 isExternal 值
    const existingLink = await prisma.footerLink.findUnique({
      where: { id },
      select: { isExternal: true },
    })

    // 使用新的 isExternal 值（如果提供），否则使用现有值
    const isExternal = result.data.isExternal ?? existingLink?.isExternal ?? false

    // 格式化 URL（如果提供了 url）
    const updateData = { ...result.data }
    if (result.data.url) {
      updateData.url = normalizeFooterLinkUrl(result.data.url, isExternal)
    }

    const link = await prisma.footerLink.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(successResponse(link))
  } catch (error) {
    console.error('Update footer link error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新页脚链接失败'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/footer-links/[id]
 * 删除 Footer 链接
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    await prisma.footerLink.delete({
      where: { id },
    })

    return NextResponse.json(successResponse({ id }))
  } catch (error) {
    console.error('Delete footer link error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '删除页脚链接失败'),
      { status: 500 }
    )
  }
}