import { expect, test } from '@playwright/test'

test.describe('GEO signals', () => {
  test('article page should expose canonical, hreflang and alternate format links', async ({ page, request }) => {
    const searchResponse = await request.get('/api/v1/search?pageSize=1')
    expect(searchResponse.status()).toBe(200)

    const searchPayload = await searchResponse.json() as {
      success: boolean
      data?: { items?: Array<{ slug?: string }> }
    }
    expect(searchPayload.success).toBe(true)

    const slug = searchPayload.data?.items?.[0]?.slug
    test.skip(!slug, 'No published article found for GEO e2e check')

    await page.goto(`/zh/articles/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')

    const canonical = page.locator('head link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', new RegExp(`https://www\\.buzhou\\.io/zh/articles/${slug}`))

    const zhAlt = page.locator('head link[rel="alternate"][hreflang="zh-CN"]')
    const enAlt = page.locator('head link[rel="alternate"][hreflang="en-US"]')
    await expect(zhAlt).toHaveAttribute('href', new RegExp(`/zh/articles/${slug}$`))
    await expect(enAlt).toHaveAttribute('href', new RegExp(`/en/articles/${slug}$`))

    const jsonAlt = page.locator('head link[rel="alternate"][type="application/json"]')
    const markdownAlt = page.locator('head link[rel="alternate"][type="text/markdown"]')
    await expect(jsonAlt).toHaveAttribute('href', new RegExp(`/api/v1/articles/${slug}\\?format=json&lang=zh$`))
    await expect(markdownAlt).toHaveAttribute('href', new RegExp(`/api/v1/articles/${slug}\\?format=markdown&lang=zh$`))

    await page.goto(`/en/articles/${slug}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  })

  test('admin pages should carry noindex signals', async ({ page, request }) => {
    const response = await request.get('/admin/login')
    expect(response.status()).toBe(200)
    expect(response.headers()['x-robots-tag']).toContain('noindex')

    await page.goto('/admin/login')
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('home pages should expose correct html lang for zh and en', async ({ page }) => {
    await page.goto('/zh')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')

    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  })
})
