'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, MoreHorizontal, Pencil, Trash2, Star, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (row: T, index: number) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  onFeature?: (row: T) => void
  onDeprecate?: (row: T) => void
  actions?: boolean
  rowKey: keyof T
}

export function DataTable<T extends object>({
  data,
  columns,
  sortKey,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  onFeature,
  onDeprecate,
  actions = true,
  rowKey,
}: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (onSort) {
      onSort(key)
    }
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
                  col.sortable && 'cursor-pointer select-none hover:text-foreground',
                  col.className
                )}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{col.header}</span>
                  {col.sortable && sortKey === col.key && (
                    <span className="text-primary">
                      {sortOrder === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
            {actions && <th className="h-12 px-4 text-right">操作</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="h-24 text-center text-muted-foreground"
              >
                暂无数据
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={String(row[rowKey])} className="border-b hover:bg-muted/50">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3', col.className)}>
                    {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(row)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                        )}
                        {onFeature && (
                          <DropdownMenuItem onClick={() => onFeature(row)}>
                            <Star className="mr-2 h-4 w-4" />
                            置顶
                          </DropdownMenuItem>
                        )}
                        {onDeprecate && (
                          <DropdownMenuItem onClick={() => onDeprecate(row)}>
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            标记失效
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onDelete(row)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}