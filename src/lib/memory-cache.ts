/**
 * 内存缓存模块
 * 用于本地开发或 Redis 不可用时的降级方案
 */

// ============================================
// 类型定义
// ============================================

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// ============================================
// MemoryCache 类
// ============================================

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // 每 60 秒清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * 设置缓存
   */
  async set(key: string, data: unknown, ttl: number = 3600): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000
    this.cache.set(key, { data, expiresAt })
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    this.cache.delete(key)
  }

  /**
   * 删除匹配模式的缓存
   */
  async delPattern(pattern: string): Promise<void> {
    const regex = this.patternToRegex(pattern)
    const keys = Array.from(this.cache.keys())
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 将 Redis 风格的模式转换为正则表达式
   */
  private patternToRegex(pattern: string): RegExp {
    const regexStr = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${regexStr}$`)
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}

// 导出单例
export const memoryCache = new MemoryCache()

// 兼容 Redis 接口的方法
export async function getMemoryCache<T>(key: string): Promise<T | null> {
  return memoryCache.get<T>(key)
}

export async function setMemoryCache(
  key: string,
  data: unknown,
  ttl: number = 3600
): Promise<void> {
  return memoryCache.set(key, data, ttl)
}

export async function delMemoryCache(key: string): Promise<void> {
  return memoryCache.del(key)
}

export async function delMemoryCachePattern(pattern: string): Promise<void> {
  return memoryCache.delPattern(pattern)
}

export async function hasMemoryCache(key: string): Promise<boolean> {
  return memoryCache.exists(key)
}