import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import prisma from '@/core/db/client'
import { isAgentRequest } from '@/lib/agent-detection'

interface TrackPublicApiCallInput {
  request: NextRequest
  endpoint: string
  method: string
  statusCode: number
  responseTimeMs: number
}

interface AgentIdentity {
  explicitAgentId: string | null
  fingerprintHash: string
  ipAddress: string
  userAgent: string
  shouldAutoRegister: boolean
}

export class AgentTrackingService {
  async trackPublicApiCall(input: TrackPublicApiCallInput): Promise<void> {
    try {
      const identity = this.extractIdentity(input.request)
      let agentId: string | null = null

      if (identity.shouldAutoRegister && this.canManageAgentModel()) {
        agentId = await this.resolveOrCreateAgent(identity)
        if (agentId) {
          await this.updateAgentUsageMetrics(agentId, input.statusCode, input.responseTimeMs)
        }
      }

      await this.createApiRequestLog(
        agentId,
        identity.ipAddress,
        identity.userAgent,
        input.endpoint,
        input.method,
        input.statusCode,
        input.responseTimeMs
      )
    } catch (error) {
      // fail-open: 跟踪失败不影响 API 主流程
      console.warn('[AgentTrackingService] Failed to track public API call:', error)
    }
  }

  private canManageAgentModel(): boolean {
    const agentApp = (prisma as unknown as {
      agentApp?: {
        findUnique?: unknown
        findFirst?: unknown
        create?: unknown
        update?: unknown
      }
      $transaction?: unknown
    }).agentApp
    const tx = (prisma as unknown as { $transaction?: unknown }).$transaction

    return Boolean(
      agentApp
      && typeof agentApp.findUnique === 'function'
      && typeof agentApp.findFirst === 'function'
      && typeof agentApp.create === 'function'
      && typeof agentApp.update === 'function'
      && typeof tx === 'function'
    )
  }

  private extractIdentity(request: NextRequest): AgentIdentity {
    const rawAgentId = request.headers.get('x-agent-id') || ''
    const explicitAgentId = this.normalizeAgentId(rawAgentId)
    const ipAddress = this.normalizeIpAddress(
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    )
    const userAgent = this.normalizeUserAgent(request.headers.get('user-agent') || '')
    const fingerprintHash = this.computeFingerprint(ipAddress, userAgent)
    const shouldAutoRegister = Boolean(explicitAgentId) || isAgentRequest(request)

    return {
      explicitAgentId,
      fingerprintHash,
      ipAddress,
      userAgent,
      shouldAutoRegister,
    }
  }

  private normalizeAgentId(rawAgentId: string): string | null {
    const normalized = rawAgentId.trim().toLowerCase()
    if (!normalized) return null
    return normalized.slice(0, 120)
  }

  private normalizeIpAddress(rawIp: string): string {
    const first = rawIp.split(',')[0]?.trim()
    return first || 'unknown'
  }

  private normalizeUserAgent(rawUserAgent: string): string {
    const normalized = rawUserAgent.trim()
    return normalized ? normalized.slice(0, 512) : 'unknown'
  }

  private computeFingerprint(ipAddress: string, userAgent: string): string {
    return createHash('sha256')
      .update(`${ipAddress.toLowerCase()}|${userAgent.toLowerCase()}`)
      .digest('hex')
  }

