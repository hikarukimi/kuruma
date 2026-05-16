import { useCallback, useEffect, useState } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PermissionKey = 'camera' | 'microphone' | 'location';
type PermissionState = Record<PermissionKey, boolean>;

const initialPermissions: PermissionState = {
  camera: false,
  microphone: false,
  location: false,
};

const permissionLabels: Record<PermissionKey, string> = {
  camera: '摄像头权限',
  microphone: '麦克风权限',
  location: '定位权限',
};

function hasAllPermissions(permissions: PermissionState) {
  return permissions.camera && permissions.microphone && permissions.location;
}

export default function PremissionRoute() {
  const [permissions, setPermissions] = useState<PermissionState>(initialPermissions);
  const [isRequesting, setIsRequesting] = useState(false);

  const applyPermissions = useCallback((nextPermissions: PermissionState) => {
    setPermissions(nextPermissions);
    if (hasAllPermissions(nextPermissions)) {
      router.replace('/login');
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    const [camera, microphone, location] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      Camera.getMicrophonePermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
    ]);

    applyPermissions({
      camera: camera.granted,
      microphone: microphone.granted,
      location: location.granted,
    });
  }, [applyPermissions]);

  const requestPermissions = useCallback(async () => {
    setIsRequesting(true);
    try {
      const camera = await Camera.requestCameraPermissionsAsync();
      const microphone = await Camera.requestMicrophonePermissionsAsync();
      const location = await Location.requestForegroundPermissionsAsync();

      applyPermissions({
        camera: camera.granted,
        microphone: microphone.granted,
        location: location.granted,
      });
    } finally {
      setIsRequesting(false);
    }
  }, [applyPermissions]);

  useEffect(() => {
    void checkPermissions();
  }, [checkPermissions]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6 pt-10">
        <Text className="mb-8 text-[28px] font-bold text-gray-900">使用前检查</Text>

        <View className="mb-8 gap-[18px]">
          {Object.entries(permissionLabels).map(([key, label]) => {
            const granted = permissions[key as PermissionKey];
            return (
              <View key={key} className="flex-row items-center">
                <Text
                  className={`mr-3 h-7 w-7 overflow-hidden rounded-md border text-center text-base leading-[26px] ${
                    granted
                      ? 'border-green-600 bg-green-100 text-green-700'
                      : 'border-slate-300 bg-white text-white'
                  }`}>
                  {granted ? '✓' : ' '}
                </Text>
                <Text className="text-lg text-gray-800">{label}</Text>
                <Text className="ml-auto text-sm text-slate-500">
                  {granted ? '已授权' : '未授权'}
                </Text>
              </View>
            );
          })}
        </View>

        <Text className="mb-9 text-base leading-6 text-slate-600">
          事故处理需要采集现场画面、声音和定位信息。
        </Text>

        <Pressable
          className={`mb-3.5 h-[52px] items-center justify-center rounded-lg ${
            isRequesting ? 'bg-blue-400' : 'bg-blue-600'
          }`}
          disabled={isRequesting}
          onPress={requestPermissions}>
          <Text className="text-[17px] font-bold text-white">
            {isRequesting ? '请求授权中...' : '授权并继续'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
