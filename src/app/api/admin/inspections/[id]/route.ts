export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAdminAuth } from '@/core/middleware/admin-auth'
import { errorResponse, ErrorCodes, successResponse } from '@/lib/api-response'
import { articleInspectionService } from '@/services/article-inspection.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

const retrySchema = z.object({
  action: z.literal('retry'),
})

export async function GET(request: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdminAuth(request)
  if (!admin) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '未登录或会话已过期'),
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const detail = await articleInspectionService.getRunDetail(id)

    if (!detail) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '巡检任务不存在'),
        { status: 404 }
      )
    }

    return NextResponse.json(successResponse(detail))
  } catch (error) {
    console.error('Failed to get admin inspection detail:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取巡检详情失败'),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdminAuth(request)
  if (!admin) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '未登录或会话已过期'),
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    retrySchema.parse(body)
    const { id } = await params
    const run = await articleInspectionService.retryRun(id)

    if (!run) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '巡检任务不存在'),
        { status: 404 }
      )
    }

    return NextResponse.json(successResponse({ run }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to retry admin inspection:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '重试巡检失败'),
      { status: 500 }
    )
  }
}
