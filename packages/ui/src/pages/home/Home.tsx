import { useCallback } from 'react'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'
import { HeroCarousel } from '@/components/home/HeroCarousel'

export default function Home() {
  const trendingMovies = useCallback(() => api.tmdb.trending('movie'), [])
  const trendingTv = useCallback(() => api.tmdb.trending('tv'), [])
  const popularMovies = useCallback(() => api.tmdb.popular('movie'), [])
  const popularTv = useCallback(() => api.tmdb.popular('tv'), [])
  const topRatedMovies = useCallback(() => api.tmdb.topRated('movie'), [])

  return (
    <div>
      <HeroCarousel />

      <div className="-mt-16 relative z-10 px-0">
        <MediaRail title="Trending Movies" fetcher={trendingMovies} />
        <MediaRail title="Trending TV Shows" fetcher={trendingTv} />
        <MediaRail title="Popular Movies" fetcher={popularMovies} />
        <MediaRail title="Popular TV Shows" fetcher={popularTv} />
        <MediaRail title="Top Rated" fetcher={topRatedMovies} />
      </div>
    </div>
  )
}
