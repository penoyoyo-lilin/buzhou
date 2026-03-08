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
import type { VerifierType, VerifierStatus, Pagination as PaginationType } from '@/types'

interface VerifierListItem {
  id: string
  type: VerifierType
  name: string
  reputationScore: number
  reputationLevel: string
  totalVerifications: number
  passedCount: number
  failedCount: number
  partialCount: number
  status: VerifierStatus
  createdAt: string
}

interface VerifiersResponse {
  items: VerifierListItem[]
  pagination: PaginationType
}

export default function VerifiersPage() {
  const router = useRouter()
  const [verifiers, setVerifiers] = useState<VerifierListItem[]>([])
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<VerifierType | ''>('')
  const [statusFilter, setStatusFilter] = useState<VerifierStatus | ''>('')

  const fetchVerifiers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(pagination.page))
      params.set('pageSize', String(pagination.pageSize))

      const res = await fetch(`/api/admin/verifiers?${params}`)
      const data = await res.json()

      if (data.success) {
        setVerifiers(data.data.items)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch verifiers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVerifiers()
  }, [pagination.page, pagination.pageSize, typeFilter, statusFilter])

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 })
    fetchVerifiers()
  }

  const handleView = (verifier: VerifierListItem) => {
    router.push(`/admin/verifiers/${verifier.id}`)
  }

  const getTypeBadge = (type: VerifierType) => {
    const labels: Record<VerifierType, string> = {
      official_bot: '官方机器人',
      third_party_agent: '第三方 Agent',
      human_expert: '人类专家',
    }
    return <Badge variant="outline">{labels[type]}</Badge>
  }

  const getStatusBadge = (status: VerifierStatus) => {
    const variants: Record<VerifierStatus, 'verified' | 'partial' | 'deprecated'> = {
      active: 'verified',
      suspended: 'partial',
      retired: 'deprecated',
    }
    const labels: Record<VerifierStatus, string> = {
      active: '活跃',
      suspended: '已暂停',
      retired: '已退役',
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const getReputationColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const columns: Column<VerifierListItem>[] = [
    {
      key: 'id',
      header: 'ID',
      className: 'font-mono text-xs w-24',
    },
    {
      key: 'name',
      header: '名称',
      render: (row) => <div className="font-medium">{row.name}</div>,
    },
    {
      key: 'type',
      header: '类型',
      render: (row) => getTypeBadge(row.type),
    },
    {
      key: 'reputationScore',
      header: '信誉分',
      render: (row) => (
        <span className={getReputationColor(row.reputationScore)}>
          {row.reputationScore}
        </span>
      ),
    },
    {
      key: 'totalVerifications',
      header: '验证次数',
      render: (row) => (
        <div className="text-sm">
          <span className="font-medium">{row.totalVerifications}</span>
          <span className="text-muted-foreground ml-1">(通过 {row.passedCount})</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'createdAt',
      header: '创建时间',
      render: (row) => formatDateTime(row.createdAt),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">验证人管理</h1>
          <p className="text-muted-foreground">管理内容验证人</p>
        </div>
        <Button onClick={() => router.push('/admin/verifiers/new')}>
          <Plus className="h-4 w-4 mr-2" />
          新建验证人
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2">
          <Input
            placeholder="搜索 ID 或名称..."
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
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as VerifierType | '')
            setPagination({ ...pagination, page: 1 })
          }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">全部类型</option>
          <option value="official_bot">官方机器人</option>
          <option value="third_party_agent">第三方 Agent</option>
          <option value="human_expert">人类专家</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as VerifierStatus | '')
            setPagination({ ...pagination, page: 1 })
          }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="suspended">已暂停</option>
          <option value="retired">已退役</option>
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
            data={verifiers}
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