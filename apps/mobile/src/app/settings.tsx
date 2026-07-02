import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { setSettings, useSettings, useT } from '@/store/settings';
import { color, radius } from '@/theme';

/** 설정 모달: 언어 · 햅틱 · 볼륨 키 LAP(Android). 값은 prefs에 저장. */
export default function SettingsScreen() {
  const s = useSettings();
  const t = useT();

  return (
    <View style={styles.screen}>
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

      <Text style={styles.tip}>{t.settingsTip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 14 },
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
  tip: { color: color.textMuted, fontSize: 12 },
});
