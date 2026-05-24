import { ExpoRoot } from 'expo-router';
import type { RequireContext } from 'expo-router';
import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppHeader } from 'components/AppHeader';
import { MessageProvider } from 'components/MessageProvider';

import './global.css';

declare const require: {
  context: (directory: string, useSubdirectories: boolean, regExp: RegExp) => RequireContext;
};

const routerContext = require.context('./app', true, /^(?:\.\/).*\.[tj]sx?$/);

function AppWrapper({ children }: { children?: ReactNode }) {
  return (
    <SafeAreaProvider>
      <MessageProvider>
        <AppHeader />
        {children}
        <StatusBar style="auto" />
      </MessageProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return <ExpoRoot context={routerContext} wrapper={AppWrapper} />;
}
