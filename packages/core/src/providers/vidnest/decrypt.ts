/**
 * VidNest payload decoder — ported verbatim from CinePro Core
 * (cinepro-org/core). VidNest wraps its per-server JSON in a custom-alphabet
 * base64 variant; this reverses it. No dependencies, pure JS.
 */

/** Custom alphabet taken from VidNest frontend logic. */
const VIDNEST_ALPHABET =
  'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/='

/** Character -> numeric value (0..63); unknown characters map to 64 (sentinel). */
const VIDNEST_REVERSE_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  for (let i = 0; i < VIDNEST_ALPHABET.length; i++) {
    map[VIDNEST_ALPHABET[i]!] = i
  }
  return map
})()

/** Decode a VidNest custom-base64 encoded string into a UTF-8 string. */
export function decodeVidnestBase64(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('VidNest: invalid payload, expected non-empty string')
  }

  let padded = input
  const mod = padded.length % 4
  if (mod !== 0) padded += '='.repeat(4 - mod)

  const bytes: number[] = []

  for (let i = 0; i < padded.length; i += 4) {
    const chunk = padded.slice(i, i + 4)

    const c0 = VIDNEST_REVERSE_MAP[chunk[0]!] ?? 64
    const c1 = VIDNEST_REVERSE_MAP[chunk[1]!] ?? 64
    const c2 = chunk[2] === '=' ? 64 : (VIDNEST_REVERSE_MAP[chunk[2]!] ?? 64)
    const c3 = chunk[3] === '=' ? 64 : (VIDNEST_REVERSE_MAP[chunk[3]!] ?? 64)

    bytes.push(((c0 << 2) | (c1 >> 4)) & 0xff)
    if (c2 !== 64) bytes.push((((c1 & 0x0f) << 4) | (c2 >> 2)) & 0xff)
    if (c3 !== 64) bytes.push((((c2 & 0x03) << 6) | c3) & 0xff)
  }

  return new TextDecoder().decode(new Uint8Array(bytes))
}

export default function decrypt<T>(payload: string): T {
  try {
    return JSON.parse(decodeVidnestBase64(payload)) as T
  } catch {
    throw new Error('VidNest: failed to parse decrypted payload as JSON')
  }
}
