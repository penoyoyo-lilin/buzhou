import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { loginSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证输入
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '输入验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const { email, password } = result.data

    // 查找管理员
    const admin = await prisma.admin.findUnique({
      where: { email },
    })

    if (!admin) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_CREDENTIALS, '邮箱或密码错误'),
        { status: 401 }
      )
    }

    // 检查状态
    if (admin.status !== 'active') {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, '账号已被禁用'),
        { status: 403 }
      )
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_CREDENTIALS, '邮箱或密码错误'),
        { status: 401 }
      )
    }

    // 创建 Session
    const sessionToken = nanoid(32)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 小时

    await prisma.session.create({
      data: {
        adminId: admin.id,
        token: sessionToken,
        expiresAt,
      },
    })

    // 更新最后登录时间
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    })

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'login',
        entityType: 'session',
        entityId: sessionToken,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    })

    // 设置 Cookie
    const response = NextResponse.json(
      successResponse({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      })
    )

    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '登录失败'),
      { status: 500 }
    )
  }
}