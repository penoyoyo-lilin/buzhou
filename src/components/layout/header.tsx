'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { t, type Locale } from '@/lib/i18n/translations'

interface HeaderProps {
  lang?: 'zh' | 'en'
}

export function Header({ lang = 'zh' }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // 同步 URL 参数变化
  useEffect(() => {
    const q = searchParams.get('q') || ''
    if (q !== searchValue) {
      setSearchValue(q)
    }
  }, [searchParams])

  const handleSearch = useCallback((query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, searchParams, router])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(searchValue.trim())
  }, [searchValue, handleSearch])

  const handleClear = useCallback(() => {
    setSearchValue('')
    handleSearch('')
  }, [handleSearch])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        {/* Logo */}
        <Link href={`/${lang}`} className="flex items-center space-x-2 shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            {lang === 'zh' ? '不周山' : 'Buzhou'}
          </span>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {lang === 'zh' ? 'Buzhou' : '不周山'}
          </span>
        </Link>

        {/* 搜索框 */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t(lang, 'home.searchPlaceholder')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="pl-10 pr-10 h-9 text-sm bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-colors"
          />
          {searchValue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </form>

        {/* 导航 */}
        <nav className="flex items-center gap-4">
          <Link
            href={`/${lang}`}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
          >
            {t(lang, 'nav.home')}
          </Link>
          <Link
            href={`/${lang}/api-docs`}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
          >
            {t(lang, 'nav.apiDocs')}
          </Link>
          <LanguageSwitcher lang={lang} />
        </nav>
      </div>
    </header>
  )
}