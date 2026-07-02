import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { deleteRecord, listRecords, listSwimmers, type Swimmer, type TrainingRecord } from '@/db';
import CompareChart from '@/features/records/CompareChart';
import TrendChart from '@/features/records/TrendChart';
import { eventKeyOf, eventLabel, recordsToCsv } from '@/features/records/csv';
import { color, font, initials, laneColor, radius, touch } from '@/theme';
import { fmtTotal } from '@splitlane/timer-core';

/** Records 탭 (PWA records 페인 이식): 선수→종목, 추세 차트, 펼침 상세, 구간 비교, CSV. */
export default function RecordsScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cmpMode, setCmpMode] = useState(false);
  const [cmpIds, setCmpIds] = useState<Set<string>>(new Set());
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
  const activeTarget = events.find(([k]) => k === activeEvent)?.[1] ?? null;
  const filtered = useMemo(
    () =>
      records
        .filter((r) => activeEvent && eventKeyOf(r.target) === activeEvent)
        .sort((a, b) => b.date - a.date),
    [records, activeEvent],
  );
  const finished = filtered.filter((r) => r.status === 'finished');
  const bestMs = finished.length ? Math.min(...finished.map((r) => r.totalMs)) : null;
  const selected = filtered.filter((r) => cmpIds.has(r.id)).sort((a, b) => a.date - b.date);
  const swimmer = swimmers.find((s) => s.id === swimmerId);
  const unit = activeTarget?.course === '25y' ? 'y' : 'm';

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
        <Text style={styles.emptyIcon}>🏊</Text>
        <Text style={styles.emptyText}>No swimmers yet</Text>
        <Text style={styles.emptySub}>Add swimmers in the Athletes tab, then time a session.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* 선수 선택 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillBar} contentContainerStyle={styles.pillRow}>
        {swimmers.map((s, i) => {
          const on = s.id === swimmerId;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setSwimmerId(s.id); setCmpIds(new Set()); setCmpMode(false); setExpandedId(null);
                void listRecords(s.id).then(setRecords);
              }}
              style={[styles.swPill, on && styles.swPillOn]}>
              <View style={[styles.swAvatar, { backgroundColor: laneColor(i) }]}>
                <Text style={styles.swAvatarText}>{initials(s.name)}</Text>
              </View>
              <Text style={[styles.pillText, on && styles.pillTextOn2]}>{s.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 종목 선택 */}
      {events.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillBar} contentContainerStyle={styles.pillRow}>
          {events.map(([k, t]) => (
            <Pressable
              key={k}
              onPress={() => { setEventKey(k); setCmpIds(new Set()); setCmpMode(false); setExpandedId(null); }}
              style={[styles.pill, k === activeEvent && styles.pillOn]}>
              <Text style={[styles.pillText, k === activeEvent && styles.pillTextOn]}>{eventLabel(t)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            {finished.length >= 2 && activeTarget && (
              <TrendChart records={finished} title={eventLabel(activeTarget)} />
            )}
            <View style={styles.histHead}>
              <Text style={styles.histTitle}>Sessions</Text>
              <Pressable onPress={() => { setCmpMode(!cmpMode); setCmpIds(new Set()); }}>
                <Text style={[styles.cmpLink, cmpMode && styles.cmpLinkActive]}>
                  {cmpMode ? 'Cancel' : 'Compare Splits'}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptySub}>No records yet. Time a session and save it.</Text>}
        renderItem={({ item }) => {
          const picked = cmpIds.has(item.id);
          const expanded = expandedId === item.id;
          const isPB = bestMs != null && item.status === 'finished' && item.totalMs === bestMs;
          return (
            <View>
              <Pressable
                onPress={() => {
                  if (cmpMode) {
                    const next = new Set(cmpIds);
                    if (picked) next.delete(item.id); else next.add(item.id);
                    setCmpIds(next);
                  } else {
                    setExpandedId(expanded ? null : item.id);
                  }
                }}
                style={[styles.row, picked && styles.rowPicked, expanded && styles.rowOpen]}>
                {cmpMode && (
                  <View style={[styles.check, picked && styles.checkOn]}>
                    {picked && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowDate}>{new Date(item.date).toLocaleDateString()}</Text>
                  <Text style={styles.rowMeta}>
                    {eventLabel(item.target)}
                    {isPB ? ' · Best' : ''}
                  </Text>
                </View>
                {isPB && <View style={styles.pbBadge}><Text style={styles.pbBadgeText}>PB</Text></View>}
                {item.status === 'dnf' && <Text style={styles.dnf}>DNF</Text>}
                <Text style={styles.rowTotal}>{fmtTotal(item.totalMs)}</Text>
              </Pressable>

              {/* 펼침 상세 (PWA .h-detail) */}
              {expanded && !cmpMode && (
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>Segment Splits</Text>
                  <View style={styles.segGrid}>
                    {item.splits.map((s, i) => (
                      <View key={i} style={styles.segChip}>
                        <Text style={styles.segChipLabel}>
                          {`${(i + 1) * item.target.splitInterval}${item.target.course === '25y' ? 'y' : 'm'}`}
                        </Text>
                        <Text style={styles.segChipVal}>{(s.splitMs / 1000).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable style={styles.delMini} onPress={() => onDelete(item)}>
                    <Text style={styles.delMiniText}>🗑 Delete</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />

      <View style={styles.actions}>
        {cmpMode ? (
          <Pressable
            style={[styles.compareBtn, selected.length < 2 && styles.btnDisabled]}
            disabled={selected.length < 2}
            onPress={() => setComparing(true)}>
            <Text style={styles.compareText}>
              {selected.length < 2 ? 'Select 2+ sessions' : `Compare ${selected.length} sessions`}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.exportBtn, records.length === 0 && styles.btnDisabled]} disabled={records.length === 0} onPress={onExport}>
            <Text style={styles.exportText}>Export CSV</Text>
          </Pressable>
        )}
      </View>

      {/* 구간 비교 모달 (차트 + 표) */}
      <Modal visible={comparing} transparent animationType="fade" onRequestClose={() => setComparing(false)}>
        <Pressable style={styles.modalBack} onPress={() => setComparing(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Split Comparison</Text>
            {activeTarget && (
              <CompareChart records={selected} splitInterval={activeTarget.splitInterval} unit={unit} />
            )}
            <View style={styles.cmpRow}>
              <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>Seg</Text>
              {selected.map((r) => (
                <Text key={r.id} style={[styles.cmpCell, styles.cmpHead]}>
                  {new Date(r.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </Text>
              ))}
            </View>
            {Array.from({ length: Math.max(...selected.map((r) => r.splits.length), 0) }, (_, i) => {
              const vals = selected.map((r) => r.splits[i]?.splitMs ?? null);
              const rowBest = Math.min(...vals.filter((v): v is number => v != null));
              return (
                <View key={i} style={styles.cmpRow}>
                  <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>
                    {activeTarget ? `${(i + 1) * activeTarget.splitInterval}${unit}` : i + 1}
                  </Text>
                  {vals.map((v, vi) => (
                    <Text key={vi} style={[styles.cmpCell, v != null && v === rowBest && styles.cmpBest]}>
                      {v != null ? (v / 1000).toFixed(2) : '—'}
                    </Text>
                  ))}
                </View>
              );
            })}
            <View style={styles.cmpRow}>
              <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>Total</Text>
              {selected.map((r) => (
                <Text key={r.id} style={[styles.cmpCell, styles.cmpTotal]}>{fmtTotal(r.totalMs)}</Text>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 10 },
  emptyScreen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyIcon: { fontSize: 40, opacity: 0.7 },
  emptyText: { color: color.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: color.textMuted, fontSize: 13, textAlign: 'center' },
  pillBar: { flexGrow: 0 },
  pillRow: { gap: 8 },
  swPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 14, height: 44,
    borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
  },
  swPillOn: { borderColor: color.accent, backgroundColor: color.surface2 },
  swAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  swAvatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  pill: {
    paddingHorizontal: 14, height: 40, justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line,
  },
  pillOn: { backgroundColor: color.accent, borderColor: color.accent },
  pillText: { color: color.text, fontSize: 14, fontWeight: '600' },
  pillTextOn: { color: color.accentInk, fontWeight: '800' },
  pillTextOn2: { color: color.text, fontWeight: '700' },
  histHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  histTitle: { color: color.text, fontSize: 14, fontWeight: '700' },
  cmpLink: { color: color.accent, fontSize: 13, fontWeight: '600' },
  cmpLinkActive: { color: color.warn },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touch.min,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10,
  },
  rowPicked: { borderColor: color.accent },
  rowOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { borderColor: color.accent, backgroundColor: color.accent },
  checkMark: { color: color.accentInk, fontSize: 12, fontWeight: '900', lineHeight: 14 },
  rowDate: { color: color.text, fontSize: 14, fontWeight: '600' },
  rowMeta: { color: color.textMuted, fontSize: 11, marginTop: 2 },
  dnf: { color: color.warn, fontSize: 12, fontWeight: '800' },
  pbBadge: { backgroundColor: color.ok, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pbBadgeText: { color: color.okInk, fontWeight: '800', fontSize: 11 },
  rowTotal: {
    color: color.text, fontSize: 18, fontWeight: '700',
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  detail: {
    backgroundColor: color.surface, borderWidth: 1, borderTopWidth: 0, borderColor: color.line,
    borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card,
    padding: 12, gap: 8, marginTop: -1,
  },
  detailLabel: { color: color.textMuted, fontSize: 11, fontWeight: '600' },
  segGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segChip: {
    flexGrow: 1, flexBasis: '22%', minWidth: 56,
    backgroundColor: color.surface2, borderRadius: 8, paddingVertical: 6, alignItems: 'center',
  },
  segChipLabel: { color: color.textMuted, fontSize: 9 },
  segChipVal: { color: color.text, fontSize: 13, marginTop: 2, fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  delMini: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: color.stop,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  delMiniText: { color: color.stop, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  compareBtn: {
    flex: 1, height: 48, borderRadius: 14, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  compareText: { color: color.accentInk, fontSize: 15, fontWeight: '800' },
  exportBtn: {
    flex: 1, height: 48, borderRadius: 14, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  exportText: { color: color.text, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,10,18,0.72)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 16, gap: 8, maxHeight: '88%',
  },
  modalTitle: { color: color.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  cmpRow: { flexDirection: 'row', gap: 6, borderBottomWidth: 1, borderBottomColor: color.line, paddingVertical: 6 },
  cmpCell: {
    flex: 1, color: color.text, fontSize: 12, textAlign: 'right',
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  cmpFirst: { textAlign: 'left', fontFamily: undefined },
  cmpHead: { color: color.textMuted, fontWeight: '700' },
  cmpBest: { color: color.ok, fontWeight: '700' },
  cmpTotal: { fontWeight: '800' },
});
