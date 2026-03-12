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
    "url": "https://buzhou.io",
    "logo": "https://buzhou.io/logo.png",
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
    "url": "https://buzhou.io",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://buzhou.io/api/v1/search?q={search_term_string}"
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
}) {
  return {
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
      "url": "https://buzhou.io"
    }
  }
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
      "url": "https://buzhou.io"
    }
  }

  if (params.dependencies && params.dependencies.length > 0) {
    schema.dependencies = params.dependencies
  }

  if (params.proficiencyLevel) {
    schema.proficiencyLevel = params.proficiencyLevel
  }

  return schema
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
