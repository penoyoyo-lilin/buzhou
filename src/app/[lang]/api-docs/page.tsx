import { CodeBlock } from '@/components/ui/code-block'
import { Badge } from '@/components/ui/badge'
import { t, type Locale } from '@/lib/i18n/translations'

export default function ApiDocsPage({ params }: { params: { lang: Locale } }) {
  const { lang } = params

  return (
    <div className="container py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{t(lang, 'apiDocs.title')}</h1>

      {/* 概述 */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'apiDocs.overview')}</h2>
        <p className="text-muted-foreground mb-4">
          {t(lang, 'apiDocs.overviewDesc')}
        </p>

        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-2">{t(lang, 'apiDocs.baseUrl')}</h3>
          <code className="text-sm bg-background px-2 py-1 rounded">
            https://buzhou.io/api/v1
          </code>
        </div>

        {/* 响应格式 */}
        <h3 className="font-medium mb-2">{t(lang, 'apiDocs.responseFormat')}</h3>
        <CodeBlock
          code={`{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-03-07T10:00:00Z",
    "nextStep": "GET /api/v1/search?domain=agent"
  }
}`}
          language="json"
        />
      </section>

      {/* 认证 */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'apiDocs.authentication')}</h2>
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{t(lang, 'apiDocs.noKeyMode')}</Badge>
              <span className="text-sm text-muted-foreground">{t(lang, 'apiDocs.noKeyModeCurrent')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(lang, 'apiDocs.noKeyModeDesc')}
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge>{t(lang, 'apiDocs.apiKeyMode')}</Badge>
              <span className="text-sm text-muted-foreground">{t(lang, 'apiDocs.apiKeyRecommended')}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t(lang, 'apiDocs.apiKeyModeDesc')}
            </p>
            <CodeBlock
              code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://buzhou.io/api/v1/search?q=Claude`}
              language="bash"
            />
          </div>
        </div>
      </section>

      {/* 端点列表 */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'apiDocs.endpoints')}</h2>

        {/* Search API */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <Badge variant="agent">GET</Badge>
              <code className="font-medium">/api/v1/search</code>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t(lang, 'apiDocs.searchEndpointDesc')}
            </p>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">{t(lang, 'apiDocs.requestParams')}</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">{t(lang, 'apiDocs.param')}</th>
                    <th className="text-left py-2">{t(lang, 'apiDocs.type')}</th>
                    <th className="text-left py-2">{t(lang, 'apiDocs.required')}</th>
                    <th className="text-left py-2">{t(lang, 'apiDocs.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">q</td>
                    <td className="py-2">string</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramQ')}</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramQDesc')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">domain</td>
                    <td className="py-2">string</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramDomain')}</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramDomainDesc')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">status</td>
                    <td className="py-2">string</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramStatus')}</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramStatusDesc')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">page</td>
                    <td className="py-2">number</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramPage')}</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramPageDesc')}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs">pageSize</td>
                    <td className="py-2">number</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramPageSize')}</td>
                    <td className="py-2">{t(lang, 'apiDocs.paramPageSizeDesc')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">{t(lang, 'apiDocs.requestExample')}</h4>
              <CodeBlock
                code={`curl "https://buzhou.io/api/v1/search?q=Claude&domain=agent&page=1"`}
                language="bash"
              />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">{t(lang, 'apiDocs.responseExample')}</h4>
              <CodeBlock
                code={`{
  "success": true,
  "data": {
    "items": [
      {
        "id": "art_001",
        "slug": "claude-agent-sdk-getting-started",
        "title": { "zh": "...", "en": "..." },
        "summary": { "zh": "...", "en": "..." },
        "domain": "agent",
        "tags": ["Claude", "SDK"],
        "verificationStatus": "verified",
        "confidenceScore": 95
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 42,
      "totalPages": 3
    }
  },
  "meta": {
    "requestId": "req_xyz789",
    "timestamp": "2026-03-07T10:00:00Z"
  }
}`}
                language="json"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 错误码 */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'apiDocs.errorCodes')}</h2>
        <table className="w-full text-sm border">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3">{t(lang, 'apiDocs.errorCode')}</th>
              <th className="text-left p-3">{t(lang, 'apiDocs.httpStatus')}</th>
              <th className="text-left p-3">{t(lang, 'apiDocs.description')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-3 font-mono text-xs">VALIDATION_ERROR</td>
              <td className="p-3">400</td>
              <td className="p-3">{t(lang, 'apiDocs.errorValidationDesc')}</td>
            </tr>
            <tr className="border-b">
              <td className="p-3 font-mono text-xs">UNAUTHORIZED</td>
              <td className="p-3">401</td>
              <td className="p-3">{t(lang, 'apiDocs.errorUnauthorizedDesc')}</td>
            </tr>
            <tr className="border-b">
              <td className="p-3 font-mono text-xs">NOT_FOUND</td>
              <td className="p-3">404</td>
              <td className="p-3">{t(lang, 'apiDocs.errorNotFoundDesc')}</td>
            </tr>
            <tr className="border-b">
              <td className="p-3 font-mono text-xs">RATE_LIMITED</td>
              <td className="p-3">429</td>
              <td className="p-3">{t(lang, 'apiDocs.errorRateLimitedDesc')}</td>
            </tr>
            <tr>
              <td className="p-3 font-mono text-xs">INTERNAL_ERROR</td>
              <td className="p-3">500</td>
              <td className="p-3">{t(lang, 'apiDocs.errorInternalDesc')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 限流策略 */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'apiDocs.rateLimit')}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">{t(lang, 'apiDocs.rateLimitNoKey')}</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t(lang, 'apiDocs.rateLimitNoKeyDesc1')}</li>
              <li>• {t(lang, 'apiDocs.rateLimitNoKeyDesc2')}</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">{t(lang, 'apiDocs.rateLimitApiKey')}</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t(lang, 'apiDocs.rateLimitApiKeyFree')}</li>
              <li>• {t(lang, 'apiDocs.rateLimitApiKeyPaid')}</li>
              <li>• {t(lang, 'apiDocs.rateLimitApiKeyConcurrent')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 响应头 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{t(lang, 'apiDocs.responseHeaders')}</h2>
        <p className="text-muted-foreground mb-4">
          {t(lang, 'apiDocs.responseHeadersDesc')}
        </p>
        <table className="w-full text-sm border">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3">Header</th>
              <th className="text-left p-3">{t(lang, 'apiDocs.description')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-3 font-mono text-xs">X-Agent-API-Endpoint</td>
              <td className="p-3">API endpoint URL</td>
            </tr>
            <tr>
              <td className="p-3 font-mono text-xs">X-Agent-API-Docs</td>
              <td className="p-3">API documentation URL</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}