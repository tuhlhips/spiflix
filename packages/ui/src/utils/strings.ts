export function normalizeQuality(q: string): string {
  if (!q) return q
  return q.endsWith('p') ? q : `${q}p`
}

export function toTitle(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export function maskKey(key: string): string {
  if (key.length <= 4) return '****'
  return '*'.repeat(key.length - 4) + key.slice(-4)
}
