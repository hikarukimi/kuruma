import { useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { loadValidAuthToken } from 'services';
import { checkAppPermissions, type AppPermissions } from 'services/permissions';

function hasAllPermissions(permissions: AppPermissions) {
  return permissions.camera && permissions.microphone && permissions.location;
}

export default function IndexRoute() {
  const checkStartupState = useCallback(async () => {
    const shouldGoToPermission = !hasAllPermissions(await checkAppPermissions());
    if (shouldGoToPermission) {
      router.replace('/premission');
      return;
    }

    const token = await loadValidAuthToken();
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
