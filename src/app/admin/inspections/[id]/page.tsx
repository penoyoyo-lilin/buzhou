'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import type { InspectionFinding, InspectionRun, RiskLevel } from '@/types'

interface RepairDetail {
  id: string
  articleId: string
  inspectionRunId: string | null
  findingIds: string[]
  mode: string
  status: string
  diff: Record<string, unknown>
  evidenceSummary: Record<string, unknown>
  validatorResult: Record<string, unknown>
  riskBefore: string
  riskAfter: string | null
  appliedAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

interface InspectionDetail {
  run: InspectionRun
  findings: InspectionFinding[]
  repairs: RepairDetail[]
}

function severityVariant(severity: RiskLevel) {
  const mapping: Record<RiskLevel, 'low' | 'medium' | 'high' | 'critical'> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    critical: 'critical',
  }
  return mapping[severity]
}

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>()
  const [detail, setDetail] = useState<InspectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/inspections/${params.id}`)
      const result = await response.json()
      if (result.success) {
        setDetail(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch inspection detail:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [params.id])

  const retry = async () => {
    setRetrying(true)
    try {
      await fetch(`/api/admin/inspections/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      await fetchDetail()
    } catch (error) {
      console.error('Failed to retry inspection:', error)
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link href="/admin/inspections" className="text-sm text-primary hover:underline">
          返回巡检中心
        </Link>
        <div className="rounded-lg border border-dashed p-8 text-muted-foreground">
          巡检任务不存在
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/inspections" className="text-sm text-primary hover:underline">
            返回巡检中心
          </Link>
          <h1 className="mt-2 text-3xl font-bold">巡检详情</h1>
          <p className="font-mono text-sm text-muted-foreground">{detail.run.id}</p>
        </div>
        <Button variant="secondary" onClick={retry} disabled={retrying}>
          {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          重试
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">文章 ID</div>
          <div className="mt-2 font-mono text-xs">{detail.run.articleId}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">状态</div>
          <div className="mt-2"><Badge variant="outline">{detail.run.status}</Badge></div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Finding / AutoFix</div>
          <div className="mt-2 text-xl font-semibold">
            {detail.run.findingsCount} / {detail.run.autoFixableCount}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">触发来源</div>
          <div className="mt-2"><Badge variant="outline">{detail.run.triggerSource}</Badge></div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Finding</h2>
        <div className="space-y-3">
          {detail.findings.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-muted-foreground">本次巡检未发现问题</div>
          ) : detail.findings.map((finding) => (
            <div key={finding.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={severityVariant(finding.severity)}>{finding.severity}</Badge>
                <Badge variant={finding.autoFixable ? 'verified' : 'outline'}>
                  {finding.autoFixable ? 'auto-fixable' : 'manual'}
                </Badge>
                <Badge variant="outline">{finding.status}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{finding.ruleKey}</span>
              </div>
              <div className="font-medium">{finding.title}</div>
              {finding.fieldPath && (
                <div className="text-sm text-muted-foreground">字段: {finding.fieldPath}</div>
              )}
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(finding.evidence, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Repair</h2>
        <div className="space-y-3">
          {detail.repairs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-muted-foreground">暂无自动修复记录</div>
          ) : detail.repairs.map((repair) => (
            <div key={repair.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{repair.mode}</Badge>
                <Badge variant={repair.status === 'applied' ? 'verified' : repair.status === 'failed' ? 'failed' : 'partial'}>
                  {repair.status}
                </Badge>
                {repair.lastError && (
                  <span className="inline-flex items-center gap-1 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {repair.lastError}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                创建于 {formatDateTime(repair.createdAt)}
                {repair.appliedAt ? `，应用于 ${formatDateTime(repair.appliedAt)}` : ''}
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(repair.diff, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
