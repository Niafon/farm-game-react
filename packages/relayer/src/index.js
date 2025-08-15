import express from 'express'
import cookieParser from 'cookie-parser'
import { z } from 'zod'
import Redis from 'ioredis'
import { NonceManager } from './nonce.js'

const app = express()
app.use(express.json())
app.use(cookieParser())

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null
const nonceMgr = new NonceManager(process.env.REDIS_URL)

function id() { return Math.random().toString(36).slice(2) }

app.post('/jobs', async (req, res) => {
  const schema = z.object({ to: z.string().startsWith('0x').length(42), data: z.string().startsWith('0x'), value: z.string().optional(), chainId: z.number().int().positive() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false })
  const idempotencyKey = req.headers['idempotency-key']
  if (idempotencyKey && redis) {
    const exists = await redis.get(`relay:idemp:${idempotencyKey}`)
    if (exists) return res.json(JSON.parse(exists))
  }
  const jobId = id()
  const job = { id: jobId, status: 'queued', ...parsed.data, createdAt: Date.now() }
  if (redis) await redis.lpush('relay:q', JSON.stringify(job))
  const resp = { ok: true, jobId }
  if (idempotencyKey && redis) await redis.setex(`relay:idemp:${idempotencyKey}`, 600, JSON.stringify(resp))
  return res.json(resp)
})

app.get('/jobs/:id', async (req, res) => {
  // Placeholder: a real impl would query Redis/DB by id
  return res.json({ ok: true, id: req.params.id, status: 'queued' })
})

const port = process.env.PORT ? Number(process.env.PORT) : 8899
app.listen(port, () => console.log(`Relayer listening on :${port}`))


