/**
 * Schema.org JSON-LD 组件
 * 用于在页面中嵌入结构化数据
 */

interface SchemaOrgProps {
  data: object | object[]
}

export function SchemaOrg({ data }: SchemaOrgProps) {
  const jsonData = Array.isArray(data) ? data : [data]
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonData)
      }}
    />
  )
}

/**
 * 组织 Schema
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "不周山 | Buzhou",
    "description": "面向 AI Agent 的可执行知识中枢和技能交易网络",
    "url": "https://www.buzhou.io",
    "logo": "https://www.buzhou.io/logo.png",
    "sameAs": []
  }
}

/**
 * 网站 Schema（带搜索功能）
 */
export function getWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "不周山 | Buzhou",
    "url": "https://www.buzhou.io",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://www.buzhou.io/api/v1/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  }
}

/**
 * 文章 Schema
 */
export function getArticleSchema(params: {
  title: string
  description: string
  url: string
  datePublished: string
  dateModified: string
  author?: string
  dateCreated?: string
  inLanguage?: 'zh-CN' | 'en-US'
  keywords?: string[]
  articleSection?: string
  mainEntityOfPage?: string
  isAccessibleForFree?: boolean
  about?: string[]
  image?: string
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": params.title,
    "description": params.description,
    "url": params.url,
    "datePublished": params.datePublished,
    "dateModified": params.dateModified,
    "author": {
      "@type": "Organization",
      "name": params.author || "Buzhou"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Buzhou",
      "url": "https://www.buzhou.io"
    }
  }

  if (params.dateCreated) {
    schema.dateCreated = params.dateCreated
  }
  if (params.inLanguage) {
    schema.inLanguage = params.inLanguage
  }
  if (params.keywords && params.keywords.length > 0) {
    schema.keywords = params.keywords
  }
  if (params.articleSection) {
    schema.articleSection = params.articleSection
  }
  if (params.mainEntityOfPage) {
    schema.mainEntityOfPage = params.mainEntityOfPage
  }
  if (params.isAccessibleForFree !== undefined) {
    schema.isAccessibleForFree = params.isAccessibleForFree
  }
  if (params.about && params.about.length > 0) {
    schema.about = params.about.map((item) => ({
      "@type": "Thing",
      "name": item,
    }))
  }
  if (params.image) {
    schema.image = params.image
  }

  return schema
}

/**
 * 技术文章 Schema
 */
export function getTechArticleSchema(params: {
  title: string
  description: string
  url: string
  datePublished: string
  dateModified: string
  author?: string
  dependencies?: string[]
  proficiencyLevel?: 'Beginner' | 'Intermediate' | 'Advanced'
  inLanguage?: 'zh-CN' | 'en-US'
  keywords?: string[]
  mainEntityOfPage?: string
  isAccessibleForFree?: boolean
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": params.title,
    "description": params.description,
    "url": params.url,
    "datePublished": params.datePublished,
    "dateModified": params.dateModified,
    "author": {
      "@type": "Organization",
      "name": params.author || "Buzhou"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Buzhou",
      "url": "https://www.buzhou.io"
    }
  }

  if (params.dependencies && params.dependencies.length > 0) {
    schema.dependencies = params.dependencies
  }

  if (params.proficiencyLevel) {
    schema.proficiencyLevel = params.proficiencyLevel
  }
  if (params.inLanguage) {
    schema.inLanguage = params.inLanguage
  }
  if (params.keywords && params.keywords.length > 0) {
    schema.keywords = params.keywords
  }
  if (params.mainEntityOfPage) {
    schema.mainEntityOfPage = params.mainEntityOfPage
  }
  if (params.isAccessibleForFree !== undefined) {
    schema.isAccessibleForFree = params.isAccessibleForFree
  }

  return schema
}

/**
 * FAQ Schema
 */
export function getFAQPageSchema(params: {
  url: string
  items: Array<{ question: string; answer: string }>
}) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "url": params.url,
    "mainEntity": params.items.map((item) => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  }
}

/**
 * Breadcrumb Schema
 */
export function getBreadcrumbSchema(params: {
  lang: 'zh' | 'en'
  title: string
  url: string
}) {
  const homeName = params.lang === 'zh' ? '首页' : 'Home'
  const articlesName = params.lang === 'zh' ? '文章' : 'Articles'
  const baseUrl = 'https://www.buzhou.io'

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": homeName,
        "item": `${baseUrl}/${params.lang}`,
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": articlesName,
        "item": `${baseUrl}/${params.lang}`,
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": params.title,
        "item": params.url,
      },
    ],
  }
}

/**
 * API 参考文档 Schema
 */
export function getAPIReferenceSchema(params: {
  name: string
  description: string
  url: string
  documentationUrl?: string
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "APIReference",
    "name": params.name,
    "description": params.description,
    "url": params.url
  }

  if (params.documentationUrl) {
    schema.documentation = params.documentationUrl
  }

  return schema
}
