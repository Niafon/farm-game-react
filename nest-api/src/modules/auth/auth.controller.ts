import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  async me(@Req() req: any) {
    const sid = req.cookies?.sid
    const sess = await this.auth.getSession(sid)
    if (!sess) throw new UnauthorizedException()
    return { ok: true, address: sess.address }
  }
}


