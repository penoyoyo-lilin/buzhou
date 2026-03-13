import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const articleFindUniqueMock = vi.fn()
const articleUpdateMock = vi.fn()
const queryRawUnsafeMock = vi.fn()
const executeRawUnsafeMock = vi.fn()
const originalDatabaseUrl = process.env.DATABASE_URL

vi.mock('@/core/db/client', () => ({
  prisma: {
    article: {
      findUnique: articleFindUniqueMock,
      update: articleUpdateMock,
    },
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
  },
  default: {
    article: {
      findUnique: articleFindUniqueMock,
      update: articleUpdateMock,
    },
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
  },
}))

describe('Admin article update domain normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = originalDatabaseUrl
    articleFindUniqueMock.mockResolvedValue({
      id: 'art_test_1',
      domain: 'foundation',
    })
    articleUpdateMock.mockResolvedValue({
      id: 'art_test_1',
      domain: 'tools_filesystem',
    })
    queryRawUnsafeMock.mockResolvedValue([])
    executeRawUnsafeMock.mockResolvedValue(1)
  })

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('should normalize legacy hyphen domain to underscore on update', async () => {
    const { PUT } = await import('@/app/api/admin/articles/[id]/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: 'tools-filesystem',
      }),
    })

    const response = await PUT(request, { params: { id: 'art_test_1' } })
    const payload = await response.json() as { success: boolean }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(articleUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'art_test_1' },
        data: expect.objectContaining({
          domain: 'tools_filesystem',
        }),
      })
    )
  })

  it('should return 400 when domain is invalid', async () => {
    const { PUT } = await import('@/app/api/admin/articles/[id]/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: 'invalid_domain',
      }),
    })

    const response = await PUT(request, { params: { id: 'art_test_1' } })
    const payload = await response.json() as { success: boolean; error?: { code?: string } }

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe('INVALID_INPUT')
    expect(articleUpdateMock).not.toHaveBeenCalled()
  })

  it('should fallback to legacy enum value when postgres enum drifts', async () => {
    process.env.DATABASE_URL = 'postgresql://pool.example.com:6543/postgres?pgbouncer=true'
    articleFindUniqueMock
      .mockResolvedValueOnce({
        id: 'art_test_1',
        domain: 'foundation',
      })
      .mockResolvedValueOnce({
        id: 'art_test_1',
        domain: 'error-codes',
      })

    articleUpdateMock.mockRejectedValueOnce(
      Object.assign(
        new Error('invalid input value for enum "ArticleDomain": "error_codes"'),
        { code: 'P2000' }
      )
    )

    queryRawUnsafeMock.mockResolvedValueOnce([
      { enumlabel: 'agent' },
      { enumlabel: 'mcp' },
      { enumlabel: 'skill' },
      { enumlabel: 'foundation' },
      { enumlabel: 'transport' },
      { enumlabel: 'tools-filesystem' },
      { enumlabel: 'tools-postgres' },
      { enumlabel: 'tools-github' },
      { enumlabel: 'error-codes' },
      { enumlabel: 'scenarios' },
    ])

    const { PUT } = await import('@/app/api/admin/articles/[id]/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles/art_test_1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: 'error_codes',
      }),
    })

    const response = await PUT(request, { params: { id: 'art_test_1' } })
    const payload = await response.json() as { success: boolean; data?: { domain?: string } }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.domain).toBe('error_codes')
    expect(executeRawUnsafeMock).toHaveBeenCalledWith(
      expect.stringContaining(`'error-codes'::"ArticleDomain"`),
      'art_test_1'
    )
  })
})
