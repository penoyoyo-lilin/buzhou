/**
 * 创建管理员账号脚本
 * 用于生产环境添加管理员
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@buzhou.io'
  const password = 'buzhou@0308'
  const name = 'Admin'

  console.log('🔐 创建管理员账号...')
  console.log(`   邮箱: ${email}`)

  // 检查是否已存在
  const existing = await prisma.admin.findUnique({
    where: { email }
  })

  if (existing) {
    console.log('⚠️ 该邮箱已存在管理员账号')
    console.log('   如需重置密码，请运行密码重置脚本')
    process.exit(1)
  }

  // 创建管理员
  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await prisma.admin.create({
    data: {
      id: `admin_${nanoid(12)}`,
      email,
      passwordHash,
      name,
      role: 'super_admin',
      status: 'active',
    },
  })

  console.log('\n✅ 管理员账号创建成功！')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`   邮箱: ${email}`)
  console.log(`   密码: ${password}`)
  console.log(`   角色: super_admin`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️ 请妥善保存账号信息，登录后建议修改密码')
}

main()
  .catch((e) => {
    console.error('❌ 创建失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })