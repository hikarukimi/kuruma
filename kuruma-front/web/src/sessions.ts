import { apiBaseUrl, assertAuthorizedResponse, authHeader, getJwtToken, handleAuthExpired, wsBaseUrl } from './service'

export type AccidentSession = {
  id: string
  driverName: string
  driverPhoneMasked: string
  description: string
  locationStatus: string
  locationText: string
  networkStatus: string
  driverOnline: boolean
  signalingStatus: string
  recordingStatus: string
  callStatus: string
  createdAt: string
  updatedAt: string
}

export type SessionRecording = {
  id: string
  sessionId: string
  callId?: string
  status: string
  fileSize: number
  mimeType: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  downloadUrl: string
}

export type TranscriptSegment = {
  id: string
  transcriptId: string
  sessionId: string
  recordingId: string
  chunkIndex: number
  segmentIndex: number
  speaker: string
  content: string
  createdAt: string
}

export type CallTranscript = {
  id: string
  sessionId: string
  recordingId: string
  status: string
  provider: string
  model: string
  errorMessage?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  segments: TranscriptSegment[]
}

export type CreateSessionInput = Partial<
  Pick<
    AccidentSession,
    | 'driverName'
    | 'driverPhoneMasked'
    | 'description'
    | 'locationStatus'
    | 'locationText'
    | 'networkStatus'
    | 'driverOnline'
    | 'signalingStatus'
    | 'recordingStatus'
    | 'callStatus'
  >
>

type SessionResponse = {
  session?: AccidentSession
  error?: string
}

type SessionsResponse = {
  sessions?: AccidentSession[]
  error?: string
}

type RecordingsResponse = {
  recordings?: SessionRecording[]
  error?: string
}

type TranscriptResponse = {
  transcripts?: CallTranscript[]
  error?: string
}

//描述 WebSocket 收到的实时信令消息结构
export type RealtimeSignalMessage = {
  type: string
  sessionId?: string
  role?: string
  payload?: unknown
}

export type RealtimeConnection = {
  disconnect: () => void
  socket: WebSocket
}

export async function listSessions() {
  const response = await fetch(`${apiBaseUrl}/sessions`, {
    headers: authHeader(),
  })
  await assertAuthorizedResponse(response)
  const data = (await response.json()) as SessionsResponse

  if (!response.ok) {
    throw new Error(data.error || '获取会话列表失败')
  }

  return data.sessions || []
}

export async function getSession(sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}`, {
    headers: authHeader(),
  })
  await assertAuthorizedResponse(response)
  const data = (await response.json()) as SessionResponse

  if (!response.ok || !data.session) {
    throw new Error(data.error || '获取会话详情失败')
  }

  return data.session
}

export async function createSession(input: CreateSessionInput = {}) {
  const response = await fetch(`${apiBaseUrl}/sessions`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(input),
  })
  await assertAuthorizedResponse(response)
  const data = (await response.json()) as SessionResponse

  if (!response.ok || !data.session) {
    throw new Error(data.error || '创建会话失败')
  }

  return data.session
}

export async function startRecording(sessionId: string) {
  return updateSession(`${sessionId}/recording/start`, '开始录像失败')
}

export async function stopRecording(sessionId: string) {
  return updateSession(`${sessionId}/recording/stop`, '停止录像失败')
}

export async function uploadRecording(sessionId: string, file: Blob, mimeType: string) {
  const formData = new FormData()
  const extension = recordingExtension(mimeType)
  formData.append('file', file, `${sessionId}-${Date.now()}.${extension}`)
  formData.append('mimeType', mimeType)

  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/recordings`, {
    method: 'POST',
    headers: authHeader(),
    body: formData,
  })
  await assertAuthorizedResponse(response)
  const data = (await response.json()) as SessionResponse & { recording?: unknown }

  if (!response.ok || !data.recording) {
    throw new Error(data.error || '上传录像失败')
  }

  return data.session
}

function recordingExtension(mimeType: string) {
  if (mimeType.includes('wav')) {
    return 'wav'
  }
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    return 'mp3'
  }
  if (mimeType.includes('mp4')) {
    return 'mp4'
  }
  return 'webm'
}

