import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { updateAgentSchema } from '@/lib/validators'

/**
 * GET /api/admin/agents/[id]
 * 获取 Agent 详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const agent = await prisma.agentApp.findUnique({
      where: { id },
    })

    if (!agent) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Agent 不存在'),
        { status: 404 }
      )
    }

    return NextResponse.json(successResponse(agent))
  } catch (error) {
    console.error('Get agent error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取 Agent 详情失败'),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/agents/[id]
 * 更新 Agent
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const result = updateAgentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    // 检查 Agent 是否存在
    const existing = await prisma.agentApp.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Agent 不存在'),
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (result.data.name) updateData.name = result.data.name
    if (result.data.description) updateData.description = result.data.description
    if (result.data.status) updateData.status = result.data.status
    if (result.data.dailyLimit !== undefined) updateData.dailyLimit = result.data.dailyLimit
    if (result.data.monthlyLimit !== undefined) updateData.monthlyLimit = result.data.monthlyLimit

    const agent = await prisma.agentApp.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(successResponse(agent))
  } catch (error) {
    console.error('Update agent error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新 Agent 失败'),
      { status: 500 }
    )
  }
}