'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Bot, Eye, TrendingUp } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n/translations'

interface StatCardProps {
  title: string
  value: number
  icon: React.ReactNode
  suffix?: string
}

function StatCard({ title, value, icon, suffix = '' }: StatCardProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toLocaleString()
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold text-foreground">
              {formatNumber(value)}
              {suffix && <span className="text-lg text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DataWallProps {
  className?: string
  lang?: 'zh' | 'en'
}

interface Stats {
  articles: { total: number; published: number; weeklyNew: number }
  agents: { active: number }
  apiRequests: { total: number }
}

export function DataWall({ className, lang = 'zh' }: DataWallProps) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/stats')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setStats(data.data)
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [])

  // 统计数据
  const articleCount = stats?.articles?.published ?? 0
  const agentCount = stats?.agents?.active ?? 0
  const apiCalls = stats?.apiRequests?.total ?? 0
  const weeklyNew = stats?.articles?.weeklyNew ?? 0

  return (
    <section className={className}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={t(lang, 'dataWall.articles')}
          value={articleCount}
          icon={<FileText className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title={t(lang, 'dataWall.agents')}
          value={agentCount}
          icon={<Bot className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title={t(lang, 'dataWall.apiCalls')}
          value={apiCalls}
          icon={<Eye className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title={lang === 'zh' ? '本周新增' : 'New This Week'}
          value={weeklyNew}
          suffix={lang === 'zh' ? '篇' : ''}
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
        />
      </div>
    </section>
  )
}