import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const pooledDatabaseUrl = process.env.DATABASE_URL?.trim()
const directDatabaseUrl = process.env.DATABASE_DIRECT_URL?.trim()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Vercel Serverless 优先使用连接池 URL（DATABASE_URL），直连仅作为兜底
    datasourceUrl: pooledDatabaseUrl || directDatabaseUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
