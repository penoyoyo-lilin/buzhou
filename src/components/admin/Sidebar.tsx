'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Users,
  Bot,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Link2,
  Key,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const menuItems = [
  { href: '/admin/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/admin/articles', label: '文章管理', icon: FileText },
  { href: '/admin/verifiers', label: '验证人管理', icon: Users },
  { href: '/admin/agents', label: 'Agent 管理', icon: Bot },
  { href: '/admin/footer-links', label: '底部导航', icon: Link2 },
  { href: '/admin/stats', label: '访问统计', icon: BarChart3 },
  { href: '/admin/internal-key', label: '内部密钥', icon: Key },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-gray-50 dark:bg-gray-900 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b">
        {!collapsed && (
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            不周山
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
              )}
            >
              <Icon className="h-5 w-5" />
              {!collapsed && <span className="ml-3">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t">
        <form action="/api/admin/auth/logout" method="POST">
          <Button
            type="submit"
            variant="ghost"
            className={cn(
              'w-full justify-start text-gray-700 dark:text-gray-300',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-3">登出</span>}
          </Button>
        </form>
      </div>
    </aside>
  )
}