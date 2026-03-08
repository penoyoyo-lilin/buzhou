import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'

/**
 * POST /api/admin/agents/[id]/api-key
 * 生成新的 API Key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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

    // 生成新的 API Key
    const key = `sk_${nanoid(32)}`
    const keyHash = await bcrypt.hash(key, 10)
    const prefix = key.substring(0, 8)

    // 更新 Agent
    await prisma.agentApp.update({
      where: { id },
      data: {
        apiKeyHash: keyHash,
        apiKeyPrefix: prefix,
        apiKeyCreatedAt: new Date(),
      },
    })

    // 返回完整的 Key（仅此一次）
    return NextResponse.json(
      successResponse({
        key,
        prefix,
        createdAt: new Date().toISOString(),
        warning: '请妥善保管此 Key，系统不会再次显示完整 Key',
      })
    )
  } catch (error) {
    console.error('Generate API key error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '生成 API Key 失败'),
      { status: 500 }
    )
  }
}