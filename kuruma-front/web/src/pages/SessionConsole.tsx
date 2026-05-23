import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  type AccidentSession,
  connectAvailableSessionsRealtime,
  connectSessionRealtime,
  endCall,
  getSession,
  startRecording,
} from '../sessions'

function SessionConsole() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [session, setSession] = useState<AccidentSession | null>(null)
  const [availableSessions, setAvailableSessions] = useState<AccidentSession[]>([])
  const [realtimeError, setRealtimeError] = useState('')
  const [isLoadingSession, setIsLoadingSession] = useState(Boolean(sessionId))
  const [isUpdating, setIsUpdating] = useState(false)
  const activeSession = session ?? (sessionId ? null : availableSessions[0]) ?? null

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
          setRealtimeError(error instanceof Error ? error.message : '获取会话详情失败')
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
  }, [sessionId])

  useEffect(() => {
    const socket = connectAvailableSessionsRealtime(
      (nextSession) => {
        setAvailableSessions((currentSessions) => {
          if (currentSessions.some((currentSession) => currentSession.id === nextSession.id)) {
            return currentSessions
          }
          return [...currentSessions, nextSession]
        })
        setRealtimeError('')
      },
      (message) => {
        setRealtimeError(message)
      },
    )

    return () => {
      socket.close()
    }
  }, [])

  useEffect(() => {
    if (!activeSession?.id) {
      return
    }

    const socket = connectSessionRealtime(
      activeSession.id,
      (nextSession) => {
        setSession(nextSession)
        setAvailableSessions((currentSessions) =>
          currentSessions.map((currentSession) =>
            currentSession.id === nextSession.id ? nextSession : currentSession,
          ),
        )
        setRealtimeError('')
      },
      (message) => {
        setRealtimeError(message)
      },
    )

    return () => {
      socket.close()
    }
  }, [activeSession?.id])

  const statusItems = useMemo(
    () => [
      { label: '网络', value: displayNetworkStatus(activeSession?.networkStatus) },
      { label: '司机端', value: activeSession?.driverOnline ? '在线' : '离线' },
      { label: '信令', value: displaySignalingStatus(activeSession?.signalingStatus) },
    ],
    [activeSession],
  )

  const isRecording = activeSession?.recordingStatus === 'recording'
  const isCallEnded = activeSession?.callStatus === 'ended'

  const handleStartRecording = async () => {
    if (!activeSession || isUpdating) {
      return
    }

    setIsUpdating(true)
    try {
      const nextSession = await startRecording(activeSession.id)
      setSession(nextSession)
      setRealtimeError('')
    } catch (error) {
      setRealtimeError(error instanceof Error ? error.message : '开始录像失败')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleEndCall = async () => {
    if (!activeSession || isUpdating) {
      return
    }

    setIsUpdating(true)
    try {
      const nextSession = await endCall(activeSession.id)
      setSession(nextSession)
      setRealtimeError('')
    } catch (error) {
      setRealtimeError(error instanceof Error ? error.message : '结束通话失败')
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
              <div className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-lg font-medium text-white/85">
                远端视频画面
              </div>
            </div>
            <div className="absolute right-4 bottom-4 h-32 w-44 overflow-hidden rounded-md border border-white/20 bg-slate-800 shadow-lg">
              <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#475569,#1f2937)] text-sm font-medium text-white/85">
                本地预览
              </div>
            </div>
          </section>

          <aside className="grid content-start gap-5">
            {realtimeError ? (
              <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                {realtimeError}
              </section>
            ) : null}
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
            <button className="min-w-24 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
              静音
            </button>
            <button className="min-w-24 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
              摄像头
            </button>
            <button
              className="min-w-24 rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white ring-1 ring-emerald-600 disabled:bg-slate-300 disabled:ring-slate-300"
              disabled={!activeSession || isUpdating || isRecording || isCallEnded}
              onClick={() => void handleStartRecording()}
            >
              {isUpdating ? '处理中' : '开始录像'}
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

export default SessionConsole
