import { webcrypto } from 'node:crypto'

const crypto = webcrypto
const PASSPHRASE = 'x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9'

/**
 * Encrypt a VidRock item id — ported verbatim from CinePro Core
 * (cinepro-org/core). AES-CBC with the passphrase as key and its first 16
 * bytes as IV, then URL-safe base64. Required to build the api request path.
 */
export async function encryptItemId(itemId: string): Promise<string> {
  const textEncoder = new TextEncoder()
  const keyData = textEncoder.encode(PASSPHRASE)
  const iv = textEncoder.encode(PASSPHRASE.substring(0, 16))

  const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, textEncoder.encode(itemId))

  const encryptedArray = new Uint8Array(encrypted)
  const binaryString = String.fromCharCode(...encryptedArray)
  const base64 = Buffer.from(binaryString, 'binary').toString('base64')

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
