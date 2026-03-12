'use client'

import { useState, useEffect } from 'react'
import { redirect, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/admin/Sidebar'
import { Header } from '@/components/admin/Header'
import type { Admin } from '@/types'

export function AdminLayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    // 不需要在登录页面检查认证状态
    if (isLoginPage) {
      setLoading(false)
      return
    }

    async function fetchAdmin() {
      try {
        const res = await fetch('/api/admin/auth/me')
        if (res.ok) {
          const data = await res.json()
          setAdmin(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch admin:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAdmin()
  }, [isLoginPage])

  // 登录页面直接渲染子组件（在loading检查之前）
  if (isLoginPage) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!admin) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col">
        <Header admin={admin} />
        <main className="flex-1 p-6 bg-gray-100 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  )
}
