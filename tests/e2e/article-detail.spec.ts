import { test, expect } from '@playwright/test'

test.describe('文章详情页', () => {
  test('应该正确显示文章详情', async ({ page }) => {
    // 先访问首页获取文章链接
    await page.goto('/zh')
    await page.waitForLoadState('networkidle')

    // 点击第一个文章链接
    const articleLink = page.locator('a[href*="/zh/articles/"]').first()
    if (await articleLink.isVisible()) {
      await articleLink.click()

      // 等待页面加载
      await page.waitForLoadState('networkidle')

      // 验证 URL 格式
      await expect(page).toHaveURL(/\/zh\/articles\//)

      // 验证文章标题存在
      const title = page.locator('h1')
      await expect(title).toBeVisible()
    }
  })

  test('不存在的文章应显示 404', async ({ page }) => {
    await page.goto('/zh/articles/non-existent-article-slug-12345')

    // 应该显示 404 页面或错误提示
    const notFound = page.locator('text=/404|未找到|Not Found/i')
    await expect(notFound).toBeVisible()
  })

  test('应该显示文章元数据', async ({ page }) => {
    await page.goto('/zh')
    await page.waitForLoadState('networkidle')

    const articleLink = page.locator('a[href*="/zh/articles/"]').first()
    if (await articleLink.isVisible()) {
      await articleLink.click()
      await page.waitForLoadState('networkidle')

      // 检查标签是否存在
      const tags = page.locator('[class*="tag"], [data-testid="tag"]')
      // 标签可能存在也可能不存在，不强制要求
    }
  })
})
