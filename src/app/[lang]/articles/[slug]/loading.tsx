import { Skeleton } from '@/components/ui/skeleton'

export default function ArticleLoading() {
  return (
    <article className="container py-8">
      {/* 头部骨架 */}
      <header className="mb-8">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-10 w-full max-w-2xl mb-4" />
        <Skeleton className="h-6 w-full max-w-3xl mb-4" />
        <Skeleton className="h-4 w-48" />
      </header>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-8">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <aside className="space-y-6">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </aside>
      </div>
    </article>
  )
}