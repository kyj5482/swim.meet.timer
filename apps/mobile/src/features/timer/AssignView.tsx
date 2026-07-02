import { useMemo, useReducer, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Swimmer } from '@/db';
import { color, laneColor, radius } from '@/theme';
import {
  fmtSplit, fmtTotal, improvement, nearestSibling, recommend, swapSwimmers,
  type CandidateStats, type SlotState,
} from '@splitlane/timer-core';

interface Props {
  slots: SlotState[];
  /** DB에서 로드된 명단·현재 종목 통계 (index.tsx가 측정 종료 시 조회) */
  swimmers: Swimmer[];
  stats: CandidateStats[];
  /** 저장은 부모가 수행(트랜잭션 + 저장취소 Alert) */
  onSave: () => void;
  onAgain: () => void;
}

/** 측정 후 배정 화면 (§3.6): 추천 → 향상/PB → 저신뢰 맞바꾸기 → 저장. */
export default function AssignView({ slots, swimmers, stats, onSave, onAgain }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [picking, setPicking] = useState<SlotState | null>(null);

  const statsOf = (swimmerId: string | null) =>
    swimmerId ? stats.find((c) => c.swimmerId === swimmerId) ?? null : null;

  useMemo(() => {
    recommend(slots, stats);
  }, [slots, stats]);

  const summary = useMemo(() => {
    let improved = 0, pb = 0;
    for (const s of slots) {
      const st = statsOf(s.swimmerId);
      if (!st) continue;
      const imp = improvement(s.lastCumMs, st);
      if (imp.kind === 'improved') improved++;
      if (imp.isPB) pb++;
    }
    return { improved, pb, total: slots.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, stats]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Done — Assign Swimmers</Text>
      <Text style={styles.headline}>{`🎉 Improved ${summary.improved} · 🏅 PB ${summary.pb} · Total ${summary.total}`}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10 }}>
        {slots.map((s) => {
          const st = statsOf(s.swimmerId);
          const imp = st ? improvement(s.lastCumMs, st) : null;
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
                  {imp.kind !== 'first' && st?.lastMs != null && (
                    <>
                      <Text style={styles.muted}>{`Prev ${fmtTotal(st.lastMs)} → `}</Text>
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
        <Pressable style={styles.saveBtn} onPress={onSave}>
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
