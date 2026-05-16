import { useCallback, useEffect, useState } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from 'components/LoginScreen';
import { PermissionCheckScreen, type PermissionState } from 'components/PermissionCheckScreen';
import { ActivityIndicator, Text, View } from 'react-native';

import './global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppHeader } from 'components/AppHeader';

type AppStep = 'checking-permissions' | 'permission-required' | 'login';

const initialPermissionState: PermissionState = {
  camera: false,
  microphone: false,
  location: false,
};

function hasAllPermissions(permissions: PermissionState) {
  return permissions.camera && permissions.microphone && permissions.location;
}

export default function App() {
  const [appStep, setAppStep] = useState<AppStep>('checking-permissions');
  const [permissions, setPermissions] = useState<PermissionState>(initialPermissionState);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  const applyPermissions = useCallback((nextPermissions: PermissionState) => {
    setPermissions(nextPermissions);
    setAppStep(hasAllPermissions(nextPermissions) ? 'login' : 'permission-required');
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
    setIsRequestingPermissions(true);

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
      setIsRequestingPermissions(false);
    }
  }, [applyPermissions]);

  useEffect(() => {
    void checkPermissions();
  }, [checkPermissions]);

  return (
    <SafeAreaProvider>
      <AppHeader></AppHeader>
      {appStep === 'checking-permissions' ? (
        <View className="flex-1 items-center justify-center bg-slate-50 px-6">
          <ActivityIndicator color="#2563eb" size="large" />
          <Text className="mt-4 text-base font-medium text-slate-600">正在检查权限...</Text>
        </View>
      ) : appStep === 'login' ? (
        <LoginScreen />
      ) : (
        <PermissionCheckScreen
          isRequesting={isRequestingPermissions}
          onRequestPermissions={requestPermissions}
          permissions={permissions}
        />
      )}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
