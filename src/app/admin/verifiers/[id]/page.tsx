'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import type { Verifier, VerifierType, VerifierStatus } from '@/types'

export default function VerifierDetailPage() {
  const router = useRouter()
  const params = useParams()
  const verifierId = params.id as string
  const isNew = verifierId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [verifier, setVerifier] = useState<Verifier | null>(null)
  const [formData, setFormData] = useState({
    type: 'official_bot' as VerifierType,
    name: '',
    description: '',
    status: 'active' as VerifierStatus,
  })

  useEffect(() => {
    if (!isNew) {
      fetchVerifier()
    }
  }, [verifierId])

  const fetchVerifier = async () => {
    try {
      const res = await fetch(`/api/admin/verifiers/${verifierId}`)
      const data = await res.json()

      if (data.success) {
        setVerifier(data.data)
        setFormData({
          type: data.data.type,
          name: data.data.name,
          description: data.data.description || '',
          status: data.data.status,
        })
      } else {
        alert('验证人不存在')
        router.push('/admin/verifiers')
      }
    } catch (error) {
      console.error('Failed to fetch verifier:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!isNew && !verifier) return

    setSaving(true)
    try {
      const url = isNew ? '/api/admin/verifiers' : `/api/admin/verifiers/${verifierId}`
      const method = isNew ? 'POST' : 'PUT'
      const body = isNew
        ? { type: formData.type, name: formData.name, description: formData.description }
        : { status: formData.status }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (data.success) {
        alert(isNew ? '验证人创建成功' : '更新成功')
        router.push('/admin/verifiers')
      } else {
        alert(data.error?.message || '保存失败')
      }
    } catch (error) {
      console.error('Failed to save verifier:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除此验证人吗？此操作不可撤销。')) return

    try {
      const res = await fetch(`/api/admin/verifiers/${verifierId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        alert('验证人已删除')
        router.push('/admin/verifiers')
      } else {
        alert(data.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete verifier:', error)
      alert('删除失败')
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
              {isNew ? '新建验证人' : verifier?.name || '验证人详情'}
            </h1>
            {!isNew && (
              <p className="text-sm text-muted-foreground font-mono">{verifierId}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>验证人的基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="验证人名称"
                disabled={!isNew}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">类型</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as VerifierType })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                disabled={!isNew}
              >
                <option value="official_bot">官方机器人</option>
                <option value="third_party_agent">第三方 Agent</option>
                <option value="human_expert">人类专家</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="验证人描述（可选）"
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm"
              disabled={!isNew}
            />
          </div>

          {!isNew && (
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as VerifierStatus })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="active">活跃</option>
                <option value="suspended">已暂停</option>
                <option value="retired">已退役</option>
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 非新建模式显示统计信息 */}
      {!isNew && verifier && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* 信誉信息 */}
          <Card>
            <CardHeader>
              <CardTitle>信誉信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">信誉分</span>
                <span className="text-2xl font-bold">{verifier.reputation.score}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">信誉等级</span>
                <Badge>
                  {verifier.reputation.level === 'beginner' && '新手'}
                  {verifier.reputation.level === 'intermediate' && '中级'}
                  {verifier.reputation.level === 'expert' && '专家'}
                  {verifier.reputation.level === 'master' && '大师'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 验证统计 */}
          <Card>
            <CardHeader>
              <CardTitle>验证统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{verifier.stats.totalVerifications}</div>
                  <div className="text-sm text-muted-foreground">总验证</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{verifier.stats.passedCount}</div>
                  <div className="text-sm text-muted-foreground">通过</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{verifier.stats.failedCount}</div>
                  <div className="text-sm text-muted-foreground">失败</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{verifier.stats.partialCount}</div>
                  <div className="text-sm text-muted-foreground">部分</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 认证信息 */}
          <Card>
            <CardHeader>
              <CardTitle>认证信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">已认证</span>
                <Badge variant={verifier.credentials.verified ? 'verified' : 'partial'}>
                  {verifier.credentials.verified ? '是' : '否'}
                </Badge>
              </div>
              {verifier.credentials.publicKey && (
                <div>
                  <Label className="text-muted-foreground">公钥</Label>
                  <p className="mt-1 font-mono text-xs break-all">{verifier.credentials.publicKey}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 创建时间 */}
          <Card>
            <CardHeader>
              <CardTitle>时间信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-muted-foreground">创建时间</Label>
                <p className="mt-1">{formatDateTime(verifier.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}