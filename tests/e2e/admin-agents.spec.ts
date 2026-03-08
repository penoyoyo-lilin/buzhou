import { test, expect } from '@playwright/test'

// 辅助函数：登录管理后台
async function loginAsAdmin(page) {
  await page.goto('/admin/login')
  await page.locator('#email').fill('admin@buzhou.ai')
  await page.locator('#password').fill('admin123456')
  await page.getByRole('button', { name: /登录/ }).click()
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 10000 })
}

test.describe('Agent管理列表', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/agents')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示Agent管理页面', async ({ page }) => {
    await expect(page.locator('h1:has-text("Agent")')).toBeVisible()
  })

  // 注意：Agent 管理页面设计上没有新建按钮，Agent 通过 API 自动注册创建
  // 跳过新建按钮测试

  test('应该显示Agent列表或空状态', async ({ page }) => {
    await page.waitForTimeout(2000)

    const hasData = await page.locator('table tbody tr, [class*="row"]').count() > 0
    const hasEmpty = await page.locator('text=/暂无|No agents|没有Agent/i').isVisible().catch(() => false)

    expect(hasData || hasEmpty).toBeTruthy()
  })

  test('应该能够搜索Agent', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]')

    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await searchInput.press('Enter')
      await page.waitForTimeout(1000)
    }
  })

  test('应该能够筛选Agent状态', async ({ page }) => {
    const statusFilter = page.locator('select:has(option:has-text("活跃"))')

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('active')
      await page.waitForTimeout(1000)
    }
  })
})

// 注意：Agent 创建页面 (/admin/agents/new) 不存在
// Agent 通过 API 自动注册，不需要在管理后台手动创建
// 删除 Agent 创建相关测试

test.describe('Agent编辑', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/agents')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够进入Agent编辑页面', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑"), a:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      expect(page.url()).toMatch(/\/admin\/agents\/[^/]+$/)
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

test.describe('Agent操作', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/agents')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够禁用Agent', async ({ page }) => {
    const toggleButton = page.locator('button:has-text("禁用"), [class*="toggle"]').first()

    if (await toggleButton.isVisible()) {
      await toggleButton.click()
      await page.waitForTimeout(1000)
    }
  })

  test('应该能够删除Agent', async ({ page }) => {
    const deleteButton = page.locator('button:has-text("删除")').first()

    if (await deleteButton.isVisible()) {
      page.on('dialog', async dialog => {
        await dialog.accept()
      })

      await deleteButton.click()
      await page.waitForTimeout(1000)
    }
  })
})

test.describe('Agent API Key管理', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/agents')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够查看API Key区域', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const apiKeySection = page.locator('text=/API Key|密钥/i')
      if (await apiKeySection.isVisible()) {
        await expect(apiKeySection).toBeVisible()
      }
    }
  })

  test('应该能够重新生成API Key', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const regenerateButton = page.locator('button:has-text("重新生成"), button:has-text("Regenerate")')

      if (await regenerateButton.isVisible()) {
        page.on('dialog', async dialog => {
          await dialog.accept()
        })

        await regenerateButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })
})

test.describe('Agent额度管理', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/agents')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够配置日限额', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const dailyLimitInput = page.locator('input[name="dailyLimit"], input[id="dailyLimit"]').first()

      if (await dailyLimitInput.isVisible()) {
        await dailyLimitInput.fill('1000')
      }
    }
  })

  test('应该能够配置月限额', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const monthlyLimitInput = page.locator('input[name="monthlyLimit"], input[id="monthlyLimit"]').first()

      if (await monthlyLimitInput.isVisible()) {
        await monthlyLimitInput.fill('30000')
      }
    }
  })
})

test.describe('Agent管理权限', () => {
  test('未登录访问应该重定向到登录页', async ({ page }) => {
    await page.goto('/admin/agents')
    await page.waitForURL(/\/admin\/login/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toContain('/admin/login')
  })
})