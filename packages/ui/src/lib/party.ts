/**
 * Watch Party client glue. The realtime brain is a standalone Socket.IO server
 * (built separately) that already targets the same CinePro backend
 * (flix.niggamovies.org) spiflix uses, resolves one shared source per room, and
 * proxies HLS so every watcher plays the identical stream — which is what makes
 * playback sync actually line up. Here we just speak its protocol.
 */

export const PARTY_URL =
  import.meta.env.VITE_PARTY_URL || 'https://watchparty-1-fba1.onrender.com'

export type VideoType = 'youtube' | 'url' | 'hls' | 'webtorrent' | 'screenshare' | 'file' | 'dash' | 'iframe'

export interface Participant {
  id: string
  name: string
  color: string
  avatar?: string
  lastHeartbeat?: number
}

export interface ChatMessage {
  id: string
  sender: string
  text: string
  timestamp: number
  system?: boolean
  reactions?: Record<string, string[]>
  replyTo?: string
  pinned?: boolean
}

export interface RoomState {
  id: string
  name: string
  title: string
  description: string
  videoSrc: string
  videoType: VideoType
  isPlaying: boolean
  currentTime: number
  participants: Participant[]
  chatMessages: ChatMessage[]
  host: string
  playbackRate: number
  locked: boolean
  vanitySlug: string
}

export interface VideoSyncData {
  isPlaying: boolean
  currentTime: number
}

export interface VideoChangeData {
  src: string
  type: VideoType
}

export interface EmojiReaction {
  emoji: string
  sender: string
  color: string
}

export interface MessageReaction {
  messageId: string
  emoji: string
  userId: string
  userName: string
}

/** Server → client events (subset spiflix's party UI consumes). */
export interface ServerToClientEvents {
  roomState: (state: RoomState) => void
  participantJoined: (participant: Participant) => void
  participantLeft: (participantId: string) => void
  chatMessage: (message: ChatMessage) => void
  chatMessageDeleted: (messageId: string) => void
  videoSync: (data: VideoSyncData) => void
  videoChange: (data: VideoChangeData) => void
  error: (message: string) => void
  roomCreated: (roomId: string) => void
  userColor: (color: string) => void
  emojiReaction: (data: EmojiReaction) => void
  messageReaction: (data: MessageReaction) => void
  kicked: () => void
}

/** Client → server events spiflix emits. */
export interface ClientToServerEvents {
  joinRoom: (data: { roomId: string; name: string }) => void
  createRoom: (data: { name: string }) => void
  chatMessage: (data: { text: string; replyTo?: string }) => void
  videoSync: (data: VideoSyncData) => void
  setVideo: (data: { src: string; type: VideoType }) => void
  sendEmoji: (emoji: string) => void
  heartbeat: () => void
  deleteMessage: (messageId: string) => void
  toggleMessageReaction: (data: { messageId: string; emoji: string }) => void
}

function isVidRockUrl(url: string): boolean {
  // VidRock / 1x2.space serve JS-wrapped content no standard player can play.
  return /1x2\.space|vidrock|\/seg\.html/i.test(url)
}

function vidlinkUrl(mediaType: 'movie' | 'tv', tmdbId: number, season?: number, episode?: number): string {
  if (mediaType === 'tv' && season && episode) return `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`
  return `https://vidlink.pro/movie/${tmdbId}`
}

export interface PartyMedia {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  season?: number
  episode?: number
}

/** Route an HLS source through the party server's proxy so segments (and the
 * CinePro-wrapped /v1/proxy URLs) load cross-origin without CORS pain. */
export function hlsProxy(url: string): string {
  return `${PARTY_URL}/api/hls/proxy?url=${encodeURIComponent(url)}`
}

/**
 * Resolve a title to a single playable source via the party server (same
 * filtering the reference client uses): drop unplayable VidRock, prefer real
 * .m3u8/HLS, and fall back to a vidlink.pro iframe when nothing streams.
 */
export async function resolvePartySource(m: PartyMedia): Promise<VideoChangeData> {
  const params = new URLSearchParams({ tmdbId: String(m.tmdbId), mediaType: m.mediaType })
  if (m.mediaType === 'tv') {
    params.set('season', String(m.season ?? 1))
    params.set('episode', String(m.episode ?? 1))
  }
  try {
    const res = await fetch(`${PARTY_URL}/api/sources?${params}`)
    const data = await res.json()
    const playable = (data.sources || []).filter((s: any) => s.url && !isVidRockUrl(s.url))
    if (playable.length > 0) {
      const sorted = [...playable].sort((a: any, b: any) => {
        const am = a.url?.includes('.m3u8') ? 0 : 1
        const bm = b.url?.includes('.m3u8') ? 0 : 1
        if (am !== bm) return am - bm
        if (a.type === 'hls' && b.type !== 'hls') return -1
        if (b.type === 'hls' && a.type !== 'hls') return 1
        return 0
      })
      const s = sorted[0]
      if (s.url) {
        if (s.url.includes('.m3u8')) return { src: s.url, type: 'hls' }
        return { src: s.url, type: s.type === 'hls' ? 'hls' : 'url' }
      }
    }
  } catch {
    // fall through to the iframe fallback
  }
  return { src: vidlinkUrl(m.mediaType, m.tmdbId, m.season, m.episode), type: 'iframe' }
}

const ADJECTIVES = ['cosmic', 'velvet', 'neon', 'midnight', 'golden', 'silver', 'crimson', 'electric', 'lunar', 'wild']
const NOUNS = ['screening', 'matinee', 'premiere', 'double-feature', 'marathon', 'night', 'reel', 'lounge', 'club']

/** A friendly-ish room name when the user doesn't pick one. */
export function randomPartyName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${a}-${n}`
}
