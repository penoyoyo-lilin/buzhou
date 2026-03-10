import { test, expect } from '@playwright/test'

test.describe('Article Detail Format Parameter', () => {
  // 先获取一个有效的文章 slug
  let articleSlug: string

  test.beforeAll(async ({ request }) => {
    const response = await request.get('/api/v1/search?pageSize=1')
    const data = await response.json()
    if (data.success && data.data.items.length > 0) {
      articleSlug = data.data.items[0].slug
    }
  })

  test('should return HTML page by default', async ({ page }) => {
    if (!articleSlug) {
      test.skip()
      return
    }

    await page.goto(`/zh/articles/${articleSlug}`)

    // 验证是 HTML 页面（有文章标题）
    await expect(page.locator('h1')).toBeVisible()

    // 验证有视图切换 Tab
    await expect(page.locator('button:has-text("HTML")')).toBeVisible()
    await expect(page.locator('button:has-text("Markdown")')).toBeVisible()
    await expect(page.locator('button:has-text("JSON")')).toBeVisible()
  })

  test('should return Markdown content with ?format=markdown', async ({ request }) => {
    if (!articleSlug) {
      test.skip()
      return
    }

    // 使用 API 路由获取 markdown 格式
    const response = await request.get(`/api/v1/articles/${articleSlug}?format=markdown`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/markdown')

    const content = await response.text()
    expect(content).toContain('# ') // Markdown 标题
    expect(content).toContain('## Content')
    expect(content).toContain('## Metadata')
  })

  test('should return JSON content with ?format=json', async ({ request }) => {
    if (!articleSlug) {
      test.skip()
      return
    }

    // 使用 API 路由获取 JSON 格式
    const response = await request.get(`/api/v1/articles/${articleSlug}?format=json`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')

    const data = await response.json()
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('slug')
    expect(data).toHaveProperty('title')
    expect(data).toHaveProperty('content')
    expect(data).toHaveProperty('domain')
  })

  test('should include X-Article-Id header in markdown response', async ({ request }) => {
    if (!articleSlug) {
      test.skip()
      return
    }

    const response = await request.get(`/api/v1/articles/${articleSlug}?format=markdown`)

    expect(response.headers()['x-article-id']).toBeDefined()
    expect(response.headers()['x-article-slug']).toBe(articleSlug)
  })

  test('should include X-Article-Id header in json response', async ({ request }) => {
    if (!articleSlug) {
      test.skip()
      return
    }

    const response = await request.get(`/api/v1/articles/${articleSlug}?format=json`)

    expect(response.headers()['x-article-id']).toBeDefined()
    expect(response.headers()['x-article-slug']).toBe(articleSlug)
  })

  test('should return 404 for non-existent article', async ({ request }) => {
    // API 路由应该返回 404
    const response = await request.get('/api/v1/articles/non-existent-slug-12345')
    expect(response.status()).toBe(404)
  })

  test('should return 404 for non-existent article with format parameter', async ({ request }) => {
    // API 路由应该返回 404
    const response = await request.get('/api/v1/articles/non-existent-slug-12345?format=markdown')
    expect(response.status()).toBe(404)
  })
})

test.describe('Article Domain Values', () => {
  test('should accept all valid domain values in search', async ({ request }) => {
    const validDomains = [
      'agent', 'mcp', 'skill',
      'foundation', 'transport',
      'tools_filesystem', 'tools_postgres', 'tools_github',
      'error_codes', 'scenarios'
    ]

    for (const domain of validDomains) {
      const response = await request.get(`/api/v1/search?domain=${domain}`)
      expect(response.status()).toBe(200)
    }
  })

  test('should reject invalid domain value in search', async ({ request }) => {
    const response = await request.get('/api/v1/search?domain=invalid_domain')

    expect(response.status()).toBe(400)
  })

  test('should reject hyphenated domain values (use underscore)', async ({ request }) => {
    // tools-filesystem 应该被拒绝，正确的值是 tools_filesystem
    const response = await request.get('/api/v1/search?domain=tools-filesystem')

    expect(response.status()).toBe(400)
  })
})

test.describe('Search API Validation Status', () => {
  test('should accept all valid verification status values', async ({ request }) => {
    const validStatuses = ['verified', 'partial', 'pending', 'failed', 'deprecated']

    for (const status of validStatuses) {
      const response = await request.get(`/api/v1/search?status=${status}`)
      expect(response.status()).toBe(200)
    }
  })

  test('should reject invalid verification status', async ({ request }) => {
    const response = await request.get('/api/v1/search?status=invalid_status')

    expect(response.status()).toBe(400)
  })
})

test.describe('llms.txt Accessibility', () => {
  test('should return llms.txt at root', async ({ request }) => {
    const response = await request.get('/llms.txt')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text')

    const content = await response.text()
    expect(content).toContain('buzhou.io')
    expect(content).toContain('API')
    expect(content).toContain('search')
  })

  test('should document all domain values correctly', async ({ request }) => {
    const response = await request.get('/llms.txt')
    const content = await response.text()

    // 检查文档中使用下划线格式的 domain
    expect(content).toContain('tools_filesystem')
    expect(content).toContain('tools_postgres')
    expect(content).toContain('tools_github')
    expect(content).toContain('error_codes')
  })
})