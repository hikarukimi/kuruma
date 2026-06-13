import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCVideoView } from 'components/RTCVideoView';
import { useMessage } from 'components/MessageProvider';
import { clearAuthToken } from 'services';
import {
  connectDriverRealtime,
  type RealtimeSignalMessage,
  sendDriverHeartbeat,
  sendRealtimeSignal,
} from 'services/realtime';
import { createSession, type AccidentSession } from 'services/sessions';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  type WebRTCIceCandidate,
  type WebRTCMediaStream,
  type WebRTCPeerConnection,
} from 'services/webrtc';

type ConnectionMode = 'video' | 'audio';

type ReadinessState = {
  location: 'checking' | 'ready' | 'failed';
  network: 'ready';
  media: 'checking' | 'ready' | 'failed';
};

const initialReadiness: ReadinessState = {
  location: 'checking',
  network: 'ready',
  media: 'checking',
};

const rtcConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function getStatusStyle(isReady: boolean) {
  return isReady
    ? 'border-green-600 bg-green-100 text-green-700'
    : 'border-amber-500 bg-amber-100 text-amber-700';
}

export default function HomeRoute() {
  const [readiness, setReadiness] = useState<ReadinessState>(initialReadiness);
  const [session, setSession] = useState<AccidentSession | null>(null);
  const [description, setDescription] = useState('');
  const [submittingMode, setSubmittingMode] = useState<ConnectionMode | null>(null);
  const [callStatus, setCallStatus] = useState('未连接');
  const [localStream, setLocalStream] = useState<WebRTCMediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<WebRTCMediaStream | null>(null);
  const peerConnectionRef = useRef<WebRTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const { showMessage } = useMessage();

  const isChecking = readiness.location === 'checking' || readiness.media === 'checking';
  const isCommunicating = Boolean(session) && session?.callStatus !== 'ended';
  const canStartConnection =
    !isChecking &&
    readiness.location === 'ready' &&
    readiness.media === 'ready' &&
    session?.callStatus !== 'ended' &&
    !isCommunicating &&
    !submittingMode;
  const isCreatingSession = Boolean(submittingMode) && !session;

  const statusItems = useMemo(
    () => [
      {
        key: 'location',
        label:
          readiness.location === 'checking'
            ? '定位获取中'
            : readiness.location === 'ready'
              ? '定位已获取'
              : '定位未获取',
        ready: readiness.location === 'ready',
      },
      {
        key: 'network',
        label: '网络正常',
        ready: readiness.network === 'ready',
      },
      {
        key: 'media',
        label:
          readiness.media === 'checking'
            ? '摄像头/麦克风检查中'
            : readiness.media === 'ready'
              ? '摄像头/麦克风可用'
              : '摄像头/麦克风不可用',
        ready: readiness.media === 'ready',
      },
    ],
    [readiness]
  );

  const sessionStatusItems = useMemo(
    () => [
      {
        key: 'session',
        label: session ? `会话 ${session.id}` : '会话未创建',
        ready: Boolean(session),
      },
      {
        key: 'signaling',
        label: `信令${displaySignalingStatus(session?.signalingStatus)}`,
        ready: session?.signalingStatus === 'connected',
      },
      {
        key: 'recording',
        label: `录像${session?.recordingStatus === 'recording' ? '中' : '未开始'}`,
        ready: session?.recordingStatus === 'recording',
      },
      {
        key: 'call',
        label: `媒体${session?.callStatus === 'ended' ? '已关闭' : callStatus}`,
        ready: session?.callStatus !== 'ended' && callStatus === '已连接',
      },
    ],
    [callStatus, session]
  );

  const checkReadiness = useCallback(async () => {
    setReadiness(initialReadiness);

    const [camera, microphone, locationPermission] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      Camera.getMicrophonePermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
    ]);

    const mediaReady = camera.granted && microphone.granted;
    setReadiness((current) => ({
      ...current,
      media: mediaReady ? 'ready' : 'failed',
    }));

    if (!locationPermission.granted) {
      setReadiness((current) => ({
        ...current,
        location: 'failed',
      }));
      return;
    }

    try {
      await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setReadiness((current) => ({
        ...current,
        location: 'ready',
      }));
    } catch {
      setReadiness((current) => ({
        ...current,
        location: 'failed',
      }));
    }
  }, []);

  const submitConnection = useCallback(
    async (mode: ConnectionMode) => {
      if (!canStartConnection) {
        const message = isChecking
          ? '正在检查现场状态，请稍后再试'
          : '请先确认定位和音视频权限可用，且当前通话未结束';
        showMessage({ text: message, type: 'error' });
        return;
      }

      setSubmittingMode(mode);

      try {
        const activeSession =
          session ??
          (await createSession({
            description,
            locationStatus: readiness.location === 'ready' ? 'ready' : 'unavailable',
            networkStatus: readiness.network,
            recordingStatus: 'idle',
            signalingStatus: 'idle',
            callStatus: 'active',
          }));
        setSession(activeSession);

        Alert.alert(
          mode === 'video' ? '已进入视频连接等待' : '已进入语音连接等待',
          `当前会话：${activeSession.id}`
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '创建会话失败';
        showMessage({ text: message, type: 'error' });
      } finally {
        setSubmittingMode(null);
      }
    },
    [canStartConnection, description, isChecking, readiness, session, showMessage]
  );

  const logout = useCallback(() => {
    const performLogout = async () => {
      try {
        await clearAuthToken();
        router.replace('/login');
      } catch (error: unknown) {
        showMessage({
          text: error instanceof Error ? error.message : '退出登录失败',
          type: 'error',
        });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('确定要退出当前账号吗？')) {
        void performLogout();
      }
      return;
    }

    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      {
        text: '取消',
        style: 'cancel',
      },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => void performLogout(),
      },
    ]);
  }, [showMessage]);

  useEffect(() => {
    void checkReadiness();
  }, [checkReadiness]);

  useEffect(() => {
    if (!session?.id) {
      return undefined;
    }

    if (session.callStatus === 'ended') {
      return undefined;
    }

    let socket: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let isActive = true;
    let hasResetConnection = false;
    let localMediaStream: WebRTCMediaStream | null = null;
    const pendingRemoteCandidates: {
      candidate: string;
      sdpMLineIndex?: number | null;
      sdpMid?: string | null;
    }[] = [];

    const resetConnection = (nextCallStatus: string) => {
      if (hasResetConnection) {
        return;
      }

      hasResetConnection = true;
      setCallStatus(nextCallStatus);
      setSession(null);
      setLocalStream(null);
      setRemoteStream(null);
    };

    const addRemoteCandidate = async (candidate: {
      candidate: string;
      sdpMLineIndex?: number | null;
      sdpMid?: string | null;
    }) => {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        return;
      }

      if (!peerConnection.remoteDescription) {
        pendingRemoteCandidates.push(candidate);
        return;
      }

      await (
        peerConnection as { addIceCandidate: (nextCandidate: unknown) => Promise<void> }
      ).addIceCandidate(
        new (RTCIceCandidate as new (nextCandidate: typeof candidate) => unknown)(candidate)
      );
    };

    const flushRemoteCandidates = async () => {
      while (pendingRemoteCandidates.length > 0) {
        const candidate = pendingRemoteCandidates.shift();
        if (candidate) {
          await addRemoteCandidate(candidate);
        }
      }
    };

    const handleSignal = async (message: RealtimeSignalMessage) => {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection || message.role === 'driver') {
        return;
      }

      try {
        if (message.type === 'webrtc.offer' && message.payload) {
          await (
            peerConnection as { setRemoteDescription: (description: unknown) => Promise<void> }
          ).setRemoteDescription(
            new (RTCSessionDescription as new (description: {
              sdp: string;
              type: 'offer';
            }) => unknown)(message.payload as { sdp: string; type: 'offer' })
          );
          await flushRemoteCandidates();
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          sendRealtimeSignal(socketRef.current, 'webrtc.answer', answer);
          return;
        }

        if (message.type === 'webrtc.leave') {
          resetConnection('已断开');
          return;
        }

        if (message.type === 'webrtc.candidate' && message.payload) {
          await addRemoteCandidate(
            message.payload as {
              candidate: string;
              sdpMLineIndex?: number | null;
              sdpMid?: string | null;
            }
          );
        }
      } catch (error: unknown) {
        showMessage({
          text: error instanceof Error ? error.message : '视频信令处理失败',
          type: 'error',
        });
      }
    };

    const setupPeerConnection = async () => {
      setCallStatus('正在接入');

      if (!mediaDevices || !RTCPeerConnection) {
        throw new Error('当前环境不支持 WebRTC');
      }

      const mediaStream = (await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'environment',
          frameRate: 24,
          width: 1280,
          height: 720,
        },
      })) as WebRTCMediaStream;

      if (!isActive) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      localMediaStream = mediaStream;
      setLocalStream(mediaStream);

      const peerConnection = new RTCPeerConnection(rtcConfiguration);
      const peerConnectionEvents = peerConnection as unknown as {
        addEventListener: (
          type: 'track' | 'icecandidate' | 'connectionstatechange',
          listener: (event: {
            candidate?: WebRTCIceCandidate | null;
            streams?: WebRTCMediaStream[];
          }) => void
        ) => void;
      };
      peerConnectionRef.current = peerConnection;
      mediaStream.getTracks().forEach((track) => {
        (peerConnection as { addTrack: (track: unknown, stream: unknown) => void }).addTrack(
          track,
          mediaStream
        );
      });

      peerConnectionEvents.addEventListener('track', (event) => {
        const [nextRemoteStream] = event.streams ?? [];
        if (nextRemoteStream) {
          setRemoteStream(nextRemoteStream);
        }
      });

      peerConnectionEvents.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          sendRealtimeSignal(socketRef.current, 'webrtc.candidate', event.candidate.toJSON());
        }
      });

      peerConnectionEvents.addEventListener('connectionstatechange', () => {
        const nextCallStatus = displayPeerConnectionState(peerConnection.connectionState);
        setCallStatus(nextCallStatus);

        if (
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed'
        ) {
          resetConnection(nextCallStatus);
        }
      });
    };

    setupPeerConnection()
      .then(() =>
        connectDriverRealtime({
          sessionId: session.id,
          onSessionUpdated: (nextSession) => {
            if (nextSession.callStatus === 'ended') {
              resetConnection('已断开');
              return;
            }

            setSession(nextSession);
          },
          onError: (message) => {
            showMessage({ text: message, type: 'warning' });
            resetConnection('连接失败');
          },
          onSignal: (message) => void handleSignal(message),
          onOpen: (openedSocket) => {
            sendRealtimeSignal(openedSocket, 'webrtc.ready', { media: 'ready' });
          },
        })
      )
      .then((nextSocket) => {
        if (!isActive) {
          nextSocket.close();
          return;
        }

        socket = nextSocket;
        socketRef.current = nextSocket;
        heartbeatTimer = setInterval(() => {
          if (socket) {
            sendDriverHeartbeat(socket);
          }
        }, 10000);
      })
      .catch((error: unknown) => {
        showMessage({
          text: error instanceof Error ? error.message : '实时连接失败',
          type: 'error',
        });
        setCallStatus('连接失败');
      });

    return () => {
      isActive = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      sendRealtimeSignal(socket, 'webrtc.leave');
      socket?.close();
      socketRef.current = null;
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      localMediaStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
      setRemoteStream(null);
    };
  }, [session?.callStatus, session?.id, showMessage]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-10 pt-4"
          keyboardShouldPersistTaps="handled">
          <View className="mb-8">
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text className="text-[28px] font-bold text-gray-900">事故连接</Text>
                <Text className="mt-3 text-base leading-6 text-slate-600">
                  确认现场状态后加入事故会话，等待警察端处理。
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                className="h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4"
                onPress={logout}>
                <Text className="text-sm font-semibold text-slate-700">退出登录</Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-7">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-gray-900">当前状态</Text>
              <Pressable onPress={checkReadiness}>
                <Text className="text-sm font-semibold text-blue-600">重新检查</Text>
              </Pressable>
            </View>

            <View className="gap-3 rounded-lg border border-slate-200 bg-white p-4">
              {statusItems.map((item) => (
                <View key={item.key} className="flex-row items-center">
                  <Text
                    className={`mr-3 h-6 w-6 overflow-hidden rounded-md border text-center text-sm leading-[22px] ${getStatusStyle(
                      item.ready
                    )}`}>
                    {item.ready ? '✓' : '!'}
                  </Text>
                  <Text className="text-base font-medium text-gray-800">{item.label}</Text>
                  {item.key !== 'network' && !item.ready ? (
                    <ActivityIndicator className="ml-auto" color="#d97706" size="small" />
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <View className="mb-7">
            <Text className="mb-3 text-base font-bold text-gray-900">会话状态</Text>
            <View className="gap-3 rounded-lg border border-slate-200 bg-white p-4">
              {sessionStatusItems.map((item) => (
                <View key={item.key} className="flex-row items-center">
                  <Text
                    className={`mr-3 h-6 w-6 overflow-hidden rounded-md border text-center text-sm leading-[22px] ${getStatusStyle(
                      item.ready
                    )}`}>
                    {item.ready ? '✓' : '!'}
                  </Text>
                  <Text className="flex-1 text-base font-medium text-gray-800">{item.label}</Text>
                  {item.key === 'session' && isCreatingSession ? (
                    <ActivityIndicator className="ml-auto" color="#2563eb" size="small" />
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          {session ? (
            <View className="mb-7">
              <Text className="mb-3 text-base font-bold text-gray-900">现场视频</Text>
              <View className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                {localStream ? (
                  <RTCVideoView
                    mirror={false}
                    objectFit="cover"
                    stream={localStream}
                    style={{ height: 260, width: '100%' }}
                  />
                ) : (
                  <View className="h-[260px] items-center justify-center">
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text className="mt-3 text-sm font-semibold text-white">正在打开摄像头</Text>
                  </View>
                )}
                <View className="absolute bottom-3 left-3 rounded-md bg-black/60 px-3 py-2">
                  <Text className="text-sm font-semibold text-white">
                    发送给警察端：{callStatus}
                  </Text>
                </View>
                {remoteStream ? (
                  <View className="absolute right-3 bottom-3 h-28 w-20 overflow-hidden rounded-md border border-white/30 bg-black">
                    <RTCVideoView
                      objectFit="cover"
                      stream={remoteStream}
                      style={{ height: '100%', width: '100%' }}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View className="mb-7">
            <Text className="mb-3 text-base font-bold text-gray-900">事故描述</Text>
            <TextInput
              className="min-h-[112px] rounded-lg border border-slate-300 bg-white px-4 py-3 text-base leading-6 text-gray-900"
              maxLength={300}
              multiline
              onChangeText={setDescription}
              placeholder="可选，简单描述现场情况"
              placeholderTextColor="#94a3b8"
              textAlignVertical="top"
              value={description}
            />
            <Text className="mt-2 text-right text-xs text-slate-500">{description.length}/300</Text>
          </View>

          <Pressable
            className={`h-[52px] flex-row items-center justify-center rounded-lg ${
              canStartConnection ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            disabled={!canStartConnection}
            onPress={() => void submitConnection('video')}>
            {submittingMode === 'video' ? <ActivityIndicator color="#ffffff" size="small" /> : null}
            <Text
              className={`text-[17px] font-bold ${
                submittingMode === 'video' ? 'ml-2' : ''
              } ${canStartConnection ? 'text-white' : 'text-slate-500'}`}>
              {submittingMode === 'video' ? '提交中...' : '发起视频连接'}
            </Text>
          </Pressable>

          <Pressable
            className={`mt-3 h-[52px] flex-row items-center justify-center rounded-lg border ${
              canStartConnection ? 'border-blue-600 bg-white' : 'border-slate-300 bg-white'
            }`}
            disabled={!canStartConnection}
            onPress={() => void submitConnection('audio')}>
            {submittingMode === 'audio' ? <ActivityIndicator color="#2563eb" size="small" /> : null}
            <Text
              className={`text-[17px] font-bold ${
                submittingMode === 'audio' ? 'ml-2' : ''
              } ${canStartConnection ? 'text-blue-600' : 'text-slate-400'}`}>
              {submittingMode === 'audio' ? '提交中...' : '仅发起语音连接'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function displaySignalingStatus(status?: string) {
  if (status === 'connected') {
    return '已连接';
  }
  if (status === 'disconnected') {
    return '已断开';
  }
  return '未连接';
}

function displayPeerConnectionState(state?: string) {
  if (state === 'connected') {
    return '已连接';
  }

  if (state === 'connecting') {
    return '连接中';
  }

  if (state === 'failed') {
    return '连接失败';
  }

  if (state === 'disconnected') {
    return '已断开';
  }

  if (state === 'closed') {
    return '已关闭';
  }

  return '未连接';
}
