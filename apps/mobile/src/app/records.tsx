import { StyleSheet, Text, View } from 'react-native';

import { color } from '@/theme';

/** Records 탭 — T-104에서 기록지/추세/스플릿 비교로 구현된다. */
export default function RecordsScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Records</Text>
      <Text style={styles.hint}>T-104: 선수별 기록지·추세 예정</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: color.text, fontSize: 24, fontWeight: '700' },
  hint: { color: color.textMuted, fontSize: 14 },
});
