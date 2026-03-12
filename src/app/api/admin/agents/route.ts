export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { agentQuerySchema } from '@/lib/validators'

/**
 * GET /api/admin/agents
 * 获取 Agent 列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const result = agentQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
    })

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const { search, status, page, pageSize } = result.data

    // 构建查询条件
    const where: Record<string, unknown> = {}

    if (search) {
      // SQLite 不支持 mode: 'insensitive'，使用默认的大小写敏感搜索
      where.OR = [
        { id: { contains: search } },
        { name: { contains: search } },
        { owner: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    // 查询总数
    const total = await prisma.agentApp.count({ where })

    // 查询列表
    const agents = await prisma.agentApp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return NextResponse.json(
      successResponse({
        items: agents.map((agent) => ({
          ...agent,
          quotaUsage: {
            daily: agent.usedToday / agent.dailyLimit,
            monthly: agent.usedThisMonth / agent.monthlyLimit,
          },
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    )
  } catch (error) {
    console.error('Get agents error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取 Agent 列表失败'),
      { status: 500 }
    )
  }
}