import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, ArrowRight } from 'lucide-react'

/** Create a new watch party, or join one by code / pasted link. */
export default function Party() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  const join = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = code.trim()
    if (!raw) return
    // Accept a full link or a bare code.
    const id = raw.includes('/party/') ? raw.split('/party/')[1].split(/[/?#]/)[0] : raw
    if (id) navigate(`/party/${id}`)
  }

  return (
    <main className="sfx-fade mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 pb-20 pt-24">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Users className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight">{t('party.title')}</h1>
        <p className="text-[15px] text-muted-foreground">{t('party.subtitle')}</p>
      </div>

      <button
        onClick={() => navigate('/party/new')}
        className="mb-6 w-full rounded-full bg-primary px-6 py-3.5 text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:scale-[1.02] hover:brightness-110"
      >
        {t('party.start')}
      </button>

      <div className="mb-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-[var(--hairline)]" />
        {t('party.or')}
        <span className="h-px flex-1 bg-[var(--hairline)]" />
      </div>

      <form onSubmit={join} className="flex items-center gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={t('party.codePlaceholder')}
          className="min-w-0 flex-1 rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.04] px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!code.trim()}
          aria-label={t('party.join')}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.06] text-foreground transition-colors hover:bg-foreground/[0.12] disabled:opacity-40"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>
    </main>
  )
}
