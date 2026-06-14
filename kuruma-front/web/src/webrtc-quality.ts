export type ConnectionMode = 'video' | 'audio'

const audioConstraints: MediaTrackConstraints = {
  autoGainControl: true,
  channelCount: { ideal: 1 },
  echoCancellation: true,
  noiseSuppression: true,
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
}

const videoConstraintFallbacks: MediaTrackConstraints[] = [
  {
    facingMode: 'user',
    frameRate: { ideal: 30, max: 30 },
    height: { ideal: 720, max: 720 },
    width: { ideal: 1280, max: 1280 },
  },
  {
    facingMode: 'user',
    frameRate: { ideal: 30, max: 30 },
    height: { ideal: 540, max: 540 },
    width: { ideal: 960, max: 960 },
  },
  {
    facingMode: 'user',
    frameRate: { ideal: 24, max: 24 },
    height: { ideal: 480, max: 480 },
    width: { ideal: 640, max: 640 },
  },
]

export async function getCallMediaStream(mode: ConnectionMode) {
  if (mode === 'audio') {
    return navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    })
  }

  let lastError: unknown
  for (const video of videoConstraintFallbacks) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('无法访问摄像头或麦克风')
}

export async function applyCallSenderQuality(sender: RTCRtpSender) {
  if (!sender.setParameters) {
    return
  }

  const parameters = sender.getParameters()
  const encodings = parameters.encodings?.length ? parameters.encodings : [{}]

  parameters.encodings = encodings.map((encoding) => {
    if (sender.track?.kind === 'video') {
      return {
        ...encoding,
        maxBitrate: 2_500_000,
        maxFramerate: 30,
      }
    }
    if (sender.track?.kind === 'audio') {
      return {
        ...encoding,
        dtx: false,
        maxBitrate: 96_000,
        priority: 'high',
      }
    }
    return encoding
  })

  if (sender.track?.kind === 'video') {
    parameters.degradationPreference = 'maintain-resolution'
  }

  try {
    await sender.setParameters(parameters)
  } catch {
    // Browser support for sender bitrate hints is inconsistent.
  }
}

export function startWebRTCQualityLogging(peerConnection: RTCPeerConnection, label: string) {
  if (!import.meta.env.DEV) {
    return () => undefined
  }

  let previousReports = new Map<string, RTCStats>()
  const timer = window.setInterval(() => {
    void peerConnection.getStats().then((stats) => {
      const summary = summarizeStats(stats, previousReports)
      previousReports = new Map(Array.from(stats.entries()))
      if (summary.length > 0) {
        console.info(`[${label}] WebRTC quality`, summary.join(' | '))
      }
    })
  }, 2000)

  return () => window.clearInterval(timer)
}

function summarizeStats(stats: RTCStatsReport, previousReports: Map<string, RTCStats>) {
  const lines: string[] = []

  stats.forEach((report) => {
    if (report.type === 'outbound-rtp' && getStatString(report, 'kind') === 'video') {
      lines.push(
        `video send ${getStatValue(report, 'frameWidth')}x${getStatValue(report, 'frameHeight')} ${getStatValue(
          report,
          'framesPerSecond',
        )}fps ${formatBitrate(report, previousReports)}`,
      )
    }
    if (report.type === 'outbound-rtp' && getStatString(report, 'kind') === 'audio') {
      lines.push(
        `audio send ${formatBitrate(report, previousReports)} packets=${getStatValue(report, 'packetsSent')}`,
      )
    }
    if (report.type === 'inbound-rtp' && getStatString(report, 'kind') === 'audio') {
      lines.push(
        `audio recv ${formatBitrate(report, previousReports)} jitter=${getStatValue(report, 'jitter')} lost=${getStatValue(
          report,
          'packetsLost',
        )}`,
      )
    }
    if (
      report.type === 'candidate-pair' &&
      getStatString(report, 'state') === 'succeeded' &&
      getStatBoolean(report, 'nominated')
    ) {
      lines.push(
        `rtt=${getStatValue(report, 'currentRoundTripTime')}s availableOut=${getStatValue(
          report,
          'availableOutgoingBitrate',
        )}`,
      )
    }
  })

  return lines
}

function formatBitrate(report: RTCStats, previousReports: Map<string, RTCStats>) {
  const bytes = getStatNumber(report, 'bytesSent') ?? getStatNumber(report, 'bytesReceived')
  const previous = previousReports.get(report.id)
  if (!previous) {
    return 'bitrate=-'
  }

  const previousBytes = getStatNumber(previous, 'bytesSent') ?? getStatNumber(previous, 'bytesReceived')
  if (bytes == null || previousBytes == null || report.timestamp <= previous.timestamp) {
    return 'bitrate=-'
  }
  const bitsPerSecond = ((bytes - previousBytes) * 8 * 1000) / (report.timestamp - previous.timestamp)
  return `bitrate=${Math.max(0, Math.round(bitsPerSecond / 1000))}kbps`
}

function getStatValue(report: RTCStats, key: string) {
  return (report as unknown as Record<string, unknown>)[key] ?? '-'
}

function getStatNumber(report: RTCStats, key: string) {
  const value = (report as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

function getStatString(report: RTCStats, key: string) {
  const value = (report as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function getStatBoolean(report: RTCStats, key: string) {
  const value = (report as unknown as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : false
}
