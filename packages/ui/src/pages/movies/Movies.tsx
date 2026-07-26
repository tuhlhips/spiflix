import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { MediaRail } from '@/components/media/MediaRail'
import { Spotlight } from '@/components/media/Spotlight'
import { GenreTiles } from '@/components/media/GenreTiles'

export default function Movies() {
  const { t } = useTranslation()
  const trending = useCallback(() => api.tmdb.trending('movie'), [])
  const popular = useCallback(() => api.tmdb.popular('movie'), [])
  const topRated = useCallback(() => api.tmdb.topRated('movie'), [])

  return (
    <div>
      <Spotlight type="movie" />
      <GenreTiles type="movie" />
      <div className="relative z-10 space-y-2 pb-12">
        <MediaRail title={t('media.trendingNow')} fetcher={trending} />
        <MediaRail title={t('media.popular')} fetcher={popular} />
        <MediaRail title={t('media.topRated')} fetcher={topRated} />
      </div>
    </div>
  )
}
