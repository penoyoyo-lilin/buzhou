/**
 * 国际化翻译字典
 */

export type Locale = 'zh' | 'en'

type TranslationDict = {
  common: {
    search: string
    loading: string
    noData: string
    readMore: string
    back: string
    home: string
  }
  nav: {
    home: string
    apiDocs: string
    articles: string
    tags: string
  }
  home: {
    title: string
    subtitle: string
    searchPlaceholder: string
    popularTags: string
    articleCount: string
    noArticles: string
  }
  filter: {
    all: string
    domain: string
    status: string
    agent: string
    mcp: string
    skill: string
    verified: string
    partial: string
    pending: string
  }
  article: {
    viewCount: string
    lastUpdated: string
    codeExample: string
    relatedArticles: string
    qa: string
    // 新增
    articleInfo: string
    articleId: string
    confidenceScore: string
    riskLevel: string
    applicableVersions: string
    verificationRecords: string
    tags: string
    publishedAt: string
    updatedAt: string
    apiAccess: string
    apiAccessDesc: string
    viewApiDocs: string
    // 视图切换
    htmlView: string
    markdownView: string
    jsonView: string
    // 关键词
    keywords: string
    keywordsDesc: string
  }
  footer: {
    copyright: string
    tagline: string
  }
  dataWall: {
    articles: string
    verified: string
    agents: string
    apiCalls: string
  }
  verification: {
    passed: string
    failed: string
    partial: string
    pending: string
    deprecated: string
    // 验证人类型
    officialBot: string
    thirdPartyAgent: string
    humanExpert: string
    // 风险等级
    lowRisk: string
    mediumRisk: string
    highRisk: string
    critical: string
    // 其他
    noRecords: string
    verifierType: string
    runtimeEnv: string
    notes: string
  }
  apiDocs: {
    title: string
    overview: string
    overviewDesc: string
    baseUrl: string
    responseFormat: string
    authentication: string
    noKeyMode: string
    noKeyModeDesc: string
    noKeyModeCurrent: string
    apiKeyMode: string
    apiKeyModeDesc: string
    apiKeyRecommended: string
    endpoints: string
    searchEndpoint: string
    searchEndpointDesc: string
    requestParams: string
    requestExample: string
    responseExample: string
    errorCodes: string
    errorValidation: string
    errorValidationDesc: string
    errorUnauthorized: string
    errorUnauthorizedDesc: string
    errorNotFound: string
    errorNotFoundDesc: string
    errorRateLimited: string
    errorRateLimitedDesc: string
    errorInternal: string
    errorInternalDesc: string
    rateLimit: string
    rateLimitNoKey: string
    rateLimitNoKeyDesc1: string
    rateLimitNoKeyDesc2: string
    rateLimitApiKey: string
    rateLimitApiKeyFree: string
    rateLimitApiKeyPaid: string
    rateLimitApiKeyConcurrent: string
    responseHeaders: string
    responseHeadersDesc: string
    param: string
    type: string
    required: string
    description: string
    errorCode: string
    httpStatus: string
    paramQ: string
    paramQDesc: string
    paramDomain: string
    paramDomainDesc: string
    paramStatus: string
    paramStatusDesc: string
    paramPage: string
    paramPageDesc: string
    paramPageSize: string
    paramPageSizeDesc: string
  }
}

