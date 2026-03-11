'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { t, type Locale } from '@/lib/i18n/translations'
import type { ArticleDomain, VerificationStatus } from '@/types'

interface FilterBarProps {
  lang?: 'zh' | 'en'
}

export function FilterBar({ lang = 'zh' }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentDomain = searchParams.get('domain') as ArticleDomain | null
  const currentStatus = searchParams.get('status') as VerificationStatus | null

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-4">
      {/* 分类筛选 */}
      <div className="w-40">
        <Select
          value={currentDomain || 'all'}
          onValueChange={(value) => updateFilter('domain', value === 'all' ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={lang === 'zh' ? '全部分类' : 'All Categories'} />
          </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === 'zh' ? '全部分类' : 'All Categories'}</SelectItem>
              <SelectItem value="agent">{t(lang, 'filter.agent')}</SelectItem>
              <SelectItem value="mcp">{t(lang, 'filter.mcp')}</SelectItem>
              <SelectItem value="skill">{t(lang, 'filter.skill')}</SelectItem>
              <SelectItem value="foundation">{t(lang, 'filter.foundation')}</SelectItem>
              <SelectItem value="transport">{t(lang, 'filter.transport')}</SelectItem>
              <SelectItem value="tools_filesystem">{t(lang, 'filter.tools_filesystem')}</SelectItem>
            <SelectItem value="tools_postgres">{t(lang, 'filter.tools_postgres')}</SelectItem>
            <SelectItem value="tools_github">{t(lang, 'filter.tools_github')}</SelectItem>
            <SelectItem value="error_codes">{t(lang, 'filter.error_codes')}</SelectItem>
            <SelectItem value="scenarios">{t(lang, 'filter.scenarios')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 验证状态筛选 */}
      <div className="w-40">
        <Select
          value={currentStatus || 'all'}
          onValueChange={(value) => updateFilter('status', value === 'all' ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={lang === 'zh' ? '全部状态' : 'All Status'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === 'zh' ? '全部状态' : 'All Status'}</SelectItem>
            <SelectItem value="verified">{t(lang, 'filter.verified')}</SelectItem>
            <SelectItem value="partial">{t(lang, 'filter.partial')}</SelectItem>
            <SelectItem value="pending">{t(lang, 'filter.pending')}</SelectItem>
            <SelectItem value="failed">{lang === 'zh' ? '验证失败' : 'Failed'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
