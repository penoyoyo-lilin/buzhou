'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export function getLocaleHomePath(lang?: string): string {
  if (lang === 'zh' || lang === 'en') {
    return `/${lang}`
  }
  return '/'
}

export default function ArticleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams<{ lang?: string }>()
  const homeHref = getLocaleHomePath(params?.lang)

  return (
    <article className="container py-8">
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">加载失败</h1>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <div className="flex justify-center gap-4">
          <Button onClick={reset}>重试</Button>
          <Button variant="outline" asChild>
            <Link href={homeHref}>返回首页</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
