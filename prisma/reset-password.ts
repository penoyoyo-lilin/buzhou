/**
 * 重置管理员密码
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@buzhou.io'
  const password = 'buzhou@0308'

  console.log('🔄 重置管理员密码...')

  // 生成新的密码哈希
  const passwordHash = await bcrypt.hash(password, 10)

  // 更新密码
  const admin = await prisma.admin.update({
    where: { email },
    data: { passwordHash },
  })

  console.log('✅ 密码重置成功！')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`   邮箱: ${email}`)
  console.log(`   密码: ${password}`)
  console.log(`   角色: ${admin.role}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ 重置失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })