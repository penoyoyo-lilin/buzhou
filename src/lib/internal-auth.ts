import { NextRequest } from 'next/server'
import { unauthorizedResponse } from './api-response'

/**
 * 内部 API 认证中间件
 * 用于验证服务间调用的密钥
 */
export function verifyInternalAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  const expectedKey = process.env.INTERNAL_API_KEY

  // 如果没有配置密钥，拒绝访问
  if (!expectedKey) {
    console.error('INTERNAL_API_KEY is not configured')
    return false
  }

  // 检查 Authorization header
  if (!authHeader) {
    return false
  }

  // 验证 Bearer token
  const [bearer, token] = authHeader.split(' ')
  if (bearer !== 'Bearer' || !token) {
    return false
  }

  // 使用常量时间比较防止时序攻击
  return timingSafeEqual(token, expectedKey)
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
    if (!verifyInternalAuth(request)) {
      return Response.json(unauthorizedResponse('无效的内部 API 密钥'), {
        status: 401,
      })
    }
    return handler(request, context)
  }
}
