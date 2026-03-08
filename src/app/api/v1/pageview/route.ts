/**
 * 记录页面访问
 * POST /api/v1/pageview
 */

import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/core/db/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, referrer } = body

    if (!path) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '缺少路径参数'),
        { status: 400 }
      )
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

    return NextResponse.json(successResponse({ recorded: true }))
  } catch (error) {
    console.error('Pageview record error:', error)
    // 静默失败，不影响用户体验
    return NextResponse.json(successResponse({ recorded: false }))
  }
}