import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Settings, Film, Menu, X, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SearchDialog } from './SearchDialog'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useProfiles, profileGradient } from '@/app/providers/profiles-provider'

const navLinks = [
  { to: '/', labelKey: 'nav.home' },
  { to: '/movies', labelKey: 'nav.movies' },
  { to: '/shows', labelKey: 'nav.shows' },
  { to: '/discover', labelKey: 'nav.discover' },
  { to: '/my-list', labelKey: 'nav.myList' },
]

export function Header() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { activeProfile } = useProfiles()
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)

  useEffect(() => {
    const check = () => api.health().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
    check()
    // Skip the poll while the tab is hidden; re-check immediately on return so
    // the badge is fresh when the user comes back rather than up to 30s stale.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') check()
    }, 30000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K and "/" — the browser's own find (Cmd+F) stays untouched.
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close the mobile menu when tapping anywhere outside the header.
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!mobileMenuOpen) return
    const onDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [mobileMenuOpen])

  return (
    <>
      {/* pointer-events-none: this bar spans the full viewport width but only
          the centered pill is visible. Without this, its transparent side
          regions would sit on top of page content (z-50) and swallow clicks on
          anything beneath the top strip — e.g. a page's top-right button. The
          interactive children below opt back in with pointer-events-auto. */}
      <header ref={headerRef} className="pointer-events-none fixed top-0 left-0 z-50 flex w-full justify-center pt-4">
        <div
          className={cn(
            'pointer-events-auto relative inline-flex items-center gap-1 overflow-hidden rounded-full border border-border/50',
            'bg-background/80 backdrop-blur-xl px-1.5 py-1.5',
            'shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05),0_4px_16px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.08)]',
          )}
        >
          {/* Logo */}
          <Link to="/" className="mr-1 flex items-center px-2">
            <Film className="h-8 w-auto text-primary" />
          </Link>

          {/* Nav links */}
          <div className="hidden items-center sm:flex">
            {navLinks.map((link) => {
              const active = location.pathname === link.to
              return (
                <Link key={link.to} to={link.to} className="relative px-3 py-2">
                  <span className={cn(
                    'relative z-10 text-sm font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}>
                    {t(link.labelKey)}
                  </span>
                  {active && (
                    <div className="absolute inset-0 rounded-full bg-primary/10" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 px-1">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={t('header.search')}
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Backend status */}
            <button
              onClick={() => navigate('/settings')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={backendOnline ? t('header.connected') : t('header.disconnected')}
            >
              <Globe className={cn('h-4 w-4', backendOnline ? 'text-green-500' : 'text-red-500')} />
            </button>

            {/* Settings */}
            <Link
              to="/settings"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={t('nav.settings')}
            >
              <Settings className="h-4 w-4" />
            </Link>

            {/* Active profile — opens the "Who's watching?" switcher. */}
            <button
              onClick={() => navigate('/profiles')}
              className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-white/15 transition-transform hover:scale-105"
              style={{ background: profileGradient(activeProfile) }}
              aria-label={activeProfile.name}
              title={activeProfile.name}
            >
              {activeProfile.initial}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex sm:hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="pointer-events-auto absolute top-16 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm rounded-xl border border-border bg-background/95 backdrop-blur-xl p-2 shadow-xl">
            {navLinks.map(({ to, labelKey }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(labelKey)}
                </Link>
              )
            })}
          </div>
        )}
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
