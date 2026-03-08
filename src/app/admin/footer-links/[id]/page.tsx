'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const categories = [
  { value: 'about', label: '关于' },
  { value: 'resources', label: '资源' },
  { value: 'developers', label: '开发者' },
  { value: 'community', label: '社区' },
]

export default function FooterLinkEditPage() {
  const router = useRouter()
  const params = useParams()
  const linkId = params.id as string
  const isNew = linkId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [link, setLink] = useState<FooterLink | null>(null)

  const [category, setCategory] = useState('about')
  const [labelZh, setLabelZh] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [url, setUrl] = useState('')
  const [isExternal, setIsExternal] = useState(false)
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!isNew) {
      fetchLink()
    }
  }, [linkId])

  const fetchLink = async () => {
    try {
      const res = await fetch(`/api/admin/footer-links/${linkId}`)
      const data = await res.json()

      if (data.success) {
        setLink(data.data)
        setCategory(data.data.category)
        setLabelZh(data.data.labelZh)
        setLabelEn(data.data.labelEn)
        setUrl(data.data.url)
        setIsExternal(data.data.isExternal)
        setSortOrder(data.data.sortOrder)
        setIsActive(data.data.isActive)
      } else {
        alert('导航不存在')
        router.push('/admin/footer-links')
      }
    } catch (error) {
      console.error('Failed to fetch footer link:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!labelZh || !labelEn || !url) {
      alert('请填写所有必填字段')
      return
    }

    setSaving(true)
    try {
      const body = {
        category,
        labelZh,
        labelEn,
        url,
        isExternal,
        sortOrder,
        isActive,
      }

      const res = isNew
        ? await fetch('/api/admin/footer-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/admin/footer-links/${linkId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      const data = await res.json()

      if (data.success) {
        alert(isNew ? '创建成功' : '更新成功')
        router.push('/admin/footer-links')
      } else {
        alert(data.error?.message || '操作失败')
      }
    } catch (error) {
      console.error('Failed to save footer link:', error)
      alert('操作失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? '新增底部导航' : '编辑底部导航'}
            </h1>
            {!isNew && link && (
              <p className="text-sm text-muted-foreground font-mono">{linkId}</p>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>

      {/* 表单 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本信息 */}
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">基本信息</h2>

          <div className="space-y-2">
            <Label htmlFor="category">分组名称 *</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="labelZh">导航名称 (中文) *</Label>
            <Input
              id="labelZh"
              value={labelZh}
              onChange={(e) => setLabelZh(e.target.value)}
              placeholder="例如：关于我们"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="labelEn">导航名称 (英文) *</Label>
            <Input
              id="labelEn"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              placeholder="例如：About Us"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL 地址 *</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={isExternal ? "例如：baidu.com 或 https://baidu.com" : "例如：/about"}
            />
            <p className="text-xs text-muted-foreground">
              {isExternal
                ? "外部链接将自动添加 https:// 前缀（如未指定协议）"
                : "内部链接应以 / 开头"}
            </p>
          </div>
        </div>

        {/* 配置选项 */}
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">配置选项</h2>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">排序</Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">数字越小越靠前</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>外部链接</Label>
              <p className="text-xs text-muted-foreground">在新窗口打开</p>
            </div>
            <button
              type="button"
              onClick={() => setIsExternal(!isExternal)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isExternal ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isExternal ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>启用状态</Label>
              <p className="text-xs text-muted-foreground">禁用后前台不显示</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {!isNew && link && (
            <div className="pt-4 border-t text-sm text-muted-foreground">
              <p>创建时间：{formatDateTime(link.createdAt)}</p>
              <p>更新时间：{formatDateTime(link.updatedAt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}