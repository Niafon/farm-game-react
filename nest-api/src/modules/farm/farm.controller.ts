import { Controller, Get, Req, UnauthorizedException, Inject } from '@nestjs/common'

@Controller('farm')
export class FarmController {
  constructor(@Inject('REDIS') private readonly redis: any) {}

  @Get('feed')
  async feed(@Req() req: any) {
    const sid = req.cookies?.sid
    if (!sid) throw new UnauthorizedException()
    // Example: return cached UI feed if present
    const cached = this.redis ? await this.redis.get('ui:feed') : null
    return { ok: true, feed: cached ? JSON.parse(cached) : [] }
  }
}


