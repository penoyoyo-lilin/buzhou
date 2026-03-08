import { NextRequest, NextResponse } from 'next/server'

/**
 * 验证管理员认证（用于 API 路由）
 * 注意：此函数只能在 Node.js Runtime 中使用，不能在 Middleware 中使用
 */
export async function verifyAdminAuth(request: NextRequest): Promise<{ id: string; email: string; role: string } | null> {
  // 动态导入 Prisma，避免在 Edge Runtime 中加载
  const { default: prisma } = await import('@/core/db/client')

  const sessionToken = request.cookies.get('admin_session')?.value

  if (!sessionToken) {
    return null
  }

  // 查询 Session
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { admin: true },
  })

  if (!session || new Date(session.expiresAt) < new Date()) {
    return null
  }

  return {
    id: session.admin.id,
    email: session.admin.email,
    role: session.admin.role,
  }
}

/**
 * 管理后台认证中间件
 */
export function adminAuthMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 登录页不需要认证
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // 检查 Session Token
  const sessionToken = request.cookies.get('admin_session')?.value

  if (!sessionToken) {
    const loginUrl = new URL('/admin/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // TODO: 验证 Session Token 是否有效
  // 这里暂时只检查 Cookie 是否存在，实际应该验证 Token

  return NextResponse.next()
}