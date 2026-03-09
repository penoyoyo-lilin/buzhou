/**
 * 管理后台 Agent API 集成测试
 * 测试 GET /api/admin/agents
 * 测试 GET/PUT /api/admin/agents/[id]
 *
 * 注意: POST 和 DELETE 功能尚未实现
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as ListAgents } from '@/app/api/admin/agents/route'
import { GET as GetAgent, PUT as UpdateAgent } from '@/app/api/admin/agents/[id]/route'
import prisma from '@/core/db/client'

describe('Admin Agents API Integration', () => {
  const createdAgentIds: string[] = []
  let testAgentId: string

  beforeAll(async () => {
    await prisma.$connect()

    // 创建测试 Agent
    const timestamp = Date.now()
    const agent = await prisma.agentApp.create({
      data: {
        id: `agent_test_${timestamp}`,
        name: 'Test Agent',
        description: 'Test agent for integration tests',
        owner: 'test-owner',
        status: 'active',
        dailyLimit: 1000,
        monthlyLimit: 30000,
      },
    })
    testAgentId = agent.id
    createdAgentIds.push(agent.id)
  })

  afterAll(async () => {
    if (createdAgentIds.length > 0) {
      await prisma.apiRequestLog.deleteMany({
        where: { agentId: { in: createdAgentIds } },
      })
      await prisma.agentApp.deleteMany({
        where: { id: { in: createdAgentIds } },
      })
    }
    await prisma.$disconnect()
  })

  // ============================================
  // GET /api/admin/agents 测试
  // ============================================
  describe('GET /api/admin/agents', () => {
    it('应该返回 Agent 列表', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/agents')

      const response = await ListAgents(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items).toBeDefined()
      expect(Array.isArray(data.data.items)).toBe(true)
      expect(data.data.pagination).toBeDefined()
    })

    it('应该支持分页', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/agents?page=1&pageSize=10'
      )

      const response = await ListAgents(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.pageSize).toBe(10)
    })

    it('应该支持状态筛选', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/agents?status=active'
      )

      const response = await ListAgents(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.items.forEach((agent: { status: string }) => {
        expect(agent.status).toBe('active')
      })
    })

    it('应该支持搜索', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/agents?search=Test'
      )

      const response = await ListAgents(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  // ============================================
  // GET /api/admin/agents/[id] 测试
  // ============================================
  describe('GET /api/admin/agents/[id]', () => {
    it('应该返回 Agent 详情', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/agents/${testAgentId}`
      )

      const response = await GetAgent(request, { params: { id: testAgentId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(testAgentId)
      expect(data.data.name).toBe('Test Agent')
    })

    it('不存在的 Agent 应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/agents/agent_nonexistent'
      )

      const response = await GetAgent(request, { params: { id: 'agent_nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // PUT /api/admin/agents/[id] 测试
  // ============================================
  describe('PUT /api/admin/agents/[id]', () => {
    it('应该更新 Agent', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/agents/${testAgentId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: 'Updated Agent Name',
            dailyLimit: 2000,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const response = await UpdateAgent(request, { params: { id: testAgentId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Agent Name')
      expect(data.data.dailyLimit).toBe(2000)
    })

    it('不存在的 Agent 应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/agents/agent_nonexistent',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Test' }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const response = await UpdateAgent(request, { params: { id: 'agent_nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
    })
  })
})