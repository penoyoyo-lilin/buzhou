export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { agentQuerySchema } from '@/lib/validators'

interface AgentListRecord {
  id: string
  name: string
  description: string
  owner: string
  externalAgentId: string | null
  fingerprintHash: string | null
  registrationSource: string
  apiKeyHash: string | null
  apiKeyPrefix: string | null
  apiKeyCreatedAt: Date | null
  dailyLimit: number
  monthlyLimit: number
  usedToday: number
  usedThisMonth: number
  usageDay: string | null
  usageMonth: string | null
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgResponseTime: number
  status: string
  createdAt: Date
  lastAccessAt: Date | null
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0
  return numerator / denominator
}

function formatAgentListItem(agent: AgentListRecord) {
  return {
    ...agent,
    quotaUsage: {
      daily: safeRatio(agent.usedToday, agent.dailyLimit),
      monthly: safeRatio(agent.usedThisMonth, agent.monthlyLimit),
    },
  }
}

function isPostgreSQLRuntime(): boolean {
  const url = process.env.DATABASE_URL || ''
  return url.includes('postgresql://') || url.includes('postgres://')
}

function isSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === 'P2021' || code === 'P2022') return true

  const message = error instanceof Error ? error.message : String(error)
  return /column .+ does not exist/i.test(message) || /table .+ does not exist/i.test(message)
}

async function queryAgentsWithSqlFallback(params: {
  search?: string
  status?: string
  page: number
  pageSize: number
}): Promise<{ total: number; items: AgentListRecord[] }> {
  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_apps'`
  )
  const columnSet = new Set(columns.map((item) => item.column_name))
  const has = (name: string) => columnSet.has(name)

  const selectExpr = (column: string, expressionWhenMissing: string, alias: string) =>
    `${has(column) ? `"${column}"` : expressionWhenMissing} AS "${alias}"`

  const whereParts: string[] = []
  const whereParams: Array<string> = []
  let placeholder = 1

  if (params.status && has('status')) {
    whereParts.push(`"status" = $${placeholder++}`)
    whereParams.push(params.status)
  }

  if (params.search) {
    const like = `%${params.search}%`
    const searchParts: string[] = []
    if (has('id')) {
      searchParts.push(`CAST("id" AS TEXT) ILIKE $${placeholder++}`)
      whereParams.push(like)
    }
    if (has('name')) {
      searchParts.push(`"name" ILIKE $${placeholder++}`)
      whereParams.push(like)
    }
    if (has('owner')) {
      searchParts.push(`"owner" ILIKE $${placeholder++}`)
      whereParams.push(like)
    }
    if (searchParts.length > 0) {
      whereParts.push(`(${searchParts.join(' OR ')})`)
    }
  }

  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''
  const totalRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
    `SELECT COUNT(*)::int AS total FROM "agent_apps" ${whereSql}`,
    ...whereParams
  )

  const orderBy = has('created_at') ? `"created_at" DESC` : `"id" DESC`
  const listSql = `
    SELECT
      ${selectExpr('id', `'unknown'::text`, 'id')},
      ${selectExpr('name', `''::text`, 'name')},
      ${selectExpr('description', `''::text`, 'description')},
      ${selectExpr('owner', `''::text`, 'owner')},
      ${selectExpr('external_agent_id', `NULL::text`, 'externalAgentId')},
      ${selectExpr('fingerprint_hash', `NULL::text`, 'fingerprintHash')},
      ${selectExpr('registration_source', `'manual'::text`, 'registrationSource')},
      ${selectExpr('api_key_hash', `NULL::text`, 'apiKeyHash')},
      ${selectExpr('api_key_prefix', `NULL::text`, 'apiKeyPrefix')},
      ${selectExpr('api_key_created_at', `NULL::timestamptz`, 'apiKeyCreatedAt')},
      ${selectExpr('daily_limit', `1000::int`, 'dailyLimit')},
      ${selectExpr('monthly_limit', `30000::int`, 'monthlyLimit')},
      ${selectExpr('used_today', `0::int`, 'usedToday')},
      ${selectExpr('used_this_month', `0::int`, 'usedThisMonth')},
      ${selectExpr('usage_day', `NULL::text`, 'usageDay')},
      ${selectExpr('usage_month', `NULL::text`, 'usageMonth')},
      ${selectExpr('total_requests', `0::int`, 'totalRequests')},
      ${selectExpr('success_requests', `0::int`, 'successRequests')},
      ${selectExpr('failed_requests', `0::int`, 'failedRequests')},
      ${selectExpr('avg_response_time', `0::double precision`, 'avgResponseTime')},
      ${selectExpr('status', `'active'::text`, 'status')},
      ${selectExpr('created_at', `NOW()`, 'createdAt')},
      ${selectExpr('last_access_at', `NULL::timestamptz`, 'lastAccessAt')}
    FROM "agent_apps"
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${placeholder} OFFSET $${placeholder + 1}
  `

  const rows = await prisma.$queryRawUnsafe<AgentListRecord[]>(
    listSql,
    ...whereParams,
    params.pageSize,
    (params.page - 1) * params.pageSize
  )

  return {
    total: totalRows[0]?.total || 0,
    items: rows,
  }
}

/**
 * GET /api/admin/agents
 * 获取 Agent 列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const result = agentQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
    })

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const { search, status, page, pageSize } = result.data

    // 构建查询条件
    const where: Record<string, unknown> = {}

    if (search) {
      // SQLite 不支持 mode: 'insensitive'，使用默认的大小写敏感搜索
      where.OR = [
        { id: { contains: search } },
        { name: { contains: search } },
        { owner: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    let total = 0
    let agents: AgentListRecord[] = []

    try {
      total = await prisma.agentApp.count({ where })
      agents = await prisma.agentApp.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }) as AgentListRecord[]
    } catch (primaryError) {
      if (isPostgreSQLRuntime() && isSchemaDriftError(primaryError)) {
        console.warn('[AdminAgentsAPI] Prisma query failed, fallback to SQL query:', primaryError)
        const fallback = await queryAgentsWithSqlFallback({ search, status, page, pageSize })
        total = fallback.total
        agents = fallback.items
      } else {
        throw primaryError
      }
    }

    return NextResponse.json(
      successResponse({
        items: agents.map(formatAgentListItem),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    )
  } catch (error) {
    console.error('Get agents error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取 Agent 列表失败'),
      { status: 500 }
    )
  }
}
