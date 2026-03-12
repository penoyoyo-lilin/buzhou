import { expect, test } from '@playwright/test'

interface AdminArticleDetailResponse {
  success: boolean
  data?: {
    id?: string
    domain?: string
    createdBy?: string
  }
}

test.describe('Admin article domain persistence', () => {
  test('should persist domain and author after create and edit', async ({ page, request }) => {
    test.slow()

    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const slug = `e2e-admin-domain-${uniqueId}`
    const createdDomain = 'foundation'
    const updatedDomain = 'tools_filesystem'
    const author = `admin-e2e-${uniqueId}`
    let articleId: string | undefined

    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    const fetchDomainById = async (id: string): Promise<string | undefined> => {
      const response = await request.get(`/api/admin/articles/${id}`)
      expect(response.status()).toBe(200)
      const payload = (await response.json()) as AdminArticleDetailResponse
      expect(payload.success).toBe(true)
      return payload.data?.domain
    }

    const fetchAuthorById = async (id: string): Promise<string | undefined> => {
      const response = await request.get(`/api/admin/articles/${id}`)
      expect(response.status()).toBe(200)
      const payload = (await response.json()) as AdminArticleDetailResponse
      expect(payload.success).toBe(true)
      return payload.data?.createdBy
    }

    try {
      await page.goto('/admin/articles/new')
      const loginButtonVisible = await page.getByRole('button', { name: '登录' }).isVisible().catch(() => false)
      if (loginButtonVisible) {
        await page.getByLabel('邮箱').fill('admin@buzhou.io')
        await page.getByLabel('密码').fill('admin123456')

        const loginResponsePromise = page.waitForResponse((response) => {
          const req = response.request()
          return response.url().includes('/api/admin/auth/login') && req.method() === 'POST'
        })

        await page.getByRole('button', { name: '登录' }).click()
        const loginResponse = await loginResponsePromise
        expect(loginResponse.status()).toBe(200)

        await page.goto('/admin/articles/new')
      }
      await expect(page.getByRole('heading', { name: '新建文章' })).toBeVisible()

      await page.locator('#slug').fill(slug)
      await page.locator('#titleZh').fill('E2E Domain Create/Update 测试')
      await page.locator('#titleEn').fill('E2E Domain Create Update Test')
      await page.locator('#summaryZh').fill('用于验证管理端创建和编辑后 domain 是否正确落库。')
      await page.locator('#summaryEn').fill('Used to verify persisted domain after admin create and edit.')
      await page.locator('#contentZh').fill('# 测试内容\n\n用于 E2E 验证。')
      await page.locator('#contentEn').fill('# Test Content\n\nFor E2E validation.')
      await page.locator('#domain').selectOption(createdDomain)
      await page.locator('#author').fill(author)

      const createResponsePromise = page.waitForResponse((response) => {
        const req = response.request()
        return response.url().includes('/api/admin/articles') && req.method() === 'POST'
      })

      await page.getByRole('button', { name: '保存' }).click()
      const createResponse = await createResponsePromise
      expect(createResponse.status()).toBe(200)
      const createPayload = (await createResponse.json()) as AdminArticleDetailResponse
      expect(createPayload.success).toBe(true)
      articleId = createPayload.data?.id
      expect(articleId).toBeTruthy()
      if (!articleId) return

      await expect.poll(async () => fetchDomainById(articleId!)).toBe(createdDomain)
      await expect.poll(async () => fetchAuthorById(articleId!)).toBe(author)

      await page.goto(`/admin/articles/${articleId}`)
      await expect(page.getByRole('heading', { name: '编辑文章' })).toBeVisible()
      await page.locator('#domain').selectOption(updatedDomain)

      const updateResponsePromise = page.waitForResponse((response) => {
        const req = response.request()
        return response.url().includes(`/api/admin/articles/${articleId}`) && req.method() === 'PUT'
      })

      await page.getByRole('button', { name: '保存' }).click()
      const updateResponse = await updateResponsePromise
      expect(updateResponse.status()).toBe(200)
      const updatePayload = (await updateResponse.json()) as { success: boolean }
      expect(updatePayload.success).toBe(true)

      await expect.poll(async () => fetchDomainById(articleId!)).toBe(updatedDomain)
    } finally {
      if (articleId) {
        await request.delete(`/api/admin/articles/${articleId}`)
      }
    }
  })
})
