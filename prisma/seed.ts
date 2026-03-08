/**
 * 种子数据脚本
 * 生成30条完整的文章数据用于测试
 */

import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80) + '-' + nanoid(6)
}

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(daysAgo: number): Date {
  const now = new Date()
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()))
}

const riskLevels = ['low', 'medium', 'high'] as const

const agentTopics = [
  { zh: 'Claude Agent SDK 快速入门', en: 'Getting Started with Claude Agent SDK' },
  { zh: '构建多工具协作的 Agent 系统', en: 'Building Multi-Tool Collaborative Agent Systems' },
  { zh: 'Agent 记忆系统设计', en: 'Agent Memory Systems Design' },
  { zh: '基于 RAG 的 Agent 知识检索', en: 'RAG-based Agent Knowledge Retrieval' },
  { zh: 'Agent 工作流编排最佳实践', en: 'Agent Workflow Orchestration Best Practices' },
  { zh: '使用 LangGraph 构建 Agent', en: 'Building Agents with LangGraph' },
  { zh: 'Agent 自主决策与推理能力', en: 'Agent Autonomous Decision and Reasoning' },
  { zh: '多 Agent 协作模式设计', en: 'Multi-Agent Collaboration Pattern Design' },
  { zh: 'Agent 安全性设计与防护', en: 'Agent Security Design and Protection' },
  { zh: 'Agent 性能优化与调优', en: 'Agent Performance Optimization and Tuning' },
]

const mcpTopics = [
  { zh: 'MCP 协议深度解析', en: 'MCP Protocol Deep Dive' },
  { zh: '从零构建 MCP Server', en: 'Building an MCP Server from Scratch' },
  { zh: 'MCP 安全最佳实践', en: 'MCP Security Best Practices' },
  { zh: 'MCP 客户端开发指南', en: 'MCP Client Development Guide' },
  { zh: 'MCP 资源管理机制', en: 'MCP Resource Management Mechanism' },
  { zh: 'MCP 工具链集成实战', en: 'MCP Toolchain Integration in Practice' },
  { zh: 'MCP 与 Claude 集成方案', en: 'MCP Integration with Claude' },
  { zh: 'MCP 错误处理与调试', en: 'MCP Error Handling and Debugging' },
  { zh: 'MCP 服务部署与监控', en: 'MCP Service Deployment and Monitoring' },
  { zh: 'MCP 扩展开发技巧', en: 'MCP Extension Development Tips' },
]

const skillTopics = [
  { zh: '代码审查技能包', en: 'Code Review Skill Pack' },
  { zh: '错误诊断技能包', en: 'Error Diagnosis Skill Pack' },
  { zh: 'API 设计模式技能包', en: 'API Design Pattern Skill Pack' },
  { zh: '数据建模最佳实践', en: 'Data Modeling Best Practices' },
  { zh: '测试驱动开发技能包', en: 'Test-Driven Development Skill Pack' },
  { zh: '性能分析技能包', en: 'Performance Analysis Skill Pack' },
  { zh: '安全审计技能包', en: 'Security Audit Skill Pack' },
  { zh: '文档生成技能包', en: 'Documentation Generation Skill Pack' },
  { zh: '代码重构技能包', en: 'Code Refactoring Skill Pack' },
  { zh: '依赖管理技能包', en: 'Dependency Management Skill Pack' },
]

const tagPool: Record<string, string[]> = {
  agent: ['Claude', 'Agent', 'SDK', 'LangGraph', 'AutoGPT', 'RAG', '多工具', '记忆系统', '推理', '工作流'],
  mcp: ['MCP', '协议', 'Server', 'Client', 'JSON-RPC', '工具集成', '资源管理', '认证', '部署', '监控'],
  skill: ['Skill', '代码审查', '测试', '安全', '性能', '重构', '文档', 'API设计', '数据建模', '依赖'],
}

const keywordPool: Record<string, string[]> = {
  agent: ['Agent架构', '工具调用', '状态管理', '任务分解', '上下文管理', '错误恢复', '并发控制', '结果聚合'],
  mcp: ['消息协议', '能力协商', '会话管理', '资源访问', '工具注册', '事件通知', '连接池', '超时处理'],
  skill: ['提示词工程', '输出格式', '上下文注入', '示例学习', '迭代优化', '验证规则', '模板复用', '版本管理'],
}

