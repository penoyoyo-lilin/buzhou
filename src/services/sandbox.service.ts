/**
 * 沙盒验证服务
 * 负责执行代码块验证
 */

import type { Article, CodeBlock } from '@/types'

// ============================================
// 类型定义
// ============================================

export type VerificationResult = 'passed' | 'failed' | 'partial'

export interface SandboxConfig {
  enabled: boolean
  timeout: number      // ms
  maxRetries: number
}

export interface ExecutionResult {
  success: boolean
  output?: string
  error?: string
  duration: number
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: SandboxConfig = {
  enabled: true,
  timeout: 5000,      // 5 秒超时
  maxRetries: 2,
}

// ============================================
// SandboxService 类
// ============================================

export class SandboxService {
  private config: SandboxConfig

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 验证文章中的所有代码块
   */
  async verify(article: Article): Promise<VerificationResult> {
    if (!this.config.enabled) {
      return 'passed' // 沙盒禁用时默认通过
    }

    const codeBlocks = article.codeBlocks as CodeBlock[]
    if (!codeBlocks || codeBlocks.length === 0) {
      return 'passed' // 没有代码块，默认通过
    }

    let passed = 0
    let failed = 0

    for (const block of codeBlocks) {
      try {
        const result = await this.executeCode(block)
        if (result.success) {
          passed++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`Code block execution failed: ${block.id}`, error)
        failed++
      }
    }

    // 计算整体结果
    const total = codeBlocks.length
    if (passed === total) return 'passed'
    if (failed === total) return 'failed'
    return 'partial'
  }

  /**
   * 执行单个代码块
   * 注意：这是一个简化实现，生产环境应使用 Docker 或 VM 隔离
   */
  async executeCode(block: CodeBlock): Promise<ExecutionResult> {
    const startTime = Date.now()

    // 目前仅支持安全的静态分析
    // 生产环境应使用 Docker 或 isolate-vm 进行真正的代码执行
    const result = await this.safeAnalyze(block)

    return {
      ...result,
      duration: Date.now() - startTime,
    }
  }

  /**
   * 安全分析代码块
   * 这是一个简化的实现，仅做静态检查
   */
  private async safeAnalyze(block: CodeBlock): Promise<ExecutionResult> {
    const { language, content } = block

    // 检查代码是否包含危险操作
    const dangerousPatterns = this.getDangerousPatterns(language)
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return {
          success: false,
          error: `Dangerous pattern detected: ${pattern.source}`,
          duration: 0,
        }
      }
    }

    // 检查代码长度
    if (content.length > 10000) {
      return {
        success: false,
        error: 'Code block too long (max 10KB)',
        duration: 0,
      }
    }

    // 基本语法检查（简化版）
    const syntaxCheck = this.checkSyntax(language, content)
    if (!syntaxCheck.valid) {
      return {
        success: false,
        error: syntaxCheck.error || 'Syntax error',
        duration: 0,
      }
    }

    // 通过所有检查
    return {
      success: true,
      output: 'Static analysis passed',
      duration: 0,
    }
  }

  /**
   * 获取危险操作的正则模式
   */
  private getDangerousPatterns(language: string): RegExp[] {
    const commonPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /require\s*\(\s*['"]child_process['"]\s*\)/i,
      /import\s+.*from\s+['"]child_process['"]/i,
      /process\.exit/i,
      /fs\.(unlink|rm|writeFile)\s*\(/i,
    ]

    const languageSpecific: Record<string, RegExp[]> = {
      javascript: [
        /document\.cookie/i,
        /localStorage/i,
        /sessionStorage/i,
        /XMLHttpRequest/i,
        /fetch\s*\(/i,
      ],
      python: [
        /os\.system/i,
        /subprocess\./i,
        /eval\s*\(/i,
        /exec\s*\(/i,
        /__import__/i,
        /open\s*\([^)]*,\s*['"]w['"]/i,
      ],
      bash: [
        /rm\s+-rf/i,
        /sudo\s+/i,
        /chmod\s+777/i,
        />\s*\/dev\//i,
        /mkfs/i,
        /dd\s+if=/i,
      ],
    }

    return [...commonPatterns, ...(languageSpecific[language] || [])]
  }

  /**
   * 基本语法检查
   */
  private checkSyntax(
    language: string,
    code: string
  ): { valid: boolean; error?: string } {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return this.checkJavaScriptSyntax(code)
      case 'python':
        return this.checkPythonSyntax(code)
      case 'json':
        return this.checkJsonSyntax(code)
      default:
        // 对于不支持的语言，默认通过
        return { valid: true }
    }
  }

  /**
   * JavaScript 语法检查
   */
  private checkJavaScriptSyntax(code: string): { valid: boolean; error?: string } {
    try {
      // 使用 Function 构造器检查语法（不执行）
      new Function(code)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Syntax error',
      }
    }
  }

  /**
   * Python 语法检查（简化版）
   */
  private checkPythonSyntax(code: string): { valid: boolean; error?: string } {
    // 检查基本的缩进一致性
    const lines = code.split('\n')
    let indentStack: number[] = [0]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim().length === 0) continue

      const indent = line.search(/\S/)
      if (indent === -1) continue

      // 检查缩进是否合理
      if (indent > (indentStack[indentStack.length - 1] || 0) + 4) {
        return {
          valid: false,
          error: `Inconsistent indentation at line ${i + 1}`,
        }
      }
    }

    // 检查括号匹配
    const brackets = { '(': ')', '[': ']', '{': '}' }
    const stack: string[] = []

    for (const char of code) {
      if (char in brackets) {
        stack.push(char)
      } else if (Object.values(brackets).includes(char)) {
        const last = stack.pop()
        if (!last || brackets[last as keyof typeof brackets] !== char) {
          return { valid: false, error: 'Mismatched brackets' }
        }
      }
    }

    if (stack.length > 0) {
      return { valid: false, error: 'Unclosed brackets' }
    }

    return { valid: true }
  }

  /**
   * JSON 语法检查
   */
  private checkJsonSyntax(code: string): { valid: boolean; error?: string } {
    try {
      JSON.parse(code)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid JSON',
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// 导出单例
export const sandboxService = new SandboxService()