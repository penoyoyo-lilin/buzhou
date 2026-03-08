/**
 * 内部 API Key 管理
 * GET: 获取当前 Key 信息
 * POST: 重新生成 Key
 *
 * 注意：API Key 存储在数据库中，支持 Serverless 环境
 */

import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/core/db/client'

const CONFIG_KEY = 'internal_api_key'

// 生成新的 API Key
function generateApiKey(): string {
  return `buzhou_internal_${randomBytes(24).toString('hex')}`
}

// 哈希 API Key（用于安全存储）
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

// 获取 Key 前缀（用于识别）
function getKeyPrefix(key: string): string {
  return key.substring(0, 12) + '...' + key.substring(key.length - 4)
}

// 从数据库获取 API Key
async function getStoredApiKey(): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: CONFIG_KEY }
  })
  return config?.value || null
}

// 保存 API Key 到数据库
async function saveApiKey(key: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: key },
    create: { key: CONFIG_KEY, value: key }
  })
}

export async function GET() {
  try {
    // 优先从数据库获取
    let currentKey = await getStoredApiKey()

    // 如果数据库没有，从环境变量获取并同步到数据库
    if (!currentKey) {
      currentKey = process.env.INTERNAL_API_KEY || null
      if (currentKey) {
        await saveApiKey(currentKey)
      }
    }

    if (!currentKey) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '未配置内部 API Key'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      successResponse({
        prefix: getKeyPrefix(currentKey),
        length: currentKey.length,
        createdAt: null,
        lastUsedAt: null,
      })
    )
  } catch (error) {
    console.error('Failed to get API key info:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取 API Key 信息失败'),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 生成新的 API Key
    const newKey = generateApiKey()

    // 保存到数据库
    await saveApiKey(newKey)

    // 返回新 Key（仅此一次显示完整 Key）
    return NextResponse.json(
      successResponse({
        key: newKey,
        prefix: getKeyPrefix(newKey),
        message: 'API Key 已重新生成，请立即保存。此密钥仅显示一次。',
        warning: '使用旧 Key 的服务将立即失效，请及时更新。',
      })
    )
  } catch (error) {
    console.error('Failed to regenerate API key:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '重新生成 API Key 失败'),
      { status: 500 }
    )
  }
}