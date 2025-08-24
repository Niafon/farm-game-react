import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import crypto from 'node:crypto'
import { verifyMessage } from 'viem'

// Simple TOTP implementation without external deps
function generateMfaSecret() {
  return crypto.randomBytes(20).toString('hex')
}

function verifyTotp(secretHex, token) {
  const key = Buffer.from(secretHex, 'hex')
  const step = 30
  const time = Math.floor(Date.now() / 1000 / step)
  for (let w = -1; w <= 1; w++) {
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(time + w))
    const hmac = crypto.createHmac('sha1', key).update(counter).digest()
    const offset = hmac[hmac.length - 1] & 0xf
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
    if (code.toString().padStart(6, '0') === String(token)) return true
  }
  return false
}
// Optional: Redis for production nonce storage (lazy, only if REDIS_URL provided)
let redis = null
if (process.env.REDIS_URL) {
  try {
    // dynamic import to avoid hard dependency in dev (ESM-friendly)
    const { createClient } = await import('redis')
    redis = createClient({ url: process.env.REDIS_URL })
    await redis.connect()
  } catch {
    // ignore if redis is not installed
  }
}

const app = express()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      connectSrc: ["'self'", "https:", "wss:"],
    }
  }
}))

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',').filter(Boolean) || [
  'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'
]
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// Basic per-IP rate limiter for SIWE endpoints (optional hardening)
const rate = new Map()
function rateLimit(key, max = 60, windowMs = 60_000) {
  const now = Date.now()
  const rec = rate.get(key) || { count: 0, reset: now + windowMs }
  if (now > rec.reset) {
    rec.count = 0
    rec.reset = now + windowMs
  }
  rec.count++
  rate.set(key, rec)
  return rec.count <= max
}

function getClientIp(req) {
  const hdr = req.headers['x-forwarded-for']
  if (typeof hdr === 'string' && hdr.length > 0) return hdr.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

function getHost(req) {
  return (req.headers.host || '').split(':')[0]
}

// In-memory stores (fallback for local dev)
const nonces = new Map()
const mfaSecrets = new Map()

async function saveNonce(nonce, ttlMs) {
  if (redis) {
    await redis.setEx(`siwe:nonce:${nonce}`, Math.floor(ttlMs / 1000), JSON.stringify({ used: false }))
    return
  }
  const expiresAt = Date.now() + ttlMs
  nonces.set(nonce, { expiresAt, used: false })
}
async function checkAndUseNonce(nonce) {
  if (redis) {
    const stored = await redis.get(`siwe:nonce:${nonce}`)
    if (!stored) return false
    // one-time: delete immediately to prevent replay
    await redis.del(`siwe:nonce:${nonce}`)
    return true
  }
  const rec = nonces.get(nonce)
  if (!rec) return false
  if (rec.used) return false
  if (rec.expiresAt < Date.now()) return false
  rec.used = true
  nonces.set(nonce, rec)
  return true
}

async function saveMfaSecret(address, secret) {
  if (redis) {
    await redis.set(`siwe:mfa:${address}`, secret)
    return
  }
  mfaSecrets.set(address, secret)
}

async function getMfaSecret(address) {
  if (redis) {
    return await redis.get(`siwe:mfa:${address}`)
  }
  return mfaSecrets.get(address)
}

app.get('/siwe/nonce', async (req, res) => {
  const ip = getClientIp(req)
  if (!rateLimit(`nonce:${ip}`, 60, 60_000)) return res.status(429).end()
  const nonce = crypto.randomBytes(16).toString('hex')
  await saveNonce(nonce, 60_000)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ nonce, expiresAt: new Date(Date.now() + 60_000).toISOString() })
})

// Generate and store TOTP secret for an address
app.post('/mfa/setup', async (req, res) => {
  const { address } = req.body || {}
  if (typeof address !== 'string') return res.status(400).json({ ok: false })
  const secret = generateMfaSecret()
  await saveMfaSecret(address.toLowerCase(), secret)
  res.json({ ok: true, secret })
})

