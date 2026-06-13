import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMessage } from '../components/message-context'
import {
  type AccidentSession,
  connectAvailableSessionsRealtime,
  connectSessionRealtime,
  endCall,
  getSession,
  type RealtimeSignalMessage,
  sendRealtimeSignal,
  startRecording,
  stopRecording,
  uploadRecording,
} from '../sessions'

const rtcConfiguration: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

function SessionConsole() {
  const navigate = useNavigate()
  const { sessionId } = useParams()

  // 页面状态：当前会话、实时会话列表、连接状态和本地媒体开关。
  const [session, setSession] = useState<AccidentSession | null>(null)
  const [availableSessions, setAvailableSessions] = useState<AccidentSession[]>([])
  const [connectionState, setConnectionState] = useState('未连接')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(Boolean(sessionId))
  const [isUpdating, setIsUpdating] = useState(false)
  const { showMessage } = useMessage()

  // 视频和本地流用 ref 保存，避免这些对象变化时引起不必要的重渲染。
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  // 优先使用 URL 指定的会话；如果没有 sessionId，就从可接入列表里取第一个。
  const activeSession = session ?? (sessionId ? null : availableSessions[0]) ?? null

  // 有 sessionId 时拉取单条会话详情，并在失败时给出全局消息提示。
  useEffect(() => {
    if (!sessionId) {
      return
    }

    let ignore = false

    getSession(sessionId)
      .then((nextSession) => {
        if (!ignore) {
          setSession(nextSession)
        }
      })
      .catch((error) => {
        if (!ignore) {
          showMessage({
            text: error instanceof Error ? error.message : '获取会话详情失败',
            type: 'error',
          })
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingSession(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [sessionId, showMessage])

  // 监听可接入会话列表的实时变化，用来补充工作台里的会话入口。
  useEffect(() => {
    const connection = connectAvailableSessionsRealtime(
      (nextSession) => {
        setAvailableSessions((currentSessions) => {
          if (currentSessions.some((currentSession) => currentSession.id === nextSession.id)) {
            return currentSessions
          }
          return [...currentSessions, nextSession]
        })
      },
      (message) => {
        showMessage({ text: message, type: 'warning' })
      },
    )

    return () => {
      connection.disconnect()
    }
  }, [showMessage])

  // 当前会话可用且未结束时，初始化 WebRTC 和会话信令连接。
  useEffect(() => {
    if (!activeSession?.id) {
      return
    }

    if (activeSession.callStatus === 'ended') {
      return
    }

    let ignore = false
    let socket: WebSocket | null = null
    let realtimeDisconnect: (() => void) | null = null
    let peerConnection: RTCPeerConnection | null = null
    let videoRecorder: CallVideoRecorder | null = null
    let recordingUploadPromise: Promise<void> = Promise.resolve()
    let hasReportedConnected = false
    const pendingRemoteCandidates: RTCIceCandidateInit[] = []
    const localVideoElement = localVideoRef.current
    const remoteVideoElement = remoteVideoRef.current
    let remoteMediaStream: MediaStream | null = null

    // 主动发起 offer，推动远端进入协商流程。
    const sendOffer = async () => {
      if (!peerConnection || !socket || socket.readyState !== WebSocket.OPEN) {
        return
      }

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      sendRealtimeSignal(socket, 'webrtc.offer', offer)
    }

    const addRemoteCandidate = async (candidate: RTCIceCandidateInit) => {
      if (!peerConnection) {
        return
      }

      if (!peerConnection.remoteDescription) {
        pendingRemoteCandidates.push(candidate)
        return
      }

      await peerConnection.addIceCandidate(candidate)
    }

    // 某些候选会先于 remoteDescription 到达，先暂存，等描述设置后再补上。
    const flushRemoteCandidates = async () => {
      while (pendingRemoteCandidates.length > 0) {
        const candidate = pendingRemoteCandidates.shift()
        if (candidate) {
          await addRemoteCandidate(candidate)
        }
      }
    }

    const startCallRecording = async () => {
      if (
        videoRecorder ||
        !localStreamRef.current ||
        !remoteMediaStream
      ) {
        return
      }

      const videoTracks = remoteMediaStream.getVideoTracks().filter((track) => track.readyState === 'live')
      if (videoTracks.length === 0) {
        return
      }

      try {
        videoRecorder = await startVideoRecorder(localStreamRef.current, remoteMediaStream)

        const nextSession = await startRecording(activeSession.id)
        if (!ignore) {
          setSession(nextSession)
        }
      } catch (error) {
        await videoRecorder?.stop()
        videoRecorder = null
        showMessage({
          text: error instanceof Error ? error.message : '开始录像失败',
          type: 'error',
        })
      }
    }

    const stopCallRecording = () => {
      if (!videoRecorder) {
        return recordingUploadPromise
      }

      const recorder = videoRecorder
      videoRecorder = null
      recordingUploadPromise = recorder
        .stop()
        .then((blob) => {
          if (blob.size === 0) {
            return stopRecording(activeSession.id)
          }

          return uploadRecording(activeSession.id, blob, blob.type)
        })
        .then((nextSession) => {
          if (!ignore && nextSession) {
            setSession(nextSession)
          }
        })
        .catch((error) => {
          showMessage({
            text: error instanceof Error ? error.message : '上传录像失败',
            type: 'error',
          })
        })

      return recordingUploadPromise
    }

    // 统一处理信令消息，按 type 驱动 WebRTC 的各个状态转换。
    const handleSignal = async (message: RealtimeSignalMessage) => {
      if (!peerConnection || message.role === 'police') {
        return
      }

      try {
        if (message.type === 'webrtc.ready') {
          await sendOffer()
          return
        }

        if (message.type === 'webrtc.leave') {
          setConnectionState('已断开')
          return
        }

        if (message.type === 'webrtc.answer' && message.payload) {
          await peerConnection.setRemoteDescription(message.payload as RTCSessionDescriptionInit)
          await flushRemoteCandidates()
          return
        }

        if (message.type === 'webrtc.candidate' && message.payload) {
          await addRemoteCandidate(message.payload as RTCIceCandidateInit)
        }
      } catch (error) {
        showMessage({
          text: error instanceof Error ? error.message : '信令处理失败',
          type: 'error',
        })
      }
    }

    const realtimeConnection = connectSessionRealtime(
      activeSession.id,
      (nextSession) => {
        setSession(nextSession)
        setAvailableSessions((currentSessions) =>
          currentSessions.map((currentSession) =>
            currentSession.id === nextSession.id ? nextSession : currentSession,
          ),
        )
      },
      (message) => {
        showMessage({ text: message, type: 'warning' })
      },
      (message) => void handleSignal(message),
    )
    socket = realtimeConnection.socket
    realtimeDisconnect = realtimeConnection.disconnect

    // 获取本地摄像头和麦克风，并把媒体轨道挂到 PeerConnection 上。
    const setupCall = async () => {
      try {
        setConnectionState('正在接入')

        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })
        if (ignore) {
          localStream.getTracks().forEach((track) => track.stop())
          return
        }

        localStreamRef.current = localStream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
        }

        peerConnection = new RTCPeerConnection(rtcConfiguration)
        localStream.getTracks().forEach((track) => peerConnection?.addTrack(track, localStream))

        peerConnection.ontrack = (event) => {
          const [remoteStream] = event.streams
          if (remoteVideoRef.current && remoteStream) {
            remoteMediaStream = remoteStream
            remoteVideoRef.current.srcObject = remoteStream
            if (peerConnection?.connectionState === 'connected') {
              void startCallRecording()
            }
          }
        }

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            sendRealtimeSignal(socket, 'webrtc.candidate', event.candidate.toJSON())
          }
        }

        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection?.connectionState
          setConnectionState(displayPeerConnectionState(state))
          if (state === 'connected') {
            if (!hasReportedConnected) {
              hasReportedConnected = true
              sendRealtimeSignal(socket, 'call.connected')
            }
            void startCallRecording()
            return
          }
          if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            void stopCallRecording()
          }
        }

        if (socket.readyState === WebSocket.OPEN) {
          await sendOffer()
        } else {
          socket.addEventListener('open', () => {
            void sendOffer()
          })
        }
      } catch (error) {
        // 设备、权限或连接初始化失败时，给出明确错误反馈。
        setConnectionState('连接失败')
        showMessage({
          text: error instanceof Error ? error.message : '无法访问摄像头或麦克风',
          type: 'error',
        })
      }
    }

    void setupCall()

    return () => {
      // 会话切换或页面卸载时，主动释放信令、连接和本地媒体资源。
      ignore = true
      sendRealtimeSignal(socket, 'webrtc.leave')
      void stopCallRecording()
      realtimeDisconnect?.()
      peerConnection?.close()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      setIsMuted(false)
      setIsCameraOff(false)
      if (localVideoElement) {
        localVideoElement.srcObject = null
      }
      if (remoteVideoElement) {
        remoteVideoElement.srcObject = null
      }
    }
  }, [activeSession?.callStatus, activeSession?.id, showMessage])

  // 侧边状态面板的数据源，集中展示网络、司机、信令和媒体状态。
  const statusItems = useMemo(
    () => [
      { label: '网络', value: displayNetworkStatus(activeSession?.networkStatus) },
      { label: '司机端', value: activeSession?.driverOnline ? '在线' : '离线' },
      { label: '信令', value: displaySignalingStatus(activeSession?.signalingStatus) },
      { label: '媒体', value: activeSession?.callStatus === 'ended' ? '已关闭' : connectionState },
    ],
    [activeSession, connectionState],
  )

  const isRecording = activeSession?.recordingStatus === 'recording'
  const isCallEnded = activeSession?.callStatus === 'ended'

  // 静音只切换音轨 enable，不重建媒体流。
  const handleToggleMute = () => {
    const nextMuted = !isMuted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    setIsMuted(nextMuted)
  }

  // 关闭摄像头同理，只禁用视频轨。
  const handleToggleCamera = () => {
    const nextCameraOff = !isCameraOff
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff
    })
    setIsCameraOff(nextCameraOff)
  }

  // 结束当前通话，并同步服务端返回的会话状态。
  const handleEndCall = async () => {
    if (!activeSession || isUpdating) {
      return
    }

    setIsUpdating(true)
    try {
      const nextSession = await endCall(activeSession.id)
      setSession(nextSession)
    } catch (error) {
      showMessage({
        text: error instanceof Error ? error.message : '结束通话失败',
        type: 'error',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] p-4 text-slate-900 md:p-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="font-semibold tracking-wide">
            {activeSession?.id || '等待司机发起会话'}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              isCallEnded ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isCallEnded ? '已结束' : '通话中'}
          </span>
          <span className="font-mono text-sm text-slate-600">03:25</span>
          <span
            className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              isRecording ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-slate-400'}`} />
            {isRecording ? '录像中' : '未录像'}
          </span>
          <button
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => navigate('/sessions')}
            type="button"
          >
            返回列表
          </button>
        </header>

        <div className="grid flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="relative min-h-[22rem] overflow-hidden rounded-lg bg-slate-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(56,189,248,0.28),transparent_34%),linear-gradient(135deg,#0f172a,#111827_52%,#18181b)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:42px_42px]" />
            <div className="relative flex h-full min-h-[22rem] items-center justify-center">
              <video
                autoPlay
                className="absolute inset-0 h-full w-full object-cover"
                playsInline
                ref={remoteVideoRef}
              />
              <div className="relative rounded-full border border-white/15 bg-white/10 px-6 py-3 text-lg font-medium text-white/85">
                {connectionState === '已连接' ? '远端视频已连接' : '等待远端视频'}
              </div>
            </div>
            <div className="absolute right-4 bottom-4 h-32 w-44 overflow-hidden rounded-md border border-white/20 bg-slate-800 shadow-lg">
              <video
                autoPlay
                className="h-full w-full object-cover"
                muted
                playsInline
                ref={localVideoRef}
              />
            </div>
          </section>

          <aside className="grid content-start gap-5">
            {isLoadingSession ? (
              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                正在加载会话...
              </section>
            ) : null}

            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">会话信息</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">司机</dt>
                  <dd className="font-medium">{activeSession?.driverName || '-'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">电话</dt>
                  <dd className="font-medium">{activeSession?.driverPhoneMasked || '-'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">位置</dt>
                  <dd className="font-medium text-emerald-700">
                    {displayLocationStatus(activeSession?.locationStatus)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">网络</dt>
                  <dd className="font-medium text-emerald-700">
                    {displayNetworkStatus(activeSession?.networkStatus)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">事故描述</h2>
              <p className="text-sm leading-6 text-slate-700">
                {activeSession?.description || '暂无事故描述'}
              </p>
            </section>
          </aside>
        </div>

        <footer className="border-t border-slate-200 px-5 py-5">
          <div className="mb-5 flex flex-wrap gap-x-10 gap-y-2 text-sm">
            {statusItems.map((item) => (
              <span key={item.label} className="text-slate-500">
                {item.label}: <strong className="font-semibold text-emerald-700">{item.value}</strong>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="min-w-24 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
              onClick={handleToggleMute}
              type="button"
            >
              {isMuted ? '取消静音' : '静音'}
            </button>
            <button
              className="min-w-24 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
              onClick={handleToggleCamera}
              type="button"
            >
              {isCameraOff ? '开启摄像头' : '关闭摄像头'}
            </button>
            <button
              className="min-w-24 rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white ring-1 ring-emerald-600 disabled:bg-slate-300 disabled:ring-slate-300"
              disabled
              type="button"
            >
              {isRecording ? '自动录像中' : '连接后自动录像'}
            </button>
            <button
              className="min-w-24 rounded-md bg-rose-600 px-5 py-3 text-sm font-semibold text-white ring-1 ring-rose-600 disabled:bg-slate-300 disabled:ring-slate-300"
              disabled={!activeSession || isUpdating || isCallEnded}
              onClick={() => void handleEndCall()}
            >
              结束通话
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}

function displayLocationStatus(status?: string) {
  return status === 'ready' ? '已获取' : '未获取'
}

function displayNetworkStatus(status?: string) {
  return status === 'good' ? '良好' : '未知'
}

function displaySignalingStatus(status?: string) {
  if (status === 'connected') {
    return '已连接'
  }
  if (status === 'disconnected') {
    return '已断开'
  }
  return '未连接'
}

function displayPeerConnectionState(state?: RTCPeerConnectionState) {
  if (state === 'connected') {
    return '已连接'
  }

  if (state === 'connecting') {
    return '连接中'
  }

  if (state === 'failed') {
    return '连接失败'
  }

  if (state === 'disconnected') {
    return '已断开'
  }

  if (state === 'closed') {
    return '已关闭'
  }

  return '未连接'
}

type CallVideoRecorder = {
  stop: () => Promise<Blob>
}

async function startVideoRecorder(localStream: MediaStream, remoteStream: MediaStream): Promise<CallVideoRecorder> {
  if (!window.MediaRecorder) {
    throw new Error('当前浏览器不支持视频录制')
  }

  const videoTracks = remoteStream.getVideoTracks().filter((track) => track.readyState === 'live')
  if (videoTracks.length === 0) {
    throw new Error('没有可录制的视频轨道')
  }

  const recordingStream = new MediaStream(videoTracks)
  const AudioContextClass =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const audioSources: MediaStreamAudioSourceNode[] = []
  let audioContext: AudioContext | null = null

  const audioTracks = [
    ...remoteStream.getAudioTracks(),
    ...localStream.getAudioTracks(),
  ].filter((track) => track.readyState === 'live')

  if (AudioContextClass && audioTracks.length > 0) {
    audioContext = new AudioContextClass()
    await audioContext.resume()

    const destination = audioContext.createMediaStreamDestination()
    const connectStream = (stream: MediaStream) => {
      if (stream.getAudioTracks().some((track) => track.readyState === 'live')) {
        const source = audioContext?.createMediaStreamSource(stream)
        if (source) {
          source.connect(destination)
          audioSources.push(source)
        }
      }
    }

    connectStream(remoteStream)
    connectStream(localStream)
    destination.stream.getAudioTracks().forEach((track) => recordingStream.addTrack(track))
  } else {
    audioTracks.forEach((track) => recordingStream.addTrack(track))
  }

  const mimeType = preferredVideoMimeType()
  const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  const stopPromise = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }
    recorder.onerror = (event) => {
      reject((event as Event & { error?: Error }).error ?? new Error('视频录制失败'))
    }
    recorder.onstop = () => {
      audioSources.forEach((source) => source.disconnect())
      void audioContext?.close()
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }))
    }
  })

  recorder.start(1000)

  return {
    stop: async () => {
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
      return stopPromise
    },
  }
}

function preferredVideoMimeType() {
  const supportedTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]

  return supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export default SessionConsole