  private async resolveOrCreateAgent(identity: AgentIdentity): Promise<string | null> {
    const { explicitAgentId, fingerprintHash, userAgent } = identity

    if (explicitAgentId) {
      const existingByExternal = await prisma.agentApp.findUnique({
        where: { externalAgentId: explicitAgentId },
        select: { id: true },
      })
      if (existingByExternal) {
        return existingByExternal.id
      }

      const autoFingerprintMatch = await prisma.agentApp.findFirst({
        where: {
          fingerprintHash,
          registrationSource: 'auto',
          externalAgentId: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (autoFingerprintMatch) {
        const upgraded = await prisma.agentApp.update({
          where: { id: autoFingerprintMatch.id },
          data: {
            externalAgentId: explicitAgentId,
            lastAccessAt: new Date(),
          },
          select: { id: true },
        })
        return upgraded.id
      }

      const created = await prisma.agentApp.create({
        data: {
          name: `Auto ${explicitAgentId}`.slice(0, 120),
          description: `Auto-registered from public API (${userAgent})`.slice(0, 500),
          owner: `auto:${explicitAgentId}`.slice(0, 190),
          externalAgentId: explicitAgentId,
          fingerprintHash,
          registrationSource: 'auto',
          status: 'active',
          usageDay: this.getDayKey(),
          usageMonth: this.getMonthKey(),
        },
        select: { id: true },
      })
      return created.id
    }

    const existingByFingerprint = await prisma.agentApp.findFirst({
      where: { fingerprintHash },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (existingByFingerprint) {
      return existingByFingerprint.id
    }

    const created = await prisma.agentApp.create({
      data: {
        name: `Auto Agent ${fingerprintHash.slice(0, 8)}`,
        description: `Auto-registered from public API (${userAgent})`.slice(0, 500),
        owner: `auto:fingerprint:${fingerprintHash.slice(0, 24)}`,
        fingerprintHash,
        registrationSource: 'auto',
        status: 'active',
        usageDay: this.getDayKey(),
        usageMonth: this.getMonthKey(),
      },
      select: { id: true },
    })
    return created.id
  }

  private async updateAgentUsageMetrics(
    agentId: string,
    statusCode: number,
    responseTimeMs: number
  ): Promise<void> {
    const now = new Date()
    const dayKey = this.getDayKey(now)
    const monthKey = this.getMonthKey(now)
    const success = statusCode >= 200 && statusCode < 400

    await prisma.$transaction(async (tx) => {
      const current = await tx.agentApp.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          totalRequests: true,
          successRequests: true,
          failedRequests: true,
          usedToday: true,
          usedThisMonth: true,
          usageDay: true,
          usageMonth: true,
          avgResponseTime: true,
        },
      })

      if (!current) return

      const nextTotalRequests = current.totalRequests + 1
      const nextSuccessRequests = current.successRequests + (success ? 1 : 0)
      const nextFailedRequests = current.failedRequests + (success ? 0 : 1)
      const normalizedResponseTime = Math.max(0, Math.round(responseTimeMs))
      const nextAvgResponseTime = current.totalRequests === 0
        ? normalizedResponseTime
        : ((current.avgResponseTime * current.totalRequests) + normalizedResponseTime) / nextTotalRequests

      const nextUsedToday = current.usageDay === dayKey ? current.usedToday + 1 : 1
      const nextUsedThisMonth = current.usageMonth === monthKey ? current.usedThisMonth + 1 : 1

      await tx.agentApp.update({
        where: { id: agentId },
        data: {
          totalRequests: nextTotalRequests,
          successRequests: nextSuccessRequests,
          failedRequests: nextFailedRequests,
          avgResponseTime: nextAvgResponseTime,
          usedToday: nextUsedToday,
          usedThisMonth: nextUsedThisMonth,
          usageDay: dayKey,
          usageMonth: monthKey,
          lastAccessAt: now,
        },
      })
    })
  }

  private async createApiRequestLog(
    agentId: string | null,
    ipAddress: string,
    userAgent: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number
  ): Promise<void> {
    const apiRequestLog = (prisma as unknown as {
      apiRequestLog?: {
        create?: (args: unknown) => Promise<unknown>
      }
    }).apiRequestLog

    if (!apiRequestLog || typeof apiRequestLog.create !== 'function') {
      return
    }

    await prisma.apiRequestLog.create({
      data: {
        agentId,
        endpoint,
        method: method.toUpperCase(),
        statusCode,
        responseTime: Math.max(0, Math.round(responseTimeMs)),
        ipAddress,
        userAgent,
      },
    })
  }

  private getDayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10)
  }

  private getMonthKey(now = new Date()): string {
    return now.toISOString().slice(0, 7)
  }
}

export const agentTrackingService = new AgentTrackingService()
