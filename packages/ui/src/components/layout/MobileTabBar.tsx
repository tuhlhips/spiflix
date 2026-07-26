import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Search, Bookmark, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  labelKey: string
  icon: typeof Home
  /** Extra path prefixes that should also light this tab up. */
  match?: (path: string) => boolean
}

const TABS: Tab[] = [
  { to: '/', labelKey: 'nav.home', icon: Home, match: p => p === '/' || p === '/movies' || p === '/shows' },
  { to: '/search', labelKey: 'nav.search', icon: Search, match: p => p.startsWith('/search') || p.startsWith('/discover') },
  { to: '/my-list', labelKey: 'nav.myList', icon: Bookmark, match: p => p.startsWith('/my-list') },
  { to: '/settings', labelKey: 'nav.account', icon: User, match: p => p.startsWith('/settings') || p.startsWith('/profiles') },
]

/**
 * Thumb-friendly bottom navigation for phones (the design's mobile shell).
 * Hidden from `sm` up, where the floating header pill takes over. The routed
 * pages already reserve bottom padding so content clears this bar.
 */
export function MobileTabBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--hairline)] bg-background/95 px-1.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden"
      aria-label={t('nav.home')}
    >
      {TABS.map(({ to, labelKey, icon: Icon, match }) => {
        const active = match ? match(pathname) : pathname === to
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[10px] font-semibold transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('h-[22px] w-[22px]', active && 'fill-primary/15')} />
            {t(labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
