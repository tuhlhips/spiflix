import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'
import { HeroCarousel } from '@/components/home/HeroCarousel'

export default function Movies() {
  const { t } = useTranslation()
  const trending = useCallback(() => api.tmdb.trending('movie'), [])
  const popular = useCallback(() => api.tmdb.popular('movie'), [])
  const topRated = useCallback(() => api.tmdb.topRated('movie'), [])

  return (
    <div>
      <HeroCarousel type="movie" />
      <div className="-mt-16 relative z-10 px-0">
        <MediaRail title={t('media.trendingNow')} fetcher={trending} />
        <MediaRail title={t('media.popular')} fetcher={popular} />
        <MediaRail title={t('media.topRated')} fetcher={topRated} />
      </div>
    </div>
  )
}
