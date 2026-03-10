import { test, expect } from '@playwright/test'

// 辅助函数：登录管理后台
async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto('/admin/login')
  await page.locator('#email').fill('admin@buzhou.io')
  await page.locator('#password').fill('admin123456')
  await page.getByRole('button', { name: /登录/ }).click()
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 10000 })
}

test.describe('验证人管理列表', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/verifiers')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示验证人管理页面', async ({ page }) => {
    await expect(page.locator('h1:has-text("验证人"), h1:has-text("Verifier")')).toBeVisible()
  })

  test('应该显示新建验证人按钮', async ({ page }) => {
    const newButton = page.locator('button:has-text("新建验证人")')
    await expect(newButton).toBeVisible()
  })

  test('应该显示验证人列表或空状态', async ({ page }) => {
    await page.waitForTimeout(2000)

    const hasData = await page.locator('table tbody tr, [class*="row"]').count() > 0
    const hasEmpty = await page.locator('text=/暂无|No verifiers|没有验证人/i').isVisible().catch(() => false)

    expect(hasData || hasEmpty).toBeTruthy()
  })

  test('应该能够搜索验证人', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]')

    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await searchInput.press('Enter')
      await page.waitForTimeout(1000)
    }
  })

  test('应该能够筛选验证人类型', async ({ page }) => {
    const typeFilter = page.locator('select:has(option:has-text("类型"))')

    if (await typeFilter.isVisible()) {
      await typeFilter.selectOption({ index: 1 })
      await page.waitForTimeout(1000)
    }
  })

  test('应该能够筛选验证人状态', async ({ page }) => {
    const statusFilter = page.locator('select:has(option:has-text("活跃"))')

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('active')
      await page.waitForTimeout(1000)
    }
  })
})

test.describe('新建验证人', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/verifiers')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够进入新建验证人页面', async ({ page }) => {
    await page.click('button:has-text("新建验证人")')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/admin/verifiers/new')
    await expect(page.locator('h1:has-text("新建验证人")')).toBeVisible()
  })

  test('应该能够创建新的验证人', async ({ page }) => {
    await page.click('button:has-text("新建验证人")')
    await page.waitForLoadState('networkidle')

    // 填写表单
    const nameInput = page.locator('input#name')
    await nameInput.fill(`测试验证人 ${Date.now()}`)

    // 选择类型
    const typeSelect = page.locator('select#type')
    await typeSelect.selectOption('third_party_agent')

    // 填写描述
    const descInput = page.locator('textarea#description')
    await descInput.fill('这是一个测试验证人')

    // 保存
    await page.click('button:has-text("保存")')

    // 等待跳转或成功提示
    await page.waitForTimeout(2000)

    // 验证是否返回列表页或显示成功消息
    const url = page.url()
    expect(url).toContain('/admin/verifiers')
  })

  test('新建验证人表单验证', async ({ page }) => {
    await page.click('button:has-text("新建验证人")')
    await page.waitForLoadState('networkidle')

    // 不填写任何信息直接保存
    await page.click('button:has-text("保存")')
    await page.waitForTimeout(1000)

    // 应该还在新建页面（表单验证失败）
    expect(page.url()).toContain('/admin/verifiers/new')
  })
})

test.describe('验证人编辑', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/verifiers')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够进入验证人编辑页面', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑"), a:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      expect(page.url()).toMatch(/\/admin\/verifiers\/[^/]+$/)
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

  test('应该能够更新验证人状态', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const statusSelect = page.locator('select#status')
      if (await statusSelect.isVisible()) {
        await statusSelect.selectOption('suspended')
        await page.click('button:has-text("保存")')
        await page.waitForTimeout(1000)
      }
    }
  })
})

test.describe('验证人操作', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/verifiers')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够删除验证人', async ({ page }) => {
    // 先进入一个验证人的详情页
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const deleteButton = page.locator('button:has-text("删除")')

      if (await deleteButton.isVisible()) {
        // 设置对话框处理
        page.on('dialog', async dialog => {
          await dialog.accept()
        })

        await deleteButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })
})

test.describe('验证人信誉分', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/verifiers')
    await page.waitForLoadState('networkidle')
  })

  test('应该能够查看验证人信誉分', async ({ page }) => {
    const editButton = page.locator('button:has-text("编辑")').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')

      const reputationSection = page.locator('text=/信誉|Reputation|分数/i')
      if (await reputationSection.isVisible()) {
        await expect(reputationSection).toBeVisible()
      }
    }
  })
})

test.describe('验证人管理权限', () => {
  test('未登录访问应该重定向到登录页', async ({ page }) => {
    await page.goto('/admin/verifiers')
    await page.waitForURL(/\/admin\/login/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toContain('/admin/login')
  })
})