import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ContinueWatchingRail } from '@/components/home/ContinueWatchingRail'

export default function Home() {
  const { t } = useTranslation()
  const trendingMovies = useCallback(() => api.tmdb.trending('movie'), [])
  const trendingTv = useCallback(() => api.tmdb.trending('tv'), [])
  const popularMovies = useCallback(() => api.tmdb.popular('movie'), [])
  const popularTv = useCallback(() => api.tmdb.popular('tv'), [])
  const topRatedMovies = useCallback(() => api.tmdb.topRated('movie'), [])

  return (
    <div>
      <HeroCarousel />

      <div className="-mt-16 relative z-10 flex flex-col gap-8 px-0 pb-4">
        <ContinueWatchingRail />
        <MediaRail title={t('home.trendingMovies')} fetcher={trendingMovies} />
        <MediaRail title={t('home.trendingTv')} fetcher={trendingTv} />
        <MediaRail title={t('home.popularMovies')} fetcher={popularMovies} />
        <MediaRail title={t('home.popularTv')} fetcher={popularTv} />
        <MediaRail title={t('home.topRated')} fetcher={topRatedMovies} />
      </div>
    </div>
  )
}
