import { Module, Global } from '@nestjs/common'
import Redis from 'ioredis'

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: () => (process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null),
    },
  ],
  exports: ['REDIS'],
})
export class CacheModule {}


