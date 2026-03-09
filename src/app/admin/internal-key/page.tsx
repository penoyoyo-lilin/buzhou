'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Key, Copy, RefreshCw, AlertTriangle, Check } from 'lucide-react'

interface KeyInfo {
  prefix: string
  length: number
}

interface NewKeyResponse {
  key: string
  prefix: string
  message: string
  warning: string
}

export default function InternalKeyPage() {
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [showNewKey, setShowNewKey] = useState(false)
  const [newKey, setNewKey] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // 获取当前 Key 信息
  const fetchKeyInfo = async () => {
    try {
      const res = await fetch('/api/admin/internal-key')
      if (res.ok) {
        const data = await res.json()
        setKeyInfo(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch key info:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeyInfo()
  }, [])

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 重新生成 Key
  const regenerateKey = async () => {
    setRegenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/internal-key', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        setNewKey(data.data.key)
        setShowNewKey(true)
        setKeyInfo({ prefix: data.data.prefix, length: data.data.key.length })
      } else {
        setError(data.error?.message || '重新生成失败')
      }
    } catch (err) {
      setError('请求失败')
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">内部 API Key</h1>
        <p className="text-muted-foreground mt-1">
          管理高权限接口的认证密钥
        </p>
      </div>

      {/* 安全警告 */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium mb-1">安全警告</p>
            <ul className="list-disc list-inside space-y-1 text-amber-600 dark:text-amber-400">
              <li>此密钥拥有高权限，请勿泄露</li>
              <li>重新生成后，旧密钥立即失效</li>
              <li>请确保在使用新密钥前更新所有服务配置</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 当前 Key 信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            当前密钥
          </CardTitle>
          <CardDescription>
            仅显示密钥前缀，完整密钥请查看 .env 文件
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {keyInfo ? (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <code className="text-sm font-mono">{keyInfo.prefix}</code>
                <p className="text-xs text-muted-foreground mt-1">
                  长度: {keyInfo.length} 字符
                </p>
              </div>
              <Badge variant="outline">已配置</Badge>
            </div>
          ) : (
            <div className="text-muted-foreground">未配置内部 API Key</div>
          )}
        </CardContent>
      </Card>

      {/* 新生成的 Key 显示 */}
      {showNewKey && newKey && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              新密钥已生成
            </CardTitle>
            <CardDescription className="text-red-500">
              ⚠️ 请立即保存此密钥，关闭后将无法再次查看完整内容
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <code className="text-sm font-mono break-all">{newKey}</code>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(newKey)}
                variant="outline"
                className="flex-1"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    复制密钥
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowNewKey(false)}
                variant="default"
              >
                我已保存，关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 重新生成 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            重新生成密钥
          </CardTitle>
          <CardDescription>
            重新生成将使当前密钥立即失效
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            onClick={regenerateKey}
            disabled={regenerating}
            variant="destructive"
          >
            {regenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                重新生成密钥
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. 在请求头中添加 Authorization 字段：</p>
          <code className="block p-2 bg-muted rounded text-xs">
            Authorization: Bearer YOUR_INTERNAL_API_KEY
          </code>
          <p>2. 详细接口文档请查看：</p>
          <code className="block p-2 bg-muted rounded text-xs">
            docs/INTERNAL_API.md
          </code>
        </CardContent>
      </Card>
    </div>
  )
}