const codeExamples: Record<string, Array<{language: string, filename: string, content: string}>> = {
  agent: [
    { language: 'typescript', filename: 'agent.ts', content: `import { Agent } from '@anthropic-ai/claude-agent-sdk'\n\nconst agent = new Agent({\n  model: 'claude-sonnet-4-6',\n  tools: ['search', 'code_executor'],\n})\n\nconst response = await agent.run('帮我分析这段代码的性能问题')\nconsole.log(response.content)` },
    { language: 'python', filename: 'agent.py', content: `from claude_agent import Agent, ToolRegistry\n\nregistry = ToolRegistry()\nregistry.register('web_search', WebSearchTool())\n\nagent = Agent(\n    model='claude-opus-4-6',\n    tool_registry=registry,\n)\n\nresult = await agent.execute("分析用户反馈数据")` },
  ],
  mcp: [
    { language: 'typescript', filename: 'server.ts', content: `import { Server } from '@modelcontextprotocol/sdk'\n\nconst server = new Server({\n  name: 'my-mcp-server',\n  version: '1.0.0',\n})\n\nserver.tool('search', {\n  description: '搜索文档',\n  parameters: { query: { type: 'string' } },\n  handler: async (params) => {\n    return { results: await searchDocs(params.query) }\n  },\n})\n\nawait server.start()` },
    { language: 'json', filename: 'request.json', content: `{\n  "jsonrpc": "2.0",\n  "method": "tools/call",\n  "params": {\n    "name": "search",\n    "arguments": { "query": "AI agents" }\n  },\n  "id": 1\n}` },
  ],
  skill: [
    { language: 'markdown', filename: 'prompt.md', content: `## 代码审查提示词模板\n\n请审查以下代码，关注：\n1. 代码质量和可读性\n2. 潜在的安全问题\n3. 性能优化建议\n4. 最佳实践建议` },
    { language: 'typescript', filename: 'review.ts', content: `interface CodeReviewResult {\n  issues: Issue[]\n  suggestions: Suggestion[]\n  score: number\n}\n\nfunction analyzeCode(code: string): CodeReviewResult {\n  // 分析代码并返回结果\n}` },
  ],
}

