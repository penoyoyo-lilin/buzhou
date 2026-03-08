'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './button'

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string
  language?: string
  filename?: string | null
  showCopy?: boolean
  showLineNumbers?: boolean
}

function CodeBlock({
  code,
  language = 'text',
  filename,
  showCopy = true,
  showLineNumbers = false,
  className,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split('\n')

  return (
    <div className={cn('relative rounded-lg border bg-muted/50 flex flex-col', className)} {...props}>
      {/* 头部：语言和文件名 */}
      {(language || filename) && (
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-sm shrink-0">
          <div className="flex items-center gap-2">
            {language && (
              <span className="font-mono text-xs text-muted-foreground uppercase">
                {language}
              </span>
            )}
            {filename && (
              <span className="text-xs text-muted-foreground">{filename}</span>
            )}
          </div>
          {showCopy && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                  <span className="text-xs">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">复制</span>
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* 代码区域 */}
      <div className="overflow-auto flex-1 min-h-0">
        <pre className="p-4 text-sm font-mono">
          {showLineNumbers ? (
            <code className="block">
              {lines.map((line, index) => (
                <div key={index} className="flex hover:bg-muted/30">
                  <span className="pr-4 text-right text-muted-foreground select-none w-12 shrink-0">
                    {index + 1}
                  </span>
                  <span className="whitespace-pre flex-1">
                    {line || ' '}
                  </span>
                </div>
              ))}
            </code>
          ) : (
            <code className={`language-${language} whitespace-pre`}>
              {code}
            </code>
          )}
        </pre>
      </div>

      {/* 复制按钮（无头部时显示） */}
      {showCopy && !language && !filename && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 h-7 px-2"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  )
}

export { CodeBlock }