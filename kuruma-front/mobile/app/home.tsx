import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
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
import { connectDriverRealtime, sendDriverHeartbeat } from 'services/realtime';
import { createSession, type AccidentSession } from 'services/sessions';

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
  const [submitError, setSubmitError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');

  const isChecking = readiness.location === 'checking' || readiness.media === 'checking';
  const canStartConnection =
    !isChecking &&
    readiness.location === 'ready' &&
    readiness.media === 'ready' &&
    session?.callStatus !== 'ended' &&
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
        label: `通话${session?.callStatus === 'ended' ? '已结束' : '进行中'}`,
        ready: Boolean(session) && session?.callStatus !== 'ended',
      },
    ],
    [session]
  );

  const checkReadiness = useCallback(async () => {
    setSubmitError('');
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
        setSubmitError(message);
        Alert.alert('无法发起连接', message);
        return;
      }

      setSubmitError('');
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
        setSubmitError(message);
        Alert.alert('无法发起连接', message);
      } finally {
        setSubmittingMode(null);
      }
    },
    [canStartConnection, description, isChecking, readiness, session]
  );

  useEffect(() => {
    void checkReadiness();
  }, [checkReadiness]);

  useEffect(() => {
    if (!session?.id) {
      return undefined;
    }

    let socket: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let isActive = true;

    connectDriverRealtime({
      sessionId: session.id,
      onSessionUpdated: (nextSession) => {
        setSession(nextSession);
        setRealtimeError('');
      },
      onError: (message) => {
        setRealtimeError(message);
      },
    })
      .then((nextSocket) => {
        if (!isActive) {
          nextSocket.close();
          return;
        }

        socket = nextSocket;
        heartbeatTimer = setInterval(() => {
          if (socket) {
            sendDriverHeartbeat(socket);
          }
        }, 10000);
      })
      .catch((error: unknown) => {
        setRealtimeError(error instanceof Error ? error.message : '实时连接失败');
      });

    return () => {
      isActive = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      socket?.close();
    };
  }, [session?.id]);

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
            <Text className="text-[28px] font-bold text-gray-900">事故连接</Text>
            <Text className="mt-3 text-base leading-6 text-slate-600">
              确认现场状态后加入事故会话，等待警察端处理。
            </Text>
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

          {submitError ? (
            <Text className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </Text>
          ) : null}

          {realtimeError ? (
            <Text className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {realtimeError}
            </Text>
          ) : null}

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
