import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useMessage } from '../components/message-context'
import {
  type AccidentSession,
  type CallTranscript,
  getSession,
  getSessionTranscript,
} from '../sessions'

const transcriptPollingIntervalMs = 3000

function SessionTranscriptPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const recordingId = searchParams.get('recordingId') ?? ''
  const [session, setSession] = useState<AccidentSession | null>(null)
  const [transcripts, setTranscripts] = useState<CallTranscript[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(sessionId))
  const { showMessage } = useMessage()
  const segments = transcripts.flatMap((transcript) => transcript.segments)
  const hasProcessingTranscript = transcripts.some((transcript) => transcript.status === 'processing')
  const hasFailedTranscript = transcripts.some((transcript) => transcript.status === 'failed')

  useEffect(() => {
    if (!sessionId) {
      return
    }

    let ignore = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      Promise.all([getSession(sessionId), getSessionTranscript(sessionId, recordingId)])
        .then(([nextSession, nextTranscripts]) => {
          if (!ignore) {
            setSession(nextSession)
            setTranscripts(nextTranscripts)
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
            setIsLoading(false)
          }
        })
    }, 0)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [recordingId, sessionId, showMessage])

  useEffect(() => {
    if (!sessionId || !recordingId || !hasProcessingTranscript) {
      return undefined
    }

    let ignore = false
    const timer = window.setInterval(() => {
      getSessionTranscript(sessionId, recordingId)
        .then((nextTranscripts) => {
          if (!ignore) {
            setTranscripts(nextTranscripts)
          }
        })
        .catch((error) => {
          if (!ignore) {
            showMessage({
              text: error instanceof Error ? error.message : '获取通话文本失败',
              type: 'error',
            })
          }
        })
    }, transcriptPollingIntervalMs)

    return () => {
      ignore = true
      window.clearInterval(timer)
    }
  }, [hasProcessingTranscript, recordingId, sessionId, showMessage])

  return (
    <main className="min-h-screen bg-[#f4f6f8] p-4 text-slate-900 md:p-8">
      <section className="mx-auto min-h-[calc(100vh-2rem)] max-w-5xl rounded-lg border border-slate-200 bg-white shadow-sm md:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="font-semibold tracking-wide">通话文本记录</div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {session?.id || sessionId || '-'}
          </span>
          <button
            className="ml-auto rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(`/sessions/${sessionId}/recording`)}
            type="button"
          >
            返回录像
          </button>
        </header>

        <div className="p-5">
          <section className="mb-5 grid gap-3 border-b border-slate-200 pb-5 text-sm md:grid-cols-2">
            <InfoItem label="司机" value={session?.driverName || '-'} />
            <InfoItem label="电话" value={session?.driverPhoneMasked || '-'} />
            <InfoItem
              label="生成状态"
              value={displayTranscriptStatus(
                isLoading,
                transcripts.length,
                hasProcessingTranscript,
                hasFailedTranscript
              )}
            />
            <InfoItem label="文本条数" value={String(segments.length)} />
            <InfoItem label="录像记录" value={recordingId || '全部'} />
          </section>

          {segments.length > 0 ? (
            <section className="grid gap-4">
              {segments.map((segment) => (
                <article className="border-b border-slate-100 pb-4" key={segment.id}>
                  <div className="mb-2 text-sm font-semibold text-emerald-700">{segment.speaker}</div>
                  <p className="text-base leading-8 text-slate-800">{segment.content}</p>
                </article>
              ))}
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              {displayEmptyText(isLoading, hasProcessingTranscript, hasFailedTranscript)}
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

function displayTranscriptStatus(
  isLoading: boolean,
  transcriptCount: number,
  hasProcessingTranscript: boolean,
  hasFailedTranscript: boolean
) {
  if (isLoading) {
    return '读取中'
  }
  if (hasProcessingTranscript) {
    return '生成中'
  }
  if (hasFailedTranscript) {
    return '生成失败'
  }
  if (transcriptCount === 0) {
    return '暂无文本'
  }
  return '已完成'
}

function displayEmptyText(isLoading: boolean, hasProcessingTranscript: boolean, hasFailedTranscript: boolean) {
  if (isLoading) {
    return '正在读取通话文本...'
  }
  if (hasProcessingTranscript) {
    return '正在生成通话文本...'
  }
  if (hasFailedTranscript) {
    return '通话文本生成失败。'
  }
  return '暂无通话文本。'
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <strong className="font-semibold text-slate-900">{value}</strong>
    </div>
  )
}

export default SessionTranscriptPage
