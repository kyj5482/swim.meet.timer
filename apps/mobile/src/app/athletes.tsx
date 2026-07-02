import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { addSwimmer, archiveSwimmer, listSwimmers, type Swimmer } from '@/db';
import { color, radius, touch } from '@/theme';

/** Athletes 탭: 명단 CRUD. 삭제는 아카이브(기록 보존). */
export default function AthletesScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [name, setName] = useState('');

  const reload = useCallback(() => {
    void listSwimmers().then(setSwimmers);
  }, []);
  useFocusEffect(reload);

  const onAdd = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    void addSwimmer(trimmed).then(reload);
  }, [name, reload]);

  const onArchive = useCallback((s: Swimmer) => {
    Alert.alert(`Delete ${s.name}?`, 'Saved records are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void archiveSwimmer(s.id).then(reload) },
    ]);
  }, [reload]);

  return (
    <View style={styles.screen}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Minjun"
          placeholderTextColor={color.textMuted}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <Pressable style={[styles.addBtn, !name.trim() && styles.addDisabled]} disabled={!name.trim()} onPress={onAdd}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={swimmers}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No swimmers yet. Add one to assign records after timing.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            {item.group ? <Text style={styles.group}>{item.group}</Text> : null}
            <Pressable style={styles.delBtn} onPress={() => onArchive(item)} hitSlop={8}>
              <Text style={styles.delText}>✕</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, height: touch.min, borderRadius: radius.btn, paddingHorizontal: 14,
    backgroundColor: color.surface, color: color.text, fontSize: 16,
    borderWidth: 1, borderColor: color.line,
  },
  addBtn: {
    height: touch.min, paddingHorizontal: 22, borderRadius: radius.btn,
    backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center',
  },
  addDisabled: { opacity: 0.4 },
  addText: { color: '#04221d', fontSize: 16, fontWeight: '800' },
  row: {
    minHeight: touch.min, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: color.surface, borderRadius: radius.card, paddingHorizontal: 14,
  },
  name: { color: color.text, fontSize: 17, fontWeight: '600' },
  group: { color: color.textMuted, fontSize: 13 },
  delBtn: { marginLeft: 'auto', padding: 8 },
  delText: { color: color.textMuted, fontSize: 16 },
  empty: { color: color.textMuted, fontSize: 14, textAlign: 'center', marginTop: 32 },
});
