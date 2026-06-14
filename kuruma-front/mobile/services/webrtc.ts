import { Platform } from 'react-native';
import type {
  MediaStream as NativeMediaStream,
  RTCIceCandidate as NativeRTCIceCandidate,
  RTCPeerConnection as NativeRTCPeerConnection,
  RTCSessionDescription as NativeRTCSessionDescription,
} from 'react-native-webrtc';

type NativeWebRTC = typeof import('react-native-webrtc');

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
