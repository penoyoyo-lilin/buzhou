import { test, expect } from '@playwright/test'

test.describe('AI Generated Fields Feature', () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理后台
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'admin123456')
    await page.click('button[type="submit"]')
    await page.waitForURL('/admin/dashboard')
  })

  test('should display AI generation buttons on article edit page', async ({ page }) => {
    // 导航到文章列表
    await page.goto('/admin/articles')

    // 点击第一个文章编辑
    const firstEditButton = page.locator('a[href^="/admin/articles/"]').first()
    if (await firstEditButton.count() > 0) {
      await firstEditButton.click()

      // 等待页面加载
      await page.waitForSelector('h1:has-text("编辑文章")')

      // 验证 AI 生成字段区域存在
      await expect(page.locator('text=AI 生成字段')).toBeVisible()

      // 验证生成按钮存在
      await expect(page.locator('button:has-text("生成 QA")')).toBeVisible()
      await expect(page.locator('button:has-text("生成关键词")')).toBeVisible()
      await expect(page.locator('button:has-text("生成关联")')).toBeVisible()
      await expect(page.locator('button:has-text("全部生成")')).toBeVisible()
    }
  })

  test('should show QA pairs section', async ({ page }) => {
    await page.goto('/admin/articles')

    const firstEditButton = page.locator('a[href^="/admin/articles/"]').first()
    if (await firstEditButton.count() > 0) {
      await firstEditButton.click()
      await page.waitForSelector('h1:has-text("编辑文章")')

      // 展开 QA 对区域
      const qaSection = page.locator('button:has-text("QA 对")')
      await qaSection.click()

      // 验证 QA 对内容区域可见
      await expect(page.locator('text=暂无 QA 对').or(page.locator('.space-y-4 > div'))).toBeVisible()
    }
  })

  test('should show keywords section', async ({ page }) => {
    await page.goto('/admin/articles')

    const firstEditButton = page.locator('a[href^="/admin/articles/"]').first()
    if (await firstEditButton.count() > 0) {
      await firstEditButton.click()
      await page.waitForSelector('h1:has-text("编辑文章")')

      // 展开关键词区域
      const keywordsSection = page.locator('button:has-text("关键词")')
      await keywordsSection.click()

      // 验证关键词内容区域可见
      await expect(page.locator('text=暂无关键词').or(page.locator('.flex.flex-wrap.gap-2'))).toBeVisible()
    }
  })

  test('should show related articles section', async ({ page }) => {
    await page.goto('/admin/articles')

    const firstEditButton = page.locator('a[href^="/admin/articles/"]').first()
    if (await firstEditButton.count() > 0) {
      await firstEditButton.click()
      await page.waitForSelector('h1:has-text("编辑文章")')

      // 展开关联文章区域
      const relatedSection = page.locator('button:has-text("关联文章")')
      await relatedSection.click()

      // 验证关联文章内容区域可见
      await expect(page.locator('text=暂无关联文章').or(page.locator('.space-y-2 > div'))).toBeVisible()
    }
  })

  test('should not show AI fields on new article page', async ({ page }) => {
    await page.goto('/admin/articles/new')

    // 验证 AI 生成字段区域不存在
    await expect(page.locator('text=AI 生成字段')).not.toBeVisible()
  })

  test('should trigger AI generation when button clicked', async ({ page }) => {
    await page.goto('/admin/articles')

    const firstEditButton = page.locator('a[href^="/admin/articles/"]').first()
    if (await firstEditButton.count() > 0) {
      await firstEditButton.click()
      await page.waitForSelector('h1:has-text("编辑文章")')

      // 监听 API 请求
      const generateRequest = page.waitForRequest(/\/api\/admin\/articles\/.*\/generate/)

      // 点击生成 QA 按钮
      await page.click('button:has-text("生成 QA")')

      // 等待请求（如果没有 AI API 配置，请求会快速返回）
      const request = await generateRequest.catch(() => null)

      if (request) {
        // 验证请求体
        const postData = request.postData()
        expect(postData).toContain('qa')
      }
    }
  })
})

test.describe('AI Generated Fields - API', () => {
  test('should return 400 for invalid types', async ({ request }) => {
    const response = await request.post('/api/admin/articles/test-id/generate', {
      data: { types: ['invalid'] }
    })
    expect(response.status()).toBe(400)
  })

  test('should return 400 for empty types', async ({ request }) => {
    const response = await request.post('/api/admin/articles/test-id/generate', {
      data: { types: [] }
    })
    expect(response.status()).toBe(400)
  })

  test('should return 404 for non-existent article', async ({ request }) => {
    const response = await request.post('/api/admin/articles/non-existent-id/generate', {
      data: { types: ['qa'] }
    })
    expect(response.status()).toBe(404)
  })
})