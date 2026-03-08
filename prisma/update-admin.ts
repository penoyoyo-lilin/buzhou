/**
 * 更新管理员邮箱
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const oldEmail = 'admin@lilin'
  const newEmail = 'admin@buzhou.io'

  console.log('🔄 更新管理员邮箱...')

  // 检查旧账号是否存在
  const existing = await prisma.admin.findUnique({
    where: { email: oldEmail }
  })

  if (existing) {
    // 更新邮箱
    await prisma.admin.update({
      where: { email: oldEmail },
      data: { email: newEmail }
    })
    console.log(`✅ 邮箱已更新: ${oldEmail} -> ${newEmail}`)
  } else {
    // 检查新邮箱是否已存在
    const newExisting = await prisma.admin.findUnique({
      where: { email: newEmail }
    })

    if (newExisting) {
      console.log('ℹ️ 管理员账号已存在')
    } else {
      console.log('❌ 未找到管理员账号，请重新创建')
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   邮箱: admin@buzhou.io')
  console.log('   密码: buzhou@0308')
  console.log('   角色: super_admin')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ 操作失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })