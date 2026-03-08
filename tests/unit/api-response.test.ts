import { describe, it, expect } from 'vitest'
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response'

describe('API Response Utils', () => {
  describe('successResponse', () => {
    it('should create a success response with data', () => {
      const data = { id: '1', name: 'Test' }
      const response = successResponse(data)

      expect(response.success).toBe(true)
      expect(response.data).toEqual(data)
      expect(response.error).toBeNull()
      expect(response.meta.requestId).toBeDefined()
      expect(response.meta.timestamp).toBeDefined()
    })

    it('should include custom meta fields', () => {
      const data = { id: '1' }
      const response = successResponse(data, { nextStep: 'Call /api/v1/next' })

      expect(response.meta.nextStep).toBe('Call /api/v1/next')
    })
  })

  describe('errorResponse', () => {
    it('should create an error response', () => {
      const response = errorResponse(ErrorCodes.UNAUTHORIZED, '未授权访问')

      expect(response.success).toBe(false)
      expect(response.data).toBeNull()
      expect(response.error?.code).toBe(ErrorCodes.UNAUTHORIZED)
      expect(response.error?.message).toBe('未授权访问')
    })

    it('should include error details', () => {
      const details = { field: 'email', reason: 'invalid format' }
      const response = errorResponse(ErrorCodes.VALIDATION_ERROR, '验证失败', details)

      expect(response.error?.details).toEqual(details)
    })
  })

  describe('ErrorCodes', () => {
    it('should have all required error codes', () => {
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN')
      expect(ErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS')
      expect(ErrorCodes.SESSION_EXPIRED).toBe('SESSION_EXPIRED')
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(ErrorCodes.INVALID_INPUT).toBe('INVALID_INPUT')
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
      expect(ErrorCodes.ALREADY_EXISTS).toBe('ALREADY_EXISTS')
      expect(ErrorCodes.OPERATION_FAILED).toBe('OPERATION_FAILED')
      expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED')
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
      expect(ErrorCodes.DATABASE_ERROR).toBe('DATABASE_ERROR')
    })
  })

  describe('helper functions', () => {
    it('validationErrorResponse should create validation error', () => {
      const errors = { email: ['邮箱格式不正确'] }
      const response = validationErrorResponse(errors)

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(response.error?.details?.errors).toEqual(errors)
    })

    it('unauthorizedResponse should create unauthorized error', () => {
      const response = unauthorizedResponse()
      expect(response.error?.code).toBe(ErrorCodes.UNAUTHORIZED)
    })

    it('forbiddenResponse should create forbidden error', () => {
      const response = forbiddenResponse('禁止访问')
      expect(response.error?.code).toBe(ErrorCodes.FORBIDDEN)
    })

    it('notFoundResponse should create not found error', () => {
      const response = notFoundResponse('文章')
      expect(response.error?.message).toBe('文章不存在')
    })

    it('internalErrorResponse should create internal error', () => {
      const response = internalErrorResponse()
      expect(response.error?.code).toBe(ErrorCodes.INTERNAL_ERROR)
    })
  })
})