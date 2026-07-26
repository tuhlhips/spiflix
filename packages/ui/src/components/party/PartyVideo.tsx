import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Play } from 'lucide-react'
import { hlsProxy, type VideoType, type VideoSyncData } from '@/lib/party'

interface PartyVideoProps {
  videoSrc: string
  videoType: VideoType
  sync: { isPlaying: boolean; currentTime: number; seq: number }
  isHost: boolean
  onSync: (data: VideoSyncData) => void
}

const HARD_SEEK = 1.5 // seconds of drift before we snap instead of nudge

export function PartyVideo({ videoSrc, videoType, sync, isHost, onSync }: PartyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  // While we apply a remote sync, suppress the resulting native play/pause/seek
  // events so they don't echo back out as a new sync (feedback loop).
  const suppress = useRef(false)
  const syncRef = useRef(sync)
  syncRef.current = sync
  const [blocked, setBlocked] = useState(false)

  const isEmbed = videoType === 'iframe' || videoType === 'youtube' || videoType === 'dash' || videoType === 'webtorrent'

  // Load the source. HLS goes through the party server's proxy so segments and
  // CinePro-wrapped URLs load cross-origin cleanly and everyone gets the same stream.
  useEffect(() => {
    const video = videoRef.current
    if (!video || isEmbed || !videoSrc) return
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

    const startAt = () => {
      const s = syncRef.current
      suppress.current = true
      if (s.currentTime > 0) video.currentTime = s.currentTime
      if (s.isPlaying) video.play().catch(() => setBlocked(true))
      setTimeout(() => { suppress.current = false }, 400)
    }

    if (videoType === 'hls') {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      if (!isSafari && Hls.isSupported()) {
        // Load the CinePro source directly first (it serves permissive CORS,
        // exactly like spiflix's own player). Only fall back to the party
        // server's proxy if a direct load fails — its m3u8 rewriting mangles
        // these nested /v1/proxy URLs.
        const attach = (src: string, allowProxyFallback: boolean) => {
          const hls = new Hls()
          hlsRef.current = hls
          hls.loadSource(src)
          hls.attachMedia(video)
          hls.on(Hls.Events.MANIFEST_PARSED, startAt)
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal && allowProxyFallback) {
              hls.destroy()
              hlsRef.current = null
              attach(hlsProxy(videoSrc), false)
            }
          })
        }
        attach(videoSrc, true)
      } else {
        // Safari plays HLS natively; the party proxy avoids its hls.js quirks.
        video.src = hlsProxy(videoSrc)
        video.addEventListener('loadedmetadata', startAt, { once: true })
      }
    } else {
      // Direct mp4 / file URL.
      video.src = videoSrc
      video.addEventListener('loadedmetadata', startAt, { once: true })
    }

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
  }, [videoSrc, videoType, isEmbed])

  // Apply an incoming sync target — snap on big drift, otherwise match play/pause.
  useEffect(() => {
    const video = videoRef.current
    if (!video || isEmbed) return
    suppress.current = true
    if (Math.abs(video.currentTime - sync.currentTime) > HARD_SEEK) {
      video.currentTime = sync.currentTime
    }
    if (sync.isPlaying && video.paused) video.play().catch(() => setBlocked(true))
    else if (!sync.isPlaying && !video.paused) video.pause()
    const t = setTimeout(() => { suppress.current = false }, 400)
    return () => clearTimeout(t)
  }, [sync.seq, isEmbed])

  // Broadcast this watcher's own play / pause / seek.
  useEffect(() => {
    const video = videoRef.current
    if (!video || isEmbed) return
    const emit = () => { if (!suppress.current) onSync({ isPlaying: !video.paused, currentTime: video.currentTime }) }
    video.addEventListener('play', emit)
    video.addEventListener('pause', emit)
    video.addEventListener('seeked', emit)
    return () => {
      video.removeEventListener('play', emit)
      video.removeEventListener('pause', emit)
      video.removeEventListener('seeked', emit)
    }
  }, [isEmbed, onSync])

  // Host anchors the room every few seconds so late joiners and drifters catch up.
  useEffect(() => {
    if (!isHost || isEmbed) return
    const id = setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused) onSync({ isPlaying: true, currentTime: video.currentTime })
    }, 4000)
    return () => clearInterval(id)
  }, [isHost, isEmbed, onSync])

  const resume = () => {
    setBlocked(false)
    videoRef.current?.play().catch(() => setBlocked(true))
  }

  if (isEmbed) {
    return (
      <div className="relative h-full w-full bg-black">
        <iframe src={videoSrc} title="Watch Party" allow="autoplay; encrypted-media; fullscreen" allowFullScreen className="h-full w-full border-0" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white/80">
          Embed source — playback isn't synced
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        controls
        playsInline
        crossOrigin="anonymous"
      />
      {blocked && (
        <button
          onClick={resume}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/50 text-white"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-[var(--shadow-cta)]">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
          <span className="text-sm font-semibold">Tap to join playback</span>
        </button>
      )}
    </div>
  )
}
