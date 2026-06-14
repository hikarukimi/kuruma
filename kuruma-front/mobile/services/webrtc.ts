import { Platform } from 'react-native';
import type {
  MediaStream as NativeMediaStream,
  RTCIceCandidate as NativeRTCIceCandidate,
  RTCPeerConnection as NativeRTCPeerConnection,
  RTCSessionDescription as NativeRTCSessionDescription,
} from 'react-native-webrtc';

type NativeWebRTC = typeof import('react-native-webrtc');

declare const __DEV__: boolean;

function getNativeWebRTC() {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-webrtc') as NativeWebRTC;
  } catch {
    return null;
  }
}

const nativeWebRTC = getNativeWebRTC();

export type WebRTCMediaStream = NativeMediaStream | globalThis.MediaStream;
export type WebRTCPeerConnection = NativeRTCPeerConnection | globalThis.RTCPeerConnection;
export type WebRTCIceCandidate = NativeRTCIceCandidate | globalThis.RTCIceCandidate;
export type WebRTCConnectionMode = 'video' | 'audio';

type MediaDeviceSource = {
  getUserMedia: (constraints: unknown) => Promise<unknown>;
};

type SenderLike = {
  getParameters?: () => {
    encodings?: Record<string, unknown>[];
    degradationPreference?: string;
  };
  setParameters?: (parameters: {
    encodings?: Record<string, unknown>[];
    degradationPreference?: string;
  }) => Promise<void>;
  track?: {
    kind?: string;
  } | null;
};

type PeerConnectionLike = {
  getStats?: () => Promise<unknown>;
};

const audioConstraints = {
  autoGainControl: true,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  sampleRate: 48000,
  sampleSize: 16,
};

const videoConstraintFallbacks = [
  {
    facingMode: 'environment',
    frameRate: { ideal: 30, max: 30 },
    height: { ideal: 720, max: 720 },
    width: { ideal: 1280, max: 1280 },
  },
  {
    facingMode: 'environment',
    frameRate: { ideal: 30, max: 30 },
    height: { ideal: 540, max: 540 },
    width: { ideal: 960, max: 960 },
  },
  {
    facingMode: 'environment',
    frameRate: { ideal: 24, max: 24 },
    height: { ideal: 480, max: 480 },
    width: { ideal: 640, max: 640 },
  },
];

export const mediaDevices =
  Platform.OS === 'web' ? navigator.mediaDevices : nativeWebRTC?.mediaDevices;

export const RTCIceCandidate =
  Platform.OS === 'web' ? globalThis.RTCIceCandidate : nativeWebRTC?.RTCIceCandidate;

export const RTCPeerConnection =
  Platform.OS === 'web' ? globalThis.RTCPeerConnection : nativeWebRTC?.RTCPeerConnection;

export const RTCSessionDescription =
  Platform.OS === 'web'
    ? globalThis.RTCSessionDescription
    : (nativeWebRTC?.RTCSessionDescription as typeof NativeRTCSessionDescription);

export async function getCallMediaStream(mode: WebRTCConnectionMode) {
  if (!mediaDevices) {
    throw new Error('当前环境不支持 WebRTC');
  }

  const devices = mediaDevices as unknown as MediaDeviceSource;
  if (mode === 'audio') {
    return (await devices.getUserMedia({
      audio: audioConstraints,
      video: false,
    })) as WebRTCMediaStream;
  }

  let lastError: unknown;
  for (const video of videoConstraintFallbacks) {
    try {
      return (await devices.getUserMedia({
        audio: audioConstraints,
        video,
      })) as WebRTCMediaStream;
    } catch (error: unknown) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('无法访问摄像头或麦克风');
}

export async function applyCallSenderQuality(sender: unknown) {
  const nextSender = sender as SenderLike;
  if (!nextSender.setParameters || !nextSender.getParameters) {
    return;
  }

  const parameters = nextSender.getParameters();
  const encodings = parameters.encodings?.length ? parameters.encodings : [{}];
  const kind = nextSender.track?.kind;

  parameters.encodings = encodings.map((encoding) => {
    if (kind === 'video') {
      return {
        ...encoding,
        maxBitrate: 2_500_000,
        maxFramerate: 30,
      };
    }
    if (kind === 'audio') {
      return {
        ...encoding,
        dtx: false,
        maxBitrate: 96_000,
        priority: 'high',
      };
    }
    return encoding;
  });

  if (kind === 'video') {
    parameters.degradationPreference = 'maintain-resolution';
  }

  try {
    await nextSender.setParameters(parameters);
  } catch {
    // Some WebRTC implementations expose setParameters but reject bitrate hints.
  }
}

export function startWebRTCQualityLogging(peerConnection: WebRTCPeerConnection, label: string) {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return () => undefined;
  }

  const connection = peerConnection as unknown as PeerConnectionLike;
  if (!connection.getStats) {
    return () => undefined;
  }

  const timer = setInterval(() => {
    void connection.getStats?.().then((stats) => {
      const summary = summarizeStats(stats);
      if (summary.length > 0) {
        console.info(`[${label}] WebRTC quality`, summary.join(' | '));
      }
    });
  }, 2000);

  return () => clearInterval(timer);
}

function summarizeStats(stats: unknown) {
  const reports = Array.from((stats as Map<string, unknown>).values?.() ?? []);
  const lines: string[] = [];

  for (const report of reports) {
    const entry = report as Record<string, unknown>;
    if (entry.type === 'outbound-rtp' && entry.kind === 'video') {
      lines.push(
        `video send ${entry.frameWidth ?? '-'}x${entry.frameHeight ?? '-'} ${entry.framesPerSecond ?? '-'}fps`
      );
    }
    if (entry.type === 'outbound-rtp' && entry.kind === 'audio') {
      lines.push(`audio send packets=${entry.packetsSent ?? '-'}`);
    }
    if (entry.type === 'inbound-rtp' && entry.kind === 'audio') {
      lines.push(`audio recv jitter=${entry.jitter ?? '-'} lost=${entry.packetsLost ?? '-'}`);
    }
    if (
      entry.type === 'candidate-pair' &&
      entry.state === 'succeeded' &&
      entry.nominated === true
    ) {
      lines.push(
        `rtt=${entry.currentRoundTripTime ?? '-'}s bitrate=${entry.availableOutgoingBitrate ?? '-'}`
      );
    }
  }

  return lines;
}
