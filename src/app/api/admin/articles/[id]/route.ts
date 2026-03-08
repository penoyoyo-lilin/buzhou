import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { idSchema } from '@/lib/validators'

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

    // PostgreSQL 的 Json 类型返回已解析的对象
    const parsedArticle = {
      ...article,
      title: article.title ? (article.title as { zh: string; en: string }) : { zh: '', en: '' },
      summary: article.summary ? (article.summary as { zh: string; en: string }) : { zh: '', en: '' },
      content: article.content ? (article.content as { zh: string; en: string }) : { zh: '', en: '' },
      tags: article.tags ? (article.tags as string[]) : [],
      keywords: article.keywords ? (article.keywords as string[]) : [],
      codeBlocks: article.codeBlocks || [],
      metadata: article.metadata || {},
      qaPairs: article.qaPairs || [],
      relatedIds: article.relatedIds ? (article.relatedIds as string[]) : [],
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

    // 构建更新数据（JSON 字段需要序列化为字符串）
    const updateData: Record<string, unknown> = {}

    if (body.title) {
      updateData.title = JSON.stringify(body.title)
    }
    if (body.summary) {
      updateData.summary = JSON.stringify(body.summary)
    }
    if (body.content) {
      updateData.content = JSON.stringify(body.content)
    }
    if (body.domain) {
      updateData.domain = body.domain
    }
    if (body.tags !== undefined) {
      updateData.tags = JSON.stringify(body.tags)
    }
    if (body.codeBlocks !== undefined) {
      updateData.codeBlocks = JSON.stringify(body.codeBlocks)
    }
    if (body.metadata !== undefined) {
      updateData.metadata = JSON.stringify(body.metadata)
    }
    if (body.qaPairs !== undefined) {
      updateData.qaPairs = JSON.stringify(body.qaPairs)
    }
    if (body.relatedIds !== undefined) {
      updateData.relatedIds = JSON.stringify(body.relatedIds)
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