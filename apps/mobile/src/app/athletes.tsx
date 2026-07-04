import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { ChevronRight } from '@/components/Icons';
import SwimmerFormModal from '@/components/SwimmerFormModal';
import { addSwimmer, ageOf, archiveSwimmer, listSwimmers, updateSwimmer, type Swimmer } from '@/db';
import { officialTimesUrl } from '@/features/records/officialTimes';
import { useT } from '@/store/settings';
import { color, radius } from '@/theme';

type Editing = { swimmer: Swimmer | null }; // null swimmer = 신규 추가

/**
 * 선수 관리 화면(스택 라우트 — 전체 종목 탭의 '선수 관리'에서 진입).
 * 아바타 카드 목록 + 추가/편집 모달(SwimmerFormModal — 배정 화면과 공유).
 * 삭제는 아카이브(기록 보존). USA Swimming ID가 있으면 공인 기록 링크 표시.
 */
export default function AthletesScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const t = useT();

  const reload = useCallback(() => {
    void listSwimmers().then(setSwimmers);
  }, []);
  useFocusEffect(reload);

  const onArchive = useCallback((s: Swimmer) => {
    Alert.alert(t.delSwTitle(s.name), t.delSwMsg, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delYes, style: 'destructive', onPress: () => { setEditing(null); void archiveSwimmer(s.id).then(reload); } },
    ]);
  }, [reload, t]);

  function metaLine(s: Swimmer): string {
    const a = ageOf(s);
    return [a != null ? t.yo(a) : null, s.group ?? null].filter(Boolean).join(' · ') || t.noGroup;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: 12 }]}>
        <Pressable style={styles.addBtn} onPress={() => setEditing({ swimmer: null })}>
          <Text style={styles.addBtnText}>{`＋ ${t.addSw}`}</Text>
        </Pressable>
        <FlatList
          data={swimmers}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>{t.athEmpty}</Text>}
          renderItem={({ item, index }) => (
            <Pressable style={styles.card} onPress={() => setEditing({ swimmer: item })}>
              <Avatar name={item.name} index={index} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{metaLine(item)}</Text>
                {item.usaId && (
                  <Pressable hitSlop={6} onPress={() => void Linking.openURL(officialTimesUrl(item.usaId!))}>
                    <Text style={styles.official}>{`${t.officialTimes} ↗`}</Text>
                  </Pressable>
                )}
              </View>
              <ChevronRight color={color.textMuted} />
            </Pressable>
          )}
        />
      </View>

      <SwimmerFormModal
        visible={editing != null}
        swimmer={editing?.swimmer ?? null}
        onClose={() => setEditing(null)}
        onSave={(fields) => {
          void (async () => {
            if (editing?.swimmer) {
              await updateSwimmer(editing.swimmer.id, {
                name: fields.name, group: fields.group ?? null, birthYear: fields.birthYear ?? null,
                gender: fields.gender ?? null, usaId: fields.usaId ?? null,
              });
            } else {
              await addSwimmer(fields);
            }
            setEditing(null);
            reload();
          })();
        }}
        onDelete={onArchive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1, paddingHorizontal: 16, gap: 12 },
  addBtn: {
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: color.accent, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: color.accent, fontSize: 16, fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12,
  },
  name: { color: color.text, fontSize: 18, fontWeight: '700' },
  meta: { color: color.textMuted, fontSize: 13, marginTop: 3 },
  official: { color: color.accent, fontSize: 12, fontWeight: '600', marginTop: 4 },
  empty: { color: color.textMuted, fontSize: 14, textAlign: 'center', marginTop: 32 },
});
