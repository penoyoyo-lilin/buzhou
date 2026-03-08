import { ApiResponse, ResponseMeta } from '@/types'
import { nanoid } from 'nanoid'

/**
 * 创建成功响应
 */
export function successResponse<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      requestId: nanoid(),
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }
}

/**
 * 创建错误响应
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId: nanoid(),
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * 常用错误码
 */
export const ErrorCodes = {
  // 认证相关
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // 验证相关
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // 资源相关
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // 操作相关
  OPERATION_FAILED: 'OPERATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',

  // 服务器错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const

/**
 * 创建验证错误响应
 */
export function validationErrorResponse(
  errors: Record<string, string[]>
): ApiResponse<null> {
  return errorResponse(
    ErrorCodes.VALIDATION_ERROR,
    '输入验证失败',
    { errors }
  )
}

/**
 * 创建未授权响应
 */
export function unauthorizedResponse(message: string = '未授权访问'): ApiResponse<null> {
  return errorResponse(ErrorCodes.UNAUTHORIZED, message)
}

/**
 * 创建禁止访问响应
 */
export function forbiddenResponse(message: string = '禁止访问'): ApiResponse<null> {
  return errorResponse(ErrorCodes.FORBIDDEN, message)
}

/**
 * 创建资源不存在响应
 */
export function notFoundResponse(resource: string = '资源'): ApiResponse<null> {
  return errorResponse(ErrorCodes.NOT_FOUND, `${resource}不存在`)
}

/**
 * 创建服务器错误响应
 */
export function internalErrorResponse(message: string = '服务器内部错误'): ApiResponse<null> {
  return errorResponse(ErrorCodes.INTERNAL_ERROR, message)
}