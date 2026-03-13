import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { errorResponse, ErrorCodes, successResponse } from '@/lib/api-response'
import { articleInspectionService } from '@/services/article-inspection.service'

const querySchema = z.object({
  processLimit: z.coerce.number().int().min(1).max(100).default(20),
})

function verifyCronAuth(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET?.trim()
  if (!expectedSecret) {
    return false
  }

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${expectedSecret}`
}

export async function GET(request: NextRequest) {
  const authorized = verifyCronAuth(request) || await verifyInternalAuth(request)
  if (!authorized) {
    return Response.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '无效的巡检调度凭证'),
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = querySchema.parse(Object.fromEntries(searchParams))
    const results = await articleInspectionService.processQueuedRuns(params.processLimit)

    return Response.json(successResponse({
      processed: results.length,
      results,
    }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', { errors: error.errors }),
        { status: 400 }
      )
    }

    console.error('Failed to execute scheduled inspection processing:', error)
    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '执行巡检处理失败'),
      { status: 500 }
    )
  }
}
