import { createHash } from 'crypto'
import prisma from '@/core/db/client'
import { CacheKeys, deleteCachePattern, redis } from '@/core/cache'
import { fromJsonValue, toJsonValue } from '@/core/db/utils'
import {
  eventBus,
  type ArticleInspectionCompletedPayload,
  type ArticleInspectionRequestedPayload,
} from '@/core/events'
import { verificationService } from '@/services/verification.service'
import type {
  ArticleMetadata,
  InspectionFinding,
  InspectionRun,
  InspectionSeveritySummary,
  LocalizedString,
  RiskLevel,
  RuntimeEnv,
} from '@/types'

const INSPECTION_QUEUE_KEY = 'queue:article-inspection:runs'
const DEFAULT_DAILY_BATCH_SIZE = 20
const PENDING_STATUSES = ['queued', 'running', 'failed', 'partial'] as const
const HIGH_RISK_SEVERITIES = new Set<RiskLevel>(['high', 'critical'])

interface InspectionCandidate {
  ruleKey: string
  severity: RiskLevel
  fieldPath: string | null
  title: string
  evidence: Record<string, unknown>
  suggestedPatch: Record<string, unknown> | null
  autoFixable: boolean
  status?: InspectionFinding['status']
}

interface InspectableArticle {
  id: string
  slug: string
  title: LocalizedString
  summary: LocalizedString
  content: LocalizedString
  metadata: ArticleMetadata
  verificationStatus: string
  updatedAt: Date
  verificationRecords: Array<{ verifiedAt: Date }>
}

interface QueuedInspectionJob {
  runId: string
  articleId: string
  triggerSource: string
  queuedAt: string
}

const globalForInspectionQueue = globalThis as unknown as {
  articleInspectionQueue?: QueuedInspectionJob[]
}

function getMemoryQueue(): QueuedInspectionJob[] {
  if (!globalForInspectionQueue.articleInspectionQueue) {
    globalForInspectionQueue.articleInspectionQueue = []
  }

  return globalForInspectionQueue.articleInspectionQueue
}

function getDefaultSeveritySummary(): InspectionSeveritySummary {
  return {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }
}

function getDefaultMetadata(): ArticleMetadata {
  return {
    applicableVersions: [],
    confidenceScore: 0,
    riskLevel: 'low',
    runtimeEnv: [],
    lastInspectedAt: null,
    lastRepairedAt: null,
    freshnessScore: 100,
    inspectionStatus: 'queued',
    staleReason: null,
  }
}

function hashArticleSnapshot(article: {
  title: unknown
  summary: unknown
  content: unknown
  metadata: unknown
  updatedAt: Date
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      title: article.title,
      summary: article.summary,
      content: article.content,
      metadata: article.metadata,
      updatedAt: article.updatedAt.toISOString(),
    }))
    .digest('hex')
}

function transformInspectionRun(run: {
  id: string
  articleId: string
  triggerSource: string
  status: string
  contentHashBefore: string
  contentHashAfter: string | null
  severitySummary: unknown
  findingsCount: number
  autoFixableCount: number
  startedAt: Date | null
  completedAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}): InspectionRun {
  return {
    id: run.id,
    articleId: run.articleId,
    triggerSource: run.triggerSource,
    status: run.status as InspectionRun['status'],
    contentHashBefore: run.contentHashBefore,
    contentHashAfter: run.contentHashAfter,
    severitySummary: fromJsonValue(run.severitySummary, getDefaultSeveritySummary()),
    findingsCount: run.findingsCount,
    autoFixableCount: run.autoFixableCount,
    startedAt: run.startedAt?.toISOString() || null,
    completedAt: run.completedAt?.toISOString() || null,
    lastError: run.lastError,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

function getHighestSeverity(findings: InspectionCandidate[]): RiskLevel | null {
  if (findings.some((finding) => finding.severity === 'critical')) return 'critical'
  if (findings.some((finding) => finding.severity === 'high')) return 'high'
  if (findings.some((finding) => finding.severity === 'medium')) return 'medium'
  if (findings.some((finding) => finding.severity === 'low')) return 'low'
  return null
}

function extractLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || []
  return Array.from(new Set(matches.map((match) => match.replace(/[.,;:]+$/, ''))))
}

function calculateFreshnessScore(summary: InspectionSeveritySummary): number {
  const deductions =
    summary.low * 5 +
    summary.medium * 12 +
    summary.high * 25 +
    summary.critical * 40

  return Math.max(0, 100 - deductions)
}

function toSeveritySummary(findings: InspectionCandidate[]): InspectionSeveritySummary {
  return findings.reduce<InspectionSeveritySummary>((summary, finding) => {
    summary[finding.severity] += 1
    return summary
  }, getDefaultSeveritySummary())
}

function buildInspectionFindingRecord(
  runId: string,
  articleId: string,
  finding: InspectionCandidate
): {
  runId: string
  articleId: string
  ruleKey: string
  severity: string
  fieldPath: string | null
  title: string
  evidence: unknown
  suggestedPatch: unknown
  autoFixable: boolean
  status: string
} {
  return {
    runId,
    articleId,
    ruleKey: finding.ruleKey,
    severity: finding.severity,
    fieldPath: finding.fieldPath,
    title: finding.title,
    evidence: toJsonValue(finding.evidence),
    suggestedPatch: finding.suggestedPatch ? toJsonValue(finding.suggestedPatch) : null,
    autoFixable: finding.autoFixable,
    status: finding.status || 'open',
  }
}

async function pushJob(job: QueuedInspectionJob): Promise<void> {
  if (redis) {
    try {
      await redis.rpush(INSPECTION_QUEUE_KEY, JSON.stringify(job))
      return
    } catch (error) {
      console.warn('[ArticleInspectionService] Failed to push Redis job, falling back to memory queue:', error)
    }
  }

  getMemoryQueue().push(job)
}

async function shiftJob(): Promise<QueuedInspectionJob | null> {
  if (redis) {
    try {
      const payload = await redis.lpop(INSPECTION_QUEUE_KEY)
      if (!payload) return null
      return JSON.parse(payload) as QueuedInspectionJob
    } catch (error) {
      console.warn('[ArticleInspectionService] Failed to pop Redis job, falling back to memory queue:', error)
    }
  }

  return getMemoryQueue().shift() || null
}

async function getQueueSize(): Promise<number> {
  if (redis) {
    try {
      return await redis.llen(INSPECTION_QUEUE_KEY)
    } catch {
      return getMemoryQueue().length
    }
  }

  return getMemoryQueue().length
}

export class ArticleInspectionService {
  async enqueueImmediateInspection(
    articleId: string,
    triggerSource: string
  ): Promise<InspectionRun | null> {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        status: true,
        title: true,
        summary: true,
        content: true,
        metadata: true,
        updatedAt: true,
      },
    })

    if (!article || article.status !== 'published') {
      return null
    }

    const existing = await prisma.inspectionRun.findFirst({
      where: {
        articleId,
        status: { in: [...PENDING_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      return transformInspectionRun(existing)
    }

    const run = await prisma.inspectionRun.create({
      data: {
        articleId,
        triggerSource,
        status: 'queued',
        contentHashBefore: hashArticleSnapshot(article),
        severitySummary: toJsonValue(getDefaultSeveritySummary()) as any,
      },
    })

    const payload: ArticleInspectionRequestedPayload = {
      articleId,
      inspectionRunId: run.id,
      triggerSource,
    }

    await pushJob({
      runId: run.id,
      articleId,
      triggerSource,
      queuedAt: run.createdAt.toISOString(),
    })

    await eventBus.emit('article:inspection-requested', payload, {
      aggregateId: articleId,
      aggregateType: 'Article',
      source: 'inspection-service',
    })

    return transformInspectionRun(run)
  }

  async selectDailyIncrementalCandidates(limit: number = DEFAULT_DAILY_BATCH_SIZE): Promise<string[]> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const failedOrPendingRuns = await prisma.inspectionRun.findMany({
      where: {
        status: { in: [...PENDING_STATUSES] },
        createdAt: { gte: dayAgo },
      },
      orderBy: { createdAt: 'asc' },
      select: { articleId: true },
      take: limit * 2,
    })

    const prioritizedArticleIds = Array.from(new Set(failedOrPendingRuns.map((run) => run.articleId)))

    const publishedArticles = await prisma.article.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        metadata: true,
      },
    })

    const sortedByInspectionAge = publishedArticles
      .map((article) => {
        const metadata = fromJsonValue<ArticleMetadata>(article.metadata, {
          applicableVersions: [],
          confidenceScore: 0,
          riskLevel: 'medium',
          runtimeEnv: [],
        })
        const lastInspectedAt = metadata.lastInspectedAt ? new Date(metadata.lastInspectedAt).getTime() : 0

        return {
          articleId: article.id,
          lastInspectedAt,
        }
      })
      .sort((a, b) => a.lastInspectedAt - b.lastInspectedAt)
      .map((item) => item.articleId)

    return Array.from(new Set([...prioritizedArticleIds, ...sortedByInspectionAge])).slice(0, limit)
  }

  async enqueueDailyIncrementalRun(limit: number = DEFAULT_DAILY_BATCH_SIZE): Promise<InspectionRun[]> {
    const articleIds = await this.selectDailyIncrementalCandidates(limit)
    const runs: InspectionRun[] = []

    for (const articleId of articleIds) {
      const run = await this.enqueueImmediateInspection(articleId, 'daily_incremental')
      if (run) {
        runs.push(run)
      }
    }

    return runs
  }

  async processQueuedRuns(limit: number = 1): Promise<Array<{
    run: InspectionRun | null
    findings: InspectionFinding[]
  }>> {
    const results: Array<{
      run: InspectionRun | null
      findings: InspectionFinding[]
    }> = []

    for (let index = 0; index < limit; index += 1) {
      const result = await this.processNextQueuedRun()
      if (!result.run) {
        break
      }
      results.push(result)
    }

    return results
  }

  async retryRun(runId: string): Promise<InspectionRun | null> {
    const run = await prisma.inspectionRun.findUnique({
      where: { id: runId },
      select: {
        articleId: true,
      },
    })

    if (!run) {
      return null
    }

    return this.enqueueImmediateInspection(run.articleId, 'manual_retry')
  }

  async takeNextQueuedRun(): Promise<InspectionRun | null> {
    const job = await shiftJob()
    if (!job) return null

    const run = await prisma.inspectionRun.update({
      where: { id: job.runId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })

    return transformInspectionRun(run)
  }

  async processNextQueuedRun(): Promise<{
    run: InspectionRun | null
    findings: InspectionFinding[]
  }> {
    const run = await this.takeNextQueuedRun()
    if (!run) {
      return { run: null, findings: [] }
    }

    try {
      const article = await this.getInspectableArticle(run.articleId)
      if (!article) {
        const failedRun = await this.completeQueuedRun(run.id, 'failed', {
          articleId: run.articleId,
          status: 'failed',
          findingsCount: 0,
          autoFixableCount: 0,
          severitySummary: getDefaultSeveritySummary(),
          lastError: 'Article not found or not published',
        })

        return { run: failedRun, findings: [] }
      }

      const inspectionResults = await Promise.allSettled([
        this.inspectBilingualCompleteness(article),
        this.inspectVerificationFreshness(article),
        this.inspectLegacyDomain(article),
        this.inspectLinks(article),
      ])

      const findings: InspectionCandidate[] = []
      const errors: string[] = []

      inspectionResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          findings.push(...result.value)
        } else {
          errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
        }
      })

      const persistedFindings = await this.persistFindings(run.id, article.id, findings)
      const severitySummary = toSeveritySummary(findings)
      const autoFixableCount = findings.filter((finding) => finding.autoFixable).length

      await this.updateArticleInspectionMetadata(article, severitySummary, findings)
      await this.applyAutomatedRepairs(article, run.id, persistedFindings)

      const completedRun = await this.completeQueuedRun(
        run.id,
        errors.length > 0 ? 'partial' : 'completed',
        {
          articleId: article.id,
          status: errors.length > 0 ? 'partial' : 'completed',
          findingsCount: findings.length,
          autoFixableCount,
          severitySummary,
          lastError: errors.length > 0 ? errors.join('; ') : null,
        }
      )

      return {
        run: completedRun,
        findings: persistedFindings,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown inspection error'
      const failedRun = await this.completeQueuedRun(run.id, 'failed', {
        articleId: run.articleId,
        status: 'failed',
        findingsCount: 0,
        autoFixableCount: 0,
        severitySummary: getDefaultSeveritySummary(),
        lastError: message,
      })

      return {
        run: failedRun,
        findings: [],
      }
    }
  }

  async completeQueuedRun(
    runId: string,
    status: 'completed' | 'partial' | 'failed',
    payload: Omit<ArticleInspectionCompletedPayload, 'inspectionRunId'>
  ): Promise<InspectionRun> {
    const run = await prisma.inspectionRun.update({
      where: { id: runId },
      data: {
        status,
        completedAt: new Date(),
        findingsCount: payload.findingsCount,
        autoFixableCount: payload.autoFixableCount,
        severitySummary: toJsonValue(payload.severitySummary) as any,
        lastError: payload.lastError || null,
      },
    })

    await eventBus.emit('article:inspection-completed', {
      inspectionRunId: run.id,
      articleId: run.articleId,
      status,
      findingsCount: payload.findingsCount,
      autoFixableCount: payload.autoFixableCount,
      severitySummary: payload.severitySummary,
      lastError: payload.lastError || null,
    }, {
      aggregateId: run.articleId,
      aggregateType: 'Article',
      source: 'inspection-service',
    })

    return transformInspectionRun(run)
  }

  async getQueueStats(): Promise<{ queued: number }> {
    return {
      queued: await getQueueSize(),
    }
  }

  async listRuns(params: {
    status?: InspectionRun['status']
    page?: number
    pageSize?: number
  } = {}): Promise<{
    runs: InspectionRun[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
    queue: {
      queued: number
    }
  }> {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const where = params.status ? { status: params.status } : {}

    const [runs, total, queue] = await Promise.all([
      prisma.inspectionRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inspectionRun.count({ where }),
      this.getQueueStats(),
    ])

    return {
      runs: runs.map(transformInspectionRun),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      queue,
    }
  }

  async getRunDetail(runId: string): Promise<{
    run: InspectionRun
    findings: InspectionFinding[]
    repairs: Array<{
      id: string
      articleId: string
      inspectionRunId: string | null
      findingIds: string[]
      mode: string
      status: string
      diff: Record<string, unknown>
      evidenceSummary: Record<string, unknown>
      validatorResult: Record<string, unknown>
      riskBefore: string
      riskAfter: string | null
      appliedAt: string | null
      lastError: string | null
      createdAt: string
      updatedAt: string
    }>
  } | null> {
    const run = await prisma.inspectionRun.findUnique({
      where: { id: runId },
      include: {
        findings: {
          orderBy: { createdAt: 'asc' },
        },
        repairRuns: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!run) {
      return null
    }

    return {
      run: transformInspectionRun(run),
      findings: run.findings.map((record) => ({
        id: record.id,
        runId: record.runId,
        articleId: record.articleId,
        ruleKey: record.ruleKey,
        severity: record.severity as RiskLevel,
        fieldPath: record.fieldPath,
        title: record.title,
        evidence: fromJsonValue(record.evidence, {}),
        suggestedPatch: record.suggestedPatch ? fromJsonValue(record.suggestedPatch, {}) : null,
        autoFixable: record.autoFixable,
        status: record.status as InspectionFinding['status'],
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      repairs: run.repairRuns.map((repair) => ({
        id: repair.id,
        articleId: repair.articleId,
        inspectionRunId: repair.inspectionRunId,
        findingIds: fromJsonValue<string[]>(repair.findingIds, []),
        mode: repair.mode,
        status: repair.status,
        diff: fromJsonValue<Record<string, unknown>>(repair.diff, {}),
        evidenceSummary: fromJsonValue<Record<string, unknown>>(repair.evidenceSummary, {}),
        validatorResult: fromJsonValue<Record<string, unknown>>(repair.validatorResult, {}),
        riskBefore: repair.riskBefore,
        riskAfter: repair.riskAfter,
        appliedAt: repair.appliedAt?.toISOString() || null,
        lastError: repair.lastError,
        createdAt: repair.createdAt.toISOString(),
        updatedAt: repair.updatedAt.toISOString(),
      })),
    }
  }

  private async getInspectableArticle(articleId: string): Promise<InspectableArticle | null> {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        slug: true,
        status: true,
        title: true,
        summary: true,
        content: true,
        metadata: true,
        verificationStatus: true,
        updatedAt: true,
        verificationRecords: {
          orderBy: { verifiedAt: 'desc' },
          take: 5,
          select: { verifiedAt: true },
        },
      },
    })

    if (!article || article.status !== 'published') {
      return null
    }

    return {
      id: article.id,
      slug: article.slug,
      title: fromJsonValue(article.title, { zh: '', en: '' }),
      summary: fromJsonValue(article.summary, { zh: '', en: '' }),
      content: fromJsonValue(article.content, { zh: '', en: '' }),
      metadata: fromJsonValue<ArticleMetadata>(article.metadata, getDefaultMetadata()),
      verificationStatus: article.verificationStatus,
      updatedAt: article.updatedAt,
      verificationRecords: article.verificationRecords,
    }
  }

  private async persistFindings(
    runId: string,
    articleId: string,
    findings: InspectionCandidate[]
  ): Promise<InspectionFinding[]> {
    if (findings.length === 0) {
      return []
    }

    const records = await Promise.all(findings.map((finding) => prisma.inspectionFinding.create({
      data: buildInspectionFindingRecord(runId, articleId, finding) as any,
    })))

    return records.map((record) => ({
      id: record.id,
      runId: record.runId,
      articleId: record.articleId,
      ruleKey: record.ruleKey,
      severity: record.severity as RiskLevel,
      fieldPath: record.fieldPath,
      title: record.title,
      evidence: fromJsonValue(record.evidence, {}),
      suggestedPatch: record.suggestedPatch ? fromJsonValue(record.suggestedPatch, {}) : null,
      autoFixable: record.autoFixable,
      status: record.status as InspectionFinding['status'],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }))
  }

  private async updateArticleInspectionMetadata(
    article: InspectableArticle,
    summary: InspectionSeveritySummary,
    findings: InspectionCandidate[]
  ): Promise<void> {
    const highestSeverity = getHighestSeverity(findings)
    const now = new Date().toISOString()
    const nextMetadata: ArticleMetadata = {
      ...getDefaultMetadata(),
      ...article.metadata,
      lastInspectedAt: now,
      freshnessScore: calculateFreshnessScore(summary),
      inspectionStatus: highestSeverity ? 'partial' : 'completed',
      staleReason: findings[0]?.title || null,
      confidenceScore: this.calculateInspectionConfidence(article.metadata.confidenceScore, summary),
      riskLevel: highestSeverity || article.metadata.riskLevel || 'low',
      runtimeEnv: article.metadata.runtimeEnv || ([] as RuntimeEnv[]),
    }

    const updateData: Record<string, unknown> = {
      metadata: toJsonValue(nextMetadata),
    }

    if (highestSeverity && HIGH_RISK_SEVERITIES.has(highestSeverity)) {
      updateData.verificationStatus = 'partial'
    }

    await prisma.article.update({
      where: { id: article.id },
      data: updateData as any,
    })
  }

  private async applyAutomatedRepairs(
    article: InspectableArticle,
    inspectionRunId: string,
    findings: InspectionFinding[]
  ): Promise<void> {
    const replaceableFindings = findings.filter((finding) =>
      finding.autoFixable &&
      finding.status === 'open' &&
      finding.suggestedPatch?.type === 'replace_text'
    )

    if (replaceableFindings.length === 0) {
      return
    }

    const summary = {
      ...article.summary,
    }
    const content = {
      ...article.content,
    }
    const diffOps: Array<Record<string, unknown>> = []
    const appliedFindingIds: string[] = []
    const rejectedFindingIds: string[] = []

    for (const finding of replaceableFindings) {
      const target = typeof finding.suggestedPatch?.target === 'string'
        ? finding.suggestedPatch.target
        : null
      const replacement = typeof finding.suggestedPatch?.replacement === 'string'
        ? finding.suggestedPatch.replacement
        : null

      if (!target || !replacement) {
        rejectedFindingIds.push(finding.id)
        continue
      }

      const tempSummary = { ...summary }
      const tempContent = { ...content }
      const changedFields = this.applyTextReplacement(tempSummary, tempContent, target, replacement)
      if (changedFields.length === 0) {
        rejectedFindingIds.push(finding.id)
        continue
      }

      const touchedLocales = new Set(changedFields.map((field) => field.locale))
      if (!touchedLocales.has('zh') || !touchedLocales.has('en')) {
        rejectedFindingIds.push(finding.id)
        continue
      }

      summary.zh = tempSummary.zh
      summary.en = tempSummary.en
      content.zh = tempContent.zh
      content.en = tempContent.en

      appliedFindingIds.push(finding.id)
      diffOps.push({
        ruleKey: finding.ruleKey,
        target,
        replacement,
        changedFields,
      })
    }

    if (rejectedFindingIds.length > 0) {
      await prisma.inspectionFinding.updateMany({
        where: { id: { in: rejectedFindingIds } },
        data: { status: 'manual_required' },
      })
    }

    if (appliedFindingIds.length === 0) {
      return
    }

    const validatorResult = this.validateRepairDiff(article, summary, content)
    if (!validatorResult.passed) {
      await prisma.inspectionFinding.updateMany({
        where: { id: { in: appliedFindingIds } },
        data: { status: 'manual_required' },
      })

      const repairRun = await prisma.repairRun.create({
        data: {
          articleId: article.id,
          inspectionRunId,
          findingIds: toJsonValue(appliedFindingIds) as any,
          mode: 'safe_auto',
          status: 'failed',
          diff: toJsonValue(diffOps) as any,
          evidenceSummary: toJsonValue({
            findingIds: appliedFindingIds,
          }) as any,
          validatorResult: toJsonValue(validatorResult) as any,
          riskBefore: article.metadata.riskLevel || 'low',
          riskAfter: article.metadata.riskLevel || 'low',
          lastError: validatorResult.reason || 'Repair validator rejected patch',
        },
      })

      await eventBus.emit('article:repair-failed', {
        articleId: article.id,
        repairRunId: repairRun.id,
        inspectionRunId,
        reason: validatorResult.reason || 'Repair validator rejected patch',
      }, {
        aggregateId: article.id,
        aggregateType: 'Article',
        source: 'inspection-service',
      })

      return
    }

    const now = new Date()
    const nextMetadata: ArticleMetadata = {
      ...getDefaultMetadata(),
      ...article.metadata,
      lastInspectedAt: article.metadata.lastInspectedAt || now.toISOString(),
      lastRepairedAt: now.toISOString(),
      inspectionStatus: 'completed',
      staleReason: null,
      freshnessScore: Math.max(article.metadata.freshnessScore || 0, 80),
    }

    const repairRun = await prisma.repairRun.create({
      data: {
        articleId: article.id,
        inspectionRunId,
        findingIds: toJsonValue(appliedFindingIds) as any,
        mode: 'safe_auto',
        status: 'applying',
        diff: toJsonValue(diffOps) as any,
        evidenceSummary: toJsonValue({
          findingIds: appliedFindingIds,
          appliedAt: now.toISOString(),
        }) as any,
        validatorResult: toJsonValue(validatorResult) as any,
        riskBefore: article.metadata.riskLevel || 'low',
        riskAfter: nextMetadata.riskLevel || article.metadata.riskLevel || 'low',
      },
    })

    try {
      const updatedArticle = await prisma.article.update({
        where: { id: article.id },
        data: {
          summary: toJsonValue(summary) as any,
          content: toJsonValue(content) as any,
          metadata: toJsonValue(nextMetadata) as any,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          content: true,
          metadata: true,
          updatedAt: true,
        },
      })

      await prisma.inspectionFinding.updateMany({
        where: { id: { in: appliedFindingIds } },
        data: { status: 'applied' },
      })

      await prisma.repairRun.update({
        where: { id: repairRun.id },
        data: {
          status: 'applied',
          appliedAt: now,
        },
      })

      await prisma.inspectionRun.update({
        where: { id: inspectionRunId },
        data: {
          contentHashAfter: hashArticleSnapshot(updatedArticle),
        },
      })

      await Promise.all([
        deleteCachePattern(CacheKeys.article(article.id)),
        deleteCachePattern(CacheKeys.articleSlug(article.slug)),
        deleteCachePattern(`render:*:${article.id}:*`),
      ])

      await eventBus.emit('article:repair-applied', {
        articleId: article.id,
        repairRunId: repairRun.id,
        inspectionRunId,
        mode: 'safe_auto',
      }, {
        aggregateId: article.id,
        aggregateType: 'Article',
        source: 'inspection-service',
      })

      await eventBus.emit('article:updated', {
        articleId: article.id,
        updatedBy: 'inspection-bot',
        changes: ['summary', 'content', 'metadata'],
      }, {
        aggregateId: article.id,
        aggregateType: 'Article',
        source: 'inspection-repair',
      })

      await this.createAutomaticVerification(article.id, findings, appliedFindingIds)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown repair error'

      await prisma.repairRun.update({
        where: { id: repairRun.id },
        data: {
          status: 'failed',
          lastError: message,
        },
      })

      await prisma.inspectionFinding.updateMany({
        where: { id: { in: appliedFindingIds } },
        data: { status: 'manual_required' },
      })

      await eventBus.emit('article:repair-failed', {
        articleId: article.id,
        repairRunId: repairRun.id,
        inspectionRunId,
        reason: message,
      }, {
        aggregateId: article.id,
        aggregateType: 'Article',
        source: 'inspection-service',
      })
    }
  }

  private calculateInspectionConfidence(
    currentScore: number,
    summary: InspectionSeveritySummary
  ): number {
    const base = typeof currentScore === 'number' ? currentScore : 80
    const penalty =
      summary.low * 2 +
      summary.medium * 6 +
      summary.high * 12 +
      summary.critical * 20

    return Math.max(0, Math.min(100, base - penalty))
  }

  private async inspectBilingualCompleteness(article: InspectableArticle): Promise<InspectionCandidate[]> {
    const findings: InspectionCandidate[] = []

    const fields: Array<keyof Pick<InspectableArticle, 'title' | 'summary' | 'content'>> = ['title', 'summary', 'content']
    fields.forEach((field) => {
      const value = article[field]
      const zh = value.zh.trim()
      const en = value.en.trim()

      if (!zh || !en) {
        findings.push({
          ruleKey: 'bilingual.missing_locale',
          severity: 'high',
          fieldPath: field,
          title: `${field} 缺少中英文完整内容`,
          evidence: {
            field,
            hasZh: Boolean(zh),
            hasEn: Boolean(en),
          },
          suggestedPatch: null,
          autoFixable: false,
          status: 'manual_required',
        })
      }
    })

    return findings
  }

  private async inspectVerificationFreshness(article: InspectableArticle): Promise<InspectionCandidate[]> {
    const latestVerification = article.verificationRecords[0]
    if (!latestVerification) {
      return [{
        ruleKey: 'verification.missing_record',
        severity: 'high',
        fieldPath: 'verificationRecords',
        title: '文章缺少验证记录',
        evidence: {
          verificationStatus: article.verificationStatus,
        },
        suggestedPatch: {
          type: 'degrade_verification_status',
          nextStatus: 'partial',
        },
        autoFixable: true,
      }]
    }

    const ageDays = Math.floor((Date.now() - latestVerification.verifiedAt.getTime()) / (24 * 60 * 60 * 1000))
    if (ageDays <= 30) {
      return []
    }

    return [{
      ruleKey: 'verification.stale_record',
      severity: ageDays > 90 ? 'critical' : 'high',
      fieldPath: 'verificationRecords[0].verifiedAt',
      title: '文章验证记录过期',
      evidence: {
        latestVerifiedAt: latestVerification.verifiedAt.toISOString(),
        ageDays,
      },
      suggestedPatch: {
        type: 'degrade_verification_status',
        nextStatus: 'partial',
        ageDays,
      },
      autoFixable: true,
    }]
  }

  private async inspectLegacyDomain(article: InspectableArticle): Promise<InspectionCandidate[]> {
    const fields: Array<keyof Pick<InspectableArticle, 'summary' | 'content'>> = ['summary', 'content']
    const findings: InspectionCandidate[] = []

    fields.forEach((field) => {
      const value = article[field]
      const matches = [value.zh, value.en].some((text) => text.includes('buzhou.ai'))
      if (!matches) {
        return
      }

      findings.push({
        ruleKey: 'content.legacy_domain',
        severity: 'medium',
        fieldPath: field,
        title: '文章包含过期站点域名 buzhou.ai',
        evidence: {
          field,
          replacement: 'https://buzhou.io',
        },
        suggestedPatch: {
          type: 'replace_text',
          target: 'buzhou.ai',
          replacement: 'buzhou.io',
        },
        autoFixable: true,
      })
    })

    return findings
  }

  private async inspectLinks(article: InspectableArticle): Promise<InspectionCandidate[]> {
    const links = Array.from(new Set([
      ...extractLinks(article.summary.zh),
      ...extractLinks(article.summary.en),
      ...extractLinks(article.content.zh),
      ...extractLinks(article.content.en),
    ])).slice(0, 10)

    if (links.length === 0) {
      return []
    }

    const checks = await Promise.allSettled(links.map((link) => this.inspectLink(link)))
    const findings: InspectionCandidate[] = []

    checks.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        findings.push(result.value)
      }
    })

    return findings
  }

  private async inspectLink(link: string): Promise<InspectionCandidate | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(link, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      })

      if (response.ok && response.url && response.url !== link) {
        return {
          ruleKey: 'link.redirected',
          severity: 'low',
          fieldPath: 'content',
          title: `链接已重定向: ${link}`,
          evidence: {
            from: link,
            to: response.url,
            status: response.status,
          },
          suggestedPatch: {
            type: 'replace_text',
            target: link,
            replacement: response.url,
          },
          autoFixable: true,
        }
      }

      if (!response.ok) {
        return {
          ruleKey: 'link.unreachable',
          severity: response.status >= 500 ? 'medium' : 'high',
          fieldPath: 'content',
          title: `链接不可访问: ${link}`,
          evidence: {
            url: link,
            status: response.status,
          },
          suggestedPatch: null,
          autoFixable: false,
          status: 'manual_required',
        }
      }

      return null
    } catch (error) {
      return {
        ruleKey: 'link.check_failed',
        severity: 'medium',
        fieldPath: 'content',
        title: `链接检查失败: ${link}`,
        evidence: {
          url: link,
          error: error instanceof Error ? error.message : String(error),
        },
        suggestedPatch: null,
        autoFixable: false,
        status: 'manual_required',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  private applyTextReplacement(
    summary: LocalizedString,
    content: LocalizedString,
    target: string,
    replacement: string
  ): Array<{ field: 'summary' | 'content'; locale: 'zh' | 'en' }> {
    const changedFields: Array<{ field: 'summary' | 'content'; locale: 'zh' | 'en' }> = []

    ;(['zh', 'en'] as const).forEach((locale) => {
      if (summary[locale].includes(target)) {
        summary[locale] = summary[locale].split(target).join(replacement)
        changedFields.push({ field: 'summary', locale })
      }

      if (content[locale].includes(target)) {
        content[locale] = content[locale].split(target).join(replacement)
        changedFields.push({ field: 'content', locale })
      }
    })

    return changedFields
  }

  private validateRepairDiff(
    article: InspectableArticle,
    nextSummary: LocalizedString,
    nextContent: LocalizedString
  ): { passed: boolean; zhRatio: number; enRatio: number; reason: string | null } {
    const zhBase = `${article.summary.zh}\n${article.content.zh}`.length || 1
    const enBase = `${article.summary.en}\n${article.content.en}`.length || 1
    const zhDelta = Math.abs(`${nextSummary.zh}\n${nextContent.zh}`.length - zhBase)
    const enDelta = Math.abs(`${nextSummary.en}\n${nextContent.en}`.length - enBase)
    const zhRatio = zhDelta / zhBase
    const enRatio = enDelta / enBase

    if (zhRatio > 0.2 || enRatio > 0.2) {
      return {
        passed: false,
        zhRatio,
        enRatio,
        reason: 'Patch exceeds 20% content change limit',
      }
    }

    return {
      passed: true,
      zhRatio,
      enRatio,
      reason: null,
    }
  }

  private async createAutomaticVerification(
    articleId: string,
    findings: InspectionFinding[],
    appliedFindingIds: string[]
  ): Promise<void> {
    const verifierId = await this.ensureInspectionBotVerifier()
    const unresolvedFindings = findings.filter((finding) => !appliedFindingIds.includes(finding.id))
    const hasHighRiskUnresolved = unresolvedFindings.some((finding) => HIGH_RISK_SEVERITIES.has(finding.severity))

    await verificationService.createRecord({
      articleId,
      verifierId,
      result: hasHighRiskUnresolved || unresolvedFindings.length > 0 ? 'partial' : 'passed',
      environment: {
        os: 'server',
        runtime: 'inspection-worker',
        version: 'v1',
      },
      notes: hasHighRiskUnresolved || unresolvedFindings.length > 0
        ? 'Auto-repair applied, but unresolved findings remain.'
        : 'Auto-repair applied and deterministic inspection checks passed.',
    })
  }

  private async ensureInspectionBotVerifier(): Promise<number> {
    const existing = await prisma.verifier.findFirst({
      where: {
        type: 'official_bot',
        name: 'Inspection Bot',
      },
      select: { id: true },
    })

    if (existing) {
      return existing.id
    }

    const verifier = await prisma.verifier.create({
      data: {
        type: 'official_bot',
        name: 'Inspection Bot',
        description: 'Automated verifier for article inspection and repair',
        credentials: toJsonValue({
          verified: true,
          system: true,
        }) as any,
        status: 'active',
      },
      select: { id: true },
    })

    return verifier.id
  }
}

export const articleInspectionService = new ArticleInspectionService()
