import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useMessage } from '../components/message-context'
import {
  type AccidentSession,
  getSession,
} from '../sessions'

const mockTranscriptSegments = [
  {
    id: 'mock-driver-report',
    speaker: '说话人1',
    content: '我所在的虹梅路发生车祸了，需要处理。',
  },
  {
    id: 'mock-police-reply',
    speaker: '说话人2',
    content: '收到。请问有人员受伤吗？',
  },
  {
    id: 'mock-driver-injury',
    speaker: '说话人1',
    content: '有两个人受了轻伤，我已经叫了救护车。',
  },
  {
    id: 'mock-police-ask-location',
    speaker: '说话人2',
    content: '请提供具体的事故地点，我这边帮您记录。',
  },
  {
    id: 'mock-driver-location',
    speaker: '说话人1',
    content: '虹梅路地铁站2号口，南向北方向。',
  },
  {
    id: 'mock-police-ask-vehicle',
    speaker: '说话人2',
    content: '涉及几辆车？车牌号方便提供吗？',
  },
  {
    id: 'mock-driver-vehicle',
    speaker: '说话人1',
    content: '三辆车连环追尾，我的车牌是沪A12345。',
  },
  {
    id: 'mock-police-response',
    speaker: '说话人2',
    content: '好的，已为您记录报案信息。交警会尽快赶往现场，请保持电话畅通。',
  },
  {
    id: 'mock-driver-confirm',
    speaker: '说话人1',
    content: '好的，谢谢。',
  },
  {
    id: 'mock-police-closing',
    speaker: '说话人2',
    content: '不客气，请注意自身安全，避免二次事故。',
  },
]

function SessionTranscriptPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [session, setSession] = useState<AccidentSession | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(sessionId))
  const { showMessage } = useMessage()

  useEffect(() => {
    if (!sessionId) {
      return
    }

    let ignore = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
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
            setIsLoading(false)
          }
        })
    }, 0)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [sessionId, showMessage])

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
            <InfoItem label="生成状态" value={isLoading ? '读取中' : ''} />
            <InfoItem label="文本条数" value={String(mockTranscriptSegments.length)} />
          </section>

          {mockTranscriptSegments.length > 0 ? (
            <section className="grid gap-4">
              {mockTranscriptSegments.map((segment) => (
                <article className="border-b border-slate-100 pb-4" key={segment.id}>
                  <div className="mb-2 text-sm font-semibold text-emerald-700">{segment.speaker}</div>
                  <p className="text-base leading-8 text-slate-800">{segment.content}</p>
                </article>
              ))}
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              {isLoading ? '正在读取通话文本...' : '暂无通话文本。'}
            </section>
          )}
        </div>
      </section>
    </main>
  )
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
