import { test, expect } from '@playwright/test'

// 辅助函数：登录管理后台
async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto('/admin/login')
  await page.locator('#email').fill('admin@buzhou.io')
  await page.locator('#password').fill('admin123456')
  await page.getByRole('button', { name: /登录/ }).click()
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 10000 })
}

// 管理后台测试 - 需要登录
test.describe('管理后台仪表盘', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)

    // 确保在仪表盘页面
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示仪表盘页面', async ({ page }) => {
    // 验证仪表盘标题
    await expect(page.locator('h1:has-text("仪表盘")')).toBeVisible()
    await expect(page.locator('text=欢迎使用不周山管理后台')).toBeVisible()
  })

  test('应该显示四个统计卡片', async ({ page }) => {
    // 检查统计卡片标题
    await expect(page.locator('text=文章总数')).toBeVisible()
    await expect(page.locator('text=待验证')).toBeVisible()
    await expect(page.locator('text=活跃 Agent')).toBeVisible()
    await expect(page.locator('text=今日 API 调用')).toBeVisible()
  })

  test('统计卡片应该显示数值', async ({ page }) => {
    // 验证统计卡片有数值显示
    const statValues = page.locator('[class*="text-2xl"][class*="font-bold"]')
    const count = await statValues.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('应该显示快捷操作卡片', async ({ page }) => {
    // 检查快捷操作标题
    await expect(page.locator('text=快捷操作')).toBeVisible()
    await expect(page.locator('text=最近需要处理的事项')).toBeVisible()
  })

  test('快捷操作应该显示待验证文章提示', async ({ page }) => {
    await expect(page.locator('text=待验证文章')).toBeVisible()
  })

  test('快捷操作应该显示今日新增文章提示', async ({ page }) => {
    await expect(page.locator('text=今日新增文章')).toBeVisible()
  })

  test('快捷操作应该显示API调用状态', async ({ page }) => {
    await expect(page.locator('text=API 调用正常')).toBeVisible()
  })

  test('应该显示最近文章列表', async ({ page }) => {
    // 检查最近文章标题
    await expect(page.locator('text=最近文章')).toBeVisible()
    await expect(page.locator('text=最新创建或更新的文章')).toBeVisible()
  })

  test('最近文章列表应该显示示例文章', async ({ page }) => {
    // 检查是否有示例文章
    const articleItems = page.locator('text=示例文章')
    const count = await articleItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('待验证文章链接应该正确跳转', async ({ page }) => {
    const link = page.locator('a[href="/admin/articles?verificationStatus=pending"]')
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/\/admin\/articles/)
      await expect(page).toHaveURL(/verificationStatus=pending/)
    }
  })

  test('应该能从仪表盘导航到文章管理', async ({ page }) => {
    await page.click('a[href="/admin/articles"]')
    await expect(page).toHaveURL('/admin/articles')
  })

  test('应该能从仪表盘导航到验证人管理', async ({ page }) => {
    await page.click('a[href="/admin/verifiers"]')
    await expect(page).toHaveURL('/admin/verifiers')
  })

  test('应该能从仪表盘导航到Agent管理', async ({ page }) => {
    await page.click('a[href="/admin/agents"]')
    await expect(page).toHaveURL('/admin/agents')
  })

  test('应该能从仪表盘导航到统计页面', async ({ page }) => {
    await page.click('a[href="/admin/stats"]')
    await expect(page).toHaveURL('/admin/stats')
  })

  test('应该能从仪表盘导航到底部导航管理', async ({ page }) => {
    await page.click('a[href="/admin/footer-links"]')
    await expect(page).toHaveURL('/admin/footer-links')
  })
})

test.describe('管理后台导航 - 侧边栏', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示侧边栏', async ({ page }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
  })

  test('侧边栏应该显示Logo', async ({ page }) => {
    await expect(page.locator('text=不周山')).toBeVisible()
  })

  test('侧边栏应该显示所有导航项', async ({ page }) => {
    await expect(page.locator('text=仪表盘')).toBeVisible()
    await expect(page.locator('text=文章管理')).toBeVisible()
    await expect(page.locator('text=验证人管理')).toBeVisible()
    await expect(page.locator('text=Agent 管理')).toBeVisible()
    await expect(page.locator('text=底部导航')).toBeVisible()
    await expect(page.locator('text=访问统计')).toBeVisible()
  })

  test('当前页面导航项应该高亮', async ({ page }) => {
    // 仪表盘应该是高亮状态
    const dashboardLink = page.locator('a[href="/admin/dashboard"]')
    await expect(dashboardLink).toHaveClass(/bg-primary/)
  })

  test('应该能够折叠侧边栏', async ({ page }) => {
    // 查找折叠按钮
    const toggleButton = page.locator('button:has([class*="ChevronLeft"]), button:has([class*="ChevronRight"])')

    if (await toggleButton.isVisible()) {
      // 点击折叠
      await toggleButton.click()
      await page.waitForTimeout(300)

      // 验证侧边栏已折叠（宽度变小）
      const sidebar = page.locator('aside')
      const width = await sidebar.evaluate(el => el.offsetWidth)
      expect(width).toBeLessThan(100) // 折叠后宽度应该小于100px
    }
  })

  test('应该能够退出登录', async ({ page }) => {
    // 点击登出按钮
    const logoutButton = page.locator('button:has-text("登出"), button:has-text("Logout")')

    if (await logoutButton.isVisible()) {
      await logoutButton.click()

      // 验证跳转到登录页
      await expect(page).toHaveURL(/\/admin\/login/)
    }
  })
})

test.describe('管理后台权限', () => {
  test('未登录访问仪表盘应该重定向到登录页', async ({ page }) => {
    await page.goto('/admin/dashboard')

    // 应该重定向到登录页
    await page.waitForURL(/\/admin\/login/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toContain('/admin/login')
  })

  test('未登录访问其他管理页面应该重定向到登录页', async ({ page }) => {
    const protectedPages = [
      '/admin/articles',
      '/admin/verifiers',
      '/admin/agents',
      '/admin/footer-links',
      '/admin/stats',
    ]

    for (const protectedPage of protectedPages) {
      await page.goto(protectedPage)
      await page.waitForURL(/\/admin\/login/, { timeout: 5000 }).catch(() => {})
      expect(page.url()).toContain('/admin/login')
    }
  })
})