'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ExternalLink, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

interface FooterLink {
  id: string
  category: string
  labelZh: string
  labelEn: string
  url: string
  isExternal: boolean
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 分组名称映射
const categoryLabels: Record<string, string> = {
  about: '关于',
  resources: '资源',
  developers: '开发者',
  community: '社区',
}

export default function FooterLinksPage() {
  const router = useRouter()
  const [links, setLinks] = useState<FooterLink[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const fetchLinks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)

      const res = await fetch(`/api/admin/footer-links?${params}`)
      const data = await res.json()

      if (data.success) {
        setLinks(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch footer links:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLinks()
  }, [categoryFilter])

  const handleEdit = (link: FooterLink) => {
    router.push(`/admin/footer-links/${link.id}`)
  }

  const handleDelete = async (link: FooterLink) => {
    if (!confirm(`确定要删除 "${link.labelZh}" 吗？`)) return

    try {
      const res = await fetch(`/api/admin/footer-links/${link.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        fetchLinks()
      } else {
        alert(data.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete footer link:', error)
      alert('删除失败')
    }
  }

  const getCategoryBadge = (category: string) => {
    return (
      <Badge variant="outline">
        {categoryLabels[category] || category}
      </Badge>
    )
  }

  const columns: Column<FooterLink>[] = [
    {
      key: 'category',
      header: '分组',
      render: (row) => getCategoryBadge(row.category),
    },
    {
      key: 'labelZh',
      header: '名称 (中文)',
      render: (row) => (
        <div>
          <div className="font-medium">{row.labelZh}</div>
          <div className="text-xs text-muted-foreground">{row.labelEn}</div>
        </div>
      ),
    },
    {
      key: 'url',
      header: '链接地址',
      render: (row) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs truncate max-w-[200px]">{row.url}</span>
          {row.isExternal && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </div>
      ),
    },
    {
      key: 'sortOrder',
      header: '排序',
      render: (row) => (
        <span className="text-muted-foreground">{row.sortOrder}</span>
      ),
    },
    {
      key: 'isActive',
      header: '状态',
      render: (row) => (
        <Badge variant={row.isActive ? 'verified' : 'deprecated'}>
          {row.isActive ? '启用' : '禁用'}
        </Badge>
      ),
    },
    {
      key: 'updatedAt',
      header: '更新时间',
      render: (row) => formatDateTime(row.updatedAt),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">底部导航管理</h1>
          <p className="text-muted-foreground">管理前台底部导航菜单</p>
        </div>
        <Button onClick={() => router.push('/admin/footer-links/new')}>
          <Plus className="h-4 w-4 mr-2" />
          新增导航
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">全部分组</option>
          <option value="about">关于</option>
          <option value="resources">资源</option>
          <option value="developers">开发者</option>
          <option value="community">社区</option>
        </select>
      </div>

      {/* 数据表格 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <DataTable
          data={links}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          rowKey="id"
        />
      )}
    </div>
  )
}