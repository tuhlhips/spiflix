/**
 * Typed API client — all backend communication goes through here.
 *
 * Design: Single source of truth for API calls. Components never
 * call fetch() directly. This enables:
 * - Centralized error handling
 * - Request deduplication
 * - Easy backend URL switching
 * - Type safety for all responses
 */

const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
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
