import { useCallback } from 'react'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'
import { HeroCarousel } from '@/components/home/HeroCarousel'

export default function Movies() {
  const trending = useCallback(() => api.tmdb.trending('movie'), [])
  const popular = useCallback(() => api.tmdb.popular('movie'), [])
  const topRated = useCallback(() => api.tmdb.topRated('movie'), [])

  return (
    <div>
      <HeroCarousel type="movie" />
      <div className="-mt-16 relative z-10 px-0">
        <MediaRail title="Trending Now" fetcher={trending} />
        <MediaRail title="Popular" fetcher={popular} />
        <MediaRail title="Top Rated" fetcher={topRated} />
      </div>
    </div>
  )
}
