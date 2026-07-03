import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { clearSeed, hasSeedData } from '@/db';
import { courseName } from '@/features/timer/config';
import { setSettings, useSettings, useT } from '@/store/settings';
import { color, radius } from '@/theme';

const COURSES = ['25y', '25m', '50m'] as const;

/** 설정 모달: 언어 · 코스 · 햅틱 · 볼륨 키 LAP(Android) · 데모 데이터. */
export default function SettingsScreen() {
  const s = useSettings();
  const t = useT();
  const [seedLeft, setSeedLeft] = useState(false);

  useEffect(() => { void hasSeedData().then(setSeedLeft); }, []);

  function onClearDemo() {
    Alert.alert(t.clearDemo, t.clearDemoConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delYes, style: 'destructive', onPress: () => void clearSeed().then(() => setSeedLeft(false)) },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* 언어 */}
      <Text style={styles.label}>{t.lang}</Text>
      <View style={styles.segRow}>
        {(['en', 'ko'] as const).map((l) => (
          <Pressable
            key={l}
            style={[styles.segBtn, s.lang === l && styles.segOn]}
            onPress={() => setSettings({ lang: l })}>
            <Text style={[styles.segText, s.lang === l && styles.segTextOn]}>
              {l === 'en' ? 'English' : '한국어'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 코스 단위 (다니는 풀) */}
      <Text style={styles.label}>{t.courseUnit}</Text>
      <View style={styles.segRow}>
        {COURSES.map((c) => (
          <Pressable
            key={c}
            style={[styles.segBtn, s.course === c && styles.segOn]}
            onPress={() => setSettings({ course: c })}>
            <Text style={[styles.segText, s.course === c && styles.segTextOn]}>{courseName(c)}</Text>
          </Pressable>
        ))}
      </View>

      {/* 햅틱 */}
      <View style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t.haptics}</Text>
          <Text style={styles.rowSub}>{t.hapticsSub}</Text>
        </View>
        <Switch
          value={s.haptics}
          onValueChange={(v) => setSettings({ haptics: v })}
          trackColor={{ true: color.accent, false: color.line }}
          thumbColor="#fff"
        />
      </View>

      {/* 볼륨 키 LAP */}
      <View style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t.volumeLap}</Text>
          <Text style={styles.rowSub}>
            {Platform.OS === 'ios' ? t.volumeLapIos : t.volumeLapSub}
          </Text>
        </View>
        {Platform.OS !== 'ios' && (
          <Switch
            value={s.volumeLap}
            onValueChange={(v) => setSettings({ volumeLap: v })}
            trackColor={{ true: color.accent, false: color.line }}
            thumbColor="#fff"
          />
        )}
      </View>

      {/* 데모 데이터 지우기 (시드가 남아 있을 때만) */}
      {seedLeft && (
        <Pressable style={styles.clearBtn} onPress={onClearDemo}>
          <Text style={styles.clearText}>{t.clearDemo}</Text>
          <Text style={styles.clearSub}>{t.clearDemoSub}</Text>
        </Pressable>
      )}

      <Text style={styles.tip}>{t.settingsTip}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: 16, gap: 14 },
  label: { color: color.textMuted, fontSize: 13 },
  segRow: { flexDirection: 'row', gap: 6 },
  segBtn: {
    flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.line,
    backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center',
  },
  segOn: { backgroundColor: color.accent, borderColor: color.accent },
  segText: { color: color.text, fontSize: 15, fontWeight: '600' },
  segTextOn: { color: color.accentInk, fontWeight: '800' },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 14,
  },
  rowTitle: { color: color.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: color.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  clearBtn: {
    borderWidth: 1, borderColor: color.stop, borderRadius: radius.card,
    padding: 14, gap: 2, marginTop: 4,
  },
  clearText: { color: color.stop, fontSize: 15, fontWeight: '700' },
  clearSub: { color: color.textMuted, fontSize: 12 },
  tip: { color: color.textMuted, fontSize: 12 },
});
