import { useEffect } from 'react'
import { getImageUrl } from '@/lib/utils'

interface PresenceMetaOptions {
  title: string
  posterPath: string | null
  type: 'movie' | 'tv'
  season?: number
  episode?: number
  episodeTitle?: string | null
}

interface MetaTag {
  attrName: 'property' | 'name'
  attrValue: string
  content: string
}

export function usePresenceMeta({
  title,
  posterPath,
  type,
  season,
  episode,
  episodeTitle,
}: PresenceMetaOptions) {
  useEffect(() => {
    if (!title) return

    const prevTitle = document.title
    document.title =
      type === 'tv' && season && episode
        ? `${title} - S${season}E${episode} - Spiflix`
        : `${title} - Spiflix`

    const tags: MetaTag[] = [{ attrName: 'property', attrValue: 'og:title', content: title }]

    const poster = getImageUrl(posterPath)
    if (poster) tags.push({ attrName: 'property', attrValue: 'og:image', content: poster })

    if (type === 'tv') {
      if (season) tags.push({ attrName: 'name', attrValue: 'spiflix:season', content: String(season) })
      if (episode) tags.push({ attrName: 'name', attrValue: 'spiflix:episode', content: String(episode) })
      if (episodeTitle)
        tags.push({ attrName: 'name', attrValue: 'spiflix:episode-title', content: episodeTitle })
    }

    const createdEls: HTMLMetaElement[] = []
    for (const tag of tags) {
      let el = document.head.querySelector<HTMLMetaElement>(
        `meta[${tag.attrName}="${tag.attrValue}"]`,
      )
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(tag.attrName, tag.attrValue)
        document.head.appendChild(el)
        createdEls.push(el)
      }
      el.setAttribute('content', tag.content)
    }

    return () => {
      document.title = prevTitle
      createdEls.forEach(el => el.remove())
    }
  }, [title, posterPath, type, season, episode, episodeTitle])
}
