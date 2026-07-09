import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'
import { HeroCarousel } from '@/components/home/HeroCarousel'

export default function Shows() {
  const { t } = useTranslation()
  const trending = useCallback(() => api.tmdb.trending('tv'), [])
  const popular = useCallback(() => api.tmdb.popular('tv'), [])
  const topRated = useCallback(() => api.tmdb.topRated('tv'), [])

  return (
    <div>
      <HeroCarousel type="tv" />
      <div className="-mt-16 relative z-10 px-0">
        <MediaRail title={t('media.trendingNow')} fetcher={trending} />
        <MediaRail title={t('media.popular')} fetcher={popular} />
        <MediaRail title={t('media.topRated')} fetcher={topRated} />
      </div>
    </div>
  )
}
