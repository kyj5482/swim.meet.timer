import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { ChevronDown, ChevronRight } from '@/components/Icons';
import { ageOf, listRecords, listSwimmers, type Swimmer, type TrainingRecord } from '@/db';
import { courseFull, eventKeyOf } from '@/features/records/csv';
import { eventProgress, type EventProgress } from '@/features/targets/progress';
import { standardLadder, stdCourse } from '@/features/targets/standards';
import { useT } from '@/store/settings';
import { color, font, radius, stdLevelColor } from '@/theme';
import { fmtTotal } from '@splitlane/timer-core';

const STROKE_ORDER = ['free', 'back', 'breast', 'fly', 'im'];
const STROKE_SHORT: Record<string, string> = {
  free: 'Free', back: 'Back', breast: 'Breast', fly: 'Fly', im: 'IM',
};

interface EventRow {
  key: string;
  target: TrainingRecord['target'];
  bestMs: number;
  count: number;
  progress: EventProgress | null;
}

/**
 * 전체 종목 탭 — 선수 한 명의 모든 종목을 한눈에: 베스트, 달성 표준 레벨,
 * 다음 레벨까지 필요한 단축률(myswimio Best Times의 "% drop needed" 방식).
 * 행을 누르면 세부 종목 탭으로 이동. 선수 추가/편집은 전환 모달의 '선수 관리'.
 */
export default function EventsOverviewScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [switching, setSwitching] = useState(false);
  const insets = useSafeAreaInsets();
  const t = useT();

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

  const rows = useMemo<EventRow[]>(() => {
    if (!swimmer) return [];
    const gender = swimmer.gender === 'M' ? 'M' : 'F';
    const age = ageOf(swimmer);
    const map = new Map<string, EventRow>();
    for (const r of records) {
      if (r.status !== 'finished') continue;
      const k = eventKeyOf(r.target);
      const cur = map.get(k);
      if (!cur) map.set(k, { key: k, target: r.target, bestMs: r.totalMs, count: 1, progress: null });
      else {
        cur.bestMs = Math.min(cur.bestMs, r.totalMs);
        cur.count++;
      }
    }
    const out = [...map.values()];
    for (const row of out) {
      const ladder = swimmer.gender
        ? standardLadder(stdCourse(row.target.course), gender, age, row.target.stroke, row.target.distance)
        : null;
      row.progress = ladder ? eventProgress(row.bestMs, ladder) : null;
    }
    return out.sort(
      (a, b) =>
        STROKE_ORDER.indexOf(a.target.stroke) - STROKE_ORDER.indexOf(b.target.stroke)
        || a.target.distance - b.target.distance
        || a.target.course.localeCompare(b.target.course),
    );
  }, [records, swimmer]);

  function metaLine(s: Swimmer): string {
    const age = ageOf(s);
    return [age != null ? t.yo(age) : null, s.group ?? null].filter(Boolean).join(' · ') || t.noGroup;
  }

  const openDetail = useCallback((row: EventRow) => {
    router.navigate({
      pathname: '/(tabs)/records',
      params: { event: row.key, swimmer: swimmerId ?? '' },
    });
  }, [swimmerId]);

  if (swimmers.length === 0) {
    return (
      <View style={[styles.emptyScreen, { paddingTop: insets.top }]}>
        <Text style={styles.emptyIcon}>🏊</Text>
        <Text style={styles.emptyText}>{t.noSwimmers}</Text>
        <Text style={styles.emptySub}>{t.noSwimmersSub}</Text>
        <Pressable style={styles.manageBtn} onPress={() => router.push('/athletes')}>
          <Text style={styles.manageBtnText}>{t.manageAthletes}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
      {/* 선수 헤더 + Switch */}
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

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>{t.ovEmpty}</Text>
            <Text style={styles.emptySub}>{t.ovEmptySub}</Text>
          </View>
        }
        ListFooterComponent={
          swimmer && !swimmer.gender && rows.length > 0 ? (
            <Text style={styles.noStdHint}>{t.ovNoStdHint}</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const p = item.progress;
          const lvColor = p?.reached ? stdLevelColor(p.reached.level) : color.line;
          return (
            <Pressable style={styles.row} onPress={() => openDetail(item)}>
              {/* 종목 */}
              <View style={styles.eventCol}>
                <Text style={styles.eventName}>
                  {`${item.target.distance} ${STROKE_SHORT[item.target.stroke] ?? item.target.stroke}`}
                </Text>
                <Text style={styles.eventMeta}>{`${courseFull(item.target.course)} · ${item.count}`}</Text>
              </View>
              {/* 베스트 */}
              <Text style={styles.best}>{fmtTotal(item.bestMs)}</Text>
              {/* 표준 레벨 + 다음 레벨 */}
              <View style={styles.stdCol}>
                <View style={[styles.levelBadge, { borderColor: lvColor }]}>
                  <Text style={[styles.levelText, { color: p?.reached ? lvColor : color.textMuted }]}>
                    {p?.reached ? p.reached.level : '—'}
                  </Text>
                </View>
                <Text style={styles.nextText} numberOfLines={1}>
                  {p == null
                    ? t.ovNoStd
                    : p.next == null
                      ? t.ovTopLevel
                      : t.ovDrop(p.next.level, p.dropPct ?? 0)}
                </Text>
              </View>
              <ChevronRight color={color.textMuted} size={18} />
            </Pressable>
          );
        }}
      />

      {/* 선수 전환 모달 + 선수 관리 */}
      <Modal visible={switching} transparent animationType="fade" onRequestClose={() => setSwitching(false)}>
        <Pressable style={styles.modalBack} onPress={() => setSwitching(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>{t.pickTitle}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {swimmers.map((s, i) => {
                const on = s.id === swimmerId;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.pickRow, on && styles.pickRowOn]}
                    onPress={() => { setSwimmerId(s.id); setSwitching(false); void listRecords(s.id).then(setRecords); }}>
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
            <Pressable
              style={styles.manageRow}
              onPress={() => { setSwitching(false); router.push('/athletes'); }}>
              <Text style={styles.manageText}>{`⚙ ${t.manageAthletes}`}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  emptyScreen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyIcon: { fontSize: 40, opacity: 0.7 },
  emptyText: { color: color.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: color.textMuted, fontSize: 13, textAlign: 'center' },
  emptyBlock: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  manageBtn: {
    marginTop: 10, height: 44, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: color.accent, alignItems: 'center', justifyContent: 'center',
  },
  manageBtnText: { color: color.accent, fontSize: 14, fontWeight: '700' },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  recName: { color: color.text, fontSize: 20, fontWeight: '700' },
  recMeta: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  switchText: { color: color.accent, fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10,
  },
  eventCol: { width: 96 },
  eventName: { color: color.text, fontSize: 16, fontWeight: '800' },
  eventMeta: { color: color.textMuted, fontSize: 11, marginTop: 2 },
  best: {
    flex: 1, color: color.text, fontSize: 18, fontWeight: '700', textAlign: 'right',
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  stdCol: { alignItems: 'flex-end', gap: 3, width: 108 },
  levelBadge: {
    borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 1.5,
    backgroundColor: color.surface2,
  },
  levelText: { fontSize: 12, fontWeight: '800' },
  nextText: { color: color.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  noStdHint: { color: color.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,10,18,0.72)', justifyContent: 'center', padding: 20 },
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
  manageRow: {
    borderTopWidth: 1, borderTopColor: color.line, paddingTop: 12, paddingBottom: 2,
    alignItems: 'center',
  },
  manageText: { color: color.accent, fontSize: 14, fontWeight: '700' },
});
