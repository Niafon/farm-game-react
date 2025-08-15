import Redis from 'ioredis'

export class NonceManager {
  constructor(redisUrl) {
    this.redis = redisUrl ? new Redis(redisUrl) : null
    this.local = new Map()
  }
  async nextNonce(address) {
    const key = `relay:nonce:${address.toLowerCase()}`
    if (this.redis) {
      const val = await this.redis.incr(key)
      if (val === 1) await this.redis.expire(key, 3600)
      return BigInt(val - 1)
    }
    const cur = this.local.get(key) ?? 0n
    this.local.set(key, cur + 1n)
    return cur
  }
}


