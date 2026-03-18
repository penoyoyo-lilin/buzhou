export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * 记录页面访问
 * POST /api/v1/pageview
 */

import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/core/db/client'
import { agentTrackingService } from '@/services/agent-tracking.service'

async function withTracking(
  request: NextRequest,
  startTime: number,
  response: NextResponse
): Promise<NextResponse> {
  await agentTrackingService.trackPublicApiCall({
    request,
    endpoint: '/api/v1/pageview',
    method: request.method,
    statusCode: response.status,
    responseTimeMs: Date.now() - startTime,
  })
  return response
}

async function parseOptionalJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  const rawBody = await request.text()
  if (!rawBody.trim()) {
    return null
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await parseOptionalJsonBody(request)
    if (!body) {
      const response = NextResponse.json(successResponse({ recorded: false }))
      return await withTracking(request, startTime, response)
    }

    const path = typeof body.path === 'string' ? body.path : ''
    const referrer = typeof body.referrer === 'string' ? body.referrer : null

    if (!path) {
      const response = NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '缺少路径参数'),
        { status: 400 }
      )
      return await withTracking(request, startTime, response)
    }

    // 获取客户端信息
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // 检测是否为机器人
    const botPatterns = /bot|crawler|spider|crawling|slurp|bingbot|googlebot/i
    const isBot = botPatterns.test(userAgent)

    // 记录访问
    await prisma.pageViewLog.create({
      data: {
        path,
        referrer: referrer || null,
        ipAddress: Array.isArray(ip) ? ip[0] : ip,
        userAgent,
        isBot,
      },
    })

    const response = NextResponse.json(successResponse({ recorded: true }))
    return await withTracking(request, startTime, response)
  } catch (error) {
    console.error('Pageview record error:', error)
    // 静默失败，不影响用户体验
    const response = NextResponse.json(successResponse({ recorded: false }))
    return await withTracking(request, startTime, response)
  }
}