export const translations: Record<Locale, TranslationDict> = {
  zh: {
    // 通用
    common: {
      search: '搜索',
      loading: '加载中...',
      noData: '暂无数据',
      readMore: '阅读更多',
      back: '返回',
      home: '首页',
    },

    // 导航
    nav: {
      home: '首页',
      apiDocs: 'API 文档',
      articles: '文章',
      tags: '标签',
    },

    // 首页
    home: {
      title: '不周山',
      subtitle: 'AI Agent 的可执行知识中枢与技能交易网络',
      searchPlaceholder: '搜索文章、标签或报错信息...',
      popularTags: '热门标签：',
      articleCount: '共找到 {count} 篇文章',
      noArticles: '没有找到相关文章',
    },

    // 筛选
    filter: {
      all: '全部',
      domain: '领域',
      status: '状态',
      agent: 'Agent',
      mcp: 'MCP',
      skill: 'Skill',
      verified: '已验证',
      partial: '部分验证',
      pending: '待验证',
    },

    // 文章
    article: {
      viewCount: '阅读',
      lastUpdated: '更新于',
      codeExample: '代码示例',
      relatedArticles: '相关文章',
      qa: '问答',
      // 新增
      articleInfo: '文章信息',
      articleId: '文章 ID',
      confidenceScore: '置信分数',
      riskLevel: '风险等级',
      applicableVersions: '适用版本',
      verificationRecords: '验证记录',
      tags: '标签',
      publishedAt: '发布于',
      updatedAt: '更新于',
      apiAccess: 'API 访问',
      apiAccessDesc: '通过 REST API 搜索文章',
      viewApiDocs: '查看完整 API 文档 →',
      // 视图切换
      htmlView: 'HTML 视图',
      markdownView: 'Markdown 视图',
      jsonView: 'JSON 视图',
      // 关键词
      keywords: '关键词',
      keywordsDesc: '用于辅助决策的关键词标签',
    },

    // Footer
    footer: {
      copyright: '保留所有权利。',
      tagline: 'AI Agent 的可执行知识中枢',
    },

    // 数据墙
    dataWall: {
      articles: '文章',
      verified: '已验证',
      agents: 'Agent',
      apiCalls: 'API 调用',
    },

    // 验证相关
    verification: {
      passed: '通过',
      failed: '失败',
      partial: '部分通过',
      pending: '待验证',
      deprecated: '已废弃',
      officialBot: '官方机器人',
      thirdPartyAgent: '第三方 Agent',
      humanExpert: '人类专家',
      lowRisk: '低风险',
      mediumRisk: '中风险',
      highRisk: '高风险',
      critical: '严重',
      noRecords: '暂无验证记录',
      verifierType: '验证人类型',
      runtimeEnv: '运行环境',
      notes: '备注',
    },

    // API 文档
    apiDocs: {
      title: 'API 文档',
      overview: '概述',
      overviewDesc: '不周山提供 RESTful API 接口，让 AI Agent 可以高效获取结构化知识数据。所有接口返回 JSON 格式，支持中英双语内容。',
      baseUrl: 'Base URL',
      responseFormat: '统一响应格式',
      authentication: '认证',
      noKeyMode: '免Key模式',
      noKeyModeDesc: '初期开放免Key访问，每个 IP 限流 100 次/分钟。建议后续申请 API Key 获取更高额度。',
      noKeyModeCurrent: '当前可用',
      apiKeyMode: 'API Key',
      apiKeyModeDesc: '在请求头中携带 API Key：',
      apiKeyRecommended: '推荐',
      endpoints: 'API 端点',
      searchEndpoint: '搜索接口，支持关键词、领域、状态筛选',
      searchEndpointDesc: '搜索接口，支持关键词、领域、状态筛选',
      requestParams: '请求参数',
      requestExample: '请求示例',
      responseExample: '响应示例',
      errorCodes: '错误码说明',
      errorValidation: '参数验证失败',
      errorValidationDesc: '参数验证失败',
      errorUnauthorized: '未授权访问',
      errorUnauthorizedDesc: '未授权访问',
      errorNotFound: '资源不存在',
      errorNotFoundDesc: '资源不存在',
      errorRateLimited: '请求过于频繁',
      errorRateLimitedDesc: '请求过于频繁',
      errorInternal: '服务器内部错误',
      errorInternalDesc: '服务器内部错误',
      rateLimit: '限流策略',
      rateLimitNoKey: '免Key模式',
      rateLimitNoKeyDesc1: 'IP 限流：100 次/分钟',
      rateLimitNoKeyDesc2: '适合低频访问场景',
      rateLimitApiKey: 'API Key 模式',
      rateLimitApiKeyFree: '1,000 次/天（免费）',
      rateLimitApiKeyPaid: '30,000 次/月（付费）',
      rateLimitApiKeyConcurrent: '支持更高的并发',
      responseHeaders: '响应头说明',
      responseHeadersDesc: '所有页面响应都会注入以下 HTTP 头，方便 Agent 自动发现 API 端点：',
      param: '参数',
      type: '类型',
      required: '必填',
      description: '说明',
      errorCode: '错误码',
      httpStatus: 'HTTP 状态',
      paramQ: '搜索关键词',
      paramQDesc: '搜索关键词',
      paramDomain: '领域筛选（agent/mcp/skill）',
      paramDomainDesc: '领域筛选（agent/mcp/skill）',
      paramStatus: '验证状态筛选',
      paramStatusDesc: '验证状态筛选',
      paramPage: '页码，默认 1',
      paramPageDesc: '页码，默认 1',
      paramPageSize: '每页数量，默认 20，最大 100',
      paramPageSizeDesc: '每页数量，默认 20，最大 100',
    },
  },

  en: {
    // Common
    common: {
      search: 'Search',
      loading: 'Loading...',
      noData: 'No data available',
      readMore: 'Read More',
      back: 'Back',
      home: 'Home',
    },

    // Navigation
    nav: {
      home: 'Home',
      apiDocs: 'API Docs',
      articles: 'Articles',
      tags: 'Tags',
    },

    // Home
    home: {
      title: 'Buzhou',
      subtitle: 'Executable Knowledge Hub & Skill Trading Network for AI Agents',
      searchPlaceholder: 'Search articles, tags, or error messages...',
      popularTags: 'Popular Tags:',
      articleCount: 'Found {count} articles',
      noArticles: 'No articles found',
    },

    // Filter
    filter: {
      all: 'All',
      domain: 'Domain',
      status: 'Status',
      agent: 'Agent',
      mcp: 'MCP',
      skill: 'Skill',
      verified: 'Verified',
      partial: 'Partial',
      pending: 'Pending',
    },

    // Article
    article: {
      viewCount: 'views',
      lastUpdated: 'Updated',
      codeExample: 'Code Examples',
      relatedArticles: 'Related Articles',
      qa: 'FAQ',
      // 新增
      articleInfo: 'Article Info',
      articleId: 'Article ID',
      confidenceScore: 'Confidence Score',
      riskLevel: 'Risk Level',
      applicableVersions: 'Applicable Versions',
      verificationRecords: 'Verification Records',
      tags: 'Tags',
      publishedAt: 'Published',
      updatedAt: 'Updated',
      apiAccess: 'API Access',
      apiAccessDesc: 'Search articles via REST API',
      viewApiDocs: 'View Full API Docs →',
      // 视图切换
      htmlView: 'HTML View',
      markdownView: 'Markdown View',
      jsonView: 'JSON View',
      // 关键词
      keywords: 'Keywords',
      keywordsDesc: 'Keywords for decision-making assistance',
    },

    // Footer
    footer: {
      copyright: 'All rights reserved.',
      tagline: 'Executable Knowledge Hub for AI Agents',
    },

    // Data Wall
    dataWall: {
      articles: 'Articles',
      verified: 'Verified',
      agents: 'Agents',
      apiCalls: 'API Calls',
    },

    // Verification
    verification: {
      passed: 'Passed',
      failed: 'Failed',
      partial: 'Partial',
      pending: 'Pending',
      deprecated: 'Deprecated',
      officialBot: 'Official Bot',
      thirdPartyAgent: 'Third-party Agent',
      humanExpert: 'Human Expert',
      lowRisk: 'Low Risk',
      mediumRisk: 'Medium Risk',
      highRisk: 'High Risk',
      critical: 'Critical',
      noRecords: 'No verification records',
      verifierType: 'Verifier Type',
      runtimeEnv: 'Runtime Environment',
      notes: 'Notes',
    },

    // API Docs
    apiDocs: {
      title: 'API Documentation',
      overview: 'Overview',
      overviewDesc: 'Buzhou provides RESTful API interfaces for AI Agents to efficiently access structured knowledge data. All endpoints return JSON format with bilingual content support.',
      baseUrl: 'Base URL',
      responseFormat: 'Response Format',
      authentication: 'Authentication',
      noKeyMode: 'No Key Mode',
      noKeyModeDesc: 'Initially open for keyless access with 100 requests/minute per IP. Recommend applying for an API Key for higher quotas.',
      noKeyModeCurrent: 'Currently Available',
      apiKeyMode: 'API Key',
      apiKeyModeDesc: 'Include API Key in request header:',
      apiKeyRecommended: 'Recommended',
      endpoints: 'API Endpoints',
      searchEndpoint: 'Search endpoint with keyword, domain, and status filters',
      searchEndpointDesc: 'Search endpoint with keyword, domain, and status filters',
      requestParams: 'Request Parameters',
      requestExample: 'Request Example',
      responseExample: 'Response Example',
      errorCodes: 'Error Codes',
      errorValidation: 'Validation Error',
      errorValidationDesc: 'Parameter validation failed',
      errorUnauthorized: 'Unauthorized',
      errorUnauthorizedDesc: 'Unauthorized access',
      errorNotFound: 'Not Found',
      errorNotFoundDesc: 'Resource not found',
      errorRateLimited: 'Rate Limited',
      errorRateLimitedDesc: 'Too many requests',
      errorInternal: 'Internal Error',
      errorInternalDesc: 'Internal server error',
      rateLimit: 'Rate Limiting',
      rateLimitNoKey: 'No Key Mode',
      rateLimitNoKeyDesc1: 'IP limit: 100 requests/minute',
      rateLimitNoKeyDesc2: 'Suitable for low-frequency access',
      rateLimitApiKey: 'API Key Mode',
      rateLimitApiKeyFree: '1,000 requests/day (Free)',
      rateLimitApiKeyPaid: '30,000 requests/month (Paid)',
      rateLimitApiKeyConcurrent: 'Higher concurrency support',
      responseHeaders: 'Response Headers',
      responseHeadersDesc: 'All page responses include the following HTTP headers for Agent auto-discovery:',
      param: 'Parameter',
      type: 'Type',
      required: 'Required',
      description: 'Description',
      errorCode: 'Error Code',
      httpStatus: 'HTTP Status',
      paramQ: 'Search keyword',
      paramQDesc: 'Search keyword',
      paramDomain: 'Domain filter (agent/mcp/skill)',
      paramDomainDesc: 'Domain filter (agent/mcp/skill)',
      paramStatus: 'Verification status filter',
      paramStatusDesc: 'Verification status filter',
      paramPage: 'Page number, default 1',
      paramPageDesc: 'Page number, default 1',
      paramPageSize: 'Page size, default 20, max 100',
      paramPageSizeDesc: 'Page size, default 20, max 100',
    },
  },
}

/**
 * 获取翻译文本
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.')
  let value: unknown = translations[locale]

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      // 回退到中文
      value = translations.zh
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = (value as Record<string, unknown>)[fallbackKey]
        } else {
          return key
        }
      }
      break
    }
  }

  if (typeof value !== 'string') {
    return key
  }

  // 替换参数
  if (params) {
    return Object.entries(params).reduce(
      (str, [paramKey, paramValue]) => str.replace(`{${paramKey}}`, String(paramValue)),
      value
    )
  }

  return value
}