import { StatusBar } from 'expo-status-bar';
import { PermissionCheckScreen } from 'components/PermissionCheckScreen';

import './global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <PermissionCheckScreen />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
