import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { idSchema } from '@/lib/validators'

// 辅助函数：安全解析 JSON 字段（兼容 PostgreSQL 和 SQLite）
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (!value) return defaultValue
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return defaultValue
  }
}

/**
 * GET /api/admin/articles/[id]
 * 获取文章详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        verificationRecords: {
          include: {
            verifier: true,
          },
          orderBy: { verifiedAt: 'desc' },
        },
      },
    })

    if (!article) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // PostgreSQL 的 Json 类型返回已解析的对象，SQLite 需要解析
    const parsedArticle = {
      ...article,
      title: parseJsonField(article.title, { zh: '', en: '' }),
      summary: parseJsonField(article.summary, { zh: '', en: '' }),
      content: parseJsonField(article.content, { zh: '', en: '' }),
      tags: parseJsonField(article.tags, [] as string[]),
      keywords: parseJsonField(article.keywords, [] as string[]),
      codeBlocks: parseJsonField(article.codeBlocks, []),
      metadata: parseJsonField(article.metadata, {}),
      qaPairs: parseJsonField(article.qaPairs, []),
      relatedIds: parseJsonField(article.relatedIds, [] as string[]),
      verificationRecords: (article.verificationRecords || []).map((record) => ({
        ...record,
        environment: record.environment as { os: string; runtime: string; version: string },
      })),
    }

    return NextResponse.json(successResponse(parsedArticle))
  } catch (error) {
    console.error('Get article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取文章详情失败'),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/articles/[id]
 * 更新文章
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // 检查文章是否存在
    const existing = await prisma.article.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // 构建更新数据（PostgreSQL Json 类型直接传递对象）
    const updateData: Record<string, unknown> = {}

    if (body.title) {
      updateData.title = body.title
    }
    if (body.summary) {
      updateData.summary = body.summary
    }
    if (body.content) {
      updateData.content = body.content
    }
    if (body.domain) {
      updateData.domain = body.domain
    }
    if (body.tags !== undefined) {
      updateData.tags = body.tags
    }
    if (body.codeBlocks !== undefined) {
      updateData.codeBlocks = body.codeBlocks
    }
    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata
    }
    if (body.qaPairs !== undefined) {
      updateData.qaPairs = body.qaPairs
    }
    if (body.relatedIds !== undefined) {
      updateData.relatedIds = body.relatedIds
    }
    if (body.status) {
      updateData.status = body.status
    }

    const article = await prisma.article.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(successResponse(article))
  } catch (error) {
    console.error('Update article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新文章失败'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/articles/[id]
 * 删除文章
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 检查文章是否存在
    const existing = await prisma.article.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    await prisma.article.delete({
      where: { id },
    })

    return NextResponse.json(successResponse(null))
  } catch (error) {
    console.error('Delete article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '删除文章失败'),
      { status: 500 }
    )
  }
}