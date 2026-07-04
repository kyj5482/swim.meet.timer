import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { ageOf, type Swimmer } from '@/db';
import { useT } from '@/store/settings';
import { color, radius } from '@/theme';

/**
 * 선수 전환(Switch) 모달 — 전체 종목·세부 종목 탭이 동일한 화면을 공유한다.
 * 목록 아래에 '선수 관리' 버튼(아이콘 없는 버튼 스타일)이 항상 붙는다.
 */
export default function SwimmerPicker({ visible, swimmers, currentId, onPick, onClose }: {
  visible: boolean;
  swimmers: Swimmer[];
  currentId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();

  function metaLine(s: Swimmer): string {
    const age = ageOf(s);
    return [age != null ? t.yo(age) : null, s.group ?? null].filter(Boolean).join(' · ') || t.noGroup;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.pickTitle}</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {swimmers.map((s, i) => {
              const on = s.id === currentId;
              return (
                <Pressable key={s.id} style={[styles.row, on && styles.rowOn]} onPress={() => onPick(s.id)}>
                  <Avatar name={s.name} index={i} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.meta}>{metaLine(s)}</Text>
                  </View>
                  {on && <Text style={styles.chk}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            style={styles.manageBtn}
            onPress={() => { onClose(); router.push('/athletes'); }}>
            <Text style={styles.manageText}>{t.manageAthletes}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(4,12,20,0.72)', justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 16, gap: 8, maxHeight: '80%',
  },
  title: { color: color.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line,
    borderRadius: 12, padding: 10, marginBottom: 8,
  },
  rowOn: { borderColor: color.accent },
  name: { color: color.text, fontSize: 16, fontWeight: '700' },
  meta: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  chk: { color: color.accent, fontWeight: '900', fontSize: 16 },
  manageBtn: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  manageText: { color: color.accent, fontSize: 14, fontWeight: '700' },
});
