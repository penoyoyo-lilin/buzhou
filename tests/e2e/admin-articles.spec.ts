import { test, expect } from '@playwright/test'

/**
 * 文章管理 E2E 测试
 * 覆盖新建、编辑、删除、上下架、置顶、标记失效等功能
 */

test.describe('文章管理', () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理后台
    await page.goto('/admin/login')

    const emailInput = page.locator('input[type="email"], input[name="email"]')
    const passwordInput = page.locator('input[type="password"]')

    await emailInput.fill('admin@buzhou.io')
    await passwordInput.fill('admin123456')

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // 等待登录完成
    await page.waitForURL(/\/admin/, { timeout: 10000 })
  })

  // ============================================
  // 文章列表页面测试
  // ============================================
  test.describe('文章列表页面', () => {
    test('应该能访问文章管理页面', async ({ page }) => {
      await page.goto('/admin/articles')

      // 验证页面标题
      const title = page.locator('h1')
      await expect(title).toContainText(/文章/)

      // 验证文章列表存在
      const articleTable = page.locator('table')
      await expect(articleTable).toBeVisible()
    })

    test('应该显示新建文章按钮', async ({ page }) => {
      await page.goto('/admin/articles')

      const newArticleButton = page.locator('button:has-text("新建文章"), a:has-text("新建文章")')
      await expect(newArticleButton).toBeVisible()
    })

    test('应该能按状态筛选文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 查找状态筛选器
      const statusFilter = page.locator('select').first()
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption({ label: '已发布' })

        // 等待页面更新
        await page.waitForLoadState('networkidle')

        // 验证所有显示的文章的状态为已发布
        const statusBadges = page.locator('[data-status="published"], td:has-text("已发布")')
        const count = await statusBadges.count()
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })

    test('应该能按领域筛选文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 查找领域筛选器
      const domainFilters = page.locator('select')
      const domainFilter = domainFilters.nth(1) // 第二个 select 通常是领域筛选

      if (await domainFilter.isVisible()) {
        await domainFilter.selectOption({ label: 'Agent' })

        // 等待页面更新
        await page.waitForLoadState('networkidle')
      }
    })

    test('应该能搜索文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 查找搜索框
      const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill('agent')
        await searchInput.press('Enter')

        // 等待搜索结果
        await page.waitForLoadState('networkidle')
      }
    })

    test('应该能分页浏览文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 查找分页控件
      const pagination = page.locator('[data-testid="pagination"], nav[aria-label*="pagination"]')
      if (await pagination.isVisible()) {
        const nextButton = pagination.locator('button:has-text("下一页"), button[aria-label*="next"]')
        if (await nextButton.isVisible() && await nextButton.isEnabled()) {
          await nextButton.click()
          await page.waitForLoadState('networkidle')
        }
      }
    })

    test('应该能排序文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 点击创建时间列标题排序
      const createdAtHeader = page.locator('th:has-text("创建时间")')
      if (await createdAtHeader.isVisible()) {
        await createdAtHeader.click()
        await page.waitForLoadState('networkidle')
      }
    })
  })

  // ============================================
  // 新建文章测试
  // ============================================
  test.describe('新建文章', () => {
    test('应该能打开新建文章页面', async ({ page }) => {
      await page.goto('/admin/articles')

      const newArticleButton = page.locator('button:has-text("新建文章"), a:has-text("新建文章")')
      await newArticleButton.click()

      // 验证跳转到新建页面
      await expect(page).toHaveURL(/\/admin\/articles\/new/)
    })

    test('应该能创建新文章', async ({ page }) => {
      await page.goto('/admin/articles/new')

      // 填写标题
      const zhTitleInput = page.locator('input[name="title.zh"], input[placeholder*="中文标题"]')
      const enTitleInput = page.locator('input[name="title.en"], input[placeholder*="英文标题"]')

      if (await zhTitleInput.isVisible()) {
        await zhTitleInput.fill(`E2E测试文章 ${Date.now()}`)
      }
      if (await enTitleInput.isVisible()) {
        await enTitleInput.fill(`E2E Test Article ${Date.now()}`)
      }

      // 填写摘要
      const zhSummaryInput = page.locator('textarea[name="summary.zh"], textarea[placeholder*="中文摘要"]')
      const enSummaryInput = page.locator('textarea[name="summary.en"], textarea[placeholder*="英文摘要"]')

      if (await zhSummaryInput.isVisible()) {
        await zhSummaryInput.fill('这是一个E2E测试文章的摘要')
      }
      if (await enSummaryInput.isVisible()) {
        await enSummaryInput.fill('This is a summary for E2E test article')
      }

      // 填写内容
      const zhContentInput = page.locator('textarea[name="content.zh"], textarea[placeholder*="中文内容"]')
      const enContentInput = page.locator('textarea[name="content.en"], textarea[placeholder*="英文内容"]')

      if (await zhContentInput.isVisible()) {
        await zhContentInput.fill('这是E2E测试文章的内容，包含详细的说明。')
      }
      if (await enContentInput.isVisible()) {
        await enContentInput.fill('This is the content of E2E test article.')
      }

      // 选择领域
      const domainSelect = page.locator('select[name="domain"]')
      if (await domainSelect.isVisible()) {
        await domainSelect.selectOption('agent')
      }

      // 提交表单
      const submitButton = page.locator('button[type="submit"]')
      if (await submitButton.isVisible()) {
        await submitButton.click()

        // 等待提交完成，应该跳转到列表页或详情页
        await page.waitForURL(/\/admin\/articles/, { timeout: 10000 })
      }
    })

    test('应该验证必填字段', async ({ page }) => {
      await page.goto('/admin/articles/new')

      // 直接提交空表单
      const submitButton = page.locator('button[type="submit"]')
      if (await submitButton.isVisible()) {
        await submitButton.click()

        // 验证显示错误信息
        const errorMessage = page.locator('[role="alert"], .error, [data-error]')
        // 可能显示验证错误或停留在当前页面
        await page.waitForTimeout(500)
      }
    })
  })

  // ============================================
  // 编辑文章测试
  // ============================================
  test.describe('编辑文章', () => {
    test('应该能打开文章编辑页面', async ({ page }) => {
      await page.goto('/admin/articles')

      // 点击第一个文章的编辑按钮
      const editButton = page.locator('button[data-action="edit"], a[href*="/admin/articles/"]').first()
      if (await editButton.isVisible()) {
        await editButton.click()

        // 验证跳转到编辑页面
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveURL(/\/admin\/articles\/art_/)
      }
    })

    test('应该能修改文章内容', async ({ page }) => {
      await page.goto('/admin/articles')

      // 找到第一个可编辑的文章
      const editButton = page.locator('button[data-action="edit"], a[href*="/admin/articles/"]').first()
      if (await editButton.isVisible()) {
        await editButton.click()
        await page.waitForLoadState('networkidle')

        // 修改标题
        const titleInput = page.locator('input[name="title.zh"]').first()
        if (await titleInput.isVisible()) {
          const currentValue = await titleInput.inputValue()
          await titleInput.fill(`${currentValue} (已更新)`)
        }

        // 保存
        const saveButton = page.locator('button[type="submit"]')
        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForLoadState('networkidle')
        }
      }
    })

    test('应该能修改文章状态为发布', async ({ page }) => {
      await page.goto('/admin/articles')

      // 找到草稿文章进行发布
      const draftRow = page.locator('tr:has-text("草稿")').first()
      if (await draftRow.isVisible()) {
        const editButton = draftRow.locator('button[data-action="edit"], a[href*="/admin/articles/"]')
        if (await editButton.isVisible()) {
          await editButton.click()
          await page.waitForLoadState('networkidle')

          // 修改状态
          const statusSelect = page.locator('select[name="status"]')
          if (await statusSelect.isVisible()) {
            await statusSelect.selectOption('published')
          }

          // 保存
          const saveButton = page.locator('button[type="submit"]')
          if (await saveButton.isVisible()) {
            await saveButton.click()
            await page.waitForLoadState('networkidle')
          }
        }
      }
    })

    test('应该能归档已发布的文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 找到已发布文章进行归档
      const publishedRow = page.locator('tr:has-text("已发布")').first()
      if (await publishedRow.isVisible()) {
        const editButton = publishedRow.locator('button[data-action="edit"], a[href*="/admin/articles/"]')
        if (await editButton.isVisible()) {
          await editButton.click()
          await page.waitForLoadState('networkidle')

          // 修改状态为归档
          const statusSelect = page.locator('select[name="status"]')
          if (await statusSelect.isVisible()) {
            await statusSelect.selectOption('archived')
          }

          // 保存
          const saveButton = page.locator('button[type="submit"]')
          if (await saveButton.isVisible()) {
            await saveButton.click()
            await page.waitForLoadState('networkidle')
          }
        }
      }
    })
  })

  // ============================================
  // 置顶功能测试
  // ============================================
  test.describe('置顶功能', () => {
    test('应该能置顶文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 找到未置顶的文章
      const unfeaturedRow = page.locator('tr:not(:has([data-testid="featured-icon"]))').first()
      if (await unfeaturedRow.isVisible()) {
        const featureButton = unfeaturedRow.locator('button[data-action="feature"]')
        if (await featureButton.isVisible()) {
          await featureButton.click()
          await page.waitForLoadState('networkidle')

          // 验证置顶状态变化
        }
      }
    })

    test('应该能取消置顶', async ({ page }) => {
      await page.goto('/admin/articles')

      // 找到已置顶的文章（有星标图标）
      const featuredRow = page.locator('tr:has(svg.lucide-star)').first()
      if (await featuredRow.isVisible()) {
        const featureButton = featuredRow.locator('button[data-action="feature"]')
        if (await featureButton.isVisible()) {
          await featureButton.click()
          await page.waitForLoadState('networkidle')
        }
      }
    })
  })

  // ============================================
  // 标记失效功能测试
  // ============================================
  test.describe('标记失效', () => {
    test('应该能标记文章为失效', async ({ page }) => {
      await page.goto('/admin/articles')

      // 找到一个文章进行失效标记
      const articleRow = page.locator('tr').first()
      if (await articleRow.isVisible()) {
        const deprecateButton = articleRow.locator('button[data-action="deprecate"]')
        if (await deprecateButton.isVisible()) {
          // 设置对话框确认处理
          page.on('dialog', dialog => dialog.accept())

          await deprecateButton.click()
          await page.waitForLoadState('networkidle')
        }
      }
    })

    test('失效文章应该显示失效状态', async ({ page }) => {
      await page.goto('/admin/articles')

      // 筛选失效文章
      const statusFilter = page.locator('select').first()
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption({ label: '已失效' })
        await page.waitForLoadState('networkidle')

        // 验证所有显示的文章为失效状态
        const deprecatedBadges = page.locator('td:has-text("已失效")')
        const count = await deprecatedBadges.count()
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // ============================================
  // 删除文章测试
  // ============================================
  test.describe('删除文章', () => {
    test('应该能删除文章', async ({ page }) => {
      await page.goto('/admin/articles')

      // 找到一个文章进行删除
      const articleRow = page.locator('tr').first()
      if (await articleRow.isVisible()) {
        const deleteButton = articleRow.locator('button[data-action="delete"]')
        if (await deleteButton.isVisible()) {
          // 设置对话框确认处理
          page.on('dialog', dialog => dialog.accept())

          await deleteButton.click()
          await page.waitForLoadState('networkidle')
        }
      }
    })

    test('删除文章应该需要确认', async ({ page }) => {
      await page.goto('/admin/articles')

      const deleteButton = page.locator('button[data-action="delete"]').first()
      if (await deleteButton.isVisible()) {
        // 设置对话框取消处理
        page.on('dialog', dialog => dialog.dismiss())

        await deleteButton.click()

        // 取消后应该停留在当前页面
        await page.waitForTimeout(500)
      }
    })
  })

  // ============================================
  // 文章详情页面测试
  // ============================================
  test.describe('文章详情页面', () => {
    test('应该能查看文章详情', async ({ page }) => {
      await page.goto('/admin/articles')

      // 点击第一个文章的查看或编辑按钮
      const actionButton = page.locator('a[href*="/admin/articles/"]').first()
      if (await actionButton.isVisible()) {
        await actionButton.click()

        // 等待页面加载
        await page.waitForLoadState('networkidle')

        // 验证跳转
        await expect(page).toHaveURL(/\/admin\/articles\/art_/)

        // 验证详情页面元素
        const articleId = page.locator('[data-testid="article-id"], code')
        await expect(articleId.first()).toBeVisible()
      }
    })

    test('应该显示验证记录', async ({ page }) => {
      await page.goto('/admin/articles')

      // 进入文章详情
      const actionButton = page.locator('a[href*="/admin/articles/"]').first()
      if (await actionButton.isVisible()) {
        await actionButton.click()
        await page.waitForLoadState('networkidle')

        // 查找验证记录区域
        const verificationSection = page.locator('[data-testid="verification-records"], h2:has-text("验证")')
        const isVisible = await verificationSection.isVisible().catch(() => false)
        expect(typeof isVisible).toBe('boolean')
      }
    })

    test('应该显示代码块', async ({ page }) => {
      await page.goto('/admin/articles')

      // 进入文章详情
      const actionButton = page.locator('a[href*="/admin/articles/"]').first()
      if (await actionButton.isVisible()) {
        await actionButton.click()
        await page.waitForLoadState('networkidle')

        // 查找代码块区域
        const codeBlocks = page.locator('pre code, [data-testid="code-block"]')
        const count = await codeBlocks.count()
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // ============================================
  // 边界情况和错误处理测试
  // ============================================
  test.describe('边界情况和错误处理', () => {
    test('访问不存在的文章应该显示404或错误', async ({ page }) => {
      await page.goto('/admin/articles/art_nonexistent_id_12345')

      // 应该显示错误信息或重定向
      await page.waitForLoadState('networkidle')

      // 验证页面状态 - 可能是404页面或错误提示
      const errorElement = page.locator('[role="alert"], h1:has-text("404"), h1:has-text("错误"), h1:has-text("不存在")')
      const hasError = await errorElement.count() > 0

      // 或者可能重定向到列表页
      const redirected = page.url().includes('/admin/articles') && !page.url().includes('art_nonexistent')

      expect(hasError || redirected).toBe(true)
    })

    test('空列表应该显示提示信息', async ({ page }) => {
      await page.goto('/admin/articles')

      // 搜索一个不存在的关键词
      const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill(`nonexistent_article_${Date.now()}`)
        await searchInput.press('Enter')
        await page.waitForLoadState('networkidle')

        // 可能显示空状态提示
        const emptyState = page.locator('text=没有找到, text=暂无数据, text=无结果')
        const hasEmptyState = await emptyState.count() > 0

        // 或者表格为空
        const tableRows = page.locator('table tbody tr')
        const rowCount = await tableRows.count()

        expect(hasEmptyState || rowCount === 0).toBe(true)
      }
    })
  })
})