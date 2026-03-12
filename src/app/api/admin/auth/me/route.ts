export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('admin_session')?.value

    if (!sessionToken) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, '未登录'),
        { status: 401 }
      )
    }

    // 查找 Session
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { admin: true },
    })

    if (!session) {
      const response = NextResponse.json(
        errorResponse(ErrorCodes.SESSION_EXPIRED, 'Session 已过期'),
        { status: 401 }
      )
      response.cookies.set('admin_session', '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/',
      })
      return response
    }

    // 检查是否过期
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } })
      const response = NextResponse.json(
        errorResponse(ErrorCodes.SESSION_EXPIRED, 'Session 已过期'),
        { status: 401 }
      )
      response.cookies.set('admin_session', '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/',
      })
      return response
    }

    return NextResponse.json(
      successResponse({
        id: session.admin.id,
        email: session.admin.email,
        name: session.admin.name,
        role: session.admin.role,
      })
    )
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取用户信息失败'),
      { status: 500 }
    )
  }
}