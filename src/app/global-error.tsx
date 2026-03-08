'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
          <h2 className="text-2xl font-bold mb-4">出错了</h2>
          <p className="text-muted-foreground mb-6">{error.message || '发生了未知错误'}</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            重试
          </button>
        </div>
      </body>
    </html>
  )
}