import Redis from 'ioredis'
import { createPublicClient, http, serializeTransaction, keccak256, toHex, recoverAddress } from 'viem'
import { KMSSigner } from './kmsSigner.js'
import { NonceManager } from './nonce.js'

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null
const rpcUrl = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'
const chainId = Number(process.env.MONAD_CHAIN_ID || '10143')
const relayerAddress = process.env.RELAYER_ADDRESS
const nonceMgr = new NonceManager(process.env.REDIS_URL)

async function run() {
  if (!redis) throw new Error('Redis required')
  const kmsKeyId = process.env.KMS_KEY_ID
  const kmsRegion = process.env.KMS_REGION || 'us-east-1'
  const signer = kmsKeyId ? new KMSSigner({ keyId: kmsKeyId, region: kmsRegion }) : null
  const client = createPublicClient({ transport: http(rpcUrl) })
  // Simplified: poll-list for jobs
  while (true) {
    const item = await redis.brpop('relay:q', 5)
    if (!item) continue
    const [, raw] = item
    try {
      const job = JSON.parse(raw)
      const nonce = await nonceMgr.nextNonce(relayerAddress)
      if (!signer) {
        console.log('Would send tx', { to: job.to, data: job.data, nonce: nonce.toString() })
        continue
      }
      // Build EIP-1559 tx (adapt if chain doesn't support 1559)
      const [maxFeePerGas, maxPriorityFeePerGas] = await Promise.all([
        client.getGasPrice(),
        client.getMaxPriorityFeePerGas().catch(() => 1n),
      ])
      const tx = {
        chainId,
        to: job.to,
        data: job.data,
        nonce,
        maxFeePerGas,
        maxPriorityFeePerGas,
        value: job.value ? BigInt(job.value) : 0n,
        gas: 500000n,
        type: 'eip1559',
      }
      // Create unsigned serialized payload and digest
      const unsignedSerialized = serializeTransaction(tx)
      const digest = keccak256(unsignedSerialized)
      const { r, s } = await signer.signDigest(digest) // r,s as 0x..
      // Detect yParity by recovering address
      const tryY = async (y) => {
        try {
          const raw = serializeTransaction(tx, { r, s, yParity: y })
          // viem doesn't expose direct recover from raw; instead recover from digest+sig
          const rec = await recoverAddress({ hash: digest, signature: toHex(Buffer.concat([Buffer.from(r.slice(2), 'hex'), Buffer.from(s.slice(2), 'hex'), Buffer.from([27 + y])])) })
          return rec?.toLowerCase() === relayerAddress?.toLowerCase() ? { y, raw } : null
        } catch { return null }
      }
      const guess0 = await tryY(0)
      const guess1 = guess0 ? null : await tryY(1)
      const picked = guess0 || guess1
      if (!picked) throw new Error('Failed to recover relayer address from signature')
      const hash = await client.request({ method: 'eth_sendRawTransaction', params: [picked.raw] })
      console.log('Relayed tx', hash)
    } catch (e) {
      console.error('Job failed parse/exec', e)
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1) })


