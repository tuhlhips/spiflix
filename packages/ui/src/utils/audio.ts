export interface AudioTrackInfo {
  id: number
  name?: string
  lang?: string
  language?: string
  default?: boolean
}

const ENGLISH_CODES = new Set([
  'en', 'eng', 'en-US', 'en-GB', 'en-AU', 'en-CA',
])

export function findPreferredAudioTrack(
  tracks: AudioTrackInfo[],
  preferredLang = 'en',
): AudioTrackInfo | undefined {
  if (!tracks || tracks.length === 0) return undefined
  if (tracks.length === 1) return tracks[0]

  const lang = preferredLang.toLowerCase().split('-')[0]

  // 1. Exact match on preferred language
  const exact = tracks.find(t =>
    (t.lang ?? t.language ?? '').toLowerCase().startsWith(lang),
  )
  if (exact) return exact

  // 2. English fallback if preferred wasn't English
  if (lang !== 'en') {
    const english = tracks.find(t =>
      ENGLISH_CODES.has((t.lang ?? t.language ?? '').toLowerCase()),
    )
    if (english) return english
  }

  // 3. Track marked default in the stream
  const streamDefault = tracks.find(t => t.default)
  if (streamDefault) return streamDefault

  // 4. First track
  return tracks[0]
}

export function getPreferredAudioLang(): string {
  try {
    return localStorage.getItem('preferredAudioLang') || 'en'
  } catch {
    return 'en'
  }
}

export function setPreferredAudioLang(lang: string): void {
  try {
    localStorage.setItem('preferredAudioLang', lang)
  } catch {}
}
