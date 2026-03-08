/**
 * 缓存模块
 * 支持 Redis 和内存缓存降级
 */

import Redis from 'ioredis'
import {
  memoryCache,
  getMemoryCache,
  setMemoryCache,
  delMemoryCache,
  delMemoryCachePattern,
  hasMemoryCache,
} from '@/lib/memory-cache'

// ============================================
// 配置
// ============================================

const USE_MEMORY_CACHE = process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL

// ============================================
// Redis 客户端（可选）
// ============================================

let redis: Redis | null = null
let redisAvailable = false

if (!USE_MEMORY_CACHE) {
  try {
    const globalForRedis = globalThis as unknown as {
      redis: Redis | undefined
    }

    redis =
      globalForRedis.redis ??
      new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: () => null, // 连接失败时不重试
      })

    if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

    // 监听连接事件
    redis.on('connect', () => {
      redisAvailable = true
      console.log('Redis connected')
    })

    redis.on('error', (err) => {
      console.warn('Redis connection error, falling back to memory cache:', err.message)
      redisAvailable = false
    })

    redis.on('close', () => {
      redisAvailable = false
    })
  } catch (error) {
    console.warn('Redis initialization failed, using memory cache:', error)
    redis = null
    redisAvailable = false
  }
}

// ============================================
// 缓存键前缀
// ============================================

export const CacheKeys = {
  article: (id: string) => `article:${id}`,
  articleSlug: (slug: string) => `article:slug:${slug}`,
  articleList: (params: string) => `articles:${params}`,
  renderHuman: (id: string, lang: string) => `render:human:${id}:${lang}`,
  renderAgent: (id: string, format: string) => `render:agent:${id}:${format}`,
  verifier: (id: string) => `verifier:${id}`,
} as const

// ============================================
// 默认缓存过期时间（秒）
// ============================================

export const CacheTTL = {
  short: 60,          // 1 分钟
  medium: 3600,       // 1 小时
  long: 86400,        // 1 天
  week: 604800,       // 1 周
} as const

// ============================================
// 缓存操作函数
// ============================================

/**
 * 获取缓存
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // 优先使用内存缓存（如果 Redis 不可用）
  if (!redis || !redisAvailable) {
    return getMemoryCache<T>(key)
  }

  try {
    const data = await redis.get(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    console.error('Redis get error, falling back to memory cache:', error)
    return getMemoryCache<T>(key)
  }
}

/**
 * 设置缓存
 */
export async function setCache(
  key: string,
  data: unknown,
  ttl: number = CacheTTL.medium
): Promise<void> {
  // 优先使用内存缓存（如果 Redis 不可用）
  if (!redis || !redisAvailable) {
    return setMemoryCache(key, data, ttl)
  }

  try {
    await redis.setex(key, ttl, JSON.stringify(data))
  } catch (error) {
    console.error('Redis set error, falling back to memory cache:', error)
    await setMemoryCache(key, data, ttl)
  }
}

/**
 * 删除缓存
 */
export async function deleteCache(key: string): Promise<void> {
  // 同时删除两个缓存
  await Promise.all([
    redis && redisAvailable ? redis.del(key).catch(() => {}) : Promise.resolve(),
    delMemoryCache(key),
  ])
}

/**
 * 删除匹配模式的缓存
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  // 同时删除两个缓存
  const promises: Promise<unknown>[] = [delMemoryCachePattern(pattern)]

  if (redis && redisAvailable) {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        promises.push(redis.del(...keys))
      }
    } catch (error) {
      console.error('Redis pattern delete error:', error)
    }
  }

  await Promise.all(promises)
}

/**
 * 检查缓存是否存在
 */
export async function hasCache(key: string): Promise<boolean> {
  if (!redis || !redisAvailable) {
    return hasMemoryCache(key)
  }

  try {
    const exists = await redis.exists(key)
    return exists === 1
  } catch (error) {
    console.error('Redis exists error, falling back to memory cache:', error)
    return hasMemoryCache(key)
  }
}

/**
 * 获取缓存状态
 */
export function getCacheStatus(): { type: 'redis' | 'memory'; available: boolean } {
  return {
    type: redis && redisAvailable ? 'redis' : 'memory',
    available: true,
  }
}

// 导出 Redis 实例（用于其他需要 Redis 的功能）
export { redis }
export default redis