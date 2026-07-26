import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Heart, Trash2 } from 'lucide-react'
import type { ChatMessage, Participant } from '@/lib/party'

interface PartyChatProps {
  messages: ChatMessage[]
  participants: Participant[]
  myId: string
  onSend: (text: string) => void
  onDelete: (id: string) => void
  onReact: (id: string, emoji: string) => void
}

export function PartyChat({ messages, participants, myId, onSend, onDelete, onReact }: PartyChatProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const colorOf = (sender: string) => participants.find(p => p.name === sender)?.color || '#9a9a9a'

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted-foreground">{t('party.chatEmpty')}</p>
        )}
        {messages.map(m => {
          if (m.system) {
            return (
              <p key={m.id} className="text-center text-xs italic text-muted-foreground/80">{m.text}</p>
            )
          }
          const mine = m.sender === participants.find(p => p.id === myId)?.name
          const reactions = Object.entries(m.reactions || {})
          return (
            <div key={m.id} className="group">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-bold" style={{ color: colorOf(m.sender) }}>{m.sender}</span>
                <span className="min-w-0 flex-1 break-words text-sm text-foreground/90">{m.text}</span>
                <div className="flex flex-none items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => onReact(m.id, '❤️')} aria-label={t('party.react')} className="text-muted-foreground hover:text-primary">
                    <Heart className="h-3.5 w-3.5" />
                  </button>
                  {mine && (
                    <button onClick={() => onDelete(m.id)} aria-label={t('party.delete')} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {reactions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {reactions.map(([emoji, users]) => (
                    <button
                      key={emoji}
                      onClick={() => onReact(m.id, emoji)}
                      className="flex items-center gap-1 rounded-full bg-foreground/[0.08] px-2 py-0.5 text-xs hover:bg-foreground/[0.14]"
                    >
                      <span>{emoji}</span>
                      <span className="tabular-nums text-muted-foreground">{users.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-[var(--hairline)] p-3">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('party.messagePlaceholder')}
          className="min-w-0 flex-1 rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.04] px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={t('party.send')}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
