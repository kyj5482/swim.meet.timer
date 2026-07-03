import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Avatar from '@/components/Avatar';
import { ChevronRight } from '@/components/Icons';
import TopBar from '@/components/TopBar';
import { addSwimmer, ageOf, archiveSwimmer, listSwimmers, updateSwimmer, type Swimmer } from '@/db';
import { useT } from '@/store/settings';
import { color, radius, touch } from '@/theme';

const BASE_YEAR = 2026;

type Editing = { swimmer: Swimmer | null }; // null swimmer = 신규 추가

/** Athletes 탭 (PWA 이식): 아바타 카드 목록 + 추가/편집 모달. 삭제는 아카이브(기록 보존). */
export default function AthletesScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [group, setGroup] = useState('');
  const t = useT();

  const reload = useCallback(() => {
    void listSwimmers().then(setSwimmers);
  }, []);
  useFocusEffect(reload);

  function openAdd() {
    setName(''); setAge(''); setGroup('');
    setEditing({ swimmer: null });
  }
  function openEdit(s: Swimmer) {
    setName(s.name);
    const a = ageOf(s);
    setAge(a != null ? String(a) : '');
    setGroup(s.group ?? '');
    setEditing({ swimmer: s });
  }

  const save = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ageN = parseInt(age, 10);
    const birthYear = Number.isFinite(ageN) && ageN > 0 ? BASE_YEAR - ageN : undefined;
    const grp = group.trim() || undefined;
    void (async () => {
      if (editing?.swimmer) {
        await updateSwimmer(editing.swimmer.id, { name: trimmed, group: grp ?? null, birthYear: birthYear ?? null });
      } else {
        await addSwimmer(trimmed, grp, birthYear);
      }
      setEditing(null);
      reload();
    })();
  }, [name, age, group, editing, reload]);

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
      <TopBar title={t.tabAth} showGear={false} />
      <View style={styles.body}>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>{`＋ ${t.addSw}`}</Text>
        </Pressable>
        <FlatList
          data={swimmers}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>{t.athEmpty}</Text>}
          renderItem={({ item, index }) => (
            <Pressable style={styles.card} onPress={() => openEdit(item)}>
              <Avatar name={item.name} index={index} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{metaLine(item)}</Text>
              </View>
              <ChevronRight color={color.textMuted} />
            </Pressable>
          )}
        />
      </View>

      <Modal visible={editing != null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.modalBack} onPress={() => setEditing(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{editing?.swimmer ? t.editSw : t.addSw}</Text>
            <Text style={styles.fieldLabel}>{t.lName}</Text>
            <TextInput
              style={styles.input} value={name} onChangeText={setName}
              placeholder={t.namePH} placeholderTextColor={color.textMuted} autoFocus={!editing?.swimmer}
            />
            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t.lAge}</Text>
                <TextInput
                  style={styles.input} value={age} onChangeText={setAge}
                  placeholder="12" placeholderTextColor={color.textMuted} keyboardType="number-pad" maxLength={2}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldLabel}>{t.lGroup}</Text>
                <TextInput
                  style={styles.input} value={group} onChangeText={setGroup}
                  placeholder={t.groupPH} placeholderTextColor={color.textMuted}
                />
              </View>
            </View>
            <Pressable style={[styles.saveBtn, !name.trim() && styles.btnDisabled]} disabled={!name.trim()} onPress={save}>
              <Text style={styles.saveText}>{t.save}</Text>
            </Pressable>
            {editing?.swimmer && (
              <Pressable style={styles.delBtn} onPress={() => onArchive(editing.swimmer!)}>
                <Text style={styles.delText}>{t.deleteSw}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  empty: { color: color.textMuted, fontSize: 14, textAlign: 'center', marginTop: 32 },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,10,18,0.72)', justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 18, gap: 8,
  },
  modalTitle: { color: color.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  fieldLabel: { color: color.textMuted, fontSize: 13, marginTop: 4 },
  input: {
    height: 48, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: color.surface2, color: color.text, fontSize: 16,
    borderWidth: 1, borderColor: color.line,
  },
  rowFields: { flexDirection: 'row', gap: 10 },
  saveBtn: { height: 50, borderRadius: 14, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveText: { color: color.accentInk, fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
  delBtn: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.stop,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  delText: { color: color.stop, fontSize: 15, fontWeight: '700' },
});