app.post('/siwe/verify', async (req, res) => {
  try {
    const { address, message, signature } = req.body || {}
    if (typeof address !== 'string' || typeof message !== 'string' || typeof signature !== 'string') {
      return res.status(400).json({ ok: false })
    }
    const lines = message.split('\n')
    const getLine = (prefix) => (lines.find((l) => l.startsWith(prefix)) || '').replace(prefix, '').trim()
    // EIP-4361 claims
    const domainLine = lines[0] || ''
    const domain = domainLine.replace(' wants you to sign in with your Ethereum account:', '').trim()
    const uri = getLine('URI: ')
    const version = getLine('Version: ')
    const chainIdStr = getLine('Chain ID: ')
    const nonce = getLine('Nonce: ')

    if (!(await checkAndUseNonce(nonce))) return res.status(400).json({ ok: false })

    // Validate domain and URI match current host
    const host = getHost(req)
    if (!host) return res.status(400).json({ ok: false })
    if (domain !== host) return res.status(400).json({ ok: false })
    try {
      const u = new URL(uri)
      if (u.hostname !== host) return res.status(400).json({ ok: false })
    } catch {
      return res.status(400).json({ ok: false })
    }
    // Optional CSRF-style check: Origin/Referer host must match
    const origin = req.headers.origin || ''
    const referer = req.headers.referer || ''
    const pick = (val) => {
      try { return new URL(String(val)).hostname } catch { return '' }
    }
    const oHost = pick(origin)
    const rHost = pick(referer)
    if ((origin && oHost !== host) || (referer && rHost !== host)) return res.status(400).json({ ok: false })
    if (version !== '1') return res.status(400).json({ ok: false })
    const expectedChain = (process.env.VITE_MONAD_CHAIN_ID || '10143').toString()
    if (chainIdStr !== expectedChain) return res.status(400).json({ ok: false })

    const ok = await verifyMessage({ address, message, signature })
    if (!ok) return res.status(401).json({ ok: false })

    const mfaSecret = await getMfaSecret(address.toLowerCase())
    if (mfaSecret) {
      const { totp } = req.body || {}
      if (typeof totp !== 'string' || !verifyTotp(mfaSecret, totp)) {
        return res.status(401).json({ ok: false, mfaRequired: true })
      }
    }

    res.setHeader('Cache-Control', 'no-store')
    res.cookie('sid', crypto.randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60_000,
      domain: process.env.COOKIE_DOMAIN || undefined,
    })
    return res.json({ ok: true })
  } catch (e) {
    console.error('SIWE verify error', e)
    return res.status(500).json({ ok: false })
  }
})

app.get('/siwe/me', (req, res) => {
  const sessionId = req.cookies.sid
  if (!sessionId) {
    return res.status(401).json({ ok: false, authenticated: false })
  }
  
  // In production, you would validate the session ID against your store
  // For now, just check if cookie exists and is valid format
  if (typeof sessionId === 'string' && sessionId.length > 0) {
    return res.json({ 
      ok: true, 
      authenticated: true,
      // You would return actual user data here
      sessionId: sessionId.slice(0, 8) + '...' // Truncated for security
    })
  }
  
  return res.status(401).json({ ok: false, authenticated: false })
})

app.post('/siwe/logout', (_req, res) => {
  res.clearCookie('sid', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    domain: process.env.COOKIE_DOMAIN || undefined,
  })
  res.json({ ok: true })
})

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    ok: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redis ? 'connected' : 'not_configured'
  })
})

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  if (redis) {
    await redis.quit()
  }
  process.exit(0)
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({ ok: false, error: 'Internal server error' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' })
})

const port = process.env.PORT ? Number(process.env.PORT) : 8787
const server = app.listen(port, () => {
  console.log(`🚀 SIWE server listening on http://localhost:${port}`)
  console.log(`📊 Health check available at http://localhost:${port}/health`)
  if (redis) {
    console.log('🔄 Redis connected for session storage')
  } else {
    console.log('⚠️  Using in-memory storage (dev only)')
  }
})


