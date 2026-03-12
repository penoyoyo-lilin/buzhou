import Link from 'next/link'

interface TagsPageProps {
  params: { lang: 'zh' | 'en' }
}

export default function TagsPage({ params }: TagsPageProps) {
  const isZh = params.lang === 'zh'

  return (
    <div className="container py-10 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">
        {isZh ? '标签索引' : 'Tag Index'}
      </h1>
      <p className="text-muted-foreground leading-7">
        {isZh
          ? '当前版本可在首页通过搜索框与热门标签快速筛选内容。'
          : 'In this version, use the home search box and popular tags to quickly filter content.'}
      </p>
      <Link href={`/${params.lang}`} className="text-primary hover:underline">
        {isZh ? '前往首页筛选' : 'Go to Home Search'}
      </Link>
    </div>
  )
}
