import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('admin_session')?.value

    if (sessionToken) {
      // 删除 Session
      await prisma.session.deleteMany({
        where: { token: sessionToken },
      }).catch(() => {
        // 忽略删除错误
      })
    }

    // 创建重定向响应 - 使用 307 状态码确保 POST 请求后正确重定向
    const loginUrl = new URL('/admin/login', request.url)
    const response = NextResponse.redirect(loginUrl, 307)

    // 清除 Cookie
    response.cookies.set('admin_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    // 即使出错也重定向到登录页
    const loginUrl = new URL('/admin/login', request.url)
    return NextResponse.redirect(loginUrl, 307)
  }
}