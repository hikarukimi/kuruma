import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  type AccidentSession,
  connectAvailableSessionsRealtime,
  connectSessionRealtime,
  listSessions,
} from '../sessions'
import { clearToken } from '../service'
import { useMessage } from '../components/message-context'

type SessionFilter = 'waiting' | 'processing' | 'ended'

const filterItems: Array<{ label: string; value: SessionFilter }> = [
  { label: '待处理', value: 'waiting' },
  { label: '处理中', value: 'processing' },
  { label: '已结束', value: 'ended' },
]

function PoliceWorkbench() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<AccidentSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [activeFilter, setActiveFilter] = useState<SessionFilter>('waiting')
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [, setNow] = useState(() => Date.now())
  const { showMessage } = useMessage()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const nextSessions = await listSessions()
      setSessions(nextSessions)
    } catch (error) {
      showMessage({
        text: error instanceof Error ? error.message : '获取请求列表失败',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }, [showMessage])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadSessions])

  useEffect(() => {
    const connection = connectAvailableSessionsRealtime(
      (nextSession) => {
        setSessions((currentSessions) => upsertSession(currentSessions, nextSession))
      },
      (message) => {
        showMessage({ text: message, type: 'warning' })
      },
    )

    return () => {
      connection.disconnect()
    }
  }, [showMessage])

  const visibleSessions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return sessions
      .filter((session) => sessionStatus(session) === activeFilter)
      .filter((session) => {
        if (!normalizedKeyword) {
          return true
        }

        return [session.id, session.driverName, session.driverPhoneMasked]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword)
      })
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  }, [activeFilter, keyword, sessions])

  const selectedSession = useMemo(
    () =>
      visibleSessions.find((session) => session.id === selectedSessionId) ??
      visibleSessions[0] ??
      null,
    [selectedSessionId, visibleSessions],
  )
  const selectedSessionStatus = selectedSession ? sessionStatus(selectedSession) : null

  useEffect(() => {
    if (!selectedSession?.id) {
      return
    }

    const connection = connectSessionRealtime(
      selectedSession.id,
      (nextSession) => {
        setSessions((currentSessions) => upsertSession(currentSessions, nextSession))
      },
      (message) => {
        showMessage({ text: message, type: 'warning' })
      },
    )

    return () => {
      connection.disconnect()
    }
  }, [selectedSession?.id, showMessage])

  const overviewItems = useMemo(() => {
    const todaySessions = sessions.filter((session) => isToday(session.createdAt))

    return [
      { label: '今日请求', value: String(todaySessions.length) },
      { label: '等待中', value: String(sessions.filter((session) => sessionStatus(session) === 'waiting').length) },
      {
        label: '正在处理',
        value: String(sessions.filter((session) => sessionStatus(session) === 'processing').length),
      },
    ]
  }, [sessions])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function handleEnterSession(session: AccidentSession | null) {
    if (!session) {
      return
    }

    if (sessionStatus(session) === 'ended') {
      navigate(`/sessions/${session.id}/recording`)
      return
    }

    navigate(`/sessions/${session.id}`)
  }

  function handleSelectSession(session: AccidentSession) {
    if (sessionStatus(session) === 'ended') {
      navigate(`/sessions/${session.id}/recording`)
      return
    }

    setSelectedSessionId(session.id)
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] p-4 text-slate-900 md:p-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-5 py-4">
          <div className="text-lg font-semibold tracking-wide text-slate-950">KURUMA 警察工作台</div>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              在线
            </span>
            <span className="font-medium text-slate-700">张警官</span>
            <button
              className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
              onClick={handleLogout}
              type="button"
            >
              退出
            </button>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
          <nav className="flex gap-2 text-sm font-semibold">
            {filterItems.map((item) => (
              <button
                className={`rounded-md px-4 py-2 ${
                  activeFilter === item.value
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                key={item.value}
                onClick={() => setActiveFilter(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto w-full max-w-sm sm:w-80">
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索事故编号/司机"
              type="search"
              value={keyword}
            />
          </div>
        </section>

        <div className="grid flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-500">左侧请求队列</h2>
            {isLoading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                正在加载请求列表...
              </div>
            ) : visibleSessions.length > 0 ? (
              <div className="grid gap-3">
                {visibleSessions.map((session) => {
                  const status = sessionStatus(session)
                  const isSelected = session.id === selectedSession?.id

                  return (
                    <article
                      className={`cursor-pointer rounded-lg border p-4 transition ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50/70 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      onDoubleClick={() => handleEnterSession(session)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-mono text-base font-semibold text-slate-950">{session.id}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}>
                          {displaySessionStatus(status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                        <span className="font-medium text-slate-700">{displaySessionStatus(status)}</span>
                        <span className="font-mono text-slate-500">{formatElapsed(session.createdAt)}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span>
                          司机:{' '}
                          <strong className="font-semibold text-slate-800">{session.driverName || '-'}</strong>
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                          视频
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                暂无匹配的事故请求
              </div>
            )}
          </section>

          <aside>
            <h2 className="mb-3 text-sm font-semibold text-slate-500">右侧概览</h2>
            <div className="grid gap-3">
              {overviewItems.map((item) => (
                <section className="rounded-lg border border-slate-200 bg-white p-4" key={item.label}>
                  <div className="text-sm font-medium text-slate-500">{item.label}</div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</div>
                </section>
              ))}
            </div>

            <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">选中请求</h2>
              {selectedSession ? (
                <>
                  <dl className="space-y-3 text-sm">
                    <div className="grid gap-1">
                      <dt className="text-slate-500">事故编号</dt>
                      <dd className="font-mono font-semibold text-slate-950">{selectedSession.id}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">司机</dt>
                      <dd className="font-medium">{selectedSession.driverName || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">电话</dt>
                      <dd className="font-medium">{selectedSession.driverPhoneMasked || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">位置</dt>
                      <dd className="font-medium text-emerald-700">
                        {selectedSession.locationStatus === 'ready' ? '已获取' : '未获取'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">网络</dt>
                      <dd className="font-medium text-emerald-700">
                        {selectedSession.networkStatus === 'good' ? '良好' : '未知'}
                      </dd>
                    </div>
                  </dl>
                  <button
                    className="mt-5 h-11 w-full rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                    onClick={() => handleEnterSession(selectedSession)}
                    type="button"
                  >
                    {selectedSessionStatus === 'ended' ? '查看详情' : '接入处理'}
                  </button>
                </>
              ) : (
                <p className="text-sm leading-6 text-slate-500">请选择左侧请求查看详情。</p>
              )}
            </section>
          </aside>
        </div>

        <footer className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          选中请求后在右侧展示详情，双击或点击接入进入请求详情页
        </footer>
      </section>
    </main>
  )
}

function upsertSession(sessions: AccidentSession[], nextSession: AccidentSession) {
  if (sessions.some((session) => session.id === nextSession.id)) {
    return sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
  }

  return [nextSession, ...sessions]
}

function sessionStatus(session: AccidentSession): SessionFilter {
  if (session.callStatus === 'ended') {
    return 'ended'
  }

  if (
    session.recordingStatus === 'recording' ||
    session.signalingStatus === 'connected' ||
    session.driverOnline
  ) {
    return 'processing'
  }

  return 'waiting'
}

function displaySessionStatus(status: SessionFilter) {
  if (status === 'processing') {
    return '处理中'
  }

  if (status === 'ended') {
    return '已结束'
  }

  return '等待接入'
}

function statusBadgeClass(status: SessionFilter) {
  if (status === 'processing') {
    return 'bg-sky-50 text-sky-700'
  }

  if (status === 'ended') {
    return 'bg-slate-100 text-slate-600'
  }

  return 'bg-amber-50 text-amber-700'
}

function formatElapsed(createdAt: string) {
  const createdTime = Date.parse(createdAt)
  if (Number.isNaN(createdTime)) {
    return '00:00:00'
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - createdTime) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function isToday(value: string) {
  const date = new Date(value)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export default PoliceWorkbench
