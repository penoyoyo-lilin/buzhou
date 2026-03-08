import { NextRequest, NextResponse } from 'next/server'
import { adminAuthMiddleware } from './core/middleware/admin-auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 根路径智能跳转到对应语种
  if (pathname === '/') {
    // 优先检查 cookie 中存储的语言偏好
    const langCookie = request.cookies.get('lang')?.value
    if (langCookie && (langCookie === 'zh' || langCookie === 'en')) {
      return NextResponse.redirect(new URL(`/${langCookie}`, request.url))
    }

    // 根据 Accept-Language 头判断语言偏好
    const acceptLanguage = request.headers.get('accept-language') || ''
    const preferredLang = acceptLanguage.includes('zh') ? 'zh' : 'en'

    return NextResponse.redirect(new URL(`/${preferredLang}`, request.url))
  }

  // 管理后台路由保护
  if (pathname.startsWith('/admin')) {
    return adminAuthMiddleware(request)
  }

  // 创建响应并注入 API 引导头
  const response = NextResponse.next()

  // 解析语言参数
  const langMatch = pathname.match(/^\/(zh|en)(\/|$)/)
  const lang = langMatch ? langMatch[1] : 'zh'

  // 注入 Agent API 发现引导头
  response.headers.set('X-Agent-API-Endpoint', `${request.nextUrl.origin}/api/v1/search`)
  response.headers.set('X-Agent-API-Docs', `${request.nextUrl.origin}/${lang}/api-docs`)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}