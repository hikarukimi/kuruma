import { useEffect, useRef } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import type { RTCView, MediaStream as NativeMediaStream } from 'react-native-webrtc';
import type { WebRTCMediaStream } from 'services/webrtc';

type NativeWebRTC = typeof import('react-native-webrtc');

type RTCVideoViewProps = {
  mirror?: boolean;
  objectFit?: 'contain' | 'cover';
  stream: WebRTCMediaStream;
  style: StyleProp<ViewStyle> & {
    height?: number | string;
    width?: number | string;
  };
};

export function RTCVideoView({
  mirror = false,
  objectFit = 'cover',
  stream,
  style,
}: RTCVideoViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.srcObject = stream as globalThis.MediaStream;
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [stream]);

  if (Platform.OS !== 'web') {
    const NativeRTCView = (require('react-native-webrtc') as NativeWebRTC)
      .RTCView as typeof RTCView;

    return (
      <NativeRTCView
        mirror={mirror}
        objectFit={objectFit}
        streamURL={(stream as NativeMediaStream).toURL()}
        style={style as StyleProp<ViewStyle>}
      />
    );
  }

  return (
    <video
      autoPlay
      muted
      playsInline
      ref={videoRef}
      style={{
        height: style.height,
        objectFit,
        transform: mirror ? 'scaleX(-1)' : undefined,
        width: style.width,
      }}
    />
  );
}
