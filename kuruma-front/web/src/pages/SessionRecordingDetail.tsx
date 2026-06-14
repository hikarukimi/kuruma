import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useMessage } from '../components/message-context'
import {
  type AccidentSession,
  type SessionRecording,
  fetchRecordingBlob,
  getSession,
  listSessionRecordings,
} from '../sessions'

function SessionRecordingDetail() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [session, setSession] = useState<AccidentSession | null>(null)
  const [recordings, setRecordings] = useState<SessionRecording[]>([])
  const [selectedRecordingId, setSelectedRecordingId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)
  const [downloadingRecordingId, setDownloadingRecordingId] = useState('')
  const { showMessage } = useMessage()

  const selectedRecording =
    recordings.find((recording) => recording.id === selectedRecordingId) ?? recordings[0] ?? null
  const selectedRecordingIsAudio = selectedRecording ? isAudioRecording(selectedRecording.mimeType) : false

  useEffect(() => {
    if (!sessionId) {
      return
    }

    let ignore = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      Promise.all([getSession(sessionId), listSessionRecordings(sessionId)])
        .then(([nextSession, nextRecordings]) => {
          if (ignore) {
            return
          }

          setSession(nextSession)
          setRecordings(nextRecordings)
          setSelectedRecordingId(nextRecordings[0]?.id ?? '')
        })
        .catch((error) => {
          if (!ignore) {
            showMessage({
              text: error instanceof Error ? error.message : '获取通话记录失败',
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

  useEffect(() => {
    if (!sessionId || !selectedRecordingId) {
      const timer = window.setTimeout(() => {
        setVideoUrl('')
        setIsLoadingVideo(false)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    let ignore = false
    const timer = window.setTimeout(() => {
      setIsLoadingVideo(true)
      setVideoUrl('')

      fetchRecordingBlob(sessionId, selectedRecordingId)
        .then((blob) => {
          if (!ignore) {
            setVideoUrl(URL.createObjectURL(blob))
          }
        })
        .catch((error) => {
          if (!ignore) {
            showMessage({
              text: error instanceof Error ? error.message : '获取录像文件失败',
              type: 'error',
            })
          }
        })
        .finally(() => {
          if (!ignore) {
            setIsLoadingVideo(false)
          }
        })
    }, 0)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [sessionId, selectedRecordingId, showMessage])

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  async function handleDownload(recording: SessionRecording) {
    if (!sessionId || downloadingRecordingId) {
      return
    }

    setDownloadingRecordingId(recording.id)
    try {
      const blob = await fetchRecordingBlob(sessionId, recording.id)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = recordingFileName(recording)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      showMessage({
        text: error instanceof Error ? error.message : '下载录像失败',
        type: 'error',
      })
    } finally {
      setDownloadingRecordingId('')
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] p-4 text-slate-900 md:p-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="font-semibold tracking-wide">已结束通话详情</div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {session?.id || sessionId || '-'}
          </span>
          <button
            className="ml-auto rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => navigate('/sessions')}
            type="button"
          >
            返回列表
          </button>
        </header>

        <div className="grid flex-1 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="flex min-h-[28rem] flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-950">{session?.driverName || '通话录像'}</h1>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                {selectedRecording ? displayRecordingType(selectedRecording.mimeType) : '视频'}
              </span>
              {selectedRecording ? (
                <span className="text-sm text-slate-500">
                  {formatFileSize(selectedRecording.fileSize)} · {displayRecordingTime(selectedRecording)}
                </span>
              ) : null}
            </div>

            <div className="relative flex flex-1 min-h-[28rem] items-center justify-center overflow-hidden rounded-lg bg-slate-950">
              {videoUrl ? (
                selectedRecordingIsAudio ? (
                  <audio className="w-3/4 max-w-xl" controls src={videoUrl} />
                ) : (
                  <video className="h-full w-full object-contain" controls src={videoUrl} />
                )
              ) : (
                <div className="px-6 text-center text-sm font-medium text-white/75">
                  {isLoading || isLoadingVideo ? '正在加载媒体...' : '暂无可播放媒体'}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={!selectedRecording}
                onClick={() => selectedRecording && void handleDownload(selectedRecording)}
                type="button"
              >
                {downloadingRecordingId === selectedRecording?.id ? '下载中' : '下载当前记录'}
              </button>
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                disabled={!selectedRecording}
                onClick={() =>
                  selectedRecording &&
                  navigate(`/sessions/${sessionId}/transcript?recordingId=${selectedRecording.id}`)
                }
                type="button"
              >
                读取通话文本
              </button>
            </div>
          </section>

          <aside className="grid content-start gap-5">
            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">基础信息</h2>
              <dl className="space-y-3 text-sm">
                <InfoItem label="事故编号" value={session?.id || sessionId || '-'} />
                <InfoItem label="司机" value={session?.driverName || '-'} />
                <InfoItem label="电话" value={session?.driverPhoneMasked || '-'} />
                <InfoItem label="位置" value={displayLocationStatus(session?.locationStatus)} />
                <InfoItem label="网络" value={displayNetworkStatus(session?.networkStatus)} />
                <InfoItem label="创建时间" value={formatDateTime(session?.createdAt)} />
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">事故描述</h2>
              <p className="text-sm leading-6 text-slate-700">{session?.description || '暂无事故描述'}</p>
            </section>

            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">录像列表</h2>
              {recordings.length > 0 ? (
                <div className="grid gap-2">
                  {recordings.map((recording) => (
                    <button
                      className={`rounded-md border p-3 text-left transition ${
                        selectedRecording?.id === recording.id
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                      key={recording.id}
                      onClick={() => setSelectedRecordingId(recording.id)}
                      type="button"
                    >
                      <div className="truncate font-mono text-xs font-semibold text-slate-900">
                        {recording.id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatFileSize(recording.fileSize)} · {displayRecordingTime(recording)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  {isLoading ? '正在加载录像...' : '该通话暂无已保存录像。'}
                </p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function displayLocationStatus(status?: string) {
  return status === 'ready' ? '已获取' : '未获取'
}

function displayNetworkStatus(status?: string) {
  return status === 'good' ? '良好' : '未知'
}

function displayRecordingType(mimeType: string) {
  if (mimeType.includes('mp4')) {
    return 'MP4'
  }

  if (mimeType.includes('wav')) {
    return 'WAV'
  }

  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    return 'MP3'
  }

  if (mimeType.includes('webm')) {
    return 'WEBM'
  }

  return '媒体'
}

function isAudioRecording(mimeType: string) {
  return mimeType.includes('audio') || mimeType.includes('wav') || mimeType.includes('mpeg') || mimeType.includes('mp3')
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B'
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function displayRecordingTime(recording: SessionRecording) {
  return formatDateTime(recording.completedAt || recording.createdAt)
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function recordingFileName(recording: SessionRecording) {
  const extension = recording.mimeType.includes('wav')
    ? 'wav'
    : recording.mimeType.includes('mpeg') || recording.mimeType.includes('mp3')
      ? 'mp3'
      : recording.mimeType.includes('mp4')
        ? 'mp4'
        : 'webm'
  return `${recording.sessionId}-${recording.id}.${extension}`
}

export default SessionRecordingDetail