export async function listSessionRecordings(sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/recordings`, {
    headers: authHeader(),
  })
  await assertAuthorizedResponse(response)
  const data = (await response.json()) as RecordingsResponse

  if (!response.ok) {
    throw new Error(data.error || '获取录像列表失败')
  }

  return data.recordings || []
}

export async function fetchRecordingBlob(sessionId: string, recordingId: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/recordings/${recordingId}/file`, {
    headers: authHeader(),
  })
  await assertAuthorizedResponse(response)

  if (!response.ok) {
    let errorMessage = '获取录像文件失败'
    try {
      const data = (await response.json()) as { error?: string }
      errorMessage = data.error || errorMessage
    } catch {
      // 文件接口异常时可能不是 JSON，保留通用错误信息。
    }
    throw new Error(errorMessage)
  }

  return response.blob()
}

export async function getSessionTranscript(sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/transcript`, {
    headers: authHeader(),
  })
  await assertAuthorizedResponse(response)
  const data = (await response.json()) as TranscriptResponse

  if (!response.ok) {
    throw new Error(data.error || '获取通话文本失败')
  }

  return data.transcripts || []
}

export async function endCall(sessionId: string) {
  return updateSession(`${sessionId}/end`, '结束通话失败')
}

export function connectSessionRealtime(
  sessionId: string,
  onSessionUpdated: (session: AccidentSession) => void,
  onError?: (message: string) => void,
  onSignal?: (message: RealtimeSignalMessage) => void,
) {
  const token = getJwtToken()
  if (!token) {
    handleAuthExpired()
  }

  const params = new URLSearchParams({
    sessionId,
    role: 'police',
    token,
  })
  const socket = new WebSocket(`${wsBaseUrl}/ws?${params.toString()}`)
  let hasOpened = false
  let isManualClose = false

  socket.onopen = () => {
    hasOpened = true
  }

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.type === 'session.updated' && message.payload) {
      onSessionUpdated(message.payload)
      return
    }

    if (message.type?.startsWith('webrtc.')) {
      onSignal?.(message)
    }
  }

  socket.onerror = () => {
    if (!isManualClose) {
      onError?.('实时状态连接异常')
    }
  }

  socket.onclose = (event) => {
    if (hasOpened && !isManualClose && !event.wasClean) {
      onError?.('实时状态连接已断开')
    }
  }

  return createRealtimeConnection(socket, () => {
    isManualClose = true
  })
}

export function sendRealtimeSignal(socket: WebSocket | null, type: string, payload?: unknown) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, payload }))
  }
}

export function connectAvailableSessionsRealtime(
  onSessionChanged: (session: AccidentSession) => void,
  onError?: (message: string) => void,
) {
  const token = getJwtToken()
  if (!token) {
    handleAuthExpired()
  }

  const params = new URLSearchParams({
    role: 'police',
    token,
  })
  const socket = new WebSocket(`${wsBaseUrl}/ws/global?${params.toString()}`)
  let hasOpened = false
  let isManualClose = false

  socket.onopen = () => {
    hasOpened = true
  }

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if ((message.type === 'session.created' || message.type === 'session.updated') && message.payload) {
      onSessionChanged(message.payload)
    }
  }

  socket.onerror = () => {
    if (!isManualClose) {
      onError?.('可接入会话连接异常')
    }
  }

  socket.onclose = (event) => {
    if (hasOpened && !isManualClose && !event.wasClean) {
      onError?.('可接入会话连接已断开')
    }
  }

  return createRealtimeConnection(socket, () => {
    isManualClose = true
  })
}

function createRealtimeConnection(socket: WebSocket, beforeDisconnect: () => void): RealtimeConnection {
  return {
    disconnect: () => {
      beforeDisconnect()
      socket.close()
    },
    socket,
  }
}

async function updateSession(path: string, fallbackMessage: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${path}`, {
    method: 'POST',
    headers: authHeader(),
  })
  await assertAuthorizedResponse(response)
  const data = (await response.json()) as SessionResponse

  if (!response.ok || !data.session) {
    throw new Error(data.error || fallbackMessage)
  }

  return data.session
}
