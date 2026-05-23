import { apiBaseUrl, authHeader, getJwtToken, wsBaseUrl } from './service'

export type AccidentSession = {
  id: string
  driverName: string
  driverPhoneMasked: string
  description: string
  locationStatus: string
  networkStatus: string
  driverOnline: boolean
  signalingStatus: string
  recordingStatus: string
  callStatus: string
  createdAt: string
  updatedAt: string
}

export type CreateSessionInput = Partial<
  Pick<
    AccidentSession,
    | 'driverName'
    | 'driverPhoneMasked'
    | 'description'
    | 'locationStatus'
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

export async function listSessions() {
  const response = await fetch(`${apiBaseUrl}/sessions`, {
    headers: authHeader(),
  })
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
  const data = (await response.json()) as SessionResponse

  if (!response.ok || !data.session) {
    throw new Error(data.error || '创建会话失败')
  }

  return data.session
}

export async function startRecording(sessionId: string) {
  return updateSession(`${sessionId}/recording/start`, '开始录像失败')
}

export async function endCall(sessionId: string) {
  return updateSession(`${sessionId}/end`, '结束通话失败')
}

export function connectSessionRealtime(
  sessionId: string,
  onSessionUpdated: (session: AccidentSession) => void,
  onError?: (message: string) => void,
) {
  const params = new URLSearchParams({
    sessionId,
    role: 'police',
    token: getJwtToken(),
  })
  const socket = new WebSocket(`${wsBaseUrl}/ws?${params.toString()}`)

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.type === 'session.updated' && message.payload) {
      onSessionUpdated(message.payload)
    }
  }

  socket.onerror = () => {
    onError?.('实时状态连接异常')
  }

  socket.onclose = (event) => {
    if (!event.wasClean) {
      onError?.('实时状态连接已断开')
    }
  }

  return socket
}

export function connectAvailableSessionsRealtime(
  onSessionCreated: (session: AccidentSession) => void,
  onError?: (message: string) => void,
) {
  const params = new URLSearchParams({
    role: 'police',
    token: getJwtToken(),
  })
  const socket = new WebSocket(`${wsBaseUrl}/ws/global?${params.toString()}`)

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.type === 'session.created' && message.payload) {
      onSessionCreated(message.payload)
    }
  }

  socket.onerror = () => {
    onError?.('可接入会话连接异常')
  }

  socket.onclose = (event) => {
    if (!event.wasClean) {
      onError?.('可接入会话连接已断开')
    }
  }

  return socket
}

async function updateSession(path: string, fallbackMessage: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${path}`, {
    method: 'POST',
    headers: authHeader(),
  })
  const data = (await response.json()) as SessionResponse

  if (!response.ok || !data.session) {
    throw new Error(data.error || fallbackMessage)
  }

  return data.session
}
