'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FileText, Users, Bot, Activity, Loader2 } from 'lucide-react'
import { formatNumber, formatDateTime } from '@/lib/utils'
import Link from 'next/link'

// API 响应类型
interface DashboardStats {
  overview: {
    articles: { total: number; published: number }
    views: { total: number; inPeriod: number }
    apiRequests: { total: number; inPeriod: number }
    agents: { active: number }
    verifiers: { active: number }
  }
}

interface RecentArticle {
  id: string
  slug: string
  title: { zh: string; en: string }
  status: string
  verificationStatus: string
  createdAt: string
  updatedAt: string
}

// 统计卡片组件
function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// 快捷操作卡片
function QuickActions({
  pendingCount,
  todayCount,
}: {
  pendingCount: number
  todayCount: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>快捷操作</CardTitle>
        <CardDescription>最近需要处理的事项</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className={`flex items-center justify-between p-3 rounded-lg ${pendingCount > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-muted'}`}>
            <div>
              <p className="font-medium">待验证文章</p>
              <p className="text-sm text-muted-foreground">
                {pendingCount > 0 ? `${pendingCount} 篇文章等待验证` : '暂无待验证文章'}
              </p>
            </div>
            <Link
              href="/admin/articles?verificationStatus=pending"
              className="text-sm text-primary hover:underline"
            >
              查看
            </Link>
          </div>
          <div className={`flex items-center justify-between p-3 rounded-lg ${todayCount > 0 ? 'bg-blue-50 dark:bg-blue-950' : 'bg-muted'}`}>
            <div>
              <p className="font-medium">今日新增文章</p>
              <p className="text-sm text-muted-foreground">
                {todayCount > 0 ? `${todayCount} 篇新文章已创建` : '今日暂无新文章'}
              </p>
            </div>
            <Link
              href="/admin/articles"
              className="text-sm text-primary hover:underline"
            >
              查看
            </Link>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <div>
              <p className="font-medium">系统状态</p>
              <p className="text-sm text-muted-foreground">服务运行正常</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 最近文章列表
function RecentArticles({ articles }: { articles: RecentArticle[] }) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    }
    const labels: Record<string, string> = {
      published: '已发布',
      draft: '草稿',
      archived: '已归档',
    }
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>最近文章</CardTitle>
        <CardDescription>最新创建或更新的文章</CardDescription>
      </CardHeader>
      <CardContent>
        {articles.length > 0 ? (
          <div className="space-y-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/admin/articles/${article.id}`}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
              >
                <div>
                  <p className="font-medium">{article.title.zh || article.title.en}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(article.updatedAt || article.createdAt)}
                  </p>
                </div>
                {getStatusBadge(article.status)}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无文章</p>
            <Link href="/admin/articles" className="text-sm text-primary hover:underline mt-2 block">
              创建第一篇文章
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true)
      setError(null)
      try {
        // 并行获取统计数据和最近文章
        const [statsRes, articlesRes, pendingRes] = await Promise.all([
          fetch('/api/admin/stats?period=day'),
          fetch('/api/admin/articles?pageSize=5&sortBy=updatedAt&sortOrder=desc'),
          fetch('/api/admin/articles?verificationStatus=pending&pageSize=1'),
        ])

        if (!statsRes.ok || !articlesRes.ok || !pendingRes.ok) {
          throw new Error('获取数据失败')
        }

        const [statsData, articlesData, pendingData] = await Promise.all([
          statsRes.json(),
          articlesRes.json(),
          pendingRes.json(),
        ])

        if (statsData.success) {
          setStats(statsData.data)
        }

        if (articlesData.success) {
          setRecentArticles(articlesData.data.items)
          // 计算今日新增（简化处理，实际应该有专门的 API）
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const todayArticles = articlesData.data.items.filter(
            (a: RecentArticle) => new Date(a.createdAt) >= today
          )
          setTodayCount(todayArticles.length)
        }

        if (pendingData.success) {
          setPendingCount(pendingData.data.pagination.total)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取数据失败')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">仪表盘</h1>
          <p className="text-muted-foreground">欢迎使用不周山管理后台</p>
        </div>
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  const overview = stats?.overview || {
    articles: { total: 0, published: 0 },
    views: { total: 0, inPeriod: 0 },
    apiRequests: { total: 0, inPeriod: 0 },
    agents: { active: 0 },
    verifiers: { active: 0 },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground">欢迎使用不周山管理后台</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="文章总数"
          value={formatNumber(overview.articles.total)}
          description={`${overview.articles.published} 篇已发布`}
          icon={FileText}
        />
        <StatCard
          title="待验证"
          value={pendingCount}
          description="等待沙盒验证"
          icon={Users}
        />
        <StatCard
          title="活跃 Agent"
          value={formatNumber(overview.agents.active)}
          description="已注册应用"
          icon={Bot}
        />
        <StatCard
          title="今日 API 调用"
          value={formatNumber(overview.apiRequests.inPeriod)}
          description={`累计 ${formatNumber(overview.apiRequests.total)} 次`}
          icon={Activity}
        />
      </div>

      {/* 快捷操作和最近文章 */}
      <div className="grid gap-6 md:grid-cols-2">
        <QuickActions pendingCount={pendingCount} todayCount={todayCount} />
        <RecentArticles articles={recentArticles} />
      </div>
    </div>
  )
}