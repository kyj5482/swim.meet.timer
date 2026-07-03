import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color } from '@/theme';
import { GearIcon } from './Icons';

/**
 * 화면 상단 커스텀 바 (PWA .top-bar 이식): 왼쪽 큰 제목 + 오른쪽 기어(설정).
 * 탭 헤더 대신 각 화면이 직접 렌더 — 타이머는 이벤트명, 선수 탭은 "Athletes" 등.
 */
export default function TopBar({ title, showGear = true, right }: {
  title: string;
  showGear?: boolean;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right}
      {showGear && (
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={styles.gear}>
          <GearIcon color={color.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 8, backgroundColor: color.bg,
  },
  title: { flex: 1, color: color.text, fontSize: 22, fontWeight: '800' },
  gear: { padding: 4 },
});
