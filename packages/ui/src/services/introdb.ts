const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

export type SegmentType = 'intro' | 'recap' | 'outro' | 'credits' | 'preview'

export interface IntroDBSegment {
  segment_type: SegmentType
  start_sec: number
  end_sec: number
}

interface IntroDBRawSegment {
  start_sec: number
  end_sec: number
  confidence: number
  submission_count: number
  updated_at: string
}

interface IntroDBResponse {
  imdb_id: string
  season?: number
  episode?: number
  intro: IntroDBRawSegment | null
  recap: IntroDBRawSegment | null
  outro: IntroDBRawSegment | null
  credits: IntroDBRawSegment | null
  preview: IntroDBRawSegment | null
}

export async function fetchSegments(
  imdbId: string,
  season?: number,
  episode?: number,
  signal?: AbortSignal,
): Promise<IntroDBSegment[]> {
  const params = new URLSearchParams({ imdb_id: imdbId })
  if (season != null) params.set('season', String(season))
  if (episode != null) params.set('episode', String(episode))

  const res = await fetch(`${BASE_URL}/api/introdb/segments?${params}`, { signal })

  if (res.status === 404) return []
  if (!res.ok) throw new Error(`IntroDB ${res.status}`)

  const data = (await res.json()) as IntroDBResponse
  const segments: IntroDBSegment[] = []
  const types: SegmentType[] = ['intro', 'recap', 'outro', 'credits', 'preview']

  for (const t of types) {
    const raw = data[t]
    if (raw) segments.push({ segment_type: t, start_sec: raw.start_sec, end_sec: raw.end_sec })
  }

  return segments
}
