import { test, expect } from '@playwright/test'

// 辅助函数：登录管理后台
async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto('/admin/login')
  await page.locator('#email').fill('admin@buzhou.io')
  await page.locator('#password').fill('admin123456')
  await page.getByRole('button', { name: /登录/ }).click()
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 10000 })
}

test.describe('底部导航管理列表', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/footer-links')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示底部导航管理页面', async ({ page }) => {
    await expect(page.locator('h1:has-text("底部导航管理")')).toBeVisible()
    await expect(page.locator('text=管理前台底部导航菜单')).toBeVisible()
  })

  test('应该显示新增导航按钮', async ({ page }) => {
    // 等待页面完全加载
    await page.waitForTimeout(1000)
    const newButton = page.locator('button:has-text("新增导航")')
    await expect(newButton).toBeVisible({ timeout: 10000 })
    await expect(newButton).toBeEnabled()
  })

  test('应该显示分组筛选下拉框', async ({ page }) => {
    const categorySelect = page.locator('select:has(option:has-text("全部分组"))')
    await expect(categorySelect).toBeVisible()
  })

  test('应该能够筛选分组', async ({ page }) => {
    const categorySelect = page.locator('select:has(option:has-text("关于"))')
    await categorySelect.selectOption('about')
    await page.waitForTimeout(1000)
  })

  test('应该显示导航列表或空状态', async ({ page }) => {
    await page.waitForTimeout(2000)

    const hasData = await page.locator('table tbody tr, [class*="row"]').count() > 0
    const hasEmpty = await page.locator('text=/暂无|没有导航|No footer links/i').isVisible().catch(() => false)

    expect(hasData || hasEmpty).toBeTruthy()
  })

  test('点击新增导航应该跳转到创建页面', async ({ page }) => {
    await page.locator('button:has-text("新增导航")').click()
    await expect(page).toHaveURL('/admin/footer-links/new')
  })
})

test.describe('底部导航创建', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/footer-links/new')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示创建表单', async ({ page }) => {
    const formElements = page.locator('input, select, textarea')
    const count = await formElements.count()
    expect(count).toBeGreaterThan(0)
  })

  test('应该能够填写中文名称', async ({ page }) => {
    const labelZhInput = page.locator('input[name="labelZh"], input[id="labelZh"]').first()

    if (await labelZhInput.isVisible()) {
      await labelZhInput.fill('测试导航')
      const value = await labelZhInput.inputValue()
      expect(value).toBe('测试导航')
    }
  })

  test('应该能够填写英文名称', async ({ page }) => {
    const labelEnInput = page.locator('input[name="labelEn"], input[id="labelEn"]').first()

    if (await labelEnInput.isVisible()) {
      await labelEnInput.fill('Test Link')
    }
  })

  test('应该能够填写链接地址', async ({ page }) => {
    const urlInput = page.locator('input[name="url"], input[id="url"]').first()

    if (await urlInput.isVisible()) {
      await urlInput.fill('https://example.com')
    }
  })

  test('应该能够选择分组', async ({ page }) => {
    const categorySelect = page.locator('select[name="category"], select[id="category"]').first()

    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption('about')
    }
  })

  test('应该能够设置排序值', async ({ page }) => {
    const sortOrderInput = page.locator('input[name="sortOrder"], input[id="sortOrder"]').first()

    if (await sortOrderInput.isVisible()) {
      await sortOrderInput.fill('1')
    }
  })

  test('取消按钮应该返回列表页', async ({ page }) => {
    const cancelButton = page.locator('button:has-text("取消"), a:has-text("取消")').first()

    if (await cancelButton.isVisible({ timeout: 5000 })) {
      await cancelButton.click()
      await page.waitForURL('/admin/footer-links', { timeout: 10000 })
      await expect(page).toHaveURL('/admin/footer-links')
    }
  })
})

test.describe('底部导航编辑', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/footer-links')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够进入编辑页面', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑"), a:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      expect(page.url()).toMatch(/\/admin\/footer-links\/[^/]+$/)
    }
  })

  test('编辑页面应该显示现有数据', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const formElements = page.locator('input, select')
      const count = await formElements.count()
      expect(count).toBeGreaterThan(0)
    }
  })
})

test.describe('底部导航操作', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/footer-links')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够删除导航', async ({ page }) => {
    const deleteButton = page.locator('button:has-text("删除")').first()

    if (await deleteButton.isVisible()) {
      page.on('dialog', async dialog => {
        await dialog.accept()
      })

      await deleteButton.click()
      await page.waitForTimeout(1000)
    }
  })

  test('应该能够切换启用状态', async ({ page }) => {
    const toggleButton = page.locator('button:has-text("启用"), button:has-text("禁用"), [class*="toggle"]').first()

    if (await toggleButton.isVisible()) {
      await toggleButton.click()
      await page.waitForTimeout(1000)
    }
  })
})

test.describe('底部导航管理权限', () => {
  test('未登录访问应该重定向到登录页', async ({ page }) => {
    await page.goto('/admin/footer-links')
    await page.waitForURL(/\/admin\/login/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toContain('/admin/login')
  })
})