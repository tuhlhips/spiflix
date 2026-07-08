import { useCallback } from 'react'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'

export default function Movies() {
  const trending = useCallback(() => api.tmdb.trending('movie'), [])
  const popular = useCallback(() => api.tmdb.popular('movie'), [])
  const topRated = useCallback(() => api.tmdb.topRated('movie'), [])

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold px-4 sm:px-6 mb-4">Movies</h1>
      <MediaRail title="Trending Now" fetcher={trending} />
      <MediaRail title="Popular" fetcher={popular} />
      <MediaRail title="Top Rated" fetcher={topRated} />
    </div>
  )
}
