/**
 * 内部 API Key 管理
 * GET: 获取当前 Key 信息
 * POST: 重新生成 Key
 */

import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { randomBytes, createHash } from 'crypto'
import fs from 'fs'
import path from 'path'

// .env 文件路径
const ENV_PATH = path.resolve(process.cwd(), '.env')

// 生成新的 API Key
function generateApiKey(): string {
  return `buzhou_internal_${randomBytes(24).toString('hex')}`
}

// 哈希 API Key
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

// 获取 Key 前缀（用于识别）
function getKeyPrefix(key: string): string {
  return key.substring(0, 12) + '...' + key.substring(key.length - 4)
}

// 更新 .env 文件中的 API Key
function updateEnvFile(newKey: string): void {
  let envContent = ''

  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8')
  }

  const keyLine = `INTERNAL_API_KEY="${newKey}"`

  if (envContent.includes('INTERNAL_API_KEY=')) {
    // 替换现有的 key
    envContent = envContent.replace(
      /INTERNAL_API_KEY=.*/,
      keyLine
    )
  } else {
    // 添加新的 key
    envContent += `\n${keyLine}\n`
  }

  fs.writeFileSync(ENV_PATH, envContent)
}

export async function GET() {
  try {
    const currentKey = process.env.INTERNAL_API_KEY

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
        createdAt: null, // 可扩展：存储创建时间
        lastUsedAt: null, // 可扩展：存储最后使用时间
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
    const body = await request.json()
    const { confirmation } = body

    // 安全确认：需要输入当前 Key 的前几位
    const currentKey = process.env.INTERNAL_API_KEY
    if (currentKey && confirmation !== currentKey.substring(0, 8)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '确认码不正确'),
        { status: 400 }
      )
    }

    // 生成新的 API Key
    const newKey = generateApiKey()

    // 更新 .env 文件
    updateEnvFile(newKey)

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