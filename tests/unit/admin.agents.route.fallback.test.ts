import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const agentCountMock = vi.fn()
const agentFindManyMock = vi.fn()
const queryRawUnsafeMock = vi.fn()

const originalDatabaseUrl = process.env.DATABASE_URL

vi.mock('@/core/db/client', () => ({
  prisma: {
    agentApp: {
      count: agentCountMock,
      findMany: agentFindManyMock,
    },
    $queryRawUnsafe: queryRawUnsafeMock,
  },
  default: {
    agentApp: {
      count: agentCountMock,
      findMany: agentFindManyMock,
    },
    $queryRawUnsafe: queryRawUnsafeMock,
  },
}))

describe('Admin agents API fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://pool.example.com:6543/postgres?pgbouncer=true'
  })

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('should fallback to SQL query when Prisma query fails due schema drift', async () => {
    const schemaError = Object.assign(
      new Error('column "registration_source" does not exist'),
      { code: 'P2022' }
    )

    agentCountMock.mockRejectedValue(schemaError)

    queryRawUnsafeMock.mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.columns')) {
        return [
          { column_name: 'id' },
          { column_name: 'name' },
          { column_name: 'description' },
          { column_name: 'owner' },
          { column_name: 'api_key_prefix' },
          { column_name: 'daily_limit' },
          { column_name: 'monthly_limit' },
          { column_name: 'used_today' },
          { column_name: 'used_this_month' },
          { column_name: 'total_requests' },
          { column_name: 'status' },
          { column_name: 'created_at' },
          { column_name: 'last_access_at' },
        ]
      }

      if (sql.includes('COUNT(*)::int AS total')) {
        return [{ total: 1 }]
      }

      return [
        {
          id: 'agent_legacy_1',
          name: 'Legacy Agent',
          description: 'Legacy schema row',
          owner: 'legacy@example.com',
          externalAgentId: null,
          fingerprintHash: null,
          registrationSource: 'manual',
          apiKeyHash: null,
          apiKeyPrefix: 'sk-test',
          apiKeyCreatedAt: null,
          dailyLimit: 1000,
          monthlyLimit: 30000,
          usedToday: 100,
          usedThisMonth: 1500,
          usageDay: null,
          usageMonth: null,
          totalRequests: 2000,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          status: 'active',
          createdAt: new Date('2026-03-12T10:00:00.000Z'),
          lastAccessAt: null,
        },
      ]
    })

    const { GET } = await import('@/app/api/admin/agents/route')
    const request = new NextRequest('http://localhost:3000/api/admin/agents?page=1&pageSize=20')

    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        items?: Array<{
          id: string
          name: string
          quotaUsage?: { daily: number; monthly: number }
        }>
        pagination?: { total?: number }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.pagination?.total).toBe(1)
    expect(payload.data?.items?.[0]?.id).toBe('agent_legacy_1')
    expect(payload.data?.items?.[0]?.name).toBe('Legacy Agent')
    expect(payload.data?.items?.[0]?.quotaUsage).toEqual({
      daily: 0.1,
      monthly: 0.05,
    })
  })
})
