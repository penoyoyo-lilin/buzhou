'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PlayCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { formatDateTime } from '@/lib/utils'
import type { InspectionRun, Pagination as PaginationType } from '@/types'

interface InspectionListResponse {
  runs: InspectionRun[]
  pagination: PaginationType
  queue: {
    queued: number
  }
}

function getStatusBadge(status: InspectionRun['status']) {
  const variantMap: Record<InspectionRun['status'], 'pending' | 'warning' | 'verified' | 'partial' | 'failed'> = {
    queued: 'pending',
    running: 'warning',
    completed: 'verified',
    partial: 'partial',
    failed: 'failed',
  }

  return <Badge variant={variantMap[status]}>{status}</Badge>
}

export default function AdminInspectionsPage() {
  const router = useRouter()
  const [data, setData] = useState<InspectionListResponse>({
    runs: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    queue: { queued: 0 },
  })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<InspectionRun['status'] | ''>('')
  const [submitting, setSubmitting] = useState<'daily' | 'process' | null>(null)

  const fetchRuns = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(data.pagination.page))
      params.set('pageSize', String(data.pagination.pageSize))
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/admin/inspections?${params}`)
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch inspections:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuns()
  }, [data.pagination.page, data.pagination.pageSize, statusFilter])

  const executeAction = async (action: 'daily' | 'process') => {
    setSubmitting(action)
    try {
      const response = await fetch('/api/admin/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          limit: action === 'daily' ? 20 : 5,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error?.message || '执行失败')
      }

      await fetchRuns()
    } catch (error) {
      console.error(`Failed to execute inspection action ${action}:`, error)
    } finally {
      setSubmitting(null)
    }
  }

  const columns: Column<InspectionRun>[] = [
    {
      key: 'id',
      header: 'Run ID',
      className: 'font-mono text-xs',
    },
    {
      key: 'articleId',
      header: '文章 ID',
      className: 'font-mono text-xs',
    },
    {
      key: 'triggerSource',
      header: '触发来源',
      render: (row) => <Badge variant="outline">{row.triggerSource}</Badge>,
    },
    {
      key: 'status',
      header: '状态',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'findingsCount',
      header: 'Finding',
      render: (row) => (
        <div className="text-sm">
          <div>{row.findingsCount}</div>
          <div className="text-xs text-muted-foreground">可自动修复 {row.autoFixableCount}</div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: '创建时间',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'completedAt',
      header: '完成时间',
      render: (row) => row.completedAt ? formatDateTime(row.completedAt) : '-',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">巡检中心</h1>
          <p className="text-muted-foreground">查看线上文章巡检、自动修复与失败重试状态</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => executeAction('daily')}
            disabled={submitting !== null}
          >
            {submitting === 'daily' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            每日增量入队
          </Button>
          <Button
            onClick={() => executeAction('process')}
            disabled={submitting !== null}
          >
            {submitting === 'process' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            处理 5 条
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">队列中</div>
          <div className="mt-2 text-3xl font-semibold">{data.queue.queued}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">总 Run</div>
          <div className="mt-2 text-3xl font-semibold">{data.pagination.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">当前筛选</div>
          <div className="mt-2">
            {statusFilter ? <Badge variant="outline">{statusFilter}</Badge> : <span className="text-muted-foreground">全部</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as InspectionRun['status'] | '')
            setData((current) => ({
              ...current,
              pagination: { ...current.pagination, page: 1 },
            }))
          }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="completed">completed</option>
          <option value="partial">partial</option>
          <option value="failed">failed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            data={data.runs}
            columns={columns}
            rowKey="id"
            onEdit={(row) => router.push(`/admin/inspections/${row.id}`)}
          />
          <Pagination
            pagination={data.pagination}
            onPageChange={(page) => setData((current) => ({
              ...current,
              pagination: { ...current.pagination, page },
            }))}
          />
        </div>
      )}
    </div>
  )
}
