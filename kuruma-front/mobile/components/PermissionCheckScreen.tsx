import { useCallback, useEffect, useState } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text, View } from 'react-native';

type PermissionKey = 'camera' | 'microphone' | 'location';

type PermissionState = Record<PermissionKey, boolean>;

const permissionLabels: Record<PermissionKey, string> = {
  camera: '摄像头权限',
  microphone: '麦克风权限',
  location: '定位权限',
};

const initialPermissionState: PermissionState = {
  camera: false,
  microphone: false,
  location: false,
};

export function PermissionCheckScreen() {
  const [permissions, setPermissions] = useState<PermissionState>(initialPermissionState);
  const [isRequesting, setIsRequesting] = useState(false);

  const permissionRows = Object.entries(permissionLabels).map(([key, label]) => ({
    key: key as PermissionKey,
    label,
    granted: permissions[key as PermissionKey],
  }));

  const checkPermissions = useCallback(async () => {
    const [camera, microphone, location] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      Camera.getMicrophonePermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
    ]);

    setPermissions({
      camera: camera.granted,
      microphone: microphone.granted,
      location: location.granted,
    });
  }, []);

  const requestPermissions = useCallback(async () => {
    setIsRequesting(true);

    try {
      const camera = await Camera.requestCameraPermissionsAsync();
      const microphone = await Camera.requestMicrophonePermissionsAsync();
      const location = await Location.requestForegroundPermissionsAsync();

      setPermissions({
        camera: camera.granted,
        microphone: microphone.granted,
        location: location.granted,
      });
    } finally {
      setIsRequesting(false);
    }
  }, []);

  useEffect(() => {
    void checkPermissions();
  }, [checkPermissions]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6 pt-10">
        <Text className="mb-8 text-[28px] font-bold text-gray-900">使用前检查</Text>

        <View className="mb-8 gap-[18px]">
          {permissionRows.map((permission) => (
            <View key={permission.key} className="flex-row items-center">
              <Text
                className={`mr-3 h-7 w-7 overflow-hidden rounded-md border text-center text-base leading-[26px] ${
                  permission.granted
                    ? 'border-green-600 bg-green-100 text-green-700'
                    : 'border-slate-300 bg-white text-white'
                }`}>
                {permission.granted ? '✓' : ' '}
              </Text>
              <Text className="text-lg text-gray-800">{permission.label}</Text>
              <Text className="ml-auto text-sm text-slate-500">
                {permission.granted ? '已授权' : '未授权'}
              </Text>
            </View>
          ))}
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

        <Pressable className="h-[52px] items-center justify-center rounded-lg border border-slate-300 bg-white">
          <Text className="text-[17px] font-semibold text-slate-700">稍后再说</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
