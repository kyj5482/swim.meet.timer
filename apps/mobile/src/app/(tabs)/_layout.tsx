import { Tabs } from 'expo-router';

import { ListIcon, RecordsIcon, TimerIcon } from '@/components/Icons';
import { useT } from '@/store/settings';
import { color } from '@/theme';

/** 탭 3개: 타이머 · 전체 종목(오버뷰) · 세부 종목(종목 상세). 선수 관리는 스택 라우트. */
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
        name="events"
        options={{ title: t.tabAll, tabBarIcon: ({ color: c, size }) => <ListIcon color={c} size={size} /> }}
      />
      <Tabs.Screen
        name="records"
        options={{ title: t.tabRec, tabBarIcon: ({ color: c, size }) => <RecordsIcon color={c} size={size} /> }}
      />
    </Tabs>
  );
}
