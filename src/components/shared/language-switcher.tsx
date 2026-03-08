'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LanguageSwitcherProps {
  lang: 'zh' | 'en'
}

export function LanguageSwitcher({ lang }: LanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = (newLang: string) => {
    // 替换 URL 中的语言部分
    const segments = pathname.split('/')
    if (segments[1] === 'zh' || segments[1] === 'en') {
      segments[1] = newLang
    } else {
      segments.splice(1, 0, newLang)
    }
    router.push(segments.join('/'))
  }

  return (
    <Select value={lang} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[80px] h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="zh">中文</SelectItem>
        <SelectItem value="en">EN</SelectItem>
      </SelectContent>
    </Select>
  )
}