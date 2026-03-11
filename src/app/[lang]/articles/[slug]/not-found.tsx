'use client'

import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export function getLocaleHomePath(lang?: string): string {
  if (lang === 'zh' || lang === 'en') {
    return `/${lang}`
  }
  return '/'
}

export default function ArticleNotFound() {
  const params = useParams<{ lang?: string }>()
  const homeHref = getLocaleHomePath(params?.lang)

  return (
    <article className="container py-8">
      <div className="text-center py-16">
        <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">文章不存在</h1>
        <p className="text-muted-foreground mb-6">
          抱歉，您访问的文章不存在或已被删除。
        </p>
        <Button asChild>
          <Link href={homeHref}>返回首页</Link>
        </Button>
      </div>
    </article>
  )
}
