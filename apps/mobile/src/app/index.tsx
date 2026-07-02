import { fmtClock } from '@splitlane/timer-core';
import { StyleSheet, Text, View } from 'react-native';

import { color, radius, touch } from '@/theme';

/** Timer 탭 — T-102에서 설정→측정→배정 3단계 화면으로 대체된다. */
export default function TimerScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.clock}>{fmtClock(0)}</Text>
      <Text style={styles.hint}>T-102: 타이머 화면 구현 예정</Text>
      <View style={styles.lapButton}>
        <Text style={styles.lapLabel}>LAP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  clock: { color: color.text, fontSize: 64, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { color: color.textMuted, fontSize: 14 },
  lapButton: {
    alignSelf: 'stretch', height: touch.lapButton, borderRadius: radius.btn,
    backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center',
  },
  lapLabel: { color: '#04221d', fontSize: 24, fontWeight: '800' },
});
