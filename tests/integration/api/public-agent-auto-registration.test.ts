import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { GET as searchGET } from '@/app/api/v1/search/route'
import { GET as statsGET } from '@/app/api/v1/stats/route'
import { GET as articleGET } from '@/app/api/v1/articles/[slug]/route'
import { POST as pageviewPOST } from '@/app/api/v1/pageview/route'
import prisma from '@/core/db/client'

describe('Public API auto agent registration', () => {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const externalAgentId = `auto-agent-${unique}`
  const articleId = `art_auto_track_${unique}`
  const articleSlug = `auto-track-article-${unique}`

  beforeAll(async () => {
    await prisma.$connect()

    await prisma.article.create({
      data: {
        id: articleId,
        slug: articleSlug,
        title: JSON.stringify({ zh: '自动注册测试', en: 'Auto Registration Test' }),
        summary: JSON.stringify({ zh: '用于自动注册测试', en: 'Used for auto registration testing' }),
        content: JSON.stringify({ zh: '正文', en: 'content' }),
        domain: 'foundation',
        tags: JSON.stringify(['auto-registration']),
        keywords: JSON.stringify([]),
        codeBlocks: JSON.stringify([]),
        metadata: JSON.stringify({
          applicableVersions: [],
          confidenceScore: 80,
          riskLevel: 'low',
          runtimeEnv: [],
        }),
        qaPairs: JSON.stringify([]),
        relatedIds: JSON.stringify([]),
        verificationStatus: 'verified',
        status: 'published',
        publishedAt: new Date(),
        createdBy: 'integration-test',
      },
    })
  })

  afterAll(async () => {
    await prisma.apiRequestLog.deleteMany({
      where: {
        OR: [
          { userAgent: 'BuzhouAutoAgent/1.0' },
          { userAgent: { contains: `browser-check-${unique}` } },
        ],
      },
    })

    await prisma.agentApp.deleteMany({
      where: {
        externalAgentId,
      },
    })

    await prisma.verificationRecord.deleteMany({
      where: { articleId },
    })
    await prisma.article.deleteMany({
      where: { id: articleId },
    })

    await prisma.$disconnect()
  })

  it('should auto register once and aggregate metrics across all public v1 endpoints', async () => {
    const headers = {
      'x-agent-id': externalAgentId,
      'user-agent': 'BuzhouAutoAgent/1.0',
      'x-forwarded-for': '10.10.10.1',
    }

    const searchResponse = await searchGET(new NextRequest(
      'http://localhost:3000/api/v1/search?q=auto-registration&pageSize=1',
      { headers }
    ))
    const statsResponse = await statsGET(new NextRequest(
      'http://localhost:3000/api/v1/stats',
      { headers }
    ))
    const articleResponse = await articleGET(
      new NextRequest(`http://localhost:3000/api/v1/articles/${articleSlug}?format=json&lang=zh`, { headers }),
      { params: { slug: articleSlug } }
    )
    const pageviewResponse = await pageviewPOST(new NextRequest(
      'http://localhost:3000/api/v1/pageview',
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path: `/zh/articles/${articleSlug}`, referrer: null }),
      }
    ))

    expect(searchResponse.status).toBe(200)
    expect(statsResponse.status).toBe(200)
    expect(articleResponse.status).toBe(200)
    expect(pageviewResponse.status).toBe(200)

    const autoAgents = await prisma.agentApp.findMany({
      where: { externalAgentId },
    })
    expect(autoAgents.length).toBe(1)

    const agent = autoAgents[0]
    expect(agent.registrationSource).toBe('auto')
    expect(agent.status).toBe('active')
    expect(agent.totalRequests).toBe(4)
    expect(agent.successRequests).toBe(4)
    expect(agent.failedRequests).toBe(0)
    expect(agent.lastAccessAt).not.toBeNull()

    const logs = await prisma.apiRequestLog.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(logs.length).toBe(4)
    expect(logs.map((log) => log.endpoint)).toEqual(expect.arrayContaining([
      '/api/v1/search',
      '/api/v1/stats',
      '/api/v1/pageview',
      `/api/v1/articles/${articleSlug}`,
    ]))
  })

  it('should not auto register non-agent traffic without x-agent-id', async () => {
    const nonAgentUserAgent = `Mozilla/5.0 browser-check-${unique}`
    const ip = '9.9.9.9'
    const fingerprint = createHash('sha256')
      .update(`${ip}|${nonAgentUserAgent.toLowerCase()}`)
      .digest('hex')

    const response = await searchGET(new NextRequest(
      'http://localhost:3000/api/v1/search?pageSize=1',
      {
        headers: {
          'user-agent': nonAgentUserAgent,
          accept: 'text/html',
          'x-forwarded-for': ip,
        },
      }
    ))

    expect(response.status).toBe(200)

    const shouldNotExist = await prisma.agentApp.findFirst({
      where: {
        fingerprintHash: fingerprint,
        registrationSource: 'auto',
      },
    })
    expect(shouldNotExist).toBeNull()
  })
})
