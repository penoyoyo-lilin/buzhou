import Link from 'next/link'

interface ArticlesPageProps {
  params: { lang: 'zh' | 'en' }
}

export default function ArticlesPage({ params }: ArticlesPageProps) {
  const isZh = params.lang === 'zh'

  return (
    <div className="container py-10 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">
        {isZh ? '文章列表' : 'Articles'}
      </h1>
      <p className="text-muted-foreground leading-7">
        {isZh
          ? '文章列表已整合在首页，支持按分类、验证状态和关键词筛选。'
          : 'The article list is integrated on the home page with domain, verification status, and keyword filters.'}
      </p>
      <Link href={`/${params.lang}`} className="text-primary hover:underline">
        {isZh ? '进入首页浏览文章' : 'Browse Articles on Home'}
      </Link>
    </div>
  )
}
