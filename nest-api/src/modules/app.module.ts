import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { CacheModule } from './cache/cache.module'
import { FarmModule } from './farm/farm.module'

@Module({
  imports: [AuthModule, CacheModule, FarmModule],
})
export class AppModule {}


