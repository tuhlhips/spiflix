import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, Link2, Users, Film } from 'lucide-react'
import { useProfiles } from '@/app/providers/profiles-provider'
import { useParty } from '@/hooks/useParty'
import { resolvePartySource, type PartyMedia } from '@/lib/party'
import { PartyVideo } from '@/components/party/PartyVideo'
import { PartyChat } from '@/components/party/PartyChat'

const REACTION_EMOJI = ['❤️', '😂', '🔥', '👍', '😮']

/** Parse `?load=movie:550` or `?load=tv:1396:1:1` into a source request. */
function parseLoad(raw: string | null): PartyMedia | null {
  if (!raw) return null
  const [type, id, s, e] = raw.split(':')
  const tmdbId = Number(id)
  if ((type !== 'movie' && type !== 'tv') || !Number.isFinite(tmdbId)) return null
  return { tmdbId, mediaType: type, season: s ? Number(s) : undefined, episode: e ? Number(e) : undefined }
}

export default function PartyRoom() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { room = '' } = useParams<{ room: string }>()
  const [params] = useSearchParams()
  const { activeProfile } = useProfiles()

  const party = useParty(room, activeProfile.name)
  const {
    connected, error, kicked, myId, roomId, isHost, participants, chat, videoSrc, videoType, sync, reactions,
    sendChat, deleteMessage, toggleReaction, syncVideo, setVideo, sendEmoji,
  } = party

  const [copied, setCopied] = useState(false)
  const loadedRef = useRef(false)

  // When a `/party/new` room resolves to a real id, swap the URL so it's shareable.
  useEffect(() => {
    if (roomId && roomId !== room) window.history.replaceState(null, '', `/party/${roomId}`)
  }, [roomId, room])

  // The host loads the title the party was started with (once).
  useEffect(() => {
    if (loadedRef.current || !isHost || videoSrc) return
    const media = parseLoad(params.get('load'))
    if (!media) return
    loadedRef.current = true
    resolvePartySource(media).then(({ src, type }) => setVideo(src, type)).catch(() => {})
  }, [isHost, videoSrc, params, setVideo])

  const copyLink = async () => {
    const url = `${window.location.origin}/party/${roomId || room}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t('party.linkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('party.linkCopyFailed'))
    }
  }

  if (kicked) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-2xl font-bold">{t('party.kickedTitle')}</h1>
        <button onClick={() => navigate('/')} className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">{t('party.backHome')}</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex flex-none items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
        <button onClick={() => navigate('/')} aria-label={t('party.leave')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-primary sfx-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">{connected ? t('party.live') : t('party.connecting')}</span>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {t('party.watching', { count: participants.length })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={copyLink} className="flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.04] px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.1]">
            <Link2 className="h-4 w-4" />
            {copied ? t('party.copied') : t('party.invite')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Video pane */}
        <div className="relative min-h-0 flex-1 bg-black">
          {error && !videoSrc ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">{error}</div>
          ) : videoSrc ? (
            <PartyVideo videoSrc={videoSrc} videoType={videoType} sync={sync} isHost={isHost} onSync={syncVideo} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Film className="h-10 w-10 text-white/30" />
              <p className="text-sm text-white/60">{isHost ? t('party.hostPick') : t('party.waitingForHost')}</p>
              {isHost && (
                <button onClick={() => navigate('/movies')} className="mt-1 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">{t('party.browse')}</button>
              )}
            </div>
          )}

          {/* Floating reactions */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {reactions.map(r => (
              <span key={r.id} className="party-float absolute bottom-24 text-3xl" style={{ left: `${10 + Math.random() * 70}%` }}>
                {r.emoji}
              </span>
            ))}
          </div>

          {/* Reaction bar */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1.5 backdrop-blur-md">
            {REACTION_EMOJI.map(e => (
              <button key={e} onClick={() => sendEmoji(e)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125" aria-label={t('party.react')}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Chat + participants */}
        <aside className="flex h-[45vh] w-full flex-col border-t border-[var(--hairline)] bg-[var(--surface)] lg:h-auto lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="flex flex-none items-center gap-1.5 overflow-x-auto border-b border-[var(--hairline)] px-4 py-2.5">
            {participants.map(p => (
              <span
                key={p.id}
                title={p.name + (p.id === party.host ? ' · host' : '')}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-white/10"
                style={{ background: p.color }}
              >
                {p.name[0]?.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <PartyChat
              messages={chat}
              participants={participants}
              myId={myId}
              onSend={sendChat}
              onDelete={deleteMessage}
              onReact={toggleReaction}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
