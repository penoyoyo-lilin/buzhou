#!/usr/bin/env node

/**
 * 生成内部 API Key
 * 用法: node scripts/generate-internal-key.js
 */

import { randomBytes } from 'crypto'

// 生成 32 字节的随机密钥（64 位十六进制字符串）
const key = randomBytes(32).toString('hex')

console.log('========================================')
console.log('  内部 API Key 已生成')
console.log('========================================')
console.log()
console.log('API Key:')
console.log(key)
console.log()
console.log('请将以下内容添加到 .env 文件:')
console.log(`INTERNAL_API_KEY="${key}"`)
console.log()
console.log('========================================')
console.log('⚠️  请妥善保管此密钥，不要提交到代码仓库')
console.log('========================================')