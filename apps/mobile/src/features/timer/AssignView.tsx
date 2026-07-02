import { useMemo, useReducer, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { color, laneColor, radius } from '@/theme';
import {
  fmtSplit, fmtTotal, improvement, nearestSibling, recommend, swapSwimmers,
  type SlotState, type Target,
} from '@splitlane/timer-core';
import { listSwimmers, saveSession, swimmerStats } from './roster';

interface Props {
  slots: SlotState[];
  target: Target;
  onSaved: (count: number) => void;
  onAgain: () => void;
}

/** 측정 후 배정 화면 (§3.6): 추천 → 향상/PB → 저신뢰 맞바꾸기 → 저장. */
export default function AssignView({ slots, target, onSaved, onAgain }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [picking, setPicking] = useState<SlotState | null>(null);
  const swimmers = listSwimmers();

  useMemo(() => {
    recommend(slots, swimmers.map((s) => swimmerStats(s.id, target)));
  }, [slots, swimmers, target]);

  const summary = useMemo(() => {
    let improved = 0, pb = 0;
    for (const s of slots) {
      if (!s.swimmerId) continue;
      const imp = improvement(s.lastCumMs, swimmerStats(s.swimmerId, target));
      if (imp.kind === 'improved') improved++;
      if (imp.isPB) pb++;
    }
    return { improved, pb, total: slots.length };
  }, [slots, target]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Done — Assign Swimmers</Text>
      <Text style={styles.headline}>{`🎉 Improved ${summary.improved} · 🏅 PB ${summary.pb} · Total ${summary.total}`}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10 }}>
        {slots.map((s) => {
          const stats = s.swimmerId ? swimmerStats(s.swimmerId, target) : null;
          const imp = s.swimmerId && stats ? improvement(s.lastCumMs, stats) : null;
          const near = s.lowConfidence ? nearestSibling(slots, s) : null;
          const name = swimmers.find((w) => w.id === s.swimmerId)?.name ?? 'Select swimmer';
          return (
            <View key={s.idx} style={[styles.card, { borderLeftColor: laneColor(s.idx) }]}>
              <View style={styles.cardTop}>
                <Text style={styles.slotName}>Lane {s.idx + 1}</Text>
                <Text style={styles.total}>{fmtTotal(s.lastCumMs)}</Text>
                {s.status === 'dnf' && <Text style={styles.dnf}>DNF</Text>}
              </View>
              <Pressable style={styles.pickBtn} onPress={() => setPicking(s)}>
                <Text style={styles.pickText}>{name} ▾</Text>
              </Pressable>
              {imp && (
                <Text style={styles.impLine}>
                  {imp.kind === 'first' && <Text style={styles.pbBadge}>First record</Text>}
                  {imp.kind !== 'first' && stats?.lastMs != null && (
                    <>
                      <Text style={styles.muted}>{`Prev ${fmtTotal(stats.lastMs)} → `}</Text>
                      <Text style={imp.kind === 'improved' ? styles.imp : styles.reg}>
                        {`${imp.kind === 'improved' ? '▼' : '▲'} ${(Math.abs(imp.deltaMs) / 1000).toFixed(2)}`}
                      </Text>
                    </>
                  )}
                  {imp.isPB && imp.kind !== 'first' && (
                    <Text style={[styles.pbBadge, s.lowConfidence && styles.pbMuted]}>{'  🏅 PB'}</Text>
                  )}
                </Text>
              )}
              <Text style={styles.splits}>{s.splits.map((x) => fmtSplit(x.splitMs)).join('  ')}</Text>
              {near && (
                <View style={styles.confBar}>
                  <Text style={styles.confText}>
                    {`⚠ ${(near.gapMs / 1000).toFixed(2)}s gap with lane ${near.sibling.idx + 1} — confirm`}
                  </Text>
                  <Pressable style={styles.swapBtn} onPress={() => { swapSwimmers(s, near.sibling); bump(); }}>
                    <Text style={styles.swapText}>↔ Swap</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable style={styles.againBtn} onPress={onAgain}>
          <Text style={styles.againText}>Time Again</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={() => onSaved(saveSession(slots, target))}>
          <Text style={styles.saveText}>Save Records</Text>
        </Pressable>
      </View>

      <Modal visible={picking != null} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.modalBack} onPress={() => setPicking(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Swimmer</Text>
            {swimmers.map((w) => (
              <Pressable
                key={w.id}
                style={styles.modalRow}
                onPress={() => {
                  if (picking) {
                    // 이미 그 선수를 가진 슬롯과는 교환(중복 배정 방지)
                    const holder = slots.find((o) => o.swimmerId === w.id);
                    if (holder && holder !== picking) holder.swimmerId = picking.swimmerId;
                    picking.swimmerId = w.id;
                  }
                  setPicking(null);
                  bump();
                }}>
                <Text style={styles.modalRowText}>{w.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 10 },
  title: { color: color.text, fontSize: 20, fontWeight: '800' },
  headline: { color: color.textMuted, fontSize: 14 },
  card: { backgroundColor: color.surface, borderRadius: radius.card, borderLeftWidth: 6, padding: 12, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotName: { color: color.textMuted, fontSize: 14, fontWeight: '700' },
  total: { color: color.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'], marginLeft: 'auto' },
  dnf: { color: color.warn, fontWeight: '800' },
  pickBtn: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 12,
    backgroundColor: color.surface2, borderRadius: radius.btn, alignSelf: 'flex-start',
  },
  pickText: { color: color.text, fontSize: 16, fontWeight: '700' },
  impLine: { fontSize: 14 },
  muted: { color: color.textMuted, fontVariant: ['tabular-nums'] },
  imp: { color: color.ok, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reg: { color: color.stop, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pbBadge: { color: color.warn, fontWeight: '800' },
  pbMuted: { opacity: 0.5 },
  splits: { color: color.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  confBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: color.surface2, borderRadius: 10, padding: 8,
  },
  confText: { color: color.warn, fontSize: 12, flex: 1 },
  swapBtn: { backgroundColor: color.warn, borderRadius: radius.pill, paddingHorizontal: 12, height: 34, justifyContent: 'center' },
  swapText: { color: '#3a2a05', fontWeight: '800', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  againBtn: { flex: 1, height: 56, borderRadius: radius.btn, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  againText: { color: color.text, fontSize: 16, fontWeight: '700' },
  saveBtn: { flex: 2, height: 56, borderRadius: radius.btn, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#04221d', fontSize: 16, fontWeight: '800' },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: color.surface, borderRadius: radius.card, padding: 16, gap: 4 },
  modalTitle: { color: color.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  modalRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  modalRowText: { color: color.text, fontSize: 17, fontWeight: '600' },
});
