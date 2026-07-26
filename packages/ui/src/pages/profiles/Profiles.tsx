import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Film } from 'lucide-react'
import { useProfiles, profileGradient, type Profile } from '@/app/providers/profiles-provider'

/** Preset gradient pairs offered when creating/editing a profile. */
const SWATCHES: [string, string][] = [
  ['#e94a5a', '#7a1230'],
  ['#4a7bf7', '#122a7a'],
  ['#12b981', '#0a5236'],
  ['#eda000', '#7a4e00'],
  ['#a13ef0', '#3a1170'],
  ['#33b6e6', '#0d4a63'],
  ['#ee3d6e', '#6e1030'],
]

function initialOf(name: string) {
  return (name.trim()[0] || '?').toUpperCase()
}

function ProfileEditor({
  editing, onClose,
}: { editing: Profile | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { profiles, addProfile, updateProfile, removeProfile } = useProfiles()
  const [name, setName] = useState(editing?.name ?? '')
  const [colors, setColors] = useState<[string, string]>(editing?.colors ?? SWATCHES[0])
  const [kid, setKid] = useState(editing?.kid ?? false)
  const canDelete = !!editing && profiles.length > 1

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (editing) {
      updateProfile(editing.id, { name: trimmed, initial: initialOf(trimmed), colors, kid })
    } else {
      addProfile({ name: trimmed, initial: initialOf(trimmed), colors, kid })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="sfx-pop relative z-10 w-full max-w-sm rounded-2xl border border-border bg-[var(--surface)] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? t('profiles.editProfile') : t('profiles.newProfile')}
      >
        <div className="mb-5 flex flex-col items-center gap-3">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-extrabold text-white ring-1 ring-white/10"
            style={{ background: `linear-gradient(150deg, ${colors[0]}, ${colors[1]})` }}
          >
            {initialOf(name)}
          </div>
          <h2 className="text-lg font-bold">{editing ? t('profiles.editProfile') : t('profiles.newProfile')}</h2>
        </div>

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profiles.name')}</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder={t('profiles.namePlaceholder')}
          autoFocus
          maxLength={20}
          className="mb-4 w-full rounded-lg border border-border bg-foreground/[0.04] px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profiles.color')}</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {SWATCHES.map(sw => {
            const active = sw[0] === colors[0] && sw[1] === colors[1]
            return (
              <button
                key={sw[0]}
                onClick={() => setColors(sw)}
                aria-label={sw[0]}
                aria-pressed={active}
                className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition ${active ? 'ring-2 ring-white' : ''}`}
                style={{ background: `linear-gradient(140deg, ${sw[0]}, ${sw[1]})` }}
              />
            )
          })}
        </div>

        <label className="mb-5 flex cursor-pointer items-center justify-between">
          <span className="text-sm font-medium">{t('profiles.kidsProfile')}</span>
          <button
            role="switch"
            aria-checked={kid}
            onClick={() => setKid(k => !k)}
            className={`relative h-6 w-11 rounded-full transition-colors ${kid ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${kid ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
          >
            {editing ? t('profiles.save') : t('profiles.create')}
          </button>
          {canDelete && (
            <button
              onClick={() => { removeProfile(editing!.id); onClose() }}
              aria-label={t('profiles.remove')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Profiles() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profiles, setActiveProfile } = useProfiles()
  const [manage, setManage] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [adding, setAdding] = useState(false)

  const pick = (p: Profile) => {
    if (manage) { setEditing(p); return }
    setActiveProfile(p.id)
    navigate('/')
  }

  return (
    <div className="sfx-fade relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10">
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-15%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full opacity-10 blur-[150px]"
        style={{ background: 'var(--accent)' }}
      />

      <div className="mb-11 flex items-center gap-2.5">
        <Film className="h-7 w-7 text-primary" />
        <span className="text-xl font-extrabold tracking-tight">Spiflix</span>
      </div>

      <h1 className="mb-10 text-center text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[46px]">
        {t('profiles.title')}
      </h1>

      <div className="flex max-w-[760px] flex-wrap items-start justify-center gap-7">
        {profiles.map(p => (
          <button key={p.id} onClick={() => pick(p)} className="flex w-[120px] flex-col items-center gap-3.5 sm:w-[140px]">
            <div
              className="group relative flex aspect-square w-[120px] items-center justify-center rounded-[20px] text-5xl font-extrabold text-white ring-1 ring-white/10 transition-transform hover:scale-105 hover:ring-2 hover:ring-white sm:w-[140px]"
              style={{ background: profileGradient(p) }}
            >
              {p.initial}
              {p.kid && (
                <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  {t('profiles.kids')}
                </span>
              )}
              {manage && (
                <span className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-black/50">
                  <Pencil className="h-7 w-7 text-white" />
                </span>
              )}
            </div>
            <span className="text-base font-semibold text-muted-foreground">{p.name}</span>
          </button>
        ))}

        <button onClick={() => setAdding(true)} className="flex w-[120px] flex-col items-center gap-3.5 sm:w-[140px]">
          <div className="flex aspect-square w-[120px] items-center justify-center rounded-[20px] border-2 border-dashed border-[var(--hairline-strong)] text-muted-foreground transition-colors hover:border-foreground/50 sm:w-[140px]">
            <Plus className="h-10 w-10" />
          </div>
          <span className="text-base font-semibold text-muted-foreground">{t('profiles.add')}</span>
        </button>
      </div>

      <button
        onClick={() => setManage(m => !m)}
        className="mt-11 rounded-full border border-[var(--hairline-strong)] px-6 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        {manage ? t('profiles.done') : t('profiles.manage')}
      </button>

      {(adding || editing) && (
        <ProfileEditor editing={editing} onClose={() => { setAdding(false); setEditing(null) }} />
      )}
    </div>
  )
}
