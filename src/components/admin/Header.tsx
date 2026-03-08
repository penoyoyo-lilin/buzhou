'use client'

import { useEffect, useState } from 'react'
import { Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Admin } from '@/types'

interface HeaderProps {
  admin: Admin | null
}

export function Header({ admin }: HeaderProps) {
  return (
    <header className="flex items-center h-16 px-6 border-b bg-white dark:bg-gray-950">
      <div className="flex-1" />

      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">
                {admin?.name || '管理员'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{admin?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {admin?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action="/api/admin/auth/logout" method="POST" className="w-full">
                <button type="submit" className="w-full text-left">
                  登出
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}