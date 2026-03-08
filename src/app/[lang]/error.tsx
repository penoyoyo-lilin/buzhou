'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <h2 className="text-xl font-semibold mb-4">出错了</h2>
      <p className="text-muted-foreground mb-4">{error.message || '发生了未知错误'}</p>
      <Button onClick={reset}>重试</Button>
    </div>
  )
}