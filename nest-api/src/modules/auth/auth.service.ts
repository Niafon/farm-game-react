import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class AuthService {
  private redis: Redis | null
  constructor() {
    this.redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null
  }
  async getSession(sid: string | undefined) {
    if (!sid) return null
    if (this.redis) {
      const raw = await this.redis.get(`siwe:sid:${sid}`)
      return raw ? JSON.parse(raw) : null
    }
    return null
  }
}


