// KV Store wrapper with in-memory fallback for development
// In production (Vercel), uses @vercel/kv Redis
// In development, uses in-memory Map

interface KVStoreInterface {
  get(key: string): Promise<any>
  set(key: string, value: any, options?: { ex?: number }): Promise<void>
  del(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

// In-memory implementation for local development
class InMemoryKVStore implements KVStoreInterface {
  private store = new Map<string, { value: any; expiry?: number }>()
  private _cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired entries every 5 minutes
    if (typeof global !== 'undefined') {
      this._cleanupInterval = setInterval(() => {
        const now = Date.now()
        for (const [key, { expiry }] of this.store.entries()) {
          if (expiry && expiry < now) {
            this.store.delete(key)
          }
        }
      }, 300000)
    }
  }

  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval)
    }
  }

  async get(key: string): Promise<any> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<void> {
    const expiry = options?.ex ? Date.now() + options.ex * 1000 : undefined
    this.store.set(key, { value, expiry })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key)
    if (!entry) return false
    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key)
      return false
    }
    return true
  }
}

// Production KV Store using @vercel/kv
class VercelKVStore implements KVStoreInterface {
  private kv: any

  constructor() {
    try {
      // @ts-ignore
      this.kv = require('@vercel/kv').kv
    } catch (e) {
      console.warn('Vercel KV not available, using in-memory store')
      this.kv = null
    }
  }

  async get(key: string): Promise<any> {
    if (!this.kv) return null
    const value = await this.kv.get(key)
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return value
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<void> {
    if (!this.kv) return
    const jsonValue = JSON.stringify(value)
    if (options?.ex) {
      await this.kv.setex(key, options.ex, jsonValue)
    } else {
      await this.kv.set(key, jsonValue)
    }
  }

  async del(key: string): Promise<void> {
    if (!this.kv) return
    await this.kv.del(key)
  }

  async exists(key: string): Promise<boolean> {
    if (!this.kv) return false
    return (await this.kv.exists(key)) === 1
  }
}

// Get appropriate KV store based on environment
function getKVStore(): KVStoreInterface {
  // Check if we're in Vercel production environment
  if (process.env.VERCEL === '1') {
    console.log('[KVStore] Using Vercel KV in production')
    return new VercelKVStore()
  }

  // Use in-memory store for development
  console.log('[KVStore] Using in-memory store for development')
  if (typeof global !== 'undefined' && !global.__inMemoryKVStore) {
    global.__inMemoryKVStore = new InMemoryKVStore()
  }
  return global.__inMemoryKVStore!
}

export const kvStore = getKVStore()
