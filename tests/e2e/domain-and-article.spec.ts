import { expect, test } from '@playwright/test'

test.describe('Domain normalization and article detail view', () => {
  test('internal create should be visible on homepage search without extra filter', async ({ request }) => {
    const internalApiKey = process.env.INTERNAL_API_KEY
    test.skip(!internalApiKey, 'INTERNAL_API_KEY is not configured for E2E')

    const unique = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const slug = `e2e-internal-visible-${unique}`
    const keyword = `e2e internal visible ${unique}`
    let createdArticleId: string | undefined

    try {
      const createResponse = await request.post('/api/internal/v1/articles', {
        headers: {
          Authorization: `Bearer ${internalApiKey}`,
          'Content-Type': 'application/json',
        },
        data: {
          slug,
          title: { zh: `标题 ${keyword}`, en: `Title ${keyword}` },
          summary: { zh: `摘要 ${keyword}`, en: `Summary ${keyword}` },
          content: { zh: '# 内容', en: '# Content' },
          domain: 'foundation',
          createdBy: 'playwright-e2e',
          skipVerification: true,
        },
      })

      expect(createResponse.status()).toBe(200)
      const createPayload = await createResponse.json() as {
        success: boolean
        data?: {
          results?: Array<{
            success: boolean
            article?: { id: string; status: string }
          }>
        }
      }

      expect(createPayload.success).toBe(true)
      const result = createPayload.data?.results?.[0]
      expect(result?.success).toBe(true)
      createdArticleId = result?.article?.id
      expect(createdArticleId).toBeTruthy()
      expect(result?.article?.status).toBe('published')

      const searchResponse = await request.get(`/api/v1/search?q=${encodeURIComponent(keyword)}&pageSize=50`)
      expect(searchResponse.status()).toBe(200)
      const searchPayload = await searchResponse.json() as {
        success: boolean
        data?: { items?: Array<{ id: string }> }
      }

      expect(searchPayload.success).toBe(true)
      const found = searchPayload.data?.items?.some((item) => item.id === createdArticleId)
      expect(found).toBe(true)
    } finally {
      if (createdArticleId) {
        await request.delete(`/api/internal/v1/articles/${createdArticleId}`, {
          headers: { Authorization: `Bearer ${internalApiKey}` },
        })
      }
    }
  })

  test('homepage domain filter writes underscore-style domain query', async ({ page }) => {
    await page.goto('/zh')
    await expect(page.getByRole('heading', { name: '不周山' })).toBeVisible()

    const domainSelect = page.locator('main [role="combobox"]').first()
    await domainSelect.click()
    await page.locator('[role="option"]', { hasText: '工具：文件系统' }).click()

    await expect(page).toHaveURL(/domain=tools_filesystem/)
  })

  test('search API accepts underscore domain and rejects hyphen domain', async ({ request }) => {
    const okResponse = await request.get('/api/v1/search?domain=tools_filesystem&pageSize=1')
    expect(okResponse.status()).toBe(200)
    const okPayload = await okResponse.json() as { success: boolean }
    expect(okPayload.success).toBe(true)

    const badResponse = await request.get('/api/v1/search?domain=tools-filesystem&pageSize=1')
    expect(badResponse.status()).toBe(400)
    const badPayload = await badResponse.json() as { success: boolean }
    expect(badPayload.success).toBe(false)
  })

  test('article detail JSON tab renders API access fields', async ({ page, request }) => {
    const searchResponse = await request.get('/api/v1/search?pageSize=1')
    expect(searchResponse.status()).toBe(200)
    const searchPayload = await searchResponse.json() as {
      data?: {
        items?: Array<{ slug?: string }>
      }
    }

    const slug = searchPayload?.data?.items?.[0]?.slug
    test.skip(!slug, 'No published article available for detail page e2e check')

    await page.goto(`/zh/articles/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.getByRole('tab', { name: 'JSON 视图' }).click()
    const codeBlock = page.getByRole('tabpanel', { name: 'JSON 视图' }).locator('code').first()
    await expect(codeBlock).toContainText('"apiAccess"')
    await expect(codeBlock).toContainText('/api/v1/search?q=')
  })
})
