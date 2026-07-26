import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  PARTY_URL,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type Participant,
  type ChatMessage,
  type RoomState,
  type VideoType,
  type VideoSyncData,
} from '@/lib/party'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface FloatingEmoji {
  id: string
  emoji: string
  sender: string
  color: string
}

export interface UseParty {
  connected: boolean
  error: string | null
  kicked: boolean
  myId: string
  /** The real room id — differs from the request when creating (`'new'`). */
  roomId: string
  isHost: boolean
  participants: Participant[]
  chat: ChatMessage[]
  host: string
  videoSrc: string
  videoType: VideoType
  /** Latest sync target; `seq` bumps on every incoming sync so effects re-fire. */
  sync: { isPlaying: boolean; currentTime: number; seq: number }
  reactions: FloatingEmoji[]
  sendChat: (text: string, replyTo?: string) => void
  deleteMessage: (id: string) => void
  toggleReaction: (messageId: string, emoji: string) => void
  syncVideo: (data: VideoSyncData) => void
  setVideo: (src: string, type: VideoType) => void
  sendEmoji: (emoji: string) => void
}

/**
 * Connects to the party server and mirrors the room's realtime state. Pass
 * `'new'` (or an empty string) as `requestedRoomId` to create a fresh room and
 * auto-join it; the real id surfaces as `roomId`. Playback control is
 * collaborative — anyone's play/pause/seek broadcasts; incoming syncs land in
 * `sync` for PartyVideo.
 */
export function useParty(requestedRoomId: string, name: string): UseParty {
  const socketRef = useRef<PartySocket | null>(null)
  const startedRef = useRef(false)

  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kicked, setKicked] = useState(false)
  const [myId, setMyId] = useState('')
  const [roomId, setRoomId] = useState(requestedRoomId === 'new' ? '' : requestedRoomId)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [host, setHost] = useState('')
  const [videoSrc, setVideoSrc] = useState('')
  const [videoType, setVideoType] = useState<VideoType>('url')
  const [sync, setSync] = useState({ isPlaying: false, currentTime: 0, seq: 0 })
  const [reactions, setReactions] = useState<FloatingEmoji[]>([])

  useEffect(() => {
    if (!requestedRoomId || !name) return
    const socket: PartySocket = io(PARTY_URL, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket
    const wantsCreate = requestedRoomId === 'new'

    const start = () => {
      if (startedRef.current) return
      startedRef.current = true
      setMyId(socket.id || '')
      if (wantsCreate) socket.emit('createRoom', { name })
      else socket.emit('joinRoom', { roomId: requestedRoomId, name })
    }

    socket.on('connect', () => { setConnected(true); setMyId(socket.id || ''); start() })
    socket.on('disconnect', () => setConnected(false))
    if (socket.connected) start()

    // Created room → adopt its id and join it.
    socket.on('roomCreated', (id: string) => { setRoomId(id); socket.emit('joinRoom', { roomId: id, name }) })

    socket.on('roomState', (state: RoomState) => {
      setParticipants(state.participants)
      setChat(state.chatMessages)
      setHost(state.host)
      setVideoSrc(state.videoSrc)
      setVideoType(state.videoType)
      setSync(s => ({ isPlaying: state.isPlaying, currentTime: state.currentTime, seq: s.seq + 1 }))
    })
    socket.on('participantJoined', p =>
      setParticipants(prev => (prev.some(x => x.id === p.id) ? prev.map(x => (x.id === p.id ? p : x)) : [...prev, p])),
    )
    socket.on('participantLeft', id => setParticipants(prev => prev.filter(p => p.id !== id)))
    socket.on('chatMessage', msg => setChat(prev => [...prev, msg]))
    socket.on('chatMessageDeleted', id => setChat(prev => prev.filter(m => m.id !== id)))
    socket.on('messageReaction', ({ messageId, emoji, userId }) =>
      setChat(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const reactions = { ...(m.reactions || {}) }
        const users = new Set(reactions[emoji] || [])
        if (users.has(userId)) users.delete(userId)
        else users.add(userId)
        if (users.size === 0) delete reactions[emoji]
        else reactions[emoji] = [...users]
        return { ...m, reactions }
      })),
    )
    socket.on('videoChange', ({ src, type }) => { setVideoSrc(src); setVideoType(type) })
    socket.on('videoSync', data =>
      setSync(s => ({ isPlaying: data.isPlaying, currentTime: data.currentTime, seq: s.seq + 1 })),
    )
    socket.on('emojiReaction', data => {
      const id = `${Date.now()}-${Math.random()}`
      setReactions(prev => [...prev, { id, ...data }])
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000)
    })
    socket.on('error', msg => setError(msg))
    socket.on('kicked', () => setKicked(true))

    const heartbeat = setInterval(() => { if (socket.connected) socket.emit('heartbeat') }, 3000)

    return () => {
      clearInterval(heartbeat)
      startedRef.current = false
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [requestedRoomId, name])

  const sendChat = useCallback((text: string, replyTo?: string) => {
    const t = text.trim()
    if (t) socketRef.current?.emit('chatMessage', { text: t, replyTo })
  }, [])
  const deleteMessage = useCallback((id: string) => socketRef.current?.emit('deleteMessage', id), [])
  const toggleReaction = useCallback((messageId: string, emoji: string) => socketRef.current?.emit('toggleMessageReaction', { messageId, emoji }), [])
  const syncVideo = useCallback((data: VideoSyncData) => socketRef.current?.emit('videoSync', data), [])
  const setVideo = useCallback((src: string, type: VideoType) => socketRef.current?.emit('setVideo', { src, type }), [])
  const sendEmoji = useCallback((emoji: string) => socketRef.current?.emit('sendEmoji', emoji), [])

  return {
    connected, error, kicked, myId, roomId,
    isHost: !!myId && host === myId,
    participants, chat, host, videoSrc, videoType, sync, reactions,
    sendChat, deleteMessage, toggleReaction, syncVideo, setVideo, sendEmoji,
  }
}
