export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAdminAuth } from '@/core/middleware/admin-auth'
import { errorResponse, ErrorCodes, successResponse } from '@/lib/api-response'
import { articleInspectionService } from '@/services/article-inspection.service'

const listQuerySchema = z.object({
  status: z.enum(['queued', 'running', 'completed', 'partial', 'failed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('enqueue'),
    articleId: z.string().min(1),
  }),
  z.object({
    action: z.literal('daily'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  z.object({
    action: z.literal('process'),
    limit: z.coerce.number().int().min(1).max(50).default(1),
  }),
])

export async function GET(request: NextRequest) {
  const admin = await verifyAdminAuth(request)
  if (!admin) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '未登录或会话已过期'),
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = listQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await articleInspectionService.listRuns(params)

    return NextResponse.json(successResponse(result))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to list admin inspections:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取巡检任务失败'),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminAuth(request)
  if (!admin) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '未登录或会话已过期'),
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const payload = actionSchema.parse(body)

    if (payload.action === 'enqueue') {
      const run = await articleInspectionService.enqueueImmediateInspection(payload.articleId, 'admin_enqueue')
      if (!run) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, '文章不存在或未发布'),
          { status: 404 }
        )
      }

      return NextResponse.json(successResponse({ run }))
    }

    if (payload.action === 'daily') {
      const runs = await articleInspectionService.enqueueDailyIncrementalRun(payload.limit)
      return NextResponse.json(successResponse({
        enqueued: runs.length,
        runs,
      }))
    }

    const results = await articleInspectionService.processQueuedRuns(payload.limit)
    return NextResponse.json(successResponse({
      processed: results.length,
      results,
    }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to execute admin inspection action:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '执行巡检任务失败'),
      { status: 500 }
    )
  }
}
