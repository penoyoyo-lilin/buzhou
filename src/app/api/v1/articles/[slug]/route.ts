/**
 * 文章 API
 * GET /api/v1/articles/[slug]?format=json|markdown
 * 返回文章的 JSON 或 Markdown 格式
 */

import { NextRequest, NextResponse } from 'next/server'
import { articleService } from '@/services/article.service'
import { renderService } from '@/services/render.service'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'

function buildAgentDiscoveryHeaders(origin: string, slug: string, lang: 'zh' | 'en') {
  const articleEndpoint = `${origin}/api/v1/articles/${slug}`
  const jsonFormatUrl = `${articleEndpoint}?format=json&lang=${lang}`
  const markdownFormatUrl = `${articleEndpoint}?format=markdown&lang=${lang}`
  const docsUrl = `${origin}/${lang}/api-docs`
  const link = [
    `<${jsonFormatUrl}>; rel="alternate"; type="application/json"`,
    `<${markdownFormatUrl}>; rel="alternate"; type="text/markdown"`,
    `<${docsUrl}>; rel="describedby"; type="text/html"`,
  ].join(', ')

  return {
    articleEndpoint,
    jsonFormatUrl,
    markdownFormatUrl,
    docsUrl,
    link,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') as 'json' | 'markdown' | null
    const lang = (searchParams.get('lang') as 'zh' | 'en') || 'zh'
    const discovery = buildAgentDiscoveryHeaders(request.nextUrl.origin, slug, lang)

    const article = await articleService.findBySlug(slug)

    if (!article) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // JSON 格式
    if (format === 'json') {
      const jsonContent = renderService.toJsonResponse(article, lang)
      return new NextResponse(jsonContent, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Article-Id': article.id,
          'X-Article-Slug': article.slug,
          'X-Agent-API-Endpoint': discovery.articleEndpoint,
          'X-Agent-API-Docs': discovery.docsUrl,
          'Link': discovery.link,
        },
      })
    }

    // Markdown 格式
    if (format === 'markdown') {
      const markdownContent = renderService.toMarkdown(article, lang)
      return new NextResponse(markdownContent, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'X-Article-Id': article.id,
          'X-Article-Slug': article.slug,
          'X-Agent-API-Endpoint': discovery.articleEndpoint,
          'X-Agent-API-Docs': discovery.docsUrl,
          'Link': discovery.link,
        },
      })
    }

    // 默认返回文章摘要信息
    return NextResponse.json(
      successResponse({
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        domain: article.domain,
        author: article.createdBy,
        tags: article.tags,
        keywords: article.keywords,
        verificationStatus: article.verificationStatus,
        confidenceScore: article.metadata.confidenceScore,
        riskLevel: article.metadata.riskLevel,
        applicableVersions: article.metadata.applicableVersions,
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt,
        createdAt: article.createdAt,
        formats: {
          json: discovery.jsonFormatUrl,
          markdown: discovery.markdownFormatUrl,
        },
      }),
      {
        headers: {
          'X-Agent-API-Endpoint': discovery.articleEndpoint,
          'X-Agent-API-Docs': discovery.docsUrl,
          'Link': discovery.link,
        },
      }
    )
  } catch (error) {
    console.error('Article API error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取文章失败'),
      { status: 500 }
    )
  }
}
