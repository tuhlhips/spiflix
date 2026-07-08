import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import { api } from '@/lib/api'
import { formatTime, getImageUrl, cn } from '@/lib/utils'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipBack, SkipForward, ArrowLeft,
} from 'lucide-react'

interface MediaPlayerProps {
  tmdbId: number
  type: 'movie' | 'tv'
  season?: number
  episode?: number
}

interface Source {
  url: string
  type: string
  quality: string
  provider: { id: string; name: string }
}

export function MediaPlayer({ tmdbId, type, season, episode }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const navigate = useNavigate()

  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const controlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Fetch sources
  useEffect(() => {
    setLoading(true)
    setError(null)

    const fetcher = type === 'movie'
      ? api.sources.movie(tmdbId)
      : api.sources.tv(tmdbId, season || 1, episode || 1)

    fetcher
      .then(data => {
        setSources(data.sources || [])
        if (data.sources?.length > 0) {
          setSelectedSource(data.sources[0])
        } else {
          setError('No sources available')
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [tmdbId, type, season, episode])

  // Fetch title
  useEffect(() => {
    api.tmdb.details(type, tmdbId)
      .then(data => setTitle(data.title || data.name || ''))
      .catch(() => {})
  }, [tmdbId, type])

  // Attach HLS.js when source changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedSource) return

    // Destroy previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const url = selectedSource.url

    if (selectedSource.type === 'hls' || url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hlsRef.current = hls

        hls.loadSource(url)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          video.play().catch(() => {})
        })

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad()
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError()
            } else {
              setError('Playback error — try another source')
              hls.destroy()
            }
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = url
      }
    } else {
      video.src = url
    }

    return () => { hlsRef.current?.destroy() }
  }, [selectedSource])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => setCurrentTime(video.currentTime)
    const onDurationChange = () => setDuration(video.duration)
    const onWaiting = () => setLoading(true)
    const onPlaying = () => setLoading(false)
    const onVolumeChange = () => { setVolume(video.volume); setMuted(video.muted) }
    const onEnded = () => {
      // Auto-advance for TV shows
      if (type === 'tv' && season && episode) {
        navigate(`/watch/tv/${tmdbId}?s=${season}&e=${episode + 1}`)
      }
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('ended', onEnded)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('ended', onEnded)
    }
  }, [tmdbId, type, season, episode, navigate])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          video.paused ? video.play() : video.pause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 10)
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 10)
          break
        case 'ArrowUp':
          e.preventDefault()
          video.volume = Math.min(1, video.volume + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          video.volume = Math.max(0, video.volume - 0.05)
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          video.muted = !video.muted
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 3000)
  }, [playing])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    video.paused ? video.play() : video.pause()
  }

  const toggleFullscreen = async () => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setFullscreen(false)
    } else {
      await container.requestFullscreen()
      setFullscreen(true)
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    video.currentTime = pct * video.duration
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-screen w-full bg-black items-center justify-center"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Back button */}
      {showControls && (
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        onClick={togglePlay}
        playsInline
      />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="h-12 w-12 animate-spin rounded-full border-3 border-white border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-white text-lg mb-4">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      {showControls && !error && (
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-black/40">
          {/* Top bar — title */}
          <div className="absolute top-0 left-0 right-0 p-4">
            <h1 className="text-white text-lg font-medium line-clamp-1">
              {title}
              {type === 'tv' && season && episode && (
                <span className="text-white/60 ml-2">S{season} E{episode}</span>
              )}
            </h1>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            {/* Seek bar */}
            <div
              onClick={seek}
              className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/20 transition-all hover:h-2.5"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="text-white hover:text-white/80">
                  {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
                </button>

                {type === 'tv' && (
                  <button
                    onClick={() => navigate(`/watch/tv/${tmdbId}?s=${season}&e=${(episode || 1) - 1}`)}
                    className="text-white/70 hover:text-white"
                  >
                    <SkipBack className="h-5 w-5" />
                  </button>
                )}

                {type === 'tv' && (
                  <button
                    onClick={() => navigate(`/watch/tv/${tmdbId}?s=${season}&e=${(episode || 1) + 1}`)}
                    className="text-white/70 hover:text-white"
                  >
                    <SkipForward className="h-5 w-5" />
                  </button>
                )}

                {/* Volume */}
                <button onClick={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)} className="text-white/70 hover:text-white">
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0 }
                  }}
                  className="w-20 accent-primary"
                />

                <span className="text-xs text-white/70 ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Source selector */}
                {sources.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="text-white/70 hover:text-white"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    {showSettings && (
                      <div className="absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-background border border-border p-2 shadow-xl">
                        <p className="text-xs text-muted-foreground mb-2 px-2">Source</p>
                        {sources.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => { setSelectedSource(s); setShowSettings(false) }}
                            className={cn(
                              'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              selectedSource === s ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                            )}
                          >
                            {s.provider.name} — {s.quality}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={toggleFullscreen} className="text-white/70 hover:text-white">
                  {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
