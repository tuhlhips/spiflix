export interface Subtitle {
  url: string
  label: string
  format: string
  providerId?: string
}

export interface Source {
  quality: string
  type: string
  url: string
  provider: { id: string; name: string }
  audioTracks?: Array<{ language: string; label: string }>
  subtitles?: Subtitle[]
}

const ENGLISH_CODES = new Set(['en', 'eng', 'english', 'en-us', 'en-gb', 'en-au', 'en-ca'])

/**
 * Provider preference for breaking exact ties (same language + quality + type).
 * Lower is better. Ranks the reliable native-English scrapers ahead of the
 * flaky (Icefy) and foreign-primary (VixSrc) ones, so the first pick is the one
 * most likely to just play. Unlisted providers sit in the middle.
 */
const PROVIDER_PRIORITY: Record<string, number> = {
  vidnest: 0,
  icefy: 2,
  cinesu: 3,
  vidrock: 4,
  vixsrc: 5,
  // Last resort: VidLink resolves progressive MP4s rather than an adaptive
  // ladder, so it tends to land lower-resolution than the HLS scrapers, and it
  // reports no audio tracks (so it can never win the language bucket). Listed
  // explicitly — without an entry it would inherit the default rank of 3 and
  // outrank VixSrc.
  vidlink: 6,
  // Demoted from rank 1: VidSrc's final hop is behind a Cloudflare Turnstile
  // challenge, so it currently resolves nothing. Kept listed rather than
  // deleted — an unlisted provider inherits rank 3 and would outrank VixSrc the
  // moment the gate lifts, silently reinstating an unproven source ahead of the
  // workhorse. Promote it again once it's confirmed playing.
  vidsrc: 7,
}
const providerRank = (source: Source): number =>
  PROVIDER_PRIORITY[source.provider?.id] ?? 3

/** Does this source carry an audio track in the preferred language? */
function sourceHasLang(source: Source, lang: string): boolean {
  return (source.audioTracks ?? []).some(t => {
    const value = (t.language || t.label || '').toLowerCase()
    if (lang === 'en') return ENGLISH_CODES.has(value) || value.startsWith('en')
    return value.startsWith(lang)
  })
}

/**
 * Rank sources best-first. Sources that advertise the preferred audio language
 * win outright — otherwise a higher-resolution foreign dub (e.g. an Italian
 * VixSrc stream) would beat an English one and the whole title plays dubbed.
 *
 * Within a language bucket, provider reliability comes BEFORE claimed quality:
 * quality strings are provider-supplied and unverified (Icefy blindly claims
 * "1080" while VidNest reports "Auto"), so sorting by resolution first would
 * put the flaky provider on top and defeat the demotion entirely. Resolution
 * and HLS only break ties within the same provider.
 *
 * Returns a new array; the player iterates it to fail over when the top pick
 * turns out to be a dead or malformed stream.
 */
export function sortSources(sources: Source[], preferredLang = 'en'): Source[] {
  const lang = preferredLang.toLowerCase().split('-')[0]
  return [...(sources ?? [])].sort((a, b) => {
    const langA = sourceHasLang(a, lang) ? 1 : 0
    const langB = sourceHasLang(b, lang) ? 1 : 0
    if (langA !== langB) return langB - langA
    const rankDelta = providerRank(a) - providerRank(b)
    if (rankDelta !== 0) return rankDelta
    const qA = parseInt(a.quality) || 0
    const qB = parseInt(b.quality) || 0
    if (qB !== qA) return qB - qA
    if (a.type === 'hls' && b.type !== 'hls') return -1
    if (b.type === 'hls' && a.type !== 'hls') return 1
    return 0
  })
}

/** Best single source, or undefined when there are none. */
export function getPreferredSource(sources: Source[], preferredLang = 'en'): Source | undefined {
  if (!sources || sources.length === 0) return undefined
  return sortSources(sources, preferredLang)[0]
}

export function isHls(source: Source): boolean {
  return source.type === 'hls' || source.url?.includes('.m3u8')
}

export function isDash(source: Source): boolean {
  return source.type === 'dash' || source.url?.includes('.mpd')
}

/** Filter subtitles that belong to the same provider as the given source. */
export function subtitlesForSource(source: Source, allSubtitles: Subtitle[]): Subtitle[] {
  const providerId = source.provider?.id
  if (!providerId) return allSubtitles
  return allSubtitles.filter(sub => !sub.providerId || sub.providerId === providerId)
}

/** Pick the best matching subtitle for a source, preferring the given language. */
export function pickSubtitle(source: Source, allSubtitles: Subtitle[], preferredLang: string): Subtitle | undefined {
  const compatible = subtitlesForSource(source, allSubtitles)
  if (compatible.length === 0) return undefined
  const lang = preferredLang.toLowerCase().split('-')[0]
  const match = compatible.find(sub => {
    const label = sub.label.toLowerCase()
    if (lang === 'en') return label === 'english' || label === 'en' || label.startsWith('en')
    return label.startsWith(lang)
  })
  return match || compatible[0]
}
