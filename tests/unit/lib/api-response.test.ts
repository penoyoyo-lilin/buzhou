import { describe, it, expect } from 'vitest'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
  ErrorCodes,
} from '@/lib/api-response'

describe('api-response', () => {
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

    it('should allow custom meta fields', () => {
      const data = { id: '1' }
      const response = successResponse(data, { nextStep: 'GET /api/v1/search' })

      expect(response.meta.nextStep).toBe('GET /api/v1/search')
    })
  })

  describe('errorResponse', () => {
    it('should create an error response', () => {
      const response = errorResponse('NOT_FOUND', 'Resource not found')

      expect(response.success).toBe(false)
      expect(response.data).toBeNull()
      expect(response.error?.code).toBe('NOT_FOUND')
      expect(response.error?.message).toBe('Resource not found')
    })

    it('should include details if provided', () => {
      const details = { field: 'id', reason: 'invalid' }
      const response = errorResponse('VALIDATION_ERROR', 'Invalid input', details)

      expect(response.error?.details).toEqual(details)
    })
  })

  describe('validationErrorResponse', () => {
    it('should create a validation error response', () => {
      const errors = { name: ['Name is required'], email: ['Invalid email'] }
      const response = validationErrorResponse(errors)

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(response.error?.details?.errors).toEqual(errors)
    })
  })

  describe('unauthorizedResponse', () => {
    it('should create an unauthorized response', () => {
      const response = unauthorizedResponse()

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe(ErrorCodes.UNAUTHORIZED)
    })

    it('should accept custom message', () => {
      const response = unauthorizedResponse('Token expired')

      expect(response.error?.message).toBe('Token expired')
    })
  })

  describe('forbiddenResponse', () => {
    it('should create a forbidden response', () => {
      const response = forbiddenResponse()

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe(ErrorCodes.FORBIDDEN)
    })
  })

  describe('notFoundResponse', () => {
    it('should create a not found response', () => {
      const response = notFoundResponse('Article')

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe(ErrorCodes.NOT_FOUND)
      expect(response.error?.message).toBe('Article不存在')
    })
  })

  describe('internalErrorResponse', () => {
    it('should create an internal error response', () => {
      const response = internalErrorResponse()

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe(ErrorCodes.INTERNAL_ERROR)
    })
  })

  describe('ErrorCodes', () => {
    it('should have all required error codes', () => {
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN')
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
      expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED')
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
    })
  })
})