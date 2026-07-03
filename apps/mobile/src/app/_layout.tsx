import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { seedIfFirstRun } from '@/db';
import { loadSettings, useT } from '@/store/settings';
import { color } from '@/theme';

export default function RootLayout() {
  const t = useT();

  useEffect(() => {
    void loadSettings();
    void seedIfFirstRun();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: t.settings }} />
      </Stack>
    </SafeAreaProvider>
  );
}
