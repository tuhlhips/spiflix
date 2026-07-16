export interface Source {
  quality: string
  type: string
  url: string
  provider: { id: string; name: string }
  audioTracks?: Array<{ language: string; label: string }>
}

export function getPreferredSource(sources: Source[]): Source | undefined {
  if (!sources || sources.length === 0) return undefined
  return [...sources].sort((a, b) => {
    const qA = parseInt(a.quality) || 0
    const qB = parseInt(b.quality) || 0
    if (qB !== qA) return qB - qA
    if (a.type === 'hls' && b.type !== 'hls') return -1
    if (b.type === 'hls' && a.type !== 'hls') return 1
    return 0
  })[0]
}

export function isHls(source: Source): boolean {
  return source.type === 'hls' || source.url?.includes('.m3u8')
}

export function isDash(source: Source): boolean {
  return source.type === 'dash' || source.url?.includes('.mpd')
}
