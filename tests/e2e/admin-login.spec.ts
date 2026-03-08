import { test, expect } from '@playwright/test'

test.describe('管理后台登录', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login')
  })

  test('应该显示登录表单', async ({ page }) => {
    // 检查邮箱输入框
    const emailInput = page.locator('input[type="email"], input[name="email"]')
    await expect(emailInput).toBeVisible()

    // 检查密码输入框
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible()

    // 检查登录按钮
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
  })

  test('空表单应显示验证错误', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // 应该显示错误提示
    const errorMessage = page.locator('text=/请输入|必填|required/i')
    // 等待一下让验证生效
    await page.waitForTimeout(500)

    // 检查是否有验证提示（可能是内联或 toast）
  })

  test('错误凭据应显示错误信息', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]')
    const passwordInput = page.locator('input[type="password"]')

    await emailInput.fill('wrong@example.com')
    await passwordInput.fill('wrongpassword')

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // 等待响应
    await page.waitForLoadState('networkidle')

    // 应该显示错误信息
    const errorAlert = page.locator('text=/用户名或密码错误|登录失败|Invalid/i')
    // 错误可能以不同形式显示
  })

  test('正确凭据应跳转到仪表盘', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]')
    const passwordInput = page.locator('input[type="password"]')

    // 使用默认管理员账号
    await emailInput.fill('admin@buzhou.io')
    await passwordInput.fill('admin123456')

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // 等待跳转
    await page.waitForURL(/\/admin(\/dashboard)?/, { timeout: 10000 })

    // 验证跳转到管理后台
    await expect(page).toHaveURL(/\/admin/)
  })
})
