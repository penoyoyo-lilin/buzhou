'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Trash2, Plus, X, Pencil, Sparkles, ChevronDown, ChevronUp, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import type { Article, ArticleDomain, ArticleStatus } from '@/types'

interface Verifier {
  id: string
  name: string
  type: string
}

interface VerificationRecordInput {
  verifierId: string
  result: 'passed' | 'failed' | 'partial'
  environment: {
    os: string
    runtime: string
    version: string
  }
  notes: string
}

interface ExistingVerificationRecord {
  id: string
  verifierId: string
  verifier?: { id: string; name: string; type: string }
  result: 'passed' | 'failed' | 'partial'
  environment: { os: string; runtime: string; version: string }
  notes?: string
  verifiedAt: string
}

interface QAPair {
  id: string
  question: { zh: string; en: string }
  answer: { zh: string; en: string }
}

interface RelatedArticle {
  id: string
  title: { zh: string; en: string }
  slug: string
}

export default function ArticleEditPage() {
  const router = useRouter()
  const params = useParams()
  const articleId = params.id as string
  const isNew = articleId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [verifiers, setVerifiers] = useState<Verifier[]>([])
  const [article, setArticle] = useState({
    slug: '',
    titleZh: '',
    titleEn: '',
    summaryZh: '',
    summaryEn: '',
    contentZh: '',
    contentEn: '',
    domain: 'agent' as ArticleDomain,
    status: 'draft' as ArticleStatus,
    tags: [] as string[],
    tagInput: '',
  })
  const [verificationRecords, setVerificationRecords] = useState<VerificationRecordInput[]>([])
  const [existingRecords, setExistingRecords] = useState<ExistingVerificationRecord[]>([])
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<VerificationRecordInput>({
    verifierId: '',
    result: 'passed',
    environment: { os: '', runtime: '', version: '' },
    notes: '',
  })

  // AI 生成字段相关状态
  const [qaPairs, setQaPairs] = useState<QAPair[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([])
  const [generating, setGenerating] = useState(false)
  const [qaExpanded, setQaExpanded] = useState(true)
  const [keywordsExpanded, setKeywordsExpanded] = useState(true)
  const [relatedExpanded, setRelatedExpanded] = useState(true)

  useEffect(() => {
    fetchVerifiers()
    if (!isNew) {
      fetchArticle()
    }
  }, [articleId])

  const fetchVerifiers = async () => {
    try {
      const res = await fetch('/api/admin/verifiers?pageSize=100')
      const data = await res.json()
      if (data.success) {
        setVerifiers(data.data.items)
      }
    } catch (error) {
      console.error('Failed to fetch verifiers:', error)
    }
  }

  const fetchArticle = async () => {
    try {
      const res = await fetch(`/api/admin/articles/${articleId}`)
      const data = await res.json()

      if (data.success) {
        const a = data.data as Article & { verificationRecords?: ExistingVerificationRecord[] }
        setArticle({
          slug: a.slug,
          titleZh: a.title.zh,
          titleEn: a.title.en,
          summaryZh: a.summary.zh,
          summaryEn: a.summary.en,
          contentZh: a.content.zh,
          contentEn: a.content.en,
          domain: a.domain,
          status: a.status,
          tags: a.tags,
          tagInput: '',
        })
        // 加载现有验证记录
        if (a.verificationRecords && a.verificationRecords.length > 0) {
          setExistingRecords(a.verificationRecords)
        }
        // 加载 AI 生成字段
        if (a.qaPairs && a.qaPairs.length > 0) {
          setQaPairs(a.qaPairs)
        }
        if (a.keywords && a.keywords.length > 0) {
          setKeywords(a.keywords)
        }
        // 加载关联文章详情
        if (a.relatedIds && a.relatedIds.length > 0) {
          fetchRelatedArticles(a.relatedIds)
        }
      } else {
        alert('文章不存在')
        router.push('/admin/articles')
      }
    } catch (error) {
      console.error('Failed to fetch article:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取关联文章详情
  const fetchRelatedArticles = async (ids: string[]) => {
    try {
      const results: RelatedArticle[] = []
      for (const id of ids.slice(0, 5)) {
        const res = await fetch(`/api/admin/articles/${id}`)
        const data = await res.json()
        if (data.success) {
          results.push({
            id: data.data.id,
            title: data.data.title,
            slug: data.data.slug,
          })
        }
      }
      setRelatedArticles(results)
    } catch (error) {
      console.error('Failed to fetch related articles:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 基础文章数据
      const articlePayload = {
        slug: article.slug,
        title: { zh: article.titleZh, en: article.titleEn },
        summary: { zh: article.summaryZh, en: article.summaryEn },
        content: { zh: article.contentZh, en: article.contentEn },
        domain: article.domain,
        status: article.status,
        tags: article.tags,
      }

      if (isNew) {
        // 新建模式：文章 + 验证记录一起提交
        const payload = {
          ...articlePayload,
          ...(verificationRecords.length > 0 ? { verificationRecords } : {}),
        }

        const res = await fetch('/api/admin/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (data.success) {
          alert('文章创建成功')
          router.push('/admin/articles')
        } else {
          alert(data.error?.message || '保存失败')
        }
      } else {
        // 编辑模式：先更新文章，再创建验证记录
        const res = await fetch(`/api/admin/articles/${articleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(articlePayload),
        })

        const data = await res.json()

        if (data.success) {
          // 如果有新的验证记录，创建它们
          if (verificationRecords.length > 0) {
            for (const record of verificationRecords) {
              await fetch(`/api/admin/articles/${articleId}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
              })
            }
          }
          alert('文章更新成功')
          router.push('/admin/articles')
        } else {
          alert(data.error?.message || '保存失败')
        }
      }
    } catch (error) {
      console.error('Failed to save article:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除此文章吗？此操作不可撤销。')) return

    try {
      const res = await fetch(`/api/admin/articles/${articleId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        alert('文章已删除')
        router.push('/admin/articles')
      } else {
        alert(data.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete article:', error)
      alert('删除失败')
    }
  }

  const handleAddTag = () => {
    const tag = article.tagInput.trim()
    if (tag && !article.tags.includes(tag)) {
      setArticle({ ...article, tags: [...article.tags, tag], tagInput: '' })
    }
  }

  const handleRemoveTag = (tag: string) => {
    setArticle({ ...article, tags: article.tags.filter((t) => t !== tag) })
  }

  // AI 生成字段处理
  const handleGenerateAI = async (types: ('qa' | 'keywords' | 'related')[]) => {
    if (isNew) {
      alert('请先保存文章后再生成 AI 字段')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types }),
      })
      const data = await res.json()
      if (data.success) {
        const results = data.data.results
        const updatedArticle = data.data.article
        // 更新本地状态
        if (results.qaPairs !== undefined && updatedArticle?.qaPairs) {
          setQaPairs(updatedArticle.qaPairs)
        }
        if (results.keywords !== undefined && updatedArticle?.keywords) {
          setKeywords(updatedArticle.keywords)
        }
        if (results.related !== undefined && updatedArticle?.relatedIds) {
          fetchRelatedArticles(updatedArticle.relatedIds)
        }
        // 显示结果
        const messages: string[] = []
        if (results.qaPairs) messages.push(`QA对: ${results.qaPairs}个`)
        if (results.keywords) messages.push(`关键词: ${results.keywords}个`)
        if (results.related) messages.push(`关联文章: ${results.related}个`)
        if (messages.length > 0) {
          alert(`生成完成\n${messages.join('\n')}`)
        } else {
          alert('生成完成，但未产生新内容')
        }
      } else {
        alert(data.error?.message || '生成失败')
      }
    } catch (error) {
      console.error('Failed to generate AI fields:', error)
      alert('生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // 删除 QA 对
  const handleRemoveQAPair = (id: string) => {
    setQaPairs(qaPairs.filter(qa => qa.id !== id))
  }

  // 删除关键词
  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword))
  }

  // 删除关联文章
  const handleRemoveRelatedArticle = (id: string) => {
    setRelatedArticles(relatedArticles.filter(a => a.id !== id))
  }

  const handleAddVerificationRecord = () => {
    if (verifiers.length === 0) return
    setVerificationRecords([
      ...verificationRecords,
      {
        verifierId: verifiers[0]?.id || '',
        result: 'passed',
        environment: { os: '', runtime: '', version: '' },
        notes: '',
      },
    ])
  }

  const handleRemoveVerificationRecord = (index: number) => {
    setVerificationRecords(verificationRecords.filter((_, i) => i !== index))
  }

  const handleUpdateVerificationRecord = (
    index: number,
    field: keyof VerificationRecordInput | 'environment.os' | 'environment.runtime' | 'environment.version',
    value: string
  ) => {
    const updated = [...verificationRecords]
    if (field.startsWith('environment.')) {
      const envField = field.split('.')[1] as 'os' | 'runtime' | 'version'
      updated[index] = {
        ...updated[index],
        environment: { ...updated[index].environment, [envField]: value },
      }
    } else if (field === 'verifierId' || field === 'result' || field === 'notes') {
      if (field === 'result') {
        updated[index] = {
          ...updated[index],
          result: value as 'passed' | 'failed' | 'partial',
        }
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value,
        }
      }
    }
    setVerificationRecords(updated)
  }

  // 开始编辑验证记录
  const handleStartEditRecord = (record: ExistingVerificationRecord) => {
    setEditingRecordId(record.id)
    setEditForm({
      verifierId: record.verifierId,
      result: record.result,
      environment: { ...record.environment },
      notes: record.notes || '',
    })
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingRecordId(null)
    setEditForm({
      verifierId: '',
      result: 'passed',
      environment: { os: '', runtime: '', version: '' },
      notes: '',
    })
  }

  // 保存编辑的验证记录
  const handleSaveEditRecord = async (recordId: string) => {
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/verify/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      const data = await res.json()

      if (data.success) {
        // 更新本地状态
        setExistingRecords(existingRecords.map(r =>
          r.id === recordId
            ? {
                ...r,
                verifierId: editForm.verifierId,
                result: editForm.result,
                environment: editForm.environment,
                notes: editForm.notes,
                verifier: verifiers.find(v => v.id === editForm.verifierId)
                  ? { id: editForm.verifierId, name: verifiers.find(v => v.id === editForm.verifierId)!.name, type: verifiers.find(v => v.id === editForm.verifierId)!.type }
                  : r.verifier,
              }
            : r
        ))
        handleCancelEdit()
      } else {
        alert(data.error?.message || '更新失败')
      }
    } catch (error) {
      console.error('Failed to update verification record:', error)
      alert('更新失败')
    }
  }

  // 删除验证记录
  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('确定要删除此验证记录吗？')) return

    try {
      const res = await fetch(`/api/admin/articles/${articleId}/verify/${recordId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        setExistingRecords(existingRecords.filter(r => r.id !== recordId))
      } else {
        alert(data.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete verification record:', error)
      alert('删除失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? '新建文章' : '编辑文章'}
            </h1>
            {!isNew && (
              <p className="text-sm text-muted-foreground font-mono">
                {articleId}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>文章的基本元数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={article.slug}
                onChange={(e) => setArticle({ ...article, slug: e.target.value })}
                placeholder="article-slug"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">领域</Label>
              <select
                id="domain"
                value={article.domain}
                onChange={(e) => setArticle({ ...article, domain: e.target.value as ArticleDomain })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="agent">Agent</option>
                <option value="mcp">MCP</option>
                <option value="skill">Skill</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">状态</Label>
            <select
              id="status"
              value={article.status}
              onChange={(e) => setArticle({ ...article, status: e.target.value as ArticleStatus })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>标签</Label>
            <div className="flex items-center gap-2">
              <Input
                value={article.tagInput}
                onChange={(e) => setArticle({ ...article, tagInput: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="输入标签后按回车添加"
              />
              <Button variant="secondary" onClick={handleAddTag}>
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 多语言内容 */}
      <Card>
        <CardHeader>
          <CardTitle>内容</CardTitle>
          <CardDescription>支持中英双语</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titleZh">标题 (中文)</Label>
            <Input
              id="titleZh"
              value={article.titleZh}
              onChange={(e) => setArticle({ ...article, titleZh: e.target.value })}
              placeholder="中文标题"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="titleEn">标题 (英文)</Label>
            <Input
              id="titleEn"
              value={article.titleEn}
              onChange={(e) => setArticle({ ...article, titleEn: e.target.value })}
              placeholder="English Title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summaryZh">摘要 (中文)</Label>
            <textarea
              id="summaryZh"
              value={article.summaryZh}
              onChange={(e) => setArticle({ ...article, summaryZh: e.target.value })}
              placeholder="中文摘要"
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summaryEn">摘要 (英文)</Label>
            <textarea
              id="summaryEn"
              value={article.summaryEn}
              onChange={(e) => setArticle({ ...article, summaryEn: e.target.value })}
              placeholder="English Summary"
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentZh">正文 (中文, Markdown)</Label>
            <textarea
              id="contentZh"
              value={article.contentZh}
              onChange={(e) => setArticle({ ...article, contentZh: e.target.value })}
              placeholder="# 中文正文"
              rows={10}
              className="w-full border rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contentEn">正文 (英文, Markdown)</Label>
            <textarea
              id="contentEn"
              value={article.contentEn}
              onChange={(e) => setArticle({ ...article, contentEn: e.target.value })}
              placeholder="# English Content"
              rows={10}
              className="w-full border rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* AI 生成字段 */}
      {!isNew && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  AI 生成字段
                </CardTitle>
                <CardDescription>由 AI 自动生成的辅助内容</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateAI(['qa'])}
                  disabled={generating}
                >
                  {generating ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  生成 QA
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateAI(['keywords'])}
                  disabled={generating}
                >
                  {generating ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  生成关键词
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateAI(['related'])}
                  disabled={generating}
                >
                  {generating ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  生成关联
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleGenerateAI(['qa', 'keywords', 'related'])}
                  disabled={generating}
                >
                  {generating ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  全部生成
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QA 对 */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                onClick={() => setQaExpanded(!qaExpanded)}
              >
                <span className="font-medium">QA 对 ({qaPairs.length})</span>
                {qaExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {qaExpanded && (
                <div className="p-4 pt-0 space-y-4">
                  {qaPairs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无 QA 对，点击上方按钮生成</p>
                  ) : (
                    qaPairs.map((qa) => (
                      <div key={qa.id} className="p-4 border rounded-lg bg-muted/30 relative group">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                          onClick={() => handleRemoveQAPair(qa.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-muted-foreground">问：</span>
                            <span className="text-sm font-medium">{qa.question.zh}</span>
                          </div>
                          <div className="text-xs text-muted-foreground pl-2">{qa.question.en}</div>
                          <div className="mt-3">
                            <span className="text-xs text-muted-foreground">答：</span>
                            <span className="text-sm">{qa.answer.zh}</span>
                          </div>
                          <div className="text-xs text-muted-foreground pl-2">{qa.answer.en}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 关键词 */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                onClick={() => setKeywordsExpanded(!keywordsExpanded)}
              >
                <span className="font-medium">关键词 ({keywords.length})</span>
                {keywordsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {keywordsExpanded && (
                <div className="p-4 pt-0">
                  {keywords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无关键词，点击上方按钮生成</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm group"
                        >
                          {keyword}
                          <button
                            onClick={() => handleRemoveKeyword(keyword)}
                            className="text-yellow-600 hover:text-yellow-800 opacity-0 group-hover:opacity-100"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 关联文章 */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                onClick={() => setRelatedExpanded(!relatedExpanded)}
              >
                <span className="font-medium">关联文章 ({relatedArticles.length})</span>
                {relatedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {relatedExpanded && (
                <div className="p-4 pt-0 space-y-2">
                  {relatedArticles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无关联文章，点击上方按钮生成</p>
                  ) : (
                    relatedArticles.map((related) => (
                      <div
                        key={related.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 group"
                      >
                        <div>
                          <div className="font-medium text-sm">{related.title.zh}</div>
                          <div className="text-xs text-muted-foreground">{related.title.en}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/articles/${related.id}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => handleRemoveRelatedArticle(related.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 验证记录 */}
      <Card>
        <CardHeader>
          <CardTitle>验证记录</CardTitle>
          <CardDescription>
            {isNew ? '添加文章的验证记录（可选）' : '查看和添加验证记录'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 已有验证记录（编辑模式） */}
          {!isNew && existingRecords.length > 0 && (
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-sm text-muted-foreground">已保存的验证记录</h4>
              {existingRecords.map((record) => (
                <div key={record.id} className="p-4 border rounded-lg bg-muted/50">
                  {editingRecordId === record.id ? (
                    // 编辑模式
                    <div className="space-y-4">
                      <div className="flex justify-end gap-2 mb-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEditRecord(record.id)}
                        >
                          保存
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>验证人</Label>
                          <select
                            value={editForm.verifierId}
                            onChange={(e) => setEditForm({ ...editForm, verifierId: e.target.value })}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                          >
                            <option value="">请选择验证人</option>
                            {verifiers.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>验证结果</Label>
                          <select
                            value={editForm.result}
                            onChange={(e) => setEditForm({ ...editForm, result: e.target.value as 'passed' | 'failed' | 'partial' })}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                          >
                            <option value="passed">通过</option>
                            <option value="failed">失败</option>
                            <option value="partial">部分通过</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>操作系统</Label>
                          <Input
                            value={editForm.environment.os}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              environment: { ...editForm.environment, os: e.target.value },
                            })}
                            placeholder="macOS"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>运行时</Label>
                          <Input
                            value={editForm.environment.runtime}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              environment: { ...editForm.environment, runtime: e.target.value },
                            })}
                            placeholder="Node.js"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>版本</Label>
                          <Input
                            value={editForm.environment.version}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              environment: { ...editForm.environment, version: e.target.value },
                            })}
                            placeholder="20.0.0"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>备注</Label>
                        <Input
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="验证备注（可选）"
                        />
                      </div>
                    </div>
                  ) : (
                    // 查看模式
                    <div className="relative">
                      <div className="absolute top-0 right-0 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEditRecord(record)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRecord(record.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">验证人：</span>
                          <span className="font-medium">{record.verifier?.name || record.verifierId}</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">结果：</span>
                          <span className={`font-medium ${
                            record.result === 'passed' ? 'text-green-600' :
                            record.result === 'failed' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {record.result === 'passed' ? '通过' : record.result === 'failed' ? '失败' : '部分通过'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                        <div><span className="text-muted-foreground">OS:</span> {record.environment.os}</div>
                        <div><span className="text-muted-foreground">Runtime:</span> {record.environment.runtime}</div>
                        <div><span className="text-muted-foreground">Version:</span> {record.environment.version}</div>
                      </div>
                      {record.notes && (
                        <div className="mt-2 text-sm"><span className="text-muted-foreground">备注:</span> {record.notes}</div>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">
                        验证时间: {new Date(record.verifiedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 新增验证记录表单 */}
          {verificationRecords.map((record, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-4 relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleRemoveVerificationRecord(index)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>验证人</Label>
                  <select
                    value={record.verifierId}
                    onChange={(e) =>
                      handleUpdateVerificationRecord(index, 'verifierId', e.target.value)
                    }
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">请选择验证人</option>
                    {verifiers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>验证结果</Label>
                  <select
                    value={record.result}
                    onChange={(e) =>
                      handleUpdateVerificationRecord(
                        index,
                        'result',
                        e.target.value as 'passed' | 'failed' | 'partial'
                      )
                    }
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="passed">通过</option>
                    <option value="failed">失败</option>
                    <option value="partial">部分通过</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>操作系统</Label>
                  <Input
                    value={record.environment.os}
                    onChange={(e) =>
                      handleUpdateVerificationRecord(index, 'environment.os', e.target.value)
                    }
                    placeholder="macOS"
                  />
                </div>
                <div className="space-y-2">
                  <Label>运行时</Label>
                  <Input
                    value={record.environment.runtime}
                    onChange={(e) =>
                      handleUpdateVerificationRecord(index, 'environment.runtime', e.target.value)
                    }
                    placeholder="Node.js"
                  />
                </div>
                <div className="space-y-2">
                  <Label>版本</Label>
                  <Input
                    value={record.environment.version}
                    onChange={(e) =>
                      handleUpdateVerificationRecord(index, 'environment.version', e.target.value)
                    }
                    placeholder="20.0.0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Input
                  value={record.notes}
                  onChange={(e) =>
                    handleUpdateVerificationRecord(index, 'notes', e.target.value)
                  }
                  placeholder="验证备注（可选）"
                />
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={handleAddVerificationRecord}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加验证记录
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}