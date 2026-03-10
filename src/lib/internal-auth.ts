import { NextRequest } from 'next/server'
import { unauthorizedResponse } from './api-response'
import { prisma } from '@/core/db/client'

const CONFIG_KEY = 'internal_api_key'

/**
 * 内部 API 认证中间件
 * 用于验证服务间调用的密钥
 *
 * 密钥来源优先级：
 * 1. 数据库中存储的密钥（Admin 后台生成）
 * 2. 环境变量 INTERNAL_API_KEY（后备）
 */
export async function verifyInternalAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')

  // 如果没有 Authorization header，检查 x-internal-api-key header
  let token: string | null = null

  if (authHeader) {
    // 验证 Bearer token
    const [bearer, extractedToken] = authHeader.split(' ')
    if (bearer === 'Bearer' && extractedToken) {
      token = extractedToken
    }
  }

  // 也支持 x-internal-api-key header
  if (!token) {
    token = request.headers.get('x-internal-api-key')
  }

  if (!token) {
    return false
  }

  // 获取预期的密钥
  const expectedKey = await getExpectedKey()

  if (!expectedKey) {
    console.error('[InternalAuth] No API key configured in database or environment')
    return false
  }

  // 使用常量时间比较防止时序攻击
  return timingSafeEqual(token, expectedKey)
}

/**
 * 获取预期的 API 密钥
 * 优先从数据库获取，其次从环境变量获取
 */
async function getExpectedKey(): Promise<string | null> {
  try {
    // 优先从数据库获取
    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY }
    })

    if (config?.value) {
      return config.value
    }

    // 后备：从环境变量获取
    const envKey = process.env.INTERNAL_API_KEY
    if (envKey) {
      // 同步到数据库
      try {
        await prisma.systemConfig.upsert({
          where: { key: CONFIG_KEY },
          update: { value: envKey },
          create: { key: CONFIG_KEY, value: envKey }
        })
        console.log('[InternalAuth] Synced API key from environment to database')
      } catch (syncError) {
        console.warn('[InternalAuth] Failed to sync API key to database:', syncError)
      }
      return envKey
    }

    return null
  } catch (error) {
    console.error('[InternalAuth] Failed to get API key:', error)
    // 数据库访问失败时，尝试从环境变量获取
    return process.env.INTERNAL_API_KEY || null
  }
}

/**
 * 常量时间字符串比较
 * 防止时序攻击
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * 内部 API 认证包装器
 * 用于包装 API 路由处理器
 */
export function withInternalAuth<T>(
  handler: (request: NextRequest, context: T) => Promise<Response>
): (request: NextRequest, context: T) => Promise<Response> {
  return async (request: NextRequest, context: T) => {
    if (!await verifyInternalAuth(request)) {
      return Response.json(unauthorizedResponse('无效的内部 API 密钥'), {
        status: 401,
      })
    }
    return handler(request, context)
  }
}