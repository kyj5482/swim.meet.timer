import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useT } from '@/store/settings';
import { color } from '@/theme';

export default function TabsLayout() {
  const t = useT();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.bg },
        headerTintColor: color.text,
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={{ paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </Pressable>
        ),
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMuted,
        sceneStyle: { backgroundColor: color.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: t.tabTimer }} />
      <Tabs.Screen name="records" options={{ title: t.tabRec }} />
      <Tabs.Screen name="athletes" options={{ title: t.tabAth }} />
    </Tabs>
  );
}
