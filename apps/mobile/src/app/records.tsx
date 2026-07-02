import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { deleteRecord, listRecords, listSwimmers, type Swimmer, type TrainingRecord } from '@/db';
import { eventKeyOf, eventLabel, recordsToCsv } from '@/features/records/csv';
import TrendChart from '@/features/records/TrendChart';
import { color, radius, touch } from '@/theme';
import { fmtSplit, fmtTotal } from '@splitlane/timer-core';

/** Records 탭: 선수→종목 필터, 추세, 세션 목록, 구간 비교, CSV 내보내기. */
export default function RecordsScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);

  const reload = useCallback(() => {
    void (async () => {
      const sw = await listSwimmers();
      setSwimmers(sw);
      const sid = swimmerId && sw.some((s) => s.id === swimmerId) ? swimmerId : sw[0]?.id ?? null;
      setSwimmerId(sid);
      setRecords(sid ? await listRecords(sid) : []);
    })();
  }, [swimmerId]);
  useFocusEffect(reload);

  const events = useMemo(() => {
    const map = new Map<string, TrainingRecord['target']>();
    for (const r of [...records].sort((a, b) => b.date - a.date)) {
      if (!map.has(eventKeyOf(r.target))) map.set(eventKeyOf(r.target), r.target);
    }
    return [...map.entries()];
  }, [records]);

  const activeEvent = eventKey && events.some(([k]) => k === eventKey) ? eventKey : events[0]?.[0] ?? null;
  const filtered = useMemo(
    () =>
      records
        .filter((r) => activeEvent && eventKeyOf(r.target) === activeEvent)
        .sort((a, b) => b.date - a.date),
    [records, activeEvent],
  );
  const finished = filtered.filter((r) => r.status === 'finished');
  const bestMs = finished.length ? Math.min(...finished.map((r) => r.totalMs)) : null;
  const selected = filtered.filter((r) => compareIds.has(r.id));
  const swimmer = swimmers.find((s) => s.id === swimmerId);

  const onDelete = useCallback((r: TrainingRecord) => {
    Alert.alert('Delete this record?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteRecord(r.id).then(reload) },
    ]);
  }, [reload]);

  const onExport = useCallback(() => {
    if (!swimmer) return;
    void (async () => {
      try {
        const file = new File(Paths.cache, `splitlane-${swimmer.name}.csv`);
        if (file.exists) file.delete();
        file.write(recordsToCsv(swimmer.name, records));
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export records' });
      } catch (err) {
        Alert.alert('Export failed', String(err));
      }
    })();
  }, [swimmer, records]);

  if (swimmers.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyText}>No swimmers yet</Text>
        <Text style={styles.emptySub}>Add swimmers in the Athletes tab, then time a session.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillBar} contentContainerStyle={styles.pillRow}>
        {swimmers.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => { setSwimmerId(s.id); setCompareIds(new Set()); void listRecords(s.id).then(setRecords); }}
            style={[styles.pill, s.id === swimmerId && styles.pillOn]}>
            <Text style={[styles.pillText, s.id === swimmerId && styles.pillTextOn]}>{s.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {events.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillBar} contentContainerStyle={styles.pillRow}>
          {events.map(([k, t]) => (
            <Pressable
              key={k}
              onPress={() => { setEventKey(k); setCompareIds(new Set()); }}
              style={[styles.pill, k === activeEvent && styles.pillOn]}>
              <Text style={[styles.pillText, k === activeEvent && styles.pillTextOn]}>{eventLabel(t)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
        ListHeaderComponent={<TrendChart records={finished} />}
        ListEmptyComponent={<Text style={styles.emptySub}>No records yet. Time a session and save it.</Text>}
        renderItem={({ item }) => {
          const picked = compareIds.has(item.id);
          return (
            <Pressable
              onPress={() => {
                const next = new Set(compareIds);
                if (picked) next.delete(item.id); else next.add(item.id);
                setCompareIds(next);
              }}
              style={[styles.row, picked && styles.rowPicked]}>
              <View style={[styles.check, picked && styles.checkOn]} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowDate}>{new Date(item.date).toLocaleDateString()}</Text>
                  {item.status === 'dnf' && <Text style={styles.dnf}>DNF</Text>}
                  {bestMs != null && item.status === 'finished' && item.totalMs === bestMs && (
                    <Text style={styles.pb}>🏅 Best</Text>
                  )}
                  <Text style={styles.rowTotal}>{fmtTotal(item.totalMs)}</Text>
                </View>
                <Text style={styles.rowSplits}>{item.splits.map((s) => fmtSplit(s.splitMs)).join('  ')}</Text>
              </View>
              <Pressable onPress={() => onDelete(item)} hitSlop={8} style={styles.delBtn}>
                <Text style={styles.delText}>✕</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
      <View style={styles.actions}>
        <Pressable
          style={[styles.compareBtn, selected.length < 2 && styles.btnDisabled]}
          disabled={selected.length < 2}
          onPress={() => setComparing(true)}>
          <Text style={styles.compareText}>
            {selected.length < 2 ? 'Select 2+ to compare' : `Compare ${selected.length}`}
          </Text>
        </Pressable>
        <Pressable style={[styles.exportBtn, records.length === 0 && styles.btnDisabled]} disabled={records.length === 0} onPress={onExport}>
          <Text style={styles.exportText}>CSV</Text>
        </Pressable>
      </View>

      <Modal visible={comparing} transparent animationType="fade" onRequestClose={() => setComparing(false)}>
        <Pressable style={styles.modalBack} onPress={() => setComparing(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Split Comparison</Text>
            <View style={styles.cmpRow}>
              <Text style={[styles.cmpCell, styles.cmpHead]}>Seg</Text>
              {selected.map((r) => (
                <Text key={r.id} style={[styles.cmpCell, styles.cmpHead]}>
                  {new Date(r.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </Text>
              ))}
            </View>
            {Array.from({ length: Math.max(...selected.map((r) => r.splits.length)) }, (_, i) => (
              <View key={i} style={styles.cmpRow}>
                <Text style={[styles.cmpCell, styles.cmpHead]}>{i + 1}</Text>
                {selected.map((r) => (
                  <Text key={r.id} style={styles.cmpCell}>
                    {r.splits[i] ? fmtSplit(r.splits[i]!.splitMs) : '—'}
                  </Text>
                ))}
              </View>
            ))}
            <View style={styles.cmpRow}>
              <Text style={[styles.cmpCell, styles.cmpHead]}>Total</Text>
              {selected.map((r) => (
                <Text key={r.id} style={[styles.cmpCell, styles.cmpTotal]}>{fmtTotal(r.totalMs)}</Text>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 10 },
  emptyScreen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyText: { color: color.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: color.textMuted, fontSize: 14, textAlign: 'center' },
  pillBar: { flexGrow: 0 },
  pillRow: { gap: 8 },
  pill: {
    paddingHorizontal: 14, height: 40, justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
  },
  pillOn: { backgroundColor: color.surface2, borderColor: color.accent },
  pillText: { color: color.textMuted, fontSize: 14, fontWeight: '600' },
  pillTextOn: { color: color.text },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touch.min,
    backgroundColor: color.surface, borderRadius: radius.card, padding: 12,
  },
  rowPicked: { borderWidth: 1, borderColor: color.accent },
  check: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: color.line },
  checkOn: { borderColor: color.accent, backgroundColor: color.accent },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDate: { color: color.textMuted, fontSize: 13 },
  dnf: { color: color.warn, fontSize: 12, fontWeight: '800' },
  pb: { color: color.warn, fontSize: 12, fontWeight: '700' },
  rowTotal: { color: color.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], marginLeft: 'auto' },
  rowSplits: { color: color.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  delBtn: { padding: 6 },
  delText: { color: color.textMuted, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 10 },
  compareBtn: {
    flex: 1, height: 52, borderRadius: radius.btn, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  compareText: { color: color.text, fontSize: 15, fontWeight: '700' },
  exportBtn: {
    width: 96, height: 52, borderRadius: radius.btn, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  exportText: { color: '#04221d', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: color.surface, borderRadius: radius.card, padding: 16, gap: 6 },
  modalTitle: { color: color.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cmpRow: { flexDirection: 'row', gap: 6 },
  cmpCell: { flex: 1, color: color.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  cmpHead: { color: color.textMuted, fontWeight: '700' },
  cmpTotal: { fontWeight: '800' },
});
