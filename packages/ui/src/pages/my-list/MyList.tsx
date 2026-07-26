import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Film } from 'lucide-react'
import { Segmented } from '@/components/ui/Segmented'
import { RatingBadge } from '@/components/ui/RatingBadge'
import { getImageUrl } from '@/lib/utils'
import { useSavedList, type SavedTitle } from '@/app/providers/saved-list-provider'
import { useProfiles } from '@/app/providers/profiles-provider'
import { useDrawer } from '@/app/providers/drawer-provider'

type Filter = 'all' | 'movie' | 'tv'

function SavedCard({ item, onRemove }: { item: SavedTitle; onRemove: () => void }) {
  const { t } = useTranslation()
  const { open } = useDrawer()
  const year = item.releaseDate?.slice(0, 4)

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => open({ id: item.id, type: item.type })}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open({ id: item.id, type: item.type }) } }}
        className="group block cursor-pointer"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-[transform,box-shadow] duration-[280ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:-translate-y-1.5 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),0_22px_40px_rgba(0,0,0,0.55)]">
          {item.posterPath ? (
            <img src={getImageUrl(item.posterPath, 'w342')!} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-background p-4 text-center">
              <Film className="h-6 w-6 text-muted-foreground/50" />
              <span className="line-clamp-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.title}</span>
            </div>
          )}
          <RatingBadge rating={item.rating ?? 0} className="absolute right-2 top-2" />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-foreground/90">{item.title}</p>
          {year && <p className="mt-0.5 text-xs text-muted-foreground">{year}</p>}
        </div>
        <button
          onClick={onRemove}
          aria-label={t('mylist.remove')}
          title={t('mylist.remove')}
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.05] text-muted-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function MyList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { items, remove } = useSavedList()
  const { activeProfile } = useProfiles()
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter(i => i.type === filter)),
    [items, filter],
  )

  return (
    <main className="sfx-fade mx-auto max-w-[1440px] px-4 pb-20 pt-24 sm:px-8 lg:px-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.14em] text-primary">
            {t('mylist.eyebrow', { name: activeProfile.name })}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">{t('mylist.title')}</h1>
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          aria-label={t('mylist.title')}
          options={[
            { value: 'all', label: t('mylist.all') },
            { value: 'movie', label: t('mylist.movies') },
            { value: 'tv', label: t('mylist.tv') },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--hairline-strong)] px-5 py-20 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/[0.06]">
            <Plus className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-[22px] font-bold">{t('mylist.emptyTitle')}</h2>
          <p className="mb-6 max-w-[360px] text-[15px] text-muted-foreground">{t('mylist.emptyBody')}</p>
          <button
            onClick={() => navigate('/discover')}
            className="rounded-full bg-primary px-7 py-3 text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:scale-[1.03] hover:brightness-110"
          >
            {t('mylist.browse')}
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-muted-foreground">{t('mylist.count', { count: filtered.length })}</p>
          <div className="grid gap-x-5 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr))]">
            {filtered.map(item => (
              <SavedCard key={`${item.type}:${item.id}`} item={item} onRemove={() => remove(item.id, item.type)} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
