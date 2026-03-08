'use client'

import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeBlock } from '@/components/ui/code-block'
import { t, type Locale } from '@/lib/i18n/translations'

interface ArticleViewTabsProps {
  htmlContent: React.ReactNode
  markdownContent: string
  jsonContent: string
  locale: Locale
}

export function ArticleViewTabs({
  htmlContent,
  markdownContent,
  jsonContent,
  locale,
}: ArticleViewTabsProps) {
  return (
    <Tabs defaultValue="html" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="html">
          {t(locale, 'article.htmlView')}
        </TabsTrigger>
        <TabsTrigger value="markdown">
          {t(locale, 'article.markdownView')}
        </TabsTrigger>
        <TabsTrigger value="json">
          {t(locale, 'article.jsonView')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="html" className="mt-0">
        {htmlContent}
      </TabsContent>

      <TabsContent value="markdown" className="mt-0">
        <div className="max-h-[600px] overflow-auto rounded-lg border">
          <CodeBlock
            code={markdownContent}
            language="markdown"
            showCopy={true}
            showLineNumbers={false}
            className="h-full"
          />
        </div>
      </TabsContent>

      <TabsContent value="json" className="mt-0">
        <div className="max-h-[600px] overflow-auto rounded-lg border">
          <CodeBlock
            code={jsonContent}
            language="json"
            showCopy={true}
            showLineNumbers={true}
            className="h-full"
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}