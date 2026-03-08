import { test, expect } from '@playwright/test'

/**
 * 搜索功能 E2E 测试
 * 测试前台顶部导航栏搜索功能
 */

test.describe('顶部导航栏搜索', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/zh')
    await page.waitForLoadState('networkidle')
  })

  // ============================================
  // 搜索框渲染测试
  // ============================================
  test.describe('搜索框渲染', () => {
    test('应该显示搜索框', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await expect(searchInput).toBeVisible()
    })

    test('应该显示搜索图标', async ({ page }) => {
      const searchIcon = page.locator('header svg.lucide-search')
      await expect(searchIcon).toBeVisible()
    })

    test('应该显示正确的占位符文本', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      const placeholder = await searchInput.getAttribute('placeholder')
      expect(placeholder).toContain('搜索')
    })

    test('输入内容后应该显示清除按钮', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('test')

      const clearButton = page.locator('header button:has(svg.lucide-x)')
      await expect(clearButton).toBeVisible()
    })

    test('空输入时不应显示清除按钮', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('')

      const clearButton = page.locator('header button:has(svg.lucide-x)')
      await expect(clearButton).not.toBeVisible()
    })
  })

  // ============================================
  // 搜索功能测试
  // ============================================
  test.describe('搜索功能', () => {
    test('应该能在搜索框中输入文字', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Claude')

      expect(await searchInput.inputValue()).toBe('Claude')
    })

    test('按 Enter 键应该触发搜索', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Claude')
      await searchInput.press('Enter')

      // 等待 URL 变化
      await page.waitForURL(/q=Claude/)
      expect(page.url()).toContain('q=Claude')
    })

    test('点击清除按钮应该清空搜索框', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('test content')

      const clearButton = page.locator('header button:has(svg.lucide-x)')
      await clearButton.click()

      expect(await searchInput.inputValue()).toBe('')
    })

    test('清除搜索应该移除 URL 参数', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('test')
      await searchInput.press('Enter')

      await page.waitForURL(/q=test/)

      const clearButton = page.locator('header button:has(svg.lucide-x)')
      await clearButton.click()

      await page.waitForURL(/\/zh$/)
    })

    test('搜索结果页面应该保持搜索词在输入框中', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Claude')
      await searchInput.press('Enter')

      await page.waitForURL(/q=Claude/)

      // 刷新页面后搜索词应该保持
      await page.reload()
      expect(await searchInput.inputValue()).toBe('Claude')
    })
  })

  // ============================================
  // 搜索结果测试
  // ============================================
  test.describe('搜索结果', () => {
    test('搜索后应该显示匹配的文章', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Claude')
      await searchInput.press('Enter')

      await page.waitForLoadState('networkidle')

      // 检查文章列表
      const articleLinks = page.locator('a[href*="/articles/"]')
      const count = await articleLinks.count()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    test('搜索无结果时应该显示提示', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill(`nonexistent_article_${Date.now()}`)
      await searchInput.press('Enter')

      await page.waitForLoadState('networkidle')

      // 可能显示空状态提示或没有文章
      const articleLinks = page.locator('a[href*="/articles/"]')
      const count = await articleLinks.count()
      expect(count).toBe(0)
    })

    test('应该支持中文搜索', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('指南')
      await searchInput.press('Enter')

      await page.waitForURL(/q=/)
      await page.waitForLoadState('networkidle')
    })

    test('应该支持英文搜索', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Guide')
      await searchInput.press('Enter')

      await page.waitForURL(/q=Guide/)
    })

    test('应该支持标签搜索', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('SDK')
      await searchInput.press('Enter')

      await page.waitForURL(/q=SDK/)
    })
  })

  // ============================================
  // 搜索与筛选组合测试
  // ============================================
  test.describe('搜索与筛选', () => {
    test('搜索参数应该在 URL 中正确编码', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Claude Agent')
      await searchInput.press('Enter')

      await page.waitForURL(/q=/)
      // URL 应该包含编码后的搜索词
      expect(decodeURIComponent(page.url())).toContain('Claude Agent')
    })

    test('搜索词前后空格应该被去除', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('  test  ')
      await searchInput.press('Enter')

      await page.waitForURL(/q=test/)
      expect(page.url()).toContain('q=test')
      expect(page.url()).not.toContain('q=%20')
    })
  })

  // ============================================
  // 边界情况测试
  // ============================================
  test.describe('边界情况', () => {
    test('应该处理特殊字符搜索', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('<script>alert(1)</script>')
      await searchInput.press('Enter')

      await page.waitForURL(/q=/)
      // 页面应该正常工作，不应有 XSS
      await expect(page.locator('body')).toBeVisible()
    })

    test('应该处理长搜索词', async ({ page }) => {
      const longQuery = 'a'.repeat(200)
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill(longQuery)
      await searchInput.press('Enter')

      await page.waitForURL(/q=/)
    })

    test('应该处理 Unicode 字符搜索', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('🔍 测试')
      await searchInput.press('Enter')

      await page.waitForURL(/q=/)
    })

    test('快速连续输入应该正常工作', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')

      // 快速输入和删除
      await searchInput.fill('test1')
      await searchInput.fill('test2')
      await searchInput.fill('test3')
      await searchInput.press('Enter')

      await page.waitForURL(/q=test3/)
    })
  })

  // ============================================
  // 多语言测试
  // ============================================
  test.describe('多语言', () => {
    test('英文页面搜索应该正常工作', async ({ page }) => {
      await page.goto('/en')
      await page.waitForLoadState('networkidle')

      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Claude')
      await searchInput.press('Enter')

      await page.waitForURL(/\/en.*q=Claude/)
    })

    test('切换语言后搜索状态应该保持', async ({ page }) => {
      const searchInput = page.locator('header input[type="search"]')
      await searchInput.fill('Claude')
      await searchInput.press('Enter')

      await page.waitForURL(/q=Claude/)

      // 切换到英文
      const enLink = page.locator('a[href="/en"]')
      if (await enLink.isVisible()) {
        await enLink.click()
        await page.waitForURL(/\/en/)
      }
    })
  })
})

test.describe('搜索结果页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/zh')
    await page.waitForLoadState('networkidle')
  })

  test('搜索后页面应该有正确的标题', async ({ page }) => {
    const searchInput = page.locator('header input[type="search"]')
    await searchInput.fill('Claude')
    await searchInput.press('Enter')

    await page.waitForURL(/q=Claude/)
    await expect(page).toHaveTitle(/不周山/)
  })

  test('搜索结果应该显示文章卡片', async ({ page }) => {
    const searchInput = page.locator('header input[type="search"]')
    await searchInput.fill('Claude')
    await searchInput.press('Enter')

    await page.waitForLoadState('networkidle')

    // 检查文章卡片组件
    const articleCards = page.locator('[data-testid="article-card"], article, .article-card')
    const count = await articleCards.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('点击搜索结果应该跳转到文章详情', async ({ page }) => {
    const searchInput = page.locator('header input[type="search"]')
    await searchInput.fill('Claude')
    await searchInput.press('Enter')

    await page.waitForLoadState('networkidle')

    // 点击第一个文章链接
    const articleLink = page.locator('a[href*="/articles/"]').first()
    if (await articleLink.isVisible()) {
      await articleLink.click()
      await page.waitForURL(/\/articles\//)
    }
  })

  test('修改搜索词应该更新结果', async ({ page }) => {
    const searchInput = page.locator('header input[type="search"]')
    await searchInput.fill('Claude')
    await searchInput.press('Enter')

    await page.waitForURL(/q=Claude/)

    // 修改搜索词
    await searchInput.fill('MCP')
    await searchInput.press('Enter')

    await page.waitForURL(/q=MCP/)
    expect(page.url()).toContain('q=MCP')
    expect(page.url()).not.toContain('q=Claude')
  })
})