'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pagination as PaginationType } from '@/types'

interface PaginationProps {
  pagination: PaginationType
  onPageChange: (page: number) => void
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, totalPages } = pagination

  if (totalPages <= 1) return null

  const pages = []
  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-sm text-muted-foreground">
        第 {page} 页，共 {totalPages} 页
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {start > 1 && (
          <>
            <Button
              variant={page === 1 ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(1)}
            >
              1
            </Button>
            {start > 2 && <span className="px-2">...</span>}
          </>
        )}
        {pages.map((p) => (
          <Button
            key={p}
            variant={page === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-2">...</span>}
            <Button
              variant={page === totalPages ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}