import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { color } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.text,
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
          tabBarActiveTintColor: color.accent,
          tabBarInactiveTintColor: color.textMuted,
          sceneStyle: { backgroundColor: color.bg },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Timer' }} />
        <Tabs.Screen name="records" options={{ title: 'Records' }} />
        <Tabs.Screen name="athletes" options={{ title: 'Athletes' }} />
      </Tabs>
    </>
  );
}
