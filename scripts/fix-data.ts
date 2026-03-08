/**
 * 数据修复脚本
 * 用于修复线上污染数据
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始数据修复...\n')

  // 0. 添加新的枚举值到 ArticleDomain
  console.log('0. 扩展 ArticleDomain 枚举...')

  const newDomains = [
    'foundation', 'transport',
    'tools_filesystem', 'tools_postgres', 'tools_github',
    'error_codes', 'scenarios'
  ]

  for (const domain of newDomains) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "ArticleDomain" ADD VALUE IF NOT EXISTS '${domain}'`
      )
      console.log(`  添加枚举值: ${domain}`)
    } catch (e) {
      console.log(`  枚举值 ${domain} 可能已存在，跳过`)
    }
  }

  // 1. 修复 domain 字段命名（连字符改下划线）
  console.log('\n1. 修复 domain 字段命名...')

  const domainMappings: Record<string, string> = {
    'tools-filesystem': 'tools_filesystem',
    'tools-postgres': 'tools_postgres',
    'tools-github': 'tools_github',
    'error-codes': 'error_codes',
  }

  for (const [oldDomain, newDomain] of Object.entries(domainMappings)) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE articles SET domain = '${newDomain}'::"ArticleDomain" WHERE domain::text = '${oldDomain}'`
    )
    console.log(`  ${oldDomain} -> ${newDomain}: ${result} 条记录`)
  }

  // 2. 修复 published_at 为空但状态为 published 的文章
  console.log('\n2. 修复 published_at 为空的记录...')

  const publishedResult = await prisma.$executeRaw`
    UPDATE articles
    SET published_at = created_at
    WHERE status = 'published' AND published_at IS NULL
  `
  console.log(`  修复了 ${publishedResult} 条记录`)

  // 3. 验证结果
  console.log('\n3. 验证结果...')

  const stats = await prisma.$queryRaw<Array<{
    total: bigint
    null_published: bigint
    unique_domains: bigint
  }>>`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN published_at IS NULL THEN 1 END) as null_published,
      COUNT(DISTINCT domain) as unique_domains
    FROM articles
  `

  console.log(`  总文章数: ${stats[0].total}`)
  console.log(`  published_at 为空: ${stats[0].null_published}`)
  console.log(`  不同的 domain 数: ${stats[0].unique_domains}`)

  // 3.1 检查 published_at 为空的记录详情
  console.log('\n  published_at 为空的记录:')
  const nullPublishedRecords = await prisma.$queryRaw<Array<{
    id: string
    status: string
    published_at: Date | null
    created_at: Date
  }>>`
    SELECT id, status, published_at, created_at
    FROM articles
    WHERE published_at IS NULL
    LIMIT 10
  `

  for (const r of nullPublishedRecords) {
    console.log(`    ${r.id} | status: ${r.status} | created: ${r.created_at}`)
  }

  // 4. 列出所有 domain 值
  console.log('\n4. 所有 domain 值分布...')

  const domains = await prisma.$queryRaw<Array<{ domain: string; count: bigint }>>`
    SELECT domain, COUNT(*) as count
    FROM articles
    GROUP BY domain
    ORDER BY count DESC
  `

  for (const d of domains) {
    console.log(`  ${d.domain}: ${d.count}`)
  }

  console.log('\n数据修复完成!')
}

main()
  .catch((e) => {
    console.error('修复失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })