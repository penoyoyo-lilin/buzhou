import { prisma } from '@/core/db/client'

export function isArticleDomainEnumValueError(error: unknown, domain?: string): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === '22P02') return true

  const message = error instanceof Error ? error.message : String(error)
  if (!/invalid input value for enum\s+"?ArticleDomain"?/i.test(message)) {
    return false
  }

  if (!domain) return true
  return message.includes(`"${domain}"`) || message.includes(`'${domain}'`)
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

export async function ensureArticleDomainEnumValue(domain: string): Promise<boolean> {
  try {
    const existing = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'ArticleDomain' AND e.enumlabel = $1`,
      domain
    )

    if (existing.length > 0) {
      return true
    }

    await prisma.$executeRawUnsafe(
      `ALTER TYPE "ArticleDomain" ADD VALUE IF NOT EXISTS '${escapeSqlLiteral(domain)}'`
    )

    return true
  } catch {
    return false
  }
}
