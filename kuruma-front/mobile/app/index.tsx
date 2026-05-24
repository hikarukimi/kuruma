import { useCallback, useEffect } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { loadAuthToken } from 'services';

type PermissionState = {
  camera: boolean;
  microphone: boolean;
  location: boolean;
};

function hasAllPermissions(permissions: PermissionState) {
  return permissions.camera && permissions.microphone && permissions.location;
}

export default function IndexRoute() {
  const checkStartupState = useCallback(async () => {
    const [camera, microphone, location] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      Camera.getMicrophonePermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
    ]);
    const shouldGoToPermission = !hasAllPermissions({
      camera: camera.granted,
      microphone: microphone.granted,
      location: location.granted,
    });
    if (shouldGoToPermission) {
      router.replace('/premission');
      return;
    }

    const token = await loadAuthToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    router.replace('/home');
  }, []);

  useEffect(() => {
    checkStartupState();
  }, [checkStartupState]);

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <ActivityIndicator color="#2563eb" size="large" />
      <Text className="mt-4 text-base font-medium text-slate-600">正在检查权限...</Text>
    </View>
  );
}
