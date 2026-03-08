'use client'

import { useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  placeholder?: string
  defaultValue?: string
  onSearch: (query: string) => void
  className?: string
}

export function SearchBar({
  placeholder = '搜索文章、标签或报错信息...',
  defaultValue = '',
  onSearch,
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSearch(value.trim())
    },
    [value, onSearch]
  )

  const handleClear = useCallback(() => {
    setValue('')
    onSearch('')
  }, [onSearch])

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-10 pr-10 h-12 text-base"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  )
}

// 热门标签
interface PopularTagsProps {
  tags: { name: string; count: number }[]
  onTagClick: (tag: string) => void
  selectedTag?: string
  className?: string
}

export function PopularTags({ tags, onTagClick, selectedTag, className }: PopularTagsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => {
        const isSelected = selectedTag === tag.name
        return (
          <Button
            key={tag.name}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'text-xs transition-all',
              isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            onClick={() => onTagClick(isSelected ? '' : tag.name)}
          >
            {tag.name}
            <span className={cn('ml-1', isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
              ({tag.count})
            </span>
          </Button>
        )
      })}
    </div>
  )
}