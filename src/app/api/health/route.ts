/**
 * 健康检查 API
 * GET /api/health
 */

import { NextResponse } from 'next/server'
import prisma from '@/core/db/client'
import { getCacheStatus } from '@/core/cache'

export async function GET() {
  const startTime = Date.now()

  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`

    // 获取缓存状态
    const cacheStatus = getCacheStatus()

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: 'connected',
        cache: cacheStatus.type,
        cacheAvailable: cacheStatus.available,
      },
    })
  } catch (error) {
    const responseTime = Date.now() - startTime

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        services: {
          database: 'disconnected',
          cache: getCacheStatus().type,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}