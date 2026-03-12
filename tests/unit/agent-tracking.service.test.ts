import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const isAgentRequestMock = vi.fn()

const agentFindUniqueMock = vi.fn()
const agentFindFirstMock = vi.fn()
const agentCreateMock = vi.fn()
const agentUpdateMock = vi.fn()
const apiRequestLogCreateMock = vi.fn()

const txAgentFindUniqueMock = vi.fn()
const txAgentUpdateMock = vi.fn()
const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
  await callback({
    agentApp: {
      findUnique: txAgentFindUniqueMock,
      update: txAgentUpdateMock,
    },
  })
})

vi.mock('@/lib/agent-detection', () => ({
  isAgentRequest: isAgentRequestMock,
}))

vi.mock('@/core/db/client', () => ({
  default: {
    agentApp: {
      findUnique: agentFindUniqueMock,
      findFirst: agentFindFirstMock,
      create: agentCreateMock,
      update: agentUpdateMock,
    },
    apiRequestLog: {
      create: apiRequestLogCreateMock,
    },
    $transaction: transactionMock,
  },
}))

function buildRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/search', {
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0',
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
  })
}

describe('AgentTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAgentRequestMock.mockReturnValue(true)

    txAgentFindUniqueMock.mockResolvedValue({
      id: 'agent_1',
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      usedToday: 0,
      usedThisMonth: 0,
      usageDay: new Date().toISOString().slice(0, 10),
      usageMonth: new Date().toISOString().slice(0, 7),
      avgResponseTime: 0,
    })
    txAgentUpdateMock.mockResolvedValue({ id: 'agent_1' })
    apiRequestLogCreateMock.mockResolvedValue({ id: 'log_1' })
  })

  it('should dedupe by explicit agent id', async () => {
    agentFindUniqueMock.mockResolvedValue({ id: 'agent_1' })

    const { agentTrackingService } = await import('@/services/agent-tracking.service')
    await agentTrackingService.trackPublicApiCall({
      request: buildRequest({ 'x-agent-id': 'My-Agent-Prod' }),
      endpoint: '/api/v1/search',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 35,
    })
    await agentTrackingService.trackPublicApiCall({
      request: buildRequest({ 'x-agent-id': 'my-agent-prod' }),
      endpoint: '/api/v1/search',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 28,
    })

    expect(agentCreateMock).not.toHaveBeenCalled()
    expect(agentFindUniqueMock).toHaveBeenCalledWith({
      where: { externalAgentId: 'my-agent-prod' },
      select: { id: true },
    })
    expect(apiRequestLogCreateMock).toHaveBeenCalledTimes(2)
    expect(apiRequestLogCreateMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        agentId: 'agent_1',
        endpoint: '/api/v1/search',
        method: 'GET',
      }),
    }))
  })

  it('should dedupe by fingerprint when explicit id is absent', async () => {
    isAgentRequestMock.mockReturnValue(true)
    agentFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'agent_fp_1' })
    agentCreateMock.mockResolvedValue({ id: 'agent_fp_1' })
    txAgentFindUniqueMock.mockResolvedValue({
      id: 'agent_fp_1',
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      usedToday: 0,
      usedThisMonth: 0,
      usageDay: new Date().toISOString().slice(0, 10),
      usageMonth: new Date().toISOString().slice(0, 7),
      avgResponseTime: 0,
    })

    const { agentTrackingService } = await import('@/services/agent-tracking.service')
    await agentTrackingService.trackPublicApiCall({
      request: buildRequest(),
      endpoint: '/api/v1/search',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 25,
    })
    await agentTrackingService.trackPublicApiCall({
      request: buildRequest(),
      endpoint: '/api/v1/stats',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 15,
    })

    expect(agentCreateMock).toHaveBeenCalledTimes(1)
    expect(apiRequestLogCreateMock).toHaveBeenCalledTimes(2)
  })

  it('should upgrade fingerprint-only record when explicit id arrives later', async () => {
    const requestWithoutId = buildRequest({ 'x-agent': 'true' })
    const requestWithId = buildRequest({ 'x-agent-id': 'agent-upgrade' })

    isAgentRequestMock.mockReturnValue(true)
    agentFindFirstMock
      .mockResolvedValueOnce(null) // first call: fingerprint lookup before create
      .mockResolvedValueOnce({ id: 'agent_fp_upgrade' }) // second call: explicit id misses, then fingerprint hit
    agentCreateMock.mockResolvedValue({ id: 'agent_fp_upgrade' })
    agentFindUniqueMock.mockResolvedValueOnce(null)
    agentUpdateMock.mockResolvedValue({ id: 'agent_fp_upgrade' })
    txAgentFindUniqueMock.mockResolvedValue({
      id: 'agent_fp_upgrade',
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      usedToday: 0,
      usedThisMonth: 0,
      usageDay: new Date().toISOString().slice(0, 10),
      usageMonth: new Date().toISOString().slice(0, 7),
      avgResponseTime: 0,
    })

    const { agentTrackingService } = await import('@/services/agent-tracking.service')
    await agentTrackingService.trackPublicApiCall({
      request: requestWithoutId,
      endpoint: '/api/v1/search',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 30,
    })
    await agentTrackingService.trackPublicApiCall({
      request: requestWithId,
      endpoint: '/api/v1/search',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 20,
    })

    expect(agentCreateMock).toHaveBeenCalledTimes(1)
    expect(agentUpdateMock).toHaveBeenCalledWith({
      where: { id: 'agent_fp_upgrade' },
      data: expect.objectContaining({
        externalAgentId: 'agent-upgrade',
      }),
      select: { id: true },
    })
  })

  it('should update success/failure stats and reset usage windows', async () => {
    agentFindUniqueMock.mockResolvedValue({ id: 'agent_1' })
    txAgentFindUniqueMock.mockResolvedValue({
      id: 'agent_1',
      totalRequests: 10,
      successRequests: 7,
      failedRequests: 3,
      usedToday: 4,
      usedThisMonth: 19,
      usageDay: '2020-01-01',
      usageMonth: '2020-01',
      avgResponseTime: 50,
    })

    const { agentTrackingService } = await import('@/services/agent-tracking.service')
    await agentTrackingService.trackPublicApiCall({
      request: buildRequest({ 'x-agent-id': 'agent-metrics' }),
      endpoint: '/api/v1/search',
      method: 'GET',
      statusCode: 500,
      responseTimeMs: 100,
    })

    expect(txAgentUpdateMock).toHaveBeenCalledWith({
      where: { id: 'agent_1' },
      data: expect.objectContaining({
        totalRequests: 11,
        successRequests: 7,
        failedRequests: 4,
        usedToday: 1,
        usedThisMonth: 1,
      }),
    })
  })

  it('should not auto register non-agent requests without explicit id', async () => {
    isAgentRequestMock.mockReturnValue(false)

    const { agentTrackingService } = await import('@/services/agent-tracking.service')
    await agentTrackingService.trackPublicApiCall({
      request: buildRequest({ accept: 'text/html' }),
      endpoint: '/api/v1/search',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 20,
    })

    expect(agentFindUniqueMock).not.toHaveBeenCalled()
    expect(agentFindFirstMock).not.toHaveBeenCalled()
    expect(agentCreateMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
    expect(apiRequestLogCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        agentId: null,
      }),
    }))
  })
})
