import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const articleFindUniqueMock = vi.fn()
const articleUpdateMock = vi.fn()

vi.mock('@/core/db/client', () => ({
  prisma: {
    article: {
      findUnique: articleFindUniqueMock,
      update: articleUpdateMock,
    },
  },
  default: {
    article: {
      findUnique: articleFindUniqueMock,
      update: articleUpdateMock,
    },
  },
}))

describe('Admin article update domain normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    articleFindUniqueMock.mockResolvedValue({
      id: 'art_test_1',
      domain: 'foundation',
    })
    articleUpdateMock.mockResolvedValue({
      id: 'art_test_1',
      domain: 'tools_filesystem',
    })
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
})
