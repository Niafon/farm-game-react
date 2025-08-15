import { KMSClient, SignCommand } from '@aws-sdk/client-kms'
import { toBytes, hexToBigInt, toHex } from 'viem'
import * as secp from '@noble/secp256k1'

export class KMSSigner {
  constructor({ keyId, region }) {
    this.client = new KMSClient({ region })
    this.keyId = keyId
  }
  async signDigest(digestHex) {
    const cmd = new SignCommand({ KeyId: this.keyId, Message: toBytes(digestHex), MessageType: 'DIGEST', SigningAlgorithm: 'ECDSA_SHA_256' })
    const res = await this.client.send(cmd)
    const der = new Uint8Array(res.Signature)
    // Parse DER to r and s
    const { r, s } = decodeDerSignature(der)
    // Return r/s as 32-byte hex each; worker decides yParity by matching relayer address
    const rHex = toHex(numberTo32Bytes(r))
    const sHex = toHex(numberTo32Bytes(s))
    return { r: rHex, s: sHex }
  }
}

function numberTo32Bytes(n) {
  const hex = n.toString(16).padStart(64, '0')
  const arr = new Uint8Array(32)
  for (let i = 0; i < 32; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16)
  return arr
}

function decodeDerSignature(der) {
  // Minimal DER ECDSA parser for r,s (assumes valid KMS output)
  let offset = 0
  if (der[offset++] !== 0x30) throw new Error('Invalid DER')
  const _len = der[offset++] // total length (unused)
  if (der[offset++] !== 0x02) throw new Error('Invalid DER')
  const rlen = der[offset++]
  const rBytes = der.slice(offset, offset + rlen)
  offset += rlen
  if (der[offset++] !== 0x02) throw new Error('Invalid DER')
  const slen = der[offset++]
  const sBytes = der.slice(offset, offset + slen)
  const r = hexToBigInt(toHex(stripLeadingZero(rBytes)))
  const s = hexToBigInt(toHex(stripLeadingZero(sBytes)))
  return { r, s }
}

function stripLeadingZero(bytes) {
  let i = 0
  while (i < bytes.length - 1 && bytes[i] === 0) i++
  return bytes.slice(i)
}

// recovery id will be detected in worker by comparing recovered address


