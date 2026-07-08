import { useCallback } from 'react'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'

export default function Shows() {
  const trending = useCallback(() => api.tmdb.trending('tv'), [])
  const popular = useCallback(() => api.tmdb.popular('tv'), [])
  const topRated = useCallback(() => api.tmdb.topRated('tv'), [])

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold px-4 sm:px-6 mb-4">TV Shows</h1>
      <MediaRail title="Trending Now" fetcher={trending} />
      <MediaRail title="Popular" fetcher={popular} />
      <MediaRail title="Top Rated" fetcher={topRated} />
    </div>
  )
}
