import { useMemo, useReducer, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Swimmer } from '@/db';
import { color, font, initials, laneColor, radius } from '@/theme';
import {
  fmtTotal, improvement, nearestSibling, recommend, swapSwimmers,
  type CandidateStats, type SlotState,
} from '@splitlane/timer-core';

interface Props {
  slots: SlotState[];
  /** DB에서 로드된 명단·현재 종목 통계 (index.tsx가 측정 종료 시 조회) */
  swimmers: Swimmer[];
  stats: CandidateStats[];
  /** 세그먼트 칩 라벨용: 스플릿 1구간 거리와 단위 (예: 25, 'y' → 25y·50y·75y…) */
  splitInterval: number;
  unit: string;
  /** 저장은 부모가 수행(트랜잭션 + 저장취소 Alert) */
  onSave: () => void;
  onAgain: () => void;
}

/** 측정 후 배정 화면 (§3.6): 추천 → 향상/PB → 저신뢰 맞바꾸기 → 저장. */
export default function AssignView({ slots, swimmers, stats, splitInterval, unit, onSave, onAgain }: Props) {
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
      <Text style={styles.lead}>Match each slot to a swimmer. Pre-filled by pace history.</Text>

      {/* 요약 헤드라인 (PWA .summary) */}
      <View style={styles.summary}>
        <Text style={styles.sumItem}>🎉 <Text style={styles.sumNum}>{summary.improved}</Text> improved</Text>
        <Text style={styles.sumItem}>🏅 <Text style={styles.sumNum}>{summary.pb}</Text> PB</Text>
        <Text style={styles.sumItem}><Text style={styles.sumNum}>{summary.total}</Text> total</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
        {slots.map((s) => {
          const lc = laneColor(s.idx);
          const st = statsOf(s.swimmerId);
          const imp = st ? improvement(s.lastCumMs, st) : null;
          const near = s.lowConfidence ? nearestSibling(slots, s) : null;
          const who = swimmers.find((w) => w.id === s.swimmerId);
          return (
            <View key={s.idx} style={[styles.card, s.lowConfidence && styles.cardLowConf]}>
              <View style={[styles.cardBar, { backgroundColor: lc }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.slotName, { color: lc }]}>Lane {s.idx + 1}</Text>
                  {s.status === 'dnf' && <Text style={styles.dnfTag}>DNF</Text>}
                  <Text style={styles.total}>{fmtTotal(s.lastCumMs)}</Text>
                </View>

                {/* 선수 선택 (PWA .who) */}
                <Pressable style={styles.pickBtn} onPress={() => setPicking(s)}>
                  {who ? (
                    <View style={[styles.avatarSm, { backgroundColor: lc }]}>
                      <Text style={styles.avatarSmText}>{initials(who.name)}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.pickText}>{who?.name ?? 'Select swimmer'}</Text>
                  <Text style={styles.pickChev}>▾</Text>
                  {who && <View style={styles.recTag}><Text style={styles.recTagText}>Rec</Text></View>}
                </Pressable>

                {/* 향상/PB (PWA .delta) */}
                {imp && (
                  <View style={styles.delta}>
                    {imp.kind === 'first' ? (
                      <View style={styles.pbBadge}><Text style={styles.pbBadgeText}>First record</Text></View>
                    ) : (
                      <>
                        <Text style={styles.prevNow}>
                          <Text style={styles.mutedMono}>{`Prev ${st!.lastMs != null ? fmtTotal(st!.lastMs) : '—'}`}</Text>
                          {'  →  '}
                          <Text style={styles.nowVal}>{fmtTotal(s.lastCumMs)}</Text>
                        </Text>
                        <Text style={imp.kind === 'improved' ? styles.imp : styles.reg}>
                          {`${imp.kind === 'improved' ? '▼' : '▲'} ${(Math.abs(imp.deltaMs) / 1000).toFixed(2)}`}
                        </Text>
                        {imp.isPB && (
                          <View style={[styles.pbBadge, s.lowConfidence && styles.pbMuted]}>
                            <Text style={styles.pbBadgeText}>🏅 PB</Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* 구간 스플릿 그리드 (PWA .seglist) */}
                <View style={styles.segList}>
                  {s.splits.map((x, i) => (
                    <View key={i} style={styles.segChip}>
                      <Text style={styles.segChipLabel}>{`${(i + 1) * splitInterval}${unit}`}</Text>
                      <Text style={styles.segChipVal}>{(x.splitMs / 1000).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* 저신뢰 경고 + 맞바꾸기 (PWA .confbar) */}
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
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.againBtn} onPress={onAgain}>
          <Text style={styles.againText}>Time Again</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.saveBtn, pressed && styles.savePressed]} onPress={onSave}>
          <Text style={styles.saveText}>Save Records</Text>
        </Pressable>
      </View>

      <Modal visible={picking != null} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.modalBack} onPress={() => setPicking(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Swimmer</Text>
            {swimmers.map((w, wi) => {
              const isCurrent = picking?.swimmerId === w.id;
              return (
                <Pressable
                  key={w.id}
                  style={[styles.pickRow, isCurrent && styles.pickRowOn]}
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
                  <View style={[styles.avatarSm, { backgroundColor: laneColor(wi) }]}>
                    <Text style={styles.avatarSmText}>{initials(w.name)}</Text>
                  </View>
                  <Text style={styles.pickRowText}>{w.name}</Text>
                  {isCurrent && <Text style={styles.pickChk}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 8 },
  title: { color: color.text, fontSize: 20, fontWeight: '800' },
  lead: { color: color.textMuted, fontSize: 12 },
  summary: {
    flexDirection: 'row', gap: 16, alignItems: 'center',
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 12, marginTop: 4,
  },
  sumItem: { color: color.text, fontSize: 14 },
  sumNum: { color: color.accent, fontSize: 18, fontWeight: '800' },
  card: {
    flexDirection: 'row', backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.line, borderRadius: radius.card, overflow: 'hidden',
  },
  cardLowConf: { borderColor: color.warn },
  cardBar: { width: 6 },
  cardBody: { flex: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotName: { fontWeight: '800', fontSize: 15 },
  dnfTag: { color: color.warn, fontWeight: '800', fontSize: 12 },
  total: {
    marginLeft: 'auto', color: color.text, fontSize: 24,
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 44, paddingHorizontal: 12,
    backgroundColor: color.surface2, borderRadius: 12, borderWidth: 1, borderColor: color.line,
  },
  pickText: { color: color.text, fontSize: 16, fontWeight: '700' },
  pickChev: { color: color.textMuted, fontSize: 12 },
  recTag: {
    marginLeft: 'auto', borderWidth: 1, borderColor: color.accent,
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  recTagText: { color: color.accent, fontSize: 10, fontWeight: '700' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  prevNow: { fontSize: 13 },
  mutedMono: { color: color.textMuted, fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  nowVal: { color: color.text, fontSize: 15, fontWeight: '700', fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  imp: { color: color.ok, fontWeight: '700', fontSize: 13 },
  reg: { color: color.stop, fontWeight: '700', fontSize: 13 },
  pbBadge: {
    backgroundColor: color.ok, borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  pbMuted: { opacity: 0.45 },
  pbBadgeText: { color: color.okInk, fontWeight: '800', fontSize: 11 },
  segList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segChip: {
    flexGrow: 1, flexBasis: '22%', minWidth: 56,
    backgroundColor: color.surface2, borderRadius: 8, paddingVertical: 6, alignItems: 'center',
  },
  segChipLabel: { color: color.textMuted, fontSize: 9 },
  segChipVal: {
    color: color.text, fontSize: 13, marginTop: 2,
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  confBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: 'rgba(255,194,75,0.16)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  confText: { color: color.warn, fontSize: 12, fontWeight: '600', flex: 1 },
  swapBtn: {
    borderWidth: 1, borderColor: color.warn, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  swapText: { color: color.warn, fontWeight: '700', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  againBtn: {
    flex: 1, height: 52, borderRadius: radius.btn, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  againText: { color: color.text, fontSize: 15, fontWeight: '700' },
  saveBtn: {
    flex: 2, height: 52, borderRadius: radius.btn, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  savePressed: { transform: [{ scale: 0.98 }], backgroundColor: color.accentPress },
  saveText: { color: color.accentInk, fontSize: 16, fontWeight: '800' },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,10,18,0.72)', justifyContent: 'center', padding: 28 },
  modalCard: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 16, gap: 8,
  },
  modalTitle: { color: color.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  pickRowOn: { borderColor: color.accent },
  pickRowText: { color: color.text, fontSize: 15, fontWeight: '600' },
  pickChk: { marginLeft: 'auto', color: color.accent, fontWeight: '900' },
  avatarSm: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
