import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Vercel 需要使用 directUrl 进行连接池连接
    // 本地开发时 DATABASE_DIRECT_URL 不存在，会回退到 DATABASE_URL
    datasourceUrl: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma