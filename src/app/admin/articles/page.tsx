'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Star, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, Column } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import type { Article, ArticleStatus, ArticleDomain, VerificationStatus, Pagination as PaginationType } from '@/types'

interface ArticleListItem {
  id: string
  slug: string
  title: { zh: string; en: string }
  domain: ArticleDomain
  status: ArticleStatus
  verificationStatus: VerificationStatus
  tags: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  featuredAt: string | null
}

interface ArticlesResponse {
  items: ArticleListItem[]
  pagination: PaginationType
}

export default function ArticlesPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | ''>('')
  const [domainFilter, setDomainFilter] = useState<ArticleDomain | ''>('')
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (domainFilter) params.set('domain', domainFilter)
      params.set('page', String(pagination.page))
      params.set('pageSize', String(pagination.pageSize))
      params.set('sortBy', sortKey)
      params.set('sortOrder', sortOrder)

      const res = await fetch(`/api/admin/articles?${params}`)
      const data = await res.json()

      if (data.success) {
        setArticles(data.data.items)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [pagination.page, pagination.pageSize, sortKey, sortOrder, statusFilter, domainFilter])

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 })
    fetchArticles()
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('desc')
    }
  }

  const handleEdit = (article: ArticleListItem) => {
    router.push(`/admin/articles/${article.id}`)
  }

  const handleFeature = async (article: ArticleListItem) => {
    try {
      const featured = !article.featuredAt
      await fetch(`/api/admin/articles/${article.id}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured }),
      })
      fetchArticles()
    } catch (error) {
      console.error('Failed to feature article:', error)
    }
  }

  const handleDeprecate = async (article: ArticleListItem) => {
    if (!confirm('确定要标记此文章为失效吗？')) return
    try {
      await fetch(`/api/admin/articles/${article.id}/deprecate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '管理员标记失效' }),
      })
      fetchArticles()
    } catch (error) {
      console.error('Failed to deprecate article:', error)
    }
  }

  const handleDelete = async (article: ArticleListItem) => {
    if (!confirm('确定要删除此文章吗？此操作不可撤销。')) return
    try {
      await fetch(`/api/admin/articles/${article.id}`, {
        method: 'DELETE',
      })
      fetchArticles()
    } catch (error) {
      console.error('Failed to delete article:', error)
    }
  }

  const getStatusBadge = (status: ArticleStatus) => {
    const variants: Record<ArticleStatus, 'verified' | 'partial' | 'deprecated' | 'default'> = {
      published: 'verified',
      draft: 'partial',
      archived: 'default',
      deprecated: 'deprecated',
    }
    const labels: Record<ArticleStatus, string> = {
      published: '已发布',
      draft: '草稿',
      archived: '已归档',
      deprecated: '已失效',
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const getVerificationBadge = (status: VerificationStatus) => {
    const variants: Record<VerificationStatus, 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated'> = {
      verified: 'verified',
      partial: 'partial',
      pending: 'pending',
      failed: 'failed',
      deprecated: 'deprecated',
    }
    const labels: Record<VerificationStatus, string> = {
      verified: '已验证',
      partial: '部分验证',
      pending: '待验证',
      failed: '验证失败',
      deprecated: '已失效',
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const columns: Column<ArticleListItem>[] = [
    {
      key: '_seq',
      header: '序号',
      className: 'w-12 text-center',
      render: (_, index) => {
        const seq = (pagination.page - 1) * pagination.pageSize + index + 1
        return <span className="text-muted-foreground">{seq}</span>
      },
    },
    {
      key: 'id',
      header: 'ID',
      className: 'font-mono text-xs',
    },
    {
      key: 'title',
      header: '标题',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.title.zh}</div>
          <div className="text-xs text-muted-foreground">{row.title.en}</div>
        </div>
      ),
    },
    {
      key: 'domain',
      header: '分类',
      render: (row) => (
        <Badge variant="outline">{row.domain}</Badge>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'verificationStatus',
      header: '验证状态',
      render: (row) => getVerificationBadge(row.verificationStatus),
    },
    {
      key: 'createdAt',
      header: '创建时间',
      sortable: true,
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'featuredAt',
      header: '置顶',
      render: (row) => row.featuredAt ? (
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
      ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">文章管理</h1>
          <p className="text-muted-foreground">管理平台所有文章内容</p>
        </div>
        <Button onClick={() => router.push('/admin/articles/new')}>
          <Plus className="h-4 w-4 mr-2" />
          新建文章
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2">
          <Input
            placeholder="搜索 ID 或 Slug..."
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
            setStatusFilter(e.target.value as ArticleStatus | '')
            setPagination({ ...pagination, page: 1 })
          }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已归档</option>
          <option value="deprecated">已失效</option>
        </select>
        <select
          value={domainFilter}
          onChange={(e) => {
            setDomainFilter(e.target.value as ArticleDomain | '')
            setPagination({ ...pagination, page: 1 })
          }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">全部分类</option>
          <option value="agent">Agent</option>
          <option value="mcp">MCP</option>
          <option value="skill">Skill</option>
          <option value="foundation">基础认知与协议</option>
          <option value="transport">连接与协议层排错</option>
          <option value="tools_filesystem">工具：文件系统</option>
          <option value="tools_postgres">工具：数据库</option>
          <option value="tools_github">工具：代码仓库</option>
          <option value="error_codes">通用错误码库</option>
          <option value="scenarios">实战案例</option>
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
            data={articles}
            columns={columns}
            sortKey={sortKey}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEdit={handleEdit}
            onFeature={handleFeature}
            onDeprecate={handleDeprecate}
            onDelete={handleDelete}
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