async function main() {
  console.log('🌱 开始生成种子数据...')

  console.log('📦 清理现有数据...')
  // 按正确的顺序删除，先删除依赖项
  await prisma.verificationRecord.deleteMany()
  await prisma.article.deleteMany()
  await prisma.verifier.deleteMany()
  await prisma.agentApp.deleteMany()
  await prisma.session.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.admin.deleteMany()

  console.log('👤 创建管理员账号...')
  const passwordHash = await bcrypt.hash('admin123456', 10)
  const admin = await prisma.admin.create({
    data: {
      id: `admin_${nanoid(12)}`,
      email: 'admin@buzhou.io',
      passwordHash,
      name: 'Admin',
      role: 'super_admin',
      status: 'active',
    },
  })

  console.log('🤖 创建验证人...')
  const verifiers = await Promise.all([
    prisma.verifier.create({
      data: {
        type: 'official_bot',
        name: 'Buzhou Official Bot',
        description: '官方验证机器人，自动化执行代码验证',
        credentials: JSON.stringify({ publicKey: 'sha256:abc123...', verified: true }),
        reputationScore: 98,
        reputationLevel: 'master',
        totalVerifications: 1520,
        passedCount: 1505,
        failedCount: 10,
        partialCount: 5,
        status: 'active',
      },
    }),
    prisma.verifier.create({
      data: {
        type: 'third_party_agent',
        name: 'Claude Agent Verifier',
        description: '基于 Claude 的第三方验证 Agent',
        credentials: JSON.stringify({ publicKey: 'sha256:def456...', verified: true }),
        reputationScore: 92,
        reputationLevel: 'expert',
        totalVerifications: 856,
        passedCount: 830,
        failedCount: 20,
        partialCount: 6,
        status: 'active',
      },
    }),
    prisma.verifier.create({
      data: {
        type: 'human_expert',
        name: 'Dr. Zhang Wei',
        description: 'AI 系统架构师，专注 Agent 和 MCP 验证',
        credentials: JSON.stringify({ certificateUrl: 'https://linkedin.com/in/zhangwei', verified: true }),
        reputationScore: 95,
        reputationLevel: 'expert',
        totalVerifications: 320,
        passedCount: 314,
        failedCount: 4,
        partialCount: 2,
        status: 'active',
      },
    }),
  ])

  console.log('🤖 创建 Agent 应用...')
  await prisma.agentApp.create({
    data: {
      id: `agent_${nanoid(12)}`,
      name: 'Test Agent App',
      description: '用于测试的 Agent 应用',
      owner: 'test@example.com',
      dailyLimit: 1000,
      monthlyLimit: 30000,
      status: 'active',
    },
  })

  console.log('📝 创建文章数据...')
  const articles: Awaited<ReturnType<typeof prisma.article.create>>[] = []
  const allTopics = [
    ...agentTopics.map(t => ({ ...t, domain: 'agent' as const })),
    ...mcpTopics.map(t => ({ ...t, domain: 'mcp' as const })),
    ...skillTopics.map(t => ({ ...t, domain: 'skill' as const })),
  ]

  for (let i = 0; i < 30; i++) {
    const topic = allTopics[i % allTopics.length]
    const domain = topic.domain
    const tags = [randomElement(tagPool[domain]), randomElement(tagPool[domain]), randomElement(tagPool[domain])]
    const keywords = [randomElement(keywordPool[domain]), randomElement(keywordPool[domain]), randomElement(keywordPool[domain])]
    const codeExample = randomElement(codeExamples[domain])
    const status = i < 20 ? 'published' : (i < 25 ? 'draft' : 'archived')
    const verificationStatus = i < 15 ? 'verified' : (i < 22 ? 'partial' : 'pending')
    const createdAt = randomDate(90)
    const publishedAt = status === 'published' ? new Date(createdAt.getTime() + 3600000) : null

    const article = await prisma.article.create({
      data: {
        id: `art_${nanoid(12)}`,
        slug: generateSlug(topic.en),
        title: JSON.stringify({ zh: topic.zh, en: topic.en }),
        summary: JSON.stringify({
          zh: `这是关于${topic.zh}的详细指南，涵盖核心概念、实现方法和最佳实践。`,
          en: `A comprehensive guide about ${topic.en}, covering core concepts, implementation methods, and best practices.`,
        }),
        content: JSON.stringify({
          zh: `## 概述\n\n本文详细介绍${topic.zh}的相关内容。\n\n## 核心概念\n\n${topic.zh}是现代AI应用开发中的重要组成部分。\n\n## 实现方法\n\n以下是具体的实现步骤和代码示例。\n\n## 最佳实践\n\n1. **理解基础概念** - 确保充分理解核心原理\n2. **循序渐进** - 从简单示例开始逐步深入\n3. **实践验证** - 通过实际项目验证学习效果\n\n## 总结\n\n${topic.zh}是一个值得深入学习的主题。`,
          en: `## Overview\n\nThis article provides detailed information about ${topic.en}.\n\n## Core Concepts\n\n${topic.en} is an important part of modern AI application development.\n\n## Implementation\n\nHere are the specific implementation steps and code examples.\n\n## Best Practices\n\n1. **Understand the basics** - Ensure you fully grasp the core principles\n2. **Progress gradually** - Start with simple examples and deepen understanding\n3. **Validate with practice** - Verify learning through actual projects\n\n## Conclusion\n\n${topic.en} is a topic worth diving deep into.`,
        }),
        domain,
        tags: JSON.stringify(Array.from(new Set(tags))),
        codeBlocks: JSON.stringify([{
          id: `cb_${nanoid(8)}`,
          language: codeExample.language,
          filename: codeExample.filename,
          content: codeExample.content,
          description: { zh: '示例代码', en: 'Example code' },
        }]),
        metadata: JSON.stringify({
          applicableVersions: ['1.0', '1.1'],
          confidenceScore: randomInt(75, 99),
          riskLevel: randomElement(riskLevels),
          runtimeEnv: [{ name: 'Node.js', version: '>=18.0.0' }, { name: 'Python', version: '>=3.10' }],
        }),
        qaPairs: JSON.stringify([{
          id: `qa_${nanoid(8)}`,
          question: { zh: `如何开始学习${topic.zh}?`, en: `How to start learning ${topic.en}?` },
          answer: { zh: '建议从官方文档开始，结合实际项目练习。', en: 'Start with official documentation and practice with real projects.' },
        }]),
        relatedIds: JSON.stringify([]),
        keywords: JSON.stringify(Array.from(new Set(keywords))),
        verificationStatus,
        status,
        createdBy: admin.id,
        createdAt,
        publishedAt,
      },
    })
    articles.push(article)
    console.log(`  ✓ 创建文章 ${i + 1}/30: ${topic.zh}`)
  }

  console.log('✅ 创建验证记录...')
  for (let i = 0; i < 15; i++) {
    const article = articles[i]
    const verifier = randomElement(verifiers)
    const result = article.verificationStatus === 'verified' ? 'passed' : (Math.random() > 0.5 ? 'passed' : 'partial')

    await prisma.verificationRecord.create({
      data: {
        id: `vr_${nanoid(12)}`,
        articleId: article.id,
        verifierId: verifier.id,
        result,
        environment: JSON.stringify({
          os: randomElement(['Ubuntu 22.04', 'macOS 14.2', 'Windows 11']),
          runtime: randomElement(['Node.js 20.10.0', 'Python 3.11.5', 'Node.js 18.19.0']),
          version: '1.0.0',
        }),
        notes: result === 'passed' ? '验证通过，代码运行正常。' : '部分功能需要进一步验证。',
        verifiedAt: new Date(article.createdAt.getTime() + 3600000),
      },
    })
  }

  console.log('\n✨ 种子数据生成完成！')
  console.log(`   - 管理员: 1`)
  console.log(`   - 验证人: ${verifiers.length}`)
  console.log(`   - 文章: ${articles.length}`)
  console.log(`   - 验证记录: 15`)
}

main()
  .catch((e) => {
    console.error('❌ 种子数据生成失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
