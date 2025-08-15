import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './modules/app.module'
import cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',').filter(Boolean) || false, credentials: true })
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 8080)
}
bootstrap()


