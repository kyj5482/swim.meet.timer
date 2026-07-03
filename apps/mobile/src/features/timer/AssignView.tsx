import { useMemo, useReducer, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Select from '@/components/Select';
import type { Swimmer } from '@/db';
import { useT } from '@/store/settings';
import { color, font, laneColor as laneCol, radius } from '@/theme';
import {
  fmtTotal, improvement, nearestSibling, recommend, swapSwimmers,
  type CandidateStats, type SlotState,
} from '@splitlane/timer-core';

interface Props {
  slots: SlotState[];
  swimmers: Swimmer[];
  stats: CandidateStats[];
  splitInterval: number;
  unit: string;
  onSave: () => void;
  onAgain: () => void;
  /** 배정 중 새 선수 추가 → id 반환(추가한 선수를 현재 슬롯에 배정) */
  onAddSwimmer: (name: string) => Promise<string>;
}

/** 측정 후 배정 화면 (§3.6): 추천 → 저신뢰 맞바꾸기 → 향상/PB → 저장. PWA 레이아웃. */
export default function AssignView({ slots, swimmers, stats, splitInterval, unit, onSave, onAgain, onAddSwimmer }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const t = useT();

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

  async function submitAdd() {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    setAddOpen(false);
    const id = await onAddSwimmer(name);
    // 방금 추가한 선수를 아직 배정 안 된 첫 슬롯에 배정
    const target = slots.find((s) => !s.swimmerId) ?? slots[0];
    if (target) target.swimmerId = id;
    bump();
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t.aTitle}</Text>
      <Text style={styles.lead}>{t.aLead}</Text>

      {/* 요약 헤드라인 (PWA .summary) */}
      <View style={styles.summary}>
        <Text style={styles.sumItem}>🎉 <Text style={styles.sumNum}>{summary.improved}</Text> {t.improvedWord}</Text>
        <Text style={styles.sumItem}>🏅 <Text style={styles.sumNum}>{summary.pb}</Text> {t.pbShort}</Text>
        <Text style={styles.sumItem}><Text style={styles.sumNum}>{summary.total}</Text> {t.totalWord}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
        {slots.map((s) => {
          const st = statsOf(s.swimmerId);
          const imp = st ? improvement(s.lastCumMs, st) : null;
          const near = s.lowConfidence ? nearestSibling(slots, s) : null;
          return (
            <View key={s.idx} style={[styles.card, s.lowConfidence && styles.cardLowConf]}>
              <View style={[styles.cardBar, { backgroundColor: laneCol(s.idx) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.slotName, { color: laneCol(s.idx) }]}>{t.laneN(s.idx + 1)}</Text>
                  {s.status === 'dnf' && <Text style={styles.dnfTag}>DNF</Text>}
                  <Text style={styles.total}>{fmtTotal(s.lastCumMs)}</Text>
                </View>

                {/* 선수 드롭다운 + Rec (PWA .who) */}
                <View style={styles.whoRow}>
                  <View style={{ flex: 1 }}>
                    <Select
                      value={s.swimmerId ?? ''}
                      options={swimmers.map((w) => ({ value: w.id, label: w.name }))}
                      onChange={(id) => {
                        const holder = slots.find((o) => o.swimmerId === id);
                        if (holder && holder !== s) holder.swimmerId = s.swimmerId;
                        s.swimmerId = id;
                        bump();
                      }}
                      renderValue={(opt) => (
                        <Text style={styles.whoName}>{opt?.label ?? t.pickTitle}</Text>
                      )}
                      title={t.pickTitle}
                    />
                  </View>
                  {s.swimmerId && <View style={styles.recTag}><Text style={styles.recTagText}>{t.rec}</Text></View>}
                </View>

                {/* 저신뢰 경고 + 맞바꾸기 (delta 위에) */}
                {near && (
                  <View style={styles.confBar}>
                    <Text style={styles.confText}>
                      {t.nearWarn(near.sibling.idx + 1, (near.gapMs / 1000).toFixed(2))}
                    </Text>
                    <Pressable style={styles.swapBtn} onPress={() => { swapSwimmers(s, near.sibling); bump(); }}>
                      <Text style={styles.swapText}>{t.swapBtn}</Text>
                    </Pressable>
                  </View>
                )}

                {/* 향상/PB (PWA .delta) */}
                {imp && (
                  <View style={styles.delta}>
                    {imp.kind === 'first' ? (
                      <View style={styles.pbBadge}><Text style={styles.pbBadgeText}>{t.firstRec}</Text></View>
                    ) : (
                      <>
                        <Text style={styles.prevNow}>
                          <Text style={styles.mutedMono}>{`${t.prev} ${st!.lastMs != null ? fmtTotal(st!.lastMs) : '—'}`}</Text>
                          {'  →  '}
                          <Text style={styles.nowVal}>{fmtTotal(s.lastCumMs)}</Text>
                        </Text>
                        <Text style={imp.kind === 'improved' ? styles.imp : styles.reg}>
                          {`${imp.kind === 'improved' ? '▼' : '▲'} ${(Math.abs(imp.deltaMs) / 1000).toFixed(2)}`}
                        </Text>
                        {imp.isPB && (
                          <View style={[styles.pbBadge, s.lowConfidence && styles.pbMuted]}>
                            <Text style={styles.pbBadgeText}>{t.pb}</Text>
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
              </View>
            </View>
          );
        })}

        {/* + Add Swimmer (PWA .addbtn) */}
        <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>{`＋ ${t.addSw}`}</Text>
        </Pressable>
      </ScrollView>

      {/* Save / Time Again 세로 스택 (PWA) */}
      <Pressable style={({ pressed }) => [styles.saveBtn, pressed && styles.savePressed]} onPress={onSave}>
        <Text style={styles.saveText}>{t.saveRec}</Text>
      </Pressable>
      <Pressable style={styles.againBtn} onPress={onAgain}>
        <Text style={styles.againText}>{t.again}</Text>
      </Pressable>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.modalBack} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t.addSw}</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder={t.namePH}
              placeholderTextColor={color.textMuted}
              autoFocus
              onSubmitEditing={submitAdd}
              returnKeyType="done"
            />
            <Pressable style={styles.modalAdd} onPress={submitAdd}>
              <Text style={styles.modalAddText}>{t.add}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
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
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whoName: { color: color.text, fontSize: 16, fontWeight: '700' },
  recTag: {
    borderWidth: 1, borderColor: color.accent,
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  recTagText: { color: color.accent, fontSize: 11, fontWeight: '700' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  prevNow: { fontSize: 13 },
  mutedMono: { color: color.textMuted, fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  nowVal: { color: color.text, fontSize: 15, fontWeight: '700', fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  imp: { color: color.ok, fontWeight: '700', fontSize: 13 },
  reg: { color: color.stop, fontWeight: '700', fontSize: 13 },
  pbBadge: { backgroundColor: color.ok, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pbMuted: { opacity: 0.45 },
  pbBadgeText: { color: color.okInk, fontWeight: '800', fontSize: 11 },
  segList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segChip: {
    flexGrow: 1, flexBasis: '22%', minWidth: 56,
    backgroundColor: color.surface2, borderRadius: 8, paddingVertical: 6, alignItems: 'center',
  },
  segChipLabel: { color: color.textMuted, fontSize: 9 },
  segChipVal: { color: color.text, fontSize: 13, marginTop: 2, fontFamily: font.mono, fontVariant: ['tabular-nums'] },
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
  addBtn: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.line, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: color.accent, fontSize: 15, fontWeight: '700' },
  saveBtn: {
    height: 56, borderRadius: radius.btn, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  savePressed: { transform: [{ scale: 0.99 }], backgroundColor: color.accentPress },
  saveText: { color: color.accentInk, fontSize: 18, fontWeight: '800' },
  againBtn: {
    height: 52, borderRadius: radius.btn, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  againText: { color: color.text, fontSize: 15, fontWeight: '700' },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,10,18,0.72)', justifyContent: 'center', padding: 28 },
  modalCard: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 16, gap: 10,
  },
  modalTitle: { color: color.text, fontSize: 17, fontWeight: '700' },
  input: {
    height: 48, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: color.surface2, color: color.text, fontSize: 16,
    borderWidth: 1, borderColor: color.line,
  },
  modalAdd: { height: 48, borderRadius: 12, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  modalAddText: { color: color.accentInk, fontSize: 16, fontWeight: '800' },
});
