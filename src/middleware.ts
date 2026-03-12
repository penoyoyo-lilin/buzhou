import { NextRequest, NextResponse } from 'next/server'
import { adminAuthMiddleware } from './core/middleware/admin-auth'

function resolvePreferredLang(request: NextRequest, pathname: string): 'zh' | 'en' {
  if (pathname.startsWith('/en')) return 'en'
  if (pathname.startsWith('/zh')) return 'zh'

  const langCookie = request.cookies.get('lang')?.value
  if (langCookie === 'zh' || langCookie === 'en') return langCookie

  const acceptLanguage = request.headers.get('accept-language') || ''
  return acceptLanguage.includes('zh') ? 'zh' : 'en'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 根路径智能跳转到对应语种
  if (pathname === '/') {
    const preferredLang = resolvePreferredLang(request, pathname)

    return NextResponse.redirect(new URL(`/${preferredLang}`, request.url))
  }

  // 管理后台路由保护
  if (pathname.startsWith('/admin')) {
    const adminResponse = adminAuthMiddleware(request)
    adminResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    return adminResponse
  }

  const preferredLang = resolvePreferredLang(request, pathname)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-buzhou-lang', preferredLang === 'zh' ? 'zh-CN' : 'en-US')

  // 创建响应并注入 API 引导头
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // 解析语言参数
  const lang = preferredLang

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
