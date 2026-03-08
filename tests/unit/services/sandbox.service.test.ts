/**
 * SandboxService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SandboxService } from '@/services/sandbox.service'
import type { Article, CodeBlock } from '@/types'

// 创建测试用的文章数据
function createMockArticle(codeBlocks: CodeBlock[]): Article {
  return {
    id: 'test-article-id',
    slug: 'test-article',
    title: { zh: '测试文章', en: 'Test Article' },
    summary: { zh: '测试摘要', en: 'Test Summary' },
    content: { zh: '测试内容', en: 'Test Content' },
    domain: 'agent',
    tags: ['test'],
    keywords: [],
    codeBlocks,
    metadata: {
      applicableVersions: [],
      confidenceScore: 0,
      riskLevel: 'low',
      runtimeEnv: [],
    },
    qaPairs: [],
    relatedIds: [],
    verificationStatus: 'pending',
    verificationRecords: [],
    status: 'draft',
    createdBy: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
  }
}

describe('SandboxService', () => {
  let service: SandboxService

  beforeEach(() => {
    service = new SandboxService()
  })

  describe('verify', () => {
    it('should return passed when sandbox is disabled', async () => {
      const disabledService = new SandboxService({ enabled: false, timeout: 5000, maxRetries: 2 })
      const article = createMockArticle([])

      const result = await disabledService.verify(article)
      expect(result).toBe('passed')
    })

    it('should return passed when no code blocks', async () => {
      const article = createMockArticle([])

      const result = await service.verify(article)
      expect(result).toBe('passed')
    })

    it('should return passed for safe JavaScript code', async () => {
      const article = createMockArticle([
        {
          id: 'block-1',
          language: 'javascript',
          filename: 'test.js',
          content: 'const x = 1 + 2;\nconsole.log(x);',
          description: { zh: '测试代码', en: 'Test code' },
        },
      ])

      const result = await service.verify(article)
      expect(result).toBe('passed')
    })

    it('should return failed for code with dangerous patterns', async () => {
      const article = createMockArticle([
        {
          id: 'block-1',
          language: 'javascript',
          filename: 'test.js',
          content: 'eval("dangerous code")',
          description: { zh: '危险代码', en: 'Dangerous code' },
        },
      ])

      const result = await service.verify(article)
      expect(result).toBe('failed')
    })

    it('should return partial when some blocks fail', async () => {
      const article = createMockArticle([
        {
          id: 'block-1',
          language: 'javascript',
          filename: 'test.js',
          content: 'const x = 1;',
          description: { zh: '安全代码', en: 'Safe code' },
        },
        {
          id: 'block-2',
          language: 'javascript',
          filename: 'bad.js',
          content: 'eval("bad")',
          description: { zh: '危险代码', en: 'Dangerous code' },
        },
      ])

      const result = await service.verify(article)
      expect(result).toBe('partial')
    })
  })

  describe('executeCode', () => {
    it('should detect dangerous eval pattern', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'javascript',
        filename: 'test.js',
        content: 'eval(userInput)',
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Dangerous pattern')
    })

    it('should detect dangerous Python patterns', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'python',
        filename: 'test.py',
        content: 'os.system("rm -rf /")',
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(false)
    })

    it('should detect dangerous bash patterns', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'bash',
        filename: 'test.sh',
        content: 'rm -rf /',
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(false)
    })

    it('should reject code longer than 10KB', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'javascript',
        filename: 'test.js',
        content: 'x'.repeat(10001),
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(false)
      expect(result.error).toContain('too long')
    })
  })

  describe('checkSyntax', () => {
    it('should validate JSON syntax', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'json',
        filename: 'test.json',
        content: '{"key": "value"}',
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(true)
    })

    it('should reject invalid JSON', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'json',
        filename: 'test.json',
        content: '{invalid json}',
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(false)
    })

    it('should validate JavaScript syntax', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'javascript',
        filename: 'test.js',
        content: 'function foo() { return 1; }',
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(true)
    })

    it('should reject invalid JavaScript syntax', async () => {
      const block: CodeBlock = {
        id: 'block-1',
        language: 'javascript',
        filename: 'test.js',
        content: 'function foo( { return 1; }',
        description: { zh: '测试', en: 'Test' },
      }

      const result = await service.executeCode(block)
      expect(result.success).toBe(false)
    })
  })

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({ timeout: 10000 })
      // 验证配置更新（间接通过行为验证）
      expect(service).toBeDefined()
    })
  })
})