import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { errorResponse, ErrorCodes, successResponse } from '@/lib/api-response'
import { articleInspectionService } from '@/services/article-inspection.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

const retrySchema = z.object({
  action: z.literal('retry'),
})

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!await verifyInternalAuth(request)) {
    return Response.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '无效的内部 API 密钥'),
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const detail = await articleInspectionService.getRunDetail(id)

    if (!detail) {
      return Response.json(
        errorResponse(ErrorCodes.NOT_FOUND, '巡检任务不存在'),
        { status: 404 }
      )
    }

    return Response.json(successResponse(detail))
  } catch (error) {
    console.error('Failed to get inspection detail:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取巡检详情失败'),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!await verifyInternalAuth(request)) {
    return Response.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '无效的内部 API 密钥'),
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    retrySchema.parse(body)
    const { id } = await params
    const run = await articleInspectionService.retryRun(id)

    if (!run) {
      return Response.json(
        errorResponse(ErrorCodes.NOT_FOUND, '巡检任务不存在'),
        { status: 404 }
      )
    }

    return Response.json(successResponse({ run }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to retry inspection:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '重试巡检失败'),
      { status: 500 }
    )
  }
}
