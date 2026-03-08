'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, Column } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import type { AgentStatus, Pagination as PaginationType } from '@/types'

interface AgentListItem {
  id: string
  name: string
  description: string
  owner: string
  apiKeyPrefix: string | null
  dailyLimit: number
  monthlyLimit: number
  usedToday: number
  usedThisMonth: number
  totalRequests: number
  successRequests: number
  failedRequests: number
  status: AgentStatus
  createdAt: string
  lastAccessAt: string | null
  quotaUsage?: {
    daily: number
    monthly: number
  }
}

interface AgentsResponse {
  items: AgentListItem[]
  pagination: PaginationType
}

export default function AgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<AgentListItem[]>([])
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AgentStatus | ''>('')

  const fetchAgents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(pagination.page))
      params.set('pageSize', String(pagination.pageSize))

      const res = await fetch(`/api/admin/agents?${params}`)
      const data = await res.json()

      if (data.success) {
        setAgents(data.data.items)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [pagination.page, pagination.pageSize, statusFilter])

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 })
    fetchAgents()
  }

  const handleView = (agent: AgentListItem) => {
    router.push(`/admin/agents/${agent.id}`)
  }

  const getStatusBadge = (status: AgentStatus) => {
    const variants: Record<AgentStatus, 'verified' | 'partial' | 'deprecated'> = {
      active: 'verified',
      suspended: 'partial',
      revoked: 'deprecated',
    }
    const labels: Record<AgentStatus, string> = {
      active: '活跃',
      suspended: '已暂停',
      revoked: '已吊销',
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const columns: Column<AgentListItem>[] = [
    {
      key: 'id',
      header: 'ID',
      className: 'font-mono text-xs w-24',
    },
    {
      key: 'name',
      header: '名称',
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-muted-foreground">{row.owner}</div>
        </div>
      ),
    },
    {
      key: 'apiKeyPrefix',
      header: 'API Key',
      render: (row) => row.apiKeyPrefix ? (
        <span className="font-mono text-xs">{row.apiKeyPrefix}...</span>
      ) : (
        <span className="text-muted-foreground text-xs">未生成</span>
      ),
    },
    {
      key: 'quota',
      header: '额度使用',
      render: (row) => {
        const dailyPercent = Math.round((row.usedToday / row.dailyLimit) * 100)
        const monthlyPercent = Math.round((row.usedThisMonth / row.monthlyLimit) * 100)
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${dailyPercent > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(dailyPercent, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{dailyPercent}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${monthlyPercent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(monthlyPercent, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{monthlyPercent}%</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'totalRequests',
      header: '请求数',
      render: (row) => (
        <div className="text-sm">
          <span className="font-medium">{row.totalRequests.toLocaleString()}</span>
          <span className="text-muted-foreground ml-1">
            (成功 {row.successRequests})
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'lastAccessAt',
      header: '最后访问',
      render: (row) => row.lastAccessAt ? formatDateTime(row.lastAccessAt) : '-',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent 管理</h1>
          <p className="text-muted-foreground">管理 API 接入的 Agent 应用</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2">
          <Input
            placeholder="搜索 ID、名称或所有者..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-sm"
          />
          <Button variant="secondary" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as AgentStatus | '')
            setPagination({ ...pagination, page: 1 })
          }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="suspended">已暂停</option>
          <option value="revoked">已吊销</option>
        </select>
      </div>

      {/* 数据表格 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            data={agents}
            columns={columns}
            onEdit={handleView}
            rowKey="id"
          />
          <Pagination
            pagination={pagination}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      )}
    </div>
  )
}