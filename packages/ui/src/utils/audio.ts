export interface AudioTrackInfo {
  id: number
  name?: string
  lang?: string
  language?: string
  default?: boolean
}

// All-lowercase: lookups compare against lowercased track codes.
const ENGLISH_CODES = new Set([
  'en', 'eng', 'en-us', 'en-gb', 'en-au', 'en-ca',
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

/** ISO 639 code (2- or 3-letter) → display name, for the audio/source pickers. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', eng: 'English',
  it: 'Italian', ita: 'Italian',
  es: 'Spanish', spa: 'Spanish',
  fr: 'French', fre: 'French', fra: 'French',
  de: 'German', ger: 'German', deu: 'German',
  pt: 'Portuguese', por: 'Portuguese',
  hi: 'Hindi', hin: 'Hindi',
  ta: 'Tamil', tam: 'Tamil',
  te: 'Telugu', tel: 'Telugu',
  ja: 'Japanese', jpn: 'Japanese',
  ko: 'Korean', kor: 'Korean',
  zh: 'Chinese', zho: 'Chinese', chi: 'Chinese',
  ru: 'Russian', rus: 'Russian',
  ar: 'Arabic', ara: 'Arabic',
  nl: 'Dutch', dut: 'Dutch', nld: 'Dutch',
  pl: 'Polish', pol: 'Polish',
  tr: 'Turkish', tur: 'Turkish',
}

/**
 * Human-friendly name for an audio track. Prefers a known language code;
 * otherwise falls back to a already-readable label (e.g. "English") and finally
 * a generic placeholder. Keeps the pickers legible instead of showing "eng".
 */
export function languageName(language?: string, label?: string): string {
  const lang = (language ?? '').toLowerCase().split('-')[0].trim()
  if (LANGUAGE_NAMES[lang]) return LANGUAGE_NAMES[lang]

  const lbl = (label ?? '').trim()
  const lblKey = lbl.toLowerCase()
  if (LANGUAGE_NAMES[lblKey]) return LANGUAGE_NAMES[lblKey]
  // A label that's already a word ("English", "Hindi") is nicer than a raw code.
  if (lbl && !/^[a-z]{2,3}$/i.test(lbl)) return lbl

  return lbl || (lang ? lang.toUpperCase() : 'Unknown')
}

/** Comma-joined language names for a source's audio tracks (deduped). */
export function sourceLanguages(audioTracks?: Array<{ language: string; label: string }>): string {
  if (!audioTracks || audioTracks.length === 0) return ''
  const names = audioTracks.map(t => languageName(t.language, t.label))
  return [...new Set(names)].join(', ')
}
