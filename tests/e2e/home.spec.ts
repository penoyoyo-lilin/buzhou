import { test, expect } from '@playwright/test'

test.describe('首页', () => {
  test('应该正确加载首页', async ({ page }) => {
    await page.goto('/zh')

    // 验证页面标题（支持中英文）
    await expect(page).toHaveTitle(/不周山|Buzhou/)

    // 验证导航栏存在
    await expect(page.locator('nav')).toBeVisible()
  })

  test('应该显示文章列表', async ({ page }) => {
    await page.goto('/zh')

    // 等待页面加载
    await page.waitForLoadState('networkidle')

    // 检查是否有文章卡片或列表
    const articleLinks = page.locator('a[href*="/articles/"]')
    const count = await articleLinks.count()

    // 至少应该有一个文章链接
    expect(count).toBeGreaterThan(0)
  })

  test('应该支持语言切换', async ({ page }) => {
    await page.goto('/zh')

    // 点击英文切换
    const enLink = page.locator('a[href="/en"]')
    if (await enLink.isVisible()) {
      await enLink.click()
      await expect(page).toHaveURL(/\/en/)
    }
  })

  test('应该显示 API 文档链接', async ({ page }) => {
    await page.goto('/zh')

    const apiDocsLink = page.locator('a[href*="/api-docs"]').first()
    await expect(apiDocsLink).toBeVisible()
  })
})
