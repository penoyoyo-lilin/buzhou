/**
 * 数据库工具函数
 * 用于处理 SQLite 和 PostgreSQL 之间的差异
 */

/**
 * 检测当前是否使用 PostgreSQL 数据库
 */
export function isPostgreSQL(): boolean {
  const dbUrl = process.env.DATABASE_URL || ''
  return dbUrl.includes('postgresql') || dbUrl.includes('postgres')
}

/**
 * 检测当前是否使用 SQLite 数据库
 */
export function isSQLite(): boolean {
  const dbUrl = process.env.DATABASE_URL || ''
  return dbUrl.includes('file:') || dbUrl.includes('.db')
}

/**
 * 将值转换为适合数据库存储的 JSON 格式
 * - PostgreSQL: 直接返回对象（Prisma Json 类型自动处理）
 * - SQLite: 返回 JSON 字符串
 */
export function toJsonValue<T>(value: T): T | string {
  if (value === null || value === undefined) {
    return value as T | string
  }

  // PostgreSQL 使用 Json 类型，直接传对象
  if (isPostgreSQL()) {
    return value
  }

  // SQLite 使用 String 类型，需要序列化
  // 如果已经是字符串，直接返回
  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value)
}

/**
 * 从数据库值解析 JSON
 * - PostgreSQL: Prisma 已经自动解析
 * - SQLite: 需要手动解析字符串
 */
export function fromJsonValue<T>(value: unknown, defaultValue: T): T {
  if (!value) return defaultValue

  // 如果已经是对象，直接返回
  if (typeof value !== 'string') {
    return value as T
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return defaultValue
  }
}