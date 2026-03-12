import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

describe('Admin create article domain options', () => {
  it('should reject agent domain for article creation', async () => {
    const { POST } = await import('@/app/api/admin/articles/route')

    const request = new NextRequest('http://localhost:3000/api/admin/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'admin-agent-domain-forbidden',
        title: { zh: '标题', en: 'Title' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent',
        author: 'admin-test',
      }),
    })

    const response = await POST(request)
    const payload = await response.json() as { success: boolean; error?: { code?: string } }

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe('INVALID_INPUT')
  })
})
