import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import { MediaCard } from './MediaCard'

interface MediaRailProps {
  title: string
  fetcher: () => Promise<any[]>
  mapper?: (item: any) => {
    id: number
    type: 'movie' | 'tv'
    title: string
    posterPath: string | null
    rating: number
    releaseDate?: string
  }
}

const defaultMapper = (item: any) => ({
  id: item.id,
  type: (item.media_type || 'movie') as 'movie' | 'tv',
  title: item.title || item.name || 'Untitled',
  posterPath: item.poster_path,
  rating: item.vote_average || 0,
  releaseDate: item.release_date || item.first_air_date,
})

export function MediaRail({ title, fetcher, mapper = defaultMapper }: MediaRailProps) {
  const [items, setItems] = useState<any[]>([])
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: true,
    containScroll: 'trimSnaps',
  })
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  useEffect(() => {
    fetcher().then(setItems).catch(() => {})
  }, [fetcher])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    onSelect()
  }, [emblaApi, onSelect])

  if (items.length === 0) return null

  return (
    <section className="py-4">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-1">
          <button
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!canScrollNext}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden px-4 sm:px-6" ref={emblaRef}>
        <div className="flex gap-3" style={{ backfaceVisibility: 'hidden' }}>
          {items.map((item) => {
            const mapped = mapper(item)
            return (
              <div key={mapped.id} className="flex-shrink-0 min-w-0" style={{ flex: '0 0 auto', width: '150px' }}>
                <div className="sm:w-[180px]">
                  <MediaCard
                    id={mapped.id}
                    type={mapped.type}
                    title={mapped.title}
                    posterPath={mapped.posterPath}
                    rating={mapped.rating}
                    releaseDate={mapped.releaseDate}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
