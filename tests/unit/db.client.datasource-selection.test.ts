import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaClientCtorMock = vi.fn()
const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL,
  NODE_ENV: process.env.NODE_ENV,
}

vi.mock('@prisma/client', () => {
  class PrismaClient {
    constructor(options: unknown) {
      prismaClientCtorMock(options)
    }
  }
  return { PrismaClient }
})

describe('core db client datasource selection', () => {
  beforeEach(() => {
    vi.resetModules()
    prismaClientCtorMock.mockReset()
    delete (globalThis as { prisma?: unknown }).prisma
    delete process.env.DATABASE_URL
    delete process.env.DATABASE_DIRECT_URL
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv.DATABASE_URL
    process.env.DATABASE_DIRECT_URL = originalEnv.DATABASE_DIRECT_URL
    process.env.NODE_ENV = originalEnv.NODE_ENV
  })

  it('prefers DATABASE_URL when both pooled and direct URLs are provided', async () => {
    process.env.DATABASE_URL = 'postgresql://pool.example.com:6543/postgres?pgbouncer=true'
    process.env.DATABASE_DIRECT_URL = 'postgresql://direct.example.com:5432/postgres'

    await import('@/core/db/client')

    expect(prismaClientCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        datasourceUrl: process.env.DATABASE_URL,
      })
    )
  })

  it('falls back to DATABASE_DIRECT_URL when DATABASE_URL is absent', async () => {
    process.env.DATABASE_DIRECT_URL = 'postgresql://direct.example.com:5432/postgres'

    await import('@/core/db/client')

    expect(prismaClientCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        datasourceUrl: process.env.DATABASE_DIRECT_URL,
      })
    )
  })
})
