'use client'

import { CheckCircle2, XCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { cn, formatDateTime } from '@/lib/utils'
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        const isExpanded = expandedId === record.id

        // 防御性处理：确保 verifier 存在
        const verifierName = record.verifier?.name || 'Unknown'
        const verifierType = record.verifier?.type || 'official_bot'

        return (
          <div
            key={record.id}
            className={cn(
              'relative pl-8 pb-4',
              index !== records.length - 1 && 'border-l-2 border-muted ml-3'
            )}
          >
            {/* 时间轴节点 */}
            <div
              className={cn(
                'absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center',
                config.bgColor
              )}
            >
              <Icon className={cn('h-4 w-4', config.color)} />
            </div>

            {/* 验证记录卡片 */}
            <div className="bg-muted/30 rounded-lg p-4 ml-2">
              {/* 头部 */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={record.result === 'passed' ? 'verified' : record.result === 'failed' ? 'failed' : 'partial'}>
                    {t(locale, `verification.${record.result}`)}
                  </Badge>
                  <span className="font-medium">{verifierName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{formatDateTime(record.verifiedAt)}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {/* 验证人类型 */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{t(locale, 'verification.verifierType')}：</span>
                    <span>{t(locale, `verification.${verifierTypeKeys[verifierType] || verifierType}`)}</span>
                  </div>

                  {/* 运行环境 */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t(locale, 'verification.runtimeEnv')}：</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        {record.environment?.os || 'Unknown'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {record.environment?.runtime || 'Unknown'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {record.environment?.version || 'Unknown'}
                      </Badge>
                    </div>
                  </div>

                  {/* 备注 */}
                  {record.notes && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t(locale, 'verification.notes')}：</span>
                      <p className="mt-1 text-foreground">{record.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}