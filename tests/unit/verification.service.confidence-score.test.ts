import { beforeEach, describe, expect, it, vi } from 'vitest'

const verificationFindManyMock = vi.fn()
const articleFindUniqueMock = vi.fn()
const articleUpdateMock = vi.fn()

vi.mock('@/core/db/client', () => ({
  default: {
    verificationRecord: {
      findMany: verificationFindManyMock,
    },
    article: {
      findUnique: articleFindUniqueMock,
      update: articleUpdateMock,
    },
  },
}))

describe('VerificationService confidence score constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    articleFindUniqueMock.mockResolvedValue({
      metadata: JSON.stringify({
        applicableVersions: [],
        confidenceScore: 0,
        riskLevel: 'low',
        runtimeEnv: [],
      }),
    })

    articleUpdateMock.mockResolvedValue({ id: 'art_test' })
  })

  const getLastUpdatePayload = () => {
    const call = articleUpdateMock.mock.calls.at(-1)?.[0] as
      | { data?: { verificationStatus?: string; metadata?: unknown } }
      | undefined

    const metadataRaw = call?.data?.metadata
    const metadata = typeof metadataRaw === 'string'
      ? JSON.parse(metadataRaw)
      : (metadataRaw as Record<string, unknown>)

    return {
      verificationStatus: call?.data?.verificationStatus,
      confidenceScore: Number(metadata?.confidenceScore ?? 0),
      metadata,
    }
  }

  it('should enforce score >= 90 when status=verified and total>=2', async () => {
    verificationFindManyMock.mockResolvedValue([
      { result: 'passed', verifierId: 1, verifiedAt: new Date('2026-03-11T10:00:00.000Z') },
      { result: 'passed', verifierId: 2, verifiedAt: new Date('2026-03-12T10:00:00.000Z') },
    ])

    const { verificationService } = await import('@/services/verification.service')
    await verificationService.updateArticleStatus('art_test')

    const payload = getLastUpdatePayload()
    expect(payload.verificationStatus).toBe('verified')
    expect(payload.confidenceScore).toBeGreaterThanOrEqual(90)
  })

  it('should enforce score >= 95 when status=verified and total>=5', async () => {
    verificationFindManyMock.mockResolvedValue([
      { result: 'passed', verifierId: 1, verifiedAt: new Date('2026-03-11T10:00:00.000Z') },
      { result: 'passed', verifierId: 2, verifiedAt: new Date('2026-03-11T11:00:00.000Z') },
      { result: 'passed', verifierId: 3, verifiedAt: new Date('2026-03-11T12:00:00.000Z') },
      { result: 'passed', verifierId: 1, verifiedAt: new Date('2026-03-11T13:00:00.000Z') },
      { result: 'passed', verifierId: 2, verifiedAt: new Date('2026-03-12T10:00:00.000Z') },
    ])

    const { verificationService } = await import('@/services/verification.service')
    await verificationService.updateArticleStatus('art_test')

    const payload = getLastUpdatePayload()
    expect(payload.verificationStatus).toBe('verified')
    expect(payload.confidenceScore).toBeGreaterThanOrEqual(95)
    expect(payload.metadata.riskLevel).toBe('low')
  })

  it('should enforce score <= 60 when status=failed and total>=3', async () => {
    verificationFindManyMock.mockResolvedValue([
      { result: 'failed', verifierId: 1, verifiedAt: new Date('2026-03-10T10:00:00.000Z') },
      { result: 'failed', verifierId: 2, verifiedAt: new Date('2026-03-11T10:00:00.000Z') },
      { result: 'failed', verifierId: 3, verifiedAt: new Date('2026-03-12T10:00:00.000Z') },
    ])

    const { verificationService } = await import('@/services/verification.service')
    await verificationService.updateArticleStatus('art_test')

    const payload = getLastUpdatePayload()
    expect(payload.verificationStatus).toBe('failed')
    expect(payload.confidenceScore).toBeLessThanOrEqual(60)
  })

  it('should treat partial-only verification records as partial status instead of pending', async () => {
    verificationFindManyMock.mockResolvedValue([
      { result: 'partial', verifierId: 1, verifiedAt: new Date('2026-03-12T10:00:00.000Z') },
    ])

    const { verificationService } = await import('@/services/verification.service')
    await verificationService.updateArticleStatus('art_test')

    const payload = getLastUpdatePayload()
    expect(payload.verificationStatus).toBe('partial')
  })
})
