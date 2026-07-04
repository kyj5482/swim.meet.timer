import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { ChevronDown } from '@/components/Icons';
import { ageOf, type Swimmer } from '@/db';
import { officialTimesUrl } from '@/features/records/officialTimes';
import { useT } from '@/store/settings';
import { color } from '@/theme';

/**
 * 선수 헤더 — 전체 종목·세부 종목 탭 공용. 이름 아래는 **한 줄**만:
 * "12 yo · Elite · Official times ↗" — USA ID가 있으면 공인 기록 링크가
 * 팀(그룹) 이름 옆에 인라인으로 붙는다. 우측은 Switch(선수 전환).
 */
export default function SwimmerHeader({ swimmer, index, onSwitch }: {
  swimmer: Swimmer | undefined;
  index: number;
  onSwitch: () => void;
}) {
  const t = useT();

  const meta = (() => {
    if (!swimmer) return '';
    const age = ageOf(swimmer);
    return [age != null ? t.yo(age) : null, swimmer.group ?? null].filter(Boolean).join(' · ') || t.noGroup;
  })();

  return (
    <Pressable style={styles.recHeader} onPress={onSwitch}>
      <Avatar name={swimmer?.name ?? '?'} index={index} size={52} />
      <View style={{ flex: 1 }}>
        <Text style={styles.recName}>{swimmer?.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.recMeta} numberOfLines={1}>{meta}</Text>
          {swimmer?.usaId && (
            <Pressable
              hitSlop={8}
              onPress={() => void Linking.openURL(officialTimesUrl(swimmer.usaId!))}>
              <Text style={styles.official}>{` · ${t.officialTimes} ↗`}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={styles.switchWrap}>
        <Text style={styles.switchText}>{t.switchLbl}</Text>
        <ChevronDown color={color.accent} size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  recName: { color: color.text, fontSize: 20, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  recMeta: { color: color.textMuted, fontSize: 12, flexShrink: 1 },
  official: { color: color.accent, fontSize: 12, fontWeight: '600' },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  switchText: { color: color.accent, fontSize: 13, fontWeight: '600' },
});
