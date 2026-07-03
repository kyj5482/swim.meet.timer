import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import Avatar from '@/components/Avatar';
import { ChevronDown } from '@/components/Icons';
import Select from '@/components/Select';
import { ageOf, deleteRecord, listRecords, listSwimmers, type Swimmer, type TrainingRecord } from '@/db';
import CompareChart from '@/features/records/CompareChart';
import TrendChart from '@/features/records/TrendChart';
import { eventKeyOf, eventLabel, recordsToCsv } from '@/features/records/csv';
import { useT } from '@/store/settings';
import { color, font, laneColor, radius, touch } from '@/theme';
import { fmtTotal } from '@splitlane/timer-core';

/** Records 탭 (PWA records 페인 이식): 아바타 헤더 + Switch, 이벤트 드롭다운, 추세 차트, 세션. */
export default function RecordsScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cmpMode, setCmpMode] = useState(false);
  const [cmpIds, setCmpIds] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const t = useT();

  const loadRecords = useCallback((sid: string) => {
    void listRecords(sid).then(setRecords);
  }, []);

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

  const swimmerIdx = Math.max(0, swimmers.findIndex((s) => s.id === swimmerId));
  const swimmer = swimmers.find((s) => s.id === swimmerId);

  // 종목 목록(최근순) + 각 종목 PB
  const events = useMemo(() => {
    const map = new Map<string, { target: TrainingRecord['target']; bestMs: number }>();
    for (const r of records) {
      const k = eventKeyOf(r.target);
      const cur = map.get(k);
      const best = r.status === 'finished' ? r.totalMs : Infinity;
      if (!cur) map.set(k, { target: r.target, bestMs: best });
      else cur.bestMs = Math.min(cur.bestMs, best);
    }
    // 거리 오름차순, 그 다음 종목
    return [...map.entries()].sort((a, b) => a[1].target.distance - b[1].target.distance);
  }, [records]);

  const activeEvent = eventKey && events.some(([k]) => k === eventKey) ? eventKey : events[0]?.[0] ?? null;
  const activeTarget = events.find(([k]) => k === activeEvent)?.[1].target ?? null;
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
  const unit = activeTarget?.course === '25y' ? 'y' : 'm';

  const switchTo = useCallback((sid: string) => {
    setSwimmerId(sid); setCmpIds(new Set()); setCmpMode(false); setExpandedId(null); setSwitching(false);
    loadRecords(sid);
  }, [loadRecords]);

  const onDelete = useCallback((r: TrainingRecord) => {
    Alert.alert(t.delConfirm, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delYes, style: 'destructive', onPress: () => void deleteRecord(r.id).then(reload) },
    ]);
  }, [reload, t]);

  const onExport = useCallback(() => {
    if (!swimmer) return;
    void (async () => {
      try {
        const file = new File(Paths.cache, `splitlane-${swimmer.name}.csv`);
        if (file.exists) file.delete();
        file.write(recordsToCsv(swimmer.name, records));
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export records' });
      } catch (err) {
        Alert.alert(t.exportFail, String(err));
      }
    })();
  }, [swimmer, records, t]);

  function metaLine(s: Swimmer): string {
    const age = ageOf(s);
    return [age != null ? t.yo(age) : null, s.group ?? null].filter(Boolean).join(' · ') || t.noGroup;
  }

  if (swimmers.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>🏊</Text>
        <Text style={styles.emptyText}>{t.noSwimmers}</Text>
        <Text style={styles.emptySub}>{t.noSwimmersSub}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* 아바타 헤더 + Switch (PWA .rec-header) */}
      <Pressable style={styles.recHeader} onPress={() => setSwitching(true)}>
        <Avatar name={swimmer?.name ?? '?'} index={swimmerIdx} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.recName}>{swimmer?.name}</Text>
          <Text style={styles.recMeta}>{swimmer ? metaLine(swimmer) : ''}</Text>
        </View>
        <View style={styles.switchWrap}>
          <Text style={styles.switchText}>{t.switchLbl}</Text>
          <ChevronDown color={color.accent} size={16} />
        </View>
      </Pressable>

      {/* 이벤트 드롭다운 (PB 인라인) */}
      {events.length > 0 && activeEvent && (
        <View style={styles.eventBlock}>
          <Text style={styles.eventLabel}>{t.event}</Text>
          <Select
            value={activeEvent}
            options={events.map(([k, v]) => ({
              value: k,
              label: `${eventLabel(v.target)}${Number.isFinite(v.bestMs) ? `  ·  🏅 ${fmtTotal(v.bestMs)}` : ''}`,
            }))}
            onChange={setEventKey}
            title={t.event}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            {finished.length >= 2 && activeTarget && (
              <TrendChart
                records={finished}
                title={`${eventLabel(activeTarget)} ${t.trend}`}
                sub={t.trendSub(finished.length)}
              />
            )}
            <View style={styles.histHead}>
              <Text style={styles.histTitle}>{t.sessions}</Text>
              <Pressable onPress={() => { setCmpMode(!cmpMode); setCmpIds(new Set()); }}>
                <Text style={[styles.cmpLink, cmpMode && styles.cmpLinkActive]}>
                  {cmpMode ? t.cancel : t.compareSplits}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptySub}>{t.noRecords}</Text>}
        renderItem={({ item, index }) => {
          const picked = cmpIds.has(item.id);
          const expanded = expandedId === item.id;
          const isPB = bestMs != null && item.status === 'finished' && item.totalMs === bestMs;
          // 직전(더 오래된) 같은 종목 세션 대비 증감 — "잘 가고 있는지" 즉시 표시.
          const prev = filtered[index + 1];
          const deltaMs = prev && item.status === 'finished' && prev.status === 'finished'
            ? item.totalMs - prev.totalMs : null;
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
                    {isPB ? ` · ${t.bestWord}` : ''}
                  </Text>
                </View>
                {deltaMs != null && deltaMs !== 0 && (
                  <Text style={deltaMs < 0 ? styles.deltaDown : styles.deltaUp}>
                    {`${deltaMs < 0 ? '▼' : '▲'}${(Math.abs(deltaMs) / 1000).toFixed(2)}`}
                  </Text>
                )}
                {isPB && <View style={styles.pbBadge}><Text style={styles.pbBadgeText}>{t.pbShort}</Text></View>}
                {item.status === 'dnf' && <Text style={styles.dnf}>DNF</Text>}
                <Text style={styles.rowTotal}>{fmtTotal(item.totalMs)}</Text>
              </Pressable>

              {expanded && !cmpMode && (
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>{t.segSplits}</Text>
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
                    <Text style={styles.delMiniText}>{t.delRec}</Text>
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
              {selected.length < 2 ? t.selectMode : t.compareN(selected.length)}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.exportBtn, records.length === 0 && styles.btnDisabled]} disabled={records.length === 0} onPress={onExport}>
            <Text style={styles.exportText}>{t.exportCsv}</Text>
          </Pressable>
        )}
      </View>

      {/* 선수 전환 모달 (Switch) */}
      <Modal visible={switching} transparent animationType="fade" onRequestClose={() => setSwitching(false)}>
        <Pressable style={styles.modalBack} onPress={() => setSwitching(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>{t.pickTitle}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {swimmers.map((s, i) => {
                const on = s.id === swimmerId;
                return (
                  <Pressable key={s.id} style={[styles.pickRow, on && styles.pickRowOn]} onPress={() => switchTo(s.id)}>
                    <Avatar name={s.name} index={i} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{s.name}</Text>
                      <Text style={styles.pickMeta}>{metaLine(s)}</Text>
                    </View>
                    {on && <Text style={styles.pickChk}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* 구간 비교 모달 (차트 + 표) */}
      <Modal visible={comparing} transparent animationType="fade" onRequestClose={() => setComparing(false)}>
        <Pressable style={styles.modalBack} onPress={() => setComparing(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t.splitCmp}</Text>
            {activeTarget && (
              <CompareChart
                records={selected}
                splitInterval={activeTarget.splitInterval}
                unit={unit}
                axisNote={t.cmpAxisNote}
              />
            )}
            <View style={styles.cmpRow}>
              <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>{t.seg}</Text>
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
              <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>{t.total2}</Text>
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
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, gap: 10 },
  emptyScreen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyIcon: { fontSize: 40, opacity: 0.7 },
  emptyText: { color: color.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: color.textMuted, fontSize: 13, textAlign: 'center' },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  recName: { color: color.text, fontSize: 20, fontWeight: '700' },
  recMeta: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  switchText: { color: color.accent, fontSize: 13, fontWeight: '600' },
  eventBlock: { gap: 6 },
  eventLabel: { color: color.textMuted, fontSize: 12 },
  histHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2, marginTop: 2 },
  histTitle: { color: color.text, fontSize: 15, fontWeight: '700' },
  cmpLink: { color: color.accent, fontSize: 13, fontWeight: '600' },
  cmpLinkActive: { color: color.warn },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touch.min + 6,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12,
  },
  rowPicked: { borderColor: color.accent },
  rowOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { borderColor: color.accent, backgroundColor: color.accent },
  checkMark: { color: color.accentInk, fontSize: 12, fontWeight: '900', lineHeight: 14 },
  rowDate: { color: color.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  dnf: { color: color.warn, fontSize: 12, fontWeight: '800' },
  deltaDown: { color: color.ok, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  deltaUp: { color: color.stop, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pbBadge: { backgroundColor: color.ok, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pbBadgeText: { color: color.okInk, fontWeight: '800', fontSize: 11 },
  rowTotal: {
    color: color.text, fontSize: 22, fontWeight: '700',
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
  pickerCard: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 16, gap: 8, maxHeight: '80%',
  },
  modalTitle: { color: color.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line,
    borderRadius: 12, padding: 10, marginBottom: 8,
  },
  pickRowOn: { borderColor: color.accent },
  pickName: { color: color.text, fontSize: 16, fontWeight: '700' },
  pickMeta: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  pickChk: { color: color.accent, fontWeight: '900', fontSize: 16 },
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
