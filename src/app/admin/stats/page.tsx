'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { Activity, Users, Bot, FileText, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

// API 响应类型
interface StatsData {
  overview: {
    articles: { total: number; published: number }
    views: { total: number; inPeriod: number }
    apiRequests: { total: number; inPeriod: number }
    metrics: {
      apiCalls: number
      pageViews: number
      humanViews: number
      botViews: number
    }
    agents: { active: number }
    verifiers: { active: number }
  }
  traffic: {
    total: number
    humanViews: number
    botViews: number
    timeSeries: Array<{ time: string; count: number }>
    topPages: Array<{ path: string; views: number }>
  }
  api: {
    total: number
    successRate: number
    avgResponseTime: number
    timeSeries: Array<{ time: string; count: number }>
    topEndpoints: Array<{
      endpoint: string
      requests: number
      avgResponseTime: number
      errorRate: number
    }>
  }
  details: {
    apiCalls: Array<{
      createdAt: string
      endpoint: string
      method: string
      statusCode: number
      responseTime: number
      userAgent: string | null
      source: string
      clientType: 'human' | 'bot'
      botVendor: string
    }>
    pageViews: Array<{
      createdAt: string
      path: string
      referrer: string | null
      userAgent: string | null
      clientType: 'human' | 'bot'
      botVendor: string
    }>
    botVendors?: {
      pageViews: Array<{ vendor: string; count: number }>
      apiCalls: Array<{ vendor: string; count: number }>
    }
  }
  period: {
    type: string
    start: string
    end: string
  }
}

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  icon: React.ElementType
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getPresetRange(type: 'day' | 'week' | 'month') {
  const end = new Date()
  const start = new Date(end)
  if (type === 'week') start.setDate(end.getDate() - 6)
  if (type === 'month') start.setDate(end.getDate() - 29)
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  }
}

function botVendorLabel(vendor: string): string {
  const map: Record<string, string> = {
    human: 'Human',
    google: 'Google',
    bing: 'Bing',
    bytedance: 'ByteDance',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    perplexity: 'Perplexity',
    other_bot: 'Other Bot',
  }
  return map[vendor] || vendor
}

