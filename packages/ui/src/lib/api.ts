const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

// Older Settings code stored these values JSON-stringified (extra quotes:
// '"en"'), and usePersistentState still does for the region. Unwrap so we
// never send language="en" (quotes included) upstream.
function unquote(value: string | null): string | null {
  if (!value) return value
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : value
  } catch {
    return value
  }
}

function getLang(): string {
  try { return unquote(localStorage.getItem('spiflix-locale')) || 'en-US' } catch { return 'en-US' }
}

function getRegion(): string {
  try { return unquote(localStorage.getItem('spiflix-region')) || 'US' } catch { return 'US' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  if (!url.searchParams.has('language')) url.searchParams.set('language', getLang())
  if (!url.searchParams.has('region')) url.searchParams.set('region', getRegion())

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Request failed: ${res.status}`)
  }

  return res.json()
}

// --- TMDB ---

export const api = {
  tmdb: {
    trending: (type: 'movie' | 'tv') =>
      request<any[]>(`/api/tmdb/trending/${type}`),

    popular: (type: 'movie' | 'tv', page = 1) =>
      request<any[]>(`/api/tmdb/popular/${type}?page=${page}`),

    topRated: (type: 'movie' | 'tv', page = 1) =>
      request<any[]>(`/api/tmdb/top-rated/${type}?page=${page}`),

    genres: (type: 'movie' | 'tv') =>
      request<{ id: number; name: string }[]>(`/api/tmdb/genres/${type}`),

    discover: (type: 'movie' | 'tv', options: {
      page: number
      sortBy: string
      genreId: number | null
      yearFrom: number | ''
      yearTo: number | ''
    }) => {
      const params = new URLSearchParams({ page: String(options.page), sort_by: options.sortBy })
      if (options.genreId) params.set('with_genres', String(options.genreId))
      if (options.yearFrom) params.set('year_from', String(options.yearFrom))
      if (options.yearTo) params.set('year_to', String(options.yearTo))
      return request<any[]>(`/api/tmdb/discover/${type}?${params}`)
    },

    search: (query: string, page = 1) =>
      request<{ movies: any[]; tv: any[] }>(`/api/tmdb/search?q=${encodeURIComponent(query)}&page=${page}`),

    details: (type: 'movie' | 'tv', id: number) =>
      request<any>(`/api/tmdb/${type}/${id}`),

    season: (tvId: number, season: number) =>
      request<any>(`/api/tmdb/tv/${tvId}/season/${season}`),
  },

  sources: {
    movie: (tmdbId: number) =>
      request<any>(`/v1/movies/${tmdbId}`),

    tv: (tmdbId: number, season: number, episode: number) =>
      request<any>(`/v1/tv/${tmdbId}/seasons/${season}/episodes/${episode}`),
  },

  health: () => request<any>('/api/health'),
}
