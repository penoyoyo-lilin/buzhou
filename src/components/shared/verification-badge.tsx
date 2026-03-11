import { Badge } from '@/components/ui/badge'
import type { VerificationStatus, ArticleDomain } from '@/types'
import { cn } from '@/lib/utils'
import { t, type Locale } from '@/lib/i18n/translations'

interface VerificationBadgeProps {
  status: VerificationStatus
  locale?: Locale
  className?: string
  showLabel?: boolean
}

export function VerificationBadge({
  status,
  locale = 'zh',
  className,
  showLabel = true,
}: VerificationBadgeProps) {
  const variants: Record<VerificationStatus, 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated'> = {
    verified: 'verified',
    partial: 'partial',
    pending: 'pending',
    failed: 'failed',
    deprecated: 'deprecated',
  }

  return (
    <Badge variant={variants[status]} className={cn('gap-1', className)}>
      {showLabel && <span>{t(locale, `verification.${status}`)}</span>}
    </Badge>
  )
}

// 领域徽章
interface DomainBadgeProps {
  domain: ArticleDomain
  locale?: Locale
  className?: string
}

// 领域分类显示名称映射（使用翻译 key）
const domainTranslationKeys: Record<ArticleDomain, string> = {
  // 原有领域分类
  agent: 'filter.agent',
  mcp: 'filter.mcp',
  skill: 'filter.skill',
  // MVP 内容分类
  foundation: 'filter.foundation',
  transport: 'filter.transport',
  'tools_filesystem': 'filter.toolsFilesystem',
  'tools_postgres': 'filter.toolsPostgres',
  'tools_github': 'filter.toolsGithub',
  'error_codes': 'filter.errorCodes',
  scenarios: 'filter.scenarios',
}

// 领域分类徽章变体映射（映射到现有 Badge variant）
const domainVariants: Record<ArticleDomain, 'agent' | 'mcp' | 'skill' | 'default' | 'secondary'> = {
  agent: 'agent',
  mcp: 'mcp',
  skill: 'skill',
  foundation: 'default',
  transport: 'secondary',
  'tools_filesystem': 'default',
  'tools_postgres': 'default',
  'tools_github': 'default',
  'error_codes': 'secondary',
  scenarios: 'skill',
}

export function DomainBadge({ domain, locale = 'zh', className }: DomainBadgeProps) {
  return (
    <Badge variant={domainVariants[domain]} className={className}>
      {t(locale, domainTranslationKeys[domain])}
    </Badge>
  )
}

// 风险等级徽章
interface RiskBadgeProps {
  risk: 'low' | 'medium' | 'high' | 'critical'
  locale?: Locale
  className?: string
  showLabel?: boolean
}

export function RiskBadge({ risk, locale = 'zh', className, showLabel = true }: RiskBadgeProps) {
  const variants: Record<'low' | 'medium' | 'high' | 'critical', 'low' | 'medium' | 'high' | 'critical'> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    critical: 'critical',
  }

  const riskKeys: Record<'low' | 'medium' | 'high' | 'critical', string> = {
    low: 'lowRisk',
    medium: 'mediumRisk',
    high: 'highRisk',
    critical: 'critical',
  }

  return (
    <Badge variant={variants[risk]} className={className}>
      {showLabel && <span>{t(locale, `verification.${riskKeys[risk]}`)}</span>}
    </Badge>
  )
}