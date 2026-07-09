import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import { api } from '@/lib/api'
import { formatTime, cn } from '@/lib/utils'
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress'
import { useHistory } from '@/app/providers/history-provider'
import { useSubtitleSettings, FONT_SIZES, COLORS, BG_OPACITIES, POSITIONS } from '@/hooks/useSubtitleSettings'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipBack, SkipForward, ArrowLeft, List,
  PictureInPicture, PictureInPicture2, ChevronDown, Subtitles,
  HardDrive, Captions, Gauge, Clapperboard, Check,
} from 'lucide-react'
import { CustomSubtitles } from './CustomSubtitles'

interface MediaPlayerProps {
  tmdbId: number
  type: 'movie' | 'tv'
  season?: number
  episode?: number
  onToggleEpisodes?: () => void
}

interface Source {
  url: string
  type: string
  quality: string
  provider: { id: string; name: string }
}

interface Subtitle {
  url: string
  label: string
  format: string
}

interface AudioTrack {
  language: string
  label: string
}

type SettingsTab = 'source' | 'quality' | 'speed' | 'subtitles' | 'audio' | 'captions'

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function MediaPlayer({ tmdbId, type, season, episode, onToggleEpisodes }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const navigate = useNavigate()
  const { save: saveProgress, getResumeTime, clear: clearProgress } = usePlaybackProgress(type, tmdbId, season, episode)
  const history = useHistory()

  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('source')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [qualities, setQualities] = useState<{ index: number; height: number; label: string }[]>([])
  const [currentQuality, setCurrentQuality] = useState(-1)
  const [showAutoplay, setShowAutoplay] = useState(false)
  const [autoplayCountdown, setAutoplayCountdown] = useState(5)
  const autoplayTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const autoplayInterval = useRef<ReturnType<typeof setInterval>>(undefined)
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null)
  const [subSettings, setSubSettings] = useSubtitleSettings()

  const controlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Fetch sources
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShowAutoplay(false)
    clearTimeout(autoplayTimer.current)

    const fetcher = type === 'movie'
      ? api.sources.movie(tmdbId)
      : api.sources.tv(tmdbId, season || 1, episode || 1)

    fetcher
      .then(data => {
        if (cancelled) return
        setSources(data.sources || [])
        setSubtitles(data.subtitles || [])
        setAudioTracks(data.sources?.[0]?.audioTracks || [])
        setSelectedSubtitle(null)
        setSelectedAudioTrack(null)
        if (data.sources?.length > 0) {
          setSelectedSource(data.sources[0])
        } else {
          setError('No sources available')
        }
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [tmdbId, type, season, episode])

  // Fetch title
  useEffect(() => {
    let cancelled = false
    api.tmdb.details(type, tmdbId)
      .then(data => { if (!cancelled) setTitle(data.title || data.name || '') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tmdbId, type])

  // Attach HLS.js when source changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedSource) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const url = selectedSource.url
    setQualities([])
    setCurrentQuality(-1)

    if (selectedSource.type === 'hls' || url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hlsRef.current = hls

        hls.loadSource(url)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          if (hls.levels.length > 0) {
            setQualities(hls.levels.map((l, i) => ({ index: i, height: l.height, label: `${l.height}p` })))
          }

          // Read audio tracks from HLS manifest
          if (hls.audioTracks.length > 0) {
            const tracks = hls.audioTracks.map(t => ({ language: t.lang || '', label: t.name || t.lang || `Track ${t.id}` }))
            setAudioTracks(tracks)

            // Default to English if available (defer to ensure HLS.js processes the switch)
            const engIdx = hls.audioTracks.findIndex(t => t.lang?.startsWith('en'))
            if (engIdx >= 0) {
              setSelectedAudioTrack(tracks[engIdx])
              setTimeout(() => { hls.audioTrack = engIdx }, 100)
            }
          }

          const resume = getResumeTime()
          if (resume && video.duration > 0) {
            video.currentTime = resume
          }
          video.play().catch(() => {})
        })

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setCurrentQuality(data.level)
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
        video.src = url
      }
    } else {
      video.src = url
    }

    return () => { hlsRef.current?.destroy() }
  }, [selectedSource])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (Math.floor(video.currentTime) % 10 === 0) {
        saveProgress(video.currentTime, video.duration)
        history.add({ id: tmdbId, type, title: title || (type === 'tv' ? `S${season}E${episode}` : String(tmdbId)), currentTime: video.currentTime, duration: video.duration })
      }
    }
    const onDurationChange = () => setDuration(video.duration)
    const onWaiting = () => setLoading(true)
    const onPlaying = () => setLoading(false)
    const onVolumeChange = () => { setVolume(video.volume); setMuted(video.muted) }
    const onEnded = () => {
      clearProgress()
      setPlaying(false)
      if (type === 'tv' && season !== undefined && episode !== undefined) {
        setShowAutoplay(true)
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
  }, [tmdbId, type, season, episode])

  const handleAutoplayNext = useCallback(() => {
    setShowAutoplay(false)
    clearTimeout(autoplayTimer.current)
    navigate(`/watch/tv/${tmdbId}?s=${season}&e=${(episode || 1) + 1}`)
  }, [tmdbId, season, episode, navigate])

  useEffect(() => {
    if (showAutoplay) {
      setAutoplayCountdown(5)
      autoplayTimer.current = setTimeout(handleAutoplayNext, 5000)
      autoplayInterval.current = setInterval(() => {
        setAutoplayCountdown(p => Math.max(0, p - 1))
      }, 1000)
      return () => {
        clearTimeout(autoplayTimer.current)
        clearInterval(autoplayInterval.current)
      }
    }
  }, [showAutoplay, handleAutoplayNext])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          if (video.paused) video.play(); else video.pause()
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

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 3000)
  }, [playing])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play(); else video.pause()
  }

  async function toggleFullscreen() {
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

  async function togglePiP() {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        setIsPiP(false)
      } else {
        await video.requestPictureInPicture()
        setIsPiP(true)
      }
    } catch {}
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    video.currentTime = pct * video.duration
  }

  const handleQualityChange = (level: number) => {
    if (!hlsRef.current) return
    hlsRef.current.currentLevel = level
    setCurrentQuality(level)
  }

  // Switch audio track when selected
  useEffect(() => {
    const hls = hlsRef.current
    if (!hls || !selectedAudioTrack || hls.audioTracks.length === 0) return
    // HLS.js audioTracks use `name` (EXT-X-MEDIA NAME) and `lang` (LANGUAGE)
    const idx = hls.audioTracks.findIndex(t =>
      t.name === selectedAudioTrack.label || t.lang === selectedAudioTrack.language
    )
    if (idx >= 0 && idx !== hls.audioTrack) {
      hls.audioTrack = idx
    }
  }, [selectedAudioTrack])

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
          aria-label="Go back"
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
        crossOrigin="anonymous"
      />

      {/* Subtitles overlay */}
      {selectedSubtitle && (
        <CustomSubtitles url={selectedSubtitle.url} videoRef={videoRef} />
      )}

      {/* Loading spinner */}
      {loading && !showAutoplay && (
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

      {/* Autoplay countdown overlay */}
      {showAutoplay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="text-center space-y-6 w-full max-w-sm px-8">
            <p className="text-white text-lg font-medium">Next episode starting soon...</p>

            {/* Progress bar */}
            <div className="relative h-2 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${(autoplayCountdown / 5) * 100}%` }}
              />
            </div>
            <p className="text-white/60 text-sm">{autoplayCountdown}s</p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleAutoplayNext}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Play Next
              </button>
              <button
                onClick={() => { setShowAutoplay(false); clearTimeout(autoplayTimer.current); clearInterval(autoplayInterval.current) }}
                className="rounded-lg bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
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
              {type === 'tv' && season !== undefined && episode !== undefined && (
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
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="text-white hover:text-white/80" aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing}>
                  {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
                </button>

                {type === 'tv' && (
                  <button
                    onClick={() => navigate(`/watch/tv/${tmdbId}?s=${season}&e=${(episode || 1) - 1}`)}
                    className="text-white/70 hover:text-white"
                    aria-label="Previous episode"
                  >
                    <SkipBack className="h-5 w-5" />
                  </button>
                )}

                {type === 'tv' && (
                  <button
                    onClick={() => navigate(`/watch/tv/${tmdbId}?s=${season}&e=${(episode || 1) + 1}`)}
                    className="text-white/70 hover:text-white"
                    aria-label="Next episode"
                  >
                    <SkipForward className="h-5 w-5" />
                  </button>
                )}

                {/* Volume */}
                <button onClick={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)} className="text-white/70 hover:text-white" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
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
                  aria-label="Volume"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
                />

                <span className="text-xs text-white/70 ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Episode selector for TV */}
                {type === 'tv' && onToggleEpisodes && (
                  <button
                    onClick={onToggleEpisodes}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Episodes"
                  >
                    <List className="h-4 w-4" />
                    Episodes
                  </button>
                )}

                {/* Settings popover */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-white/70 hover:text-white"
                    aria-label="Settings"
                    aria-haspopup="true"
                    aria-expanded={showSettings}
                  >
                    <Settings className="h-5 w-5" />
                  </button>

                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 w-72 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 shadow-xl max-h-[70vh] flex flex-col" role="menu">
                      {/* Tab bar */}
                      <div className="flex border-b border-white/10">
                        {([
                          { id: 'source' as SettingsTab, icon: HardDrive },
                          { id: 'subtitles' as SettingsTab, icon: Captions },
                          { id: 'audio' as SettingsTab, icon: Volume2 },
                          { id: 'quality' as SettingsTab, icon: Clapperboard },
                          { id: 'speed' as SettingsTab, icon: Gauge },
                          { id: 'captions' as SettingsTab, icon: Subtitles },
                        ]).map(({ id, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => setSettingsTab(id)}
                            className={cn(
                              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                              settingsTab === id
                                ? 'text-white bg-white/10'
                                : 'text-white/50 hover:text-white/80',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {id === 'captions' ? 'Style' : id}
                          </button>
                        ))}
                      </div>

                      {/* Content */}
                      <div className="flex-1 overflow-y-auto p-2 min-h-0 max-h-64">
                        {/* Source */}
                        {settingsTab === 'source' && (
                          <div className="space-y-1">
                            {sources.length === 0 ? (
                              <p className="text-xs text-white/40 px-2 py-1">No sources</p>
                            ) : (
                              (() => {
                                const grouped = sources.reduce<Record<string, typeof sources>>((acc, s) => {
                                  const provider = s.provider.name
                                  if (!acc[provider]) acc[provider] = []
                                  acc[provider].push(s)
                                  return acc
                                }, {})
                                return Object.entries(grouped).map(([provider, providerSources]) => (
                                  <div key={provider} className="mb-3 last:mb-0">
                                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">{provider}</div>
                                    <div className="mt-0.5 space-y-0.5">
                                      {providerSources.map((s, i) => {
                                        const isSelected = selectedSource === s
                                        return (
                                          <button
                                            key={`${s.provider.id}-${i}`}
                                            onClick={() => { setSelectedSource(s); setShowSettings(false) }}
                                            className={cn(
                                              'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                                              isSelected ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                            )}
                                          >
                                            <span>
                                              <span className="font-medium">Source {i + 1}</span>
                                              <span className="ml-1.5 text-white/40">{s.quality}</span>
                                            </span>
                                            {isSelected && <Check className="h-3 w-3" />}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))
                              })()
                            )}
                          </div>
                        )}

                        {/* Subtitles */}
                        {settingsTab === 'subtitles' && (
                          <div className="space-y-0.5">
                            <button
                              onClick={() => setSelectedSubtitle(null)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                !selectedSubtitle ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                              )}
                            >
                              <span>Off</span>
                              {!selectedSubtitle && <Check className="h-3 w-3" />}
                            </button>
                            {subtitles.length === 0 ? (
                              <p className="text-xs text-white/40 px-2 py-1">No subtitles available</p>
                            ) : (
                              subtitles.map((sub, i) => (
                                <button
                                  key={i}
                                  onClick={() => { setSelectedSubtitle(sub); setShowSettings(false) }}
                                  className={cn(
                                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                    selectedSubtitle === sub ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                  )}
                                >
                                  <span>{sub.label}</span>
                                  {selectedSubtitle === sub && <Check className="h-3 w-3" />}
                                </button>
                              ))
                            )}
                          </div>
                        )}

                        {/* Audio */}
                        {settingsTab === 'audio' && (
                          <div className="space-y-0.5">
                            {audioTracks.length === 0 ? (
                              <p className="text-xs text-white/40 px-2 py-1">No audio tracks available</p>
                            ) : (
                              audioTracks.map((track, i) => (
                                <button
                                  key={i}
                                  onClick={() => { setSelectedAudioTrack(track); setShowSettings(false) }}
                                  className={cn(
                                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                    selectedAudioTrack === track ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                  )}
                                >
                                  <span>{track.label || track.language}</span>
                                  {selectedAudioTrack === track && <Check className="h-3 w-3" />}
                                </button>
                              ))
                            )}
                          </div>
                        )}

                        {/* Quality */}
                        {settingsTab === 'quality' && (
                          <div className="space-y-0.5">
                            <button
                              onClick={() => handleQualityChange(-1)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                currentQuality === -1 ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                              )}
                            >
                              <span>Auto</span>
                              {currentQuality === -1 && <Check className="h-3 w-3" />}
                            </button>
                            {qualities.map(q => (
                              <button
                                key={q.index}
                                onClick={() => handleQualityChange(q.index)}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                  currentQuality === q.index ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                )}
                              >
                                <span>{q.label}</span>
                                {currentQuality === q.index && <Check className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Speed */}
                        {settingsTab === 'speed' && (
                          <div className="space-y-0.5">
                            {PLAYBACK_RATES.map(rate => (
                              <button
                                key={rate}
                                onClick={() => { setPlaybackRate(rate); setShowSettings(false) }}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                  playbackRate === rate ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                )}
                              >
                                <span>{rate}x</span>
                                {playbackRate === rate && <Check className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Captions style */}
                        {settingsTab === 'captions' && (
                          <div className="space-y-4 p-1">
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Font Size</p>
                              <div className="flex gap-1">
                                {FONT_SIZES.map(f => (
                                  <button
                                    key={f.value}
                                    onClick={() => setSubSettings({ ...subSettings, fontSize: f.value })}
                                    className={cn(
                                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                      subSettings.fontSize === f.value ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                    )}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Color</p>
                              <div className="flex gap-2">
                                {COLORS.map(c => (
                                  <button
                                    key={c.value}
                                    onClick={() => setSubSettings({ ...subSettings, color: c.value })}
                                    className={cn('h-6 w-6 rounded-full ring-offset-2 ring-offset-black transition-all', subSettings.color === c.value ? 'ring-2 ring-white scale-110' : '')}
                                    title={c.label}
                                  >
                                    <div className={cn('h-full w-full rounded-full', c.swatch)} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Background</p>
                              <div className="flex gap-1">
                                {BG_OPACITIES.map(b => (
                                  <button
                                    key={b.value}
                                    onClick={() => setSubSettings({ ...subSettings, bgOpacity: b.value })}
                                    className={cn(
                                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                      subSettings.bgOpacity === b.value ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                    )}
                                  >
                                    {b.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Position</p>
                              <div className="flex gap-1">
                                {POSITIONS.map(p => (
                                  <button
                                    key={p.value}
                                    onClick={() => setSubSettings({ ...subSettings, position: p.value })}
                                    className={cn(
                                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                      subSettings.position === p.value ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                    )}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Picture in Picture */}
                <button
                  onClick={togglePiP}
                  className="text-white/70 hover:text-white"
                  aria-label={isPiP ? 'Exit Picture in Picture' : 'Picture in Picture'}
                  aria-pressed={isPiP}
                >
                  {isPiP ? <PictureInPicture2 className="h-4 w-4" /> : <PictureInPicture className="h-4 w-4" />}
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="text-white/70 hover:text-white"
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-pressed={fullscreen}
                >
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
