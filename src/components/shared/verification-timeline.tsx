'use client'

import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { VerificationRecord } from '@/types'
import { t, type Locale } from '@/lib/i18n/translations'

interface VerificationTimelineProps {
  records: VerificationRecord[]
  locale?: Locale
  className?: string
}

const resultConfig = {
  passed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  partial: {
    icon: AlertCircle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
}

const verifierTypeKeys: Record<string, string> = {
  official_bot: 'officialBot',
  third_party_agent: 'thirdPartyAgent',
  human_expert: 'humanExpert',
}

export function VerificationTimeline({ records, locale = 'zh', className }: VerificationTimelineProps) {
  const labels = locale === 'zh'
    ? {
        recordId: '记录 ID',
        verifierId: '验证人 ID',
        unknownOs: '未知系统',
        unknownRuntime: '未知运行时',
        unknownVersion: '未知版本',
      }
    : {
        recordId: 'Record ID',
        verifierId: 'Verifier ID',
        unknownOs: 'Unknown OS',
        unknownRuntime: 'Unknown Runtime',
        unknownVersion: 'Unknown Version',
      }

  if (!records || records.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t(locale, 'verification.noRecords')}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {records.map((record, index) => {
        const config = resultConfig[record.result] || resultConfig.partial
        const Icon = config.icon

        // 防御性处理：确保 verifier 存在
        const verifierName = record.verifier?.name || 'Unknown'
        const verifierType = record.verifier?.type || 'official_bot'
        const verifierId = record.verifier?.id || 0

        return (
          <div
            key={record.id}
            className={cn(
              'relative pl-10',
              index !== records.length - 1 && 'pb-4'
            )}
          >
            {index !== records.length - 1 && (
              <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />
            )}

            {/* 时间轴节点 */}
            <div
              className={cn(
                'absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border border-background',
                config.bgColor
              )}
            >
              <Icon className={cn('h-4 w-4', config.color)} />
            </div>

            {/* 验证记录卡片 */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={record.result === 'passed' ? 'verified' : record.result === 'failed' ? 'failed' : 'partial'}>
                    {t(locale, `verification.${record.result}`)}
                  </Badge>
                  <span className="font-medium">{verifierName}</span>
                  <Badge variant="outline" className="text-xs">
                    {t(locale, `verification.${verifierTypeKeys[verifierType] || verifierType}`)}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">{formatDate(record.verifiedAt, locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
              </div>

              <div className="mt-4 grid gap-3 border-t pt-4 text-sm">
                <div className="grid gap-2 md:grid-cols-[120px_1fr] md:items-center">
                  <span className="text-muted-foreground">{labels.recordId}</span>
                  <span className="font-mono break-all">{record.id}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-[120px_1fr] md:items-center">
                  <span className="text-muted-foreground">{labels.verifierId}</span>
                  <span className="font-mono">{verifierId}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-[120px_1fr] md:items-start">
                  <span className="text-muted-foreground">{t(locale, 'verification.runtimeEnv')}</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {record.environment?.os || labels.unknownOs}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {record.environment?.runtime || labels.unknownRuntime}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {record.environment?.version || labels.unknownVersion}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[120px_1fr] md:items-start">
                  <span className="text-muted-foreground">{t(locale, 'verification.notes')}</span>
                  <p className="whitespace-pre-wrap break-words text-foreground">
                    {record.notes || '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