function StatCard({ title, value, change, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className="text-xs text-muted-foreground">
            <span className={change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
              {change}
            </span>
            {' '}较前期
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function StatsPage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('day')
  const defaultRange = getPresetRange('day')
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [detailTab, setDetailTab] = useState<'api' | 'page'>('api')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)
      try {
        const query = new URLSearchParams({
          startDate,
          endDate,
        })
        const response = await fetch(`/api/admin/stats?${query.toString()}`)
        if (!response.ok) throw new Error('获取统计数据失败')
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          throw new Error(result.error?.message || '获取统计数据失败')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取统计数据失败')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [startDate, endDate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">暂无数据</p>
      </div>
    )
  }

  // 转换时间序列数据格式
  const trafficData = data.traffic.timeSeries.map((item) => ({
    time: item.time,
    views: item.count,
  }))

  const apiData = data.api.timeSeries.map((item) => ({
    time: item.time,
    requests: item.count,
  }))

  const metrics = data.overview.metrics || {
    apiCalls: data.api.total,
    pageViews: data.traffic.total,
    humanViews: data.traffic.humanViews,
    botViews: data.traffic.botViews,
  }

  const applyPreset = (preset: 'day' | 'week' | 'month') => {
    const range = getPresetRange(preset)
    setPeriod(preset)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">访问统计</h1>
          <p className="text-muted-foreground">平台流量和 API 调用统计</p>
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-muted/20">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="stats-start-date" className="text-xs text-muted-foreground">开始日期</label>
            <input
              id="stats-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setPeriod('custom')
                setStartDate(e.target.value)
              }}
              className="h-9 rounded border bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="stats-end-date" className="text-xs text-muted-foreground">结束日期</label>
            <input
              id="stats-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setPeriod('custom')
                setEndDate(e.target.value)
              }}
              className="h-9 rounded border bg-background px-3 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyPreset('day')}
              className={`px-3 py-1 text-sm rounded ${period === 'day' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              今日
            </button>
            <button
              onClick={() => applyPreset('week')}
              className={`px-3 py-1 text-sm rounded ${period === 'week' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              近 7 天
            </button>
            <button
              onClick={() => applyPreset('month')}
              className={`px-3 py-1 text-sm rounded ${period === 'month' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              近 30 天
            </button>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            当前范围：{startDate} ~ {endDate}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="API 调用次数"
          value={formatNumber(metrics.apiCalls)}
          icon={Activity}
        />
        <StatCard
          title="页面访问次数"
          value={formatNumber(metrics.pageViews)}
          icon={Users}
        />
        <StatCard
          title="人类访问次数"
          value={formatNumber(metrics.humanViews)}
          icon={Bot}
        />
        <StatCard
          title="BOT 访问次数"
          value={formatNumber(metrics.botViews)}
          icon={FileText}
        />
      </div>

      {/* 流量图表 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>流量趋势</CardTitle>
            <CardDescription>
              {period === 'day' ? '今日 24 小时' : period === 'week' ? '过去 7 天' : period === 'month' ? '过去 30 天' : '自定义日期范围'}页面浏览量
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {trafficData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" stroke="#8884d8" name="浏览量" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API 调用分布</CardTitle>
            <CardDescription>
              {period === 'day' ? '今日 24 小时' : period === 'week' ? '过去 7 天' : period === 'month' ? '过去 30 天' : '自定义日期范围'}API 调用量
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {apiData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apiData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="requests" fill="#8884d8" name="请求数" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 排行榜 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>热门页面</CardTitle>
            <CardDescription>访问量最高的页面</CardDescription>
          </CardHeader>
          <CardContent>
            {data.traffic.topPages.length > 0 ? (
              <div className="space-y-4">
                {data.traffic.topPages.map((page, index) => (
                  <div key={page.path} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      <p className="font-medium truncate max-w-[200px]" title={page.path}>
                        {page.path}
                      </p>
                    </div>
                    <p className="font-medium">{formatNumber(page.views)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">暂无数据</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>热门 API 端点</CardTitle>
            <CardDescription>调用量最高的 API</CardDescription>
          </CardHeader>
          <CardContent>
            {data.api.topEndpoints.length > 0 ? (
              <div className="space-y-4">
                {data.api.topEndpoints.map((endpoint, index) => (
                  <div key={endpoint.endpoint} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium truncate max-w-[200px]" title={endpoint.endpoint}>
                          {endpoint.endpoint}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {endpoint.avgResponseTime}ms | {endpoint.errorRate}% 错误
                        </p>
                      </div>
                    </div>
                    <p className="font-medium">{formatNumber(endpoint.requests)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">暂无数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 访问明细 */}
      <Card>
        <CardHeader>
          <CardTitle>访问明细</CardTitle>
          <CardDescription>按类型查看 API 调用与网页访问，并区分人类与 Bot 厂商</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailTab('api')}
              className={`px-3 py-1 text-sm rounded ${detailTab === 'api' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              API 调用明细
            </button>
            <button
              onClick={() => setDetailTab('page')}
              className={`px-3 py-1 text-sm rounded ${detailTab === 'page' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              网页访问明细
            </button>
          </div>

          {detailTab === 'api' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(data.details.botVendors?.apiCalls || []).map((item) => (
                  <span key={`api-${item.vendor}`} className="rounded-full border px-2 py-1">
                    {botVendorLabel(item.vendor)}: {item.count}
                  </span>
                ))}
              </div>
              <div className="rounded border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2">时间</th>
                      <th className="px-3 py-2">请求</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2">耗时</th>
                      <th className="px-3 py-2">来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.details.apiCalls.length > 0 ? (
                      data.details.apiCalls.map((row, idx) => (
                        <tr key={`${row.createdAt}-${row.endpoint}-${idx}`} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs">{row.method} {row.endpoint}</div>
                          </td>
                          <td className="px-3 py-2">{row.statusCode}</td>
                          <td className="px-3 py-2">{row.responseTime} ms</td>
                          <td className="px-3 py-2">{row.source || 'Bot'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">暂无数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(data.details.botVendors?.pageViews || []).map((item) => (
                  <span key={`pv-${item.vendor}`} className="rounded-full border px-2 py-1">
                    {botVendorLabel(item.vendor)}: {item.count}
                  </span>
                ))}
              </div>
              <div className="rounded border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2">时间</th>
                      <th className="px-3 py-2">页面路径</th>
                      <th className="px-3 py-2">Referrer</th>
                      <th className="px-3 py-2">来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.details.pageViews.length > 0 ? (
                      data.details.pageViews.map((row, idx) => (
                        <tr key={`${row.createdAt}-${row.path}-${idx}`} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.path}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.referrer || '-'}</td>
                          <td className="px-3 py-2">
                            {row.clientType === 'human' ? 'Human' : `Bot / ${botVendorLabel(row.botVendor)}`}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">暂无数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
