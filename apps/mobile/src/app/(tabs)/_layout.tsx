import { Tabs } from 'expo-router';

import { AthletesIcon, RecordsIcon, TimerIcon } from '@/components/Icons';
import { useT } from '@/store/settings';
import { color } from '@/theme';

export default function TabsLayout() {
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMuted,
        sceneStyle: { backgroundColor: color.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t.tabTimer, tabBarIcon: ({ color: c, size }) => <TimerIcon color={c} size={size} /> }}
      />
      <Tabs.Screen
        name="records"
        options={{ title: t.tabRec, tabBarIcon: ({ color: c, size }) => <RecordsIcon color={c} size={size} /> }}
      />
      <Tabs.Screen
        name="athletes"
        options={{ title: t.tabAth, tabBarIcon: ({ color: c, size }) => <AthletesIcon color={c} size={size} /> }}
      />
    </Tabs>
  );
}
