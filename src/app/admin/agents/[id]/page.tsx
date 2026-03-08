'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Key, Copy, Check } from 'lucide-react'
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
import type { AgentStatus } from '@/types'

interface AgentDetail {
  id: string
  name: string
  description: string
  owner: string
  apiKeyPrefix: string | null
  apiKeyCreatedAt: string | null
  dailyLimit: number
  monthlyLimit: number
  usedToday: number
  usedThisMonth: number
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgResponseTime: number
  status: AgentStatus
  createdAt: string
  lastAccessAt: string | null
}

export default function AgentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const agentId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<AgentStatus>('active')
  const [dailyLimit, setDailyLimit] = useState(1000)
  const [monthlyLimit, setMonthlyLimit] = useState(30000)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchAgent()
  }, [agentId])

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`)
      const data = await res.json()

      if (data.success) {
        const a = data.data
        setAgent(a)
        setName(a.name)
        setStatus(a.status)
        setDailyLimit(a.dailyLimit)
        setMonthlyLimit(a.monthlyLimit)
      } else {
        alert('Agent 不存在')
        router.push('/admin/agents')
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!agent) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          status,
          dailyLimit,
          monthlyLimit,
        }),
      })

      const data = await res.json()

      if (data.success) {
        alert('更新成功')
        fetchAgent()
      } else {
        alert(data.error?.message || '更新失败')
      }
    } catch (error) {
      console.error('Failed to update agent:', error)
      alert('更新失败')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateApiKey = async () => {
    if (!confirm('生成新的 API Key 将使旧 Key 失效，确定继续吗？')) return

    try {
      const res = await fetch(`/api/admin/agents/${agentId}/api-key`, {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        setNewApiKey(data.data.key)
        fetchAgent()
      } else {
        alert(data.error?.message || '生成失败')
      }
    } catch (error) {
      console.error('Failed to generate API key:', error)
      alert('生成失败')
    }
  }

  const handleCopy = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!agent) return null

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{agentId}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>所有者</Label>
              <Input value={agent.owner} disabled />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input value={agent.description} disabled />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AgentStatus)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="active">活跃</option>
                <option value="suspended">已暂停</option>
                <option value="revoked">已吊销</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>创建时间</Label>
              <p className="text-sm">{formatDateTime(agent.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* API Key 管理 */}
        <Card>
          <CardHeader>
            <CardTitle>API Key 管理</CardTitle>
            <CardDescription>管理 Agent 的 API 访问密钥</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">当前 Key 前缀</p>
                <p className="font-mono">{agent.apiKeyPrefix || '未生成'}</p>
              </div>
              <Button variant="outline" onClick={handleGenerateApiKey}>
                <Key className="h-4 w-4 mr-2" />
                生成新 Key
              </Button>
            </div>
            {agent.apiKeyCreatedAt && (
              <p className="text-xs text-muted-foreground">
                创建于 {formatDateTime(agent.apiKeyCreatedAt)}
              </p>
            )}

            {/* 新生成的 Key */}
            {newApiKey && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  ⚠️ 请立即保存此 Key，关闭后将无法再次查看
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded font-mono text-sm break-all">
                    {newApiKey}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 额度配置 */}
        <Card>
          <CardHeader>
            <CardTitle>额度配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>日限额</Label>
              <Input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                已使用: {agent.usedToday} ({Math.round((agent.usedToday / agent.dailyLimit) * 100)}%)
              </p>
            </div>
            <div className="space-y-2">
              <Label>月限额</Label>
              <Input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                已使用: {agent.usedThisMonth} ({Math.round((agent.usedThisMonth / agent.monthlyLimit) * 100)}%)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 调用统计 */}
        <Card>
          <CardHeader>
            <CardTitle>调用统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{agent.totalRequests.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">总请求数</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-green-600">{agent.successRequests.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">成功请求</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-red-600">{agent.failedRequests.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">失败请求</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{agent.avgResponseTime.toFixed(0)}ms</p>
                <p className="text-sm text-muted-foreground">平均响应时间</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}