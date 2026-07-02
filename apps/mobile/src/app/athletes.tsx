import { StyleSheet, Text, View } from 'react-native';

import { color } from '@/theme';

/** Athletes 탭 — T-103에서 선수 명단 CRUD로 구현된다. */
export default function AthletesScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Athletes</Text>
      <Text style={styles.hint}>T-103: 선수 명단 예정</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: color.text, fontSize: 24, fontWeight: '700' },
  hint: { color: color.textMuted, fontSize: 14 },
});
