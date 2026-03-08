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

// API 响应类型
interface StatsData {
  overview: {
    articles: { total: number; published: number }
    views: { total: number; inPeriod: number }
    apiRequests: { total: number; inPeriod: number }
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
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/admin/stats?period=${period}`)
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
  }, [period])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">访问统计</h1>
          <p className="text-muted-foreground">平台流量和 API 调用统计</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriod('day')}
            className={`px-3 py-1 text-sm rounded ${period === 'day' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            今日
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1 text-sm rounded ${period === 'week' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            本周
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1 text-sm rounded ${period === 'month' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            本月
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="页面浏览量"
          value={formatNumber(data.traffic.total)}
          icon={Activity}
        />
        <StatCard
          title="人类访问"
          value={formatNumber(data.traffic.humanViews)}
          icon={Users}
        />
        <StatCard
          title="API 调用量"
          value={formatNumber(data.api.total)}
          icon={Bot}
        />
        <StatCard
          title="成功率"
          value={`${data.api.successRate}%`}
          icon={FileText}
        />
      </div>

      {/* 流量图表 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>流量趋势</CardTitle>
            <CardDescription>
              {period === 'day' ? '今日 24 小时' : period === 'week' ? '过去 7 天' : '过去 30 天'}页面浏览量
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
              {period === 'day' ? '今日 24 小时' : period === 'week' ? '过去 7 天' : '过去 30 天'}API 调用量
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
    </div>
  )
}