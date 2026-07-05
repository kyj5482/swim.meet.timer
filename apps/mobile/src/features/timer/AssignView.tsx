import { useRouter } from 'expo-router';
import { useMemo, useReducer, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Select from '@/components/Select';
import SwimmerFormModal from '@/components/SwimmerFormModal';
import type { Swimmer } from '@/db';
import type { SwimmerFields } from '@/db/swimmers';
import { sharksEggActive } from '@/features/game/sharksEgg';
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
  /** 이스터 에그 게임에 그대로 전달되는 이벤트 설정 (docs/09 §1) */
  stroke: string;
  distance: number;
  onSave: () => void;
  onAgain: () => void;
  /** 배정 중 새 선수 추가(선수 관리와 동일 폼) → id 반환(현재 슬롯에 배정) */
  onAddSwimmer: (fields: SwimmerFields) => Promise<string>;
}

/** 측정 후 배정 화면 (§3.6): 추천 → 저신뢰 맞바꾸기 → 향상/PB → 저장. PWA 레이아웃. */
export default function AssignView({ slots, swimmers, stats, splitInterval, unit, stroke, distance, onSave, onAgain, onAddSwimmer }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [addOpen, setAddOpen] = useState(false);
  const t = useT();
  const router = useRouter();

  // 이스터 에그: 어떤 기록이든 1/100초 두 자리가 더블 숫자(.00/.11/…)면 활성화
  const sharksEgg = useMemo(() => sharksEggActive(slots.map((s) => s.lastCumMs)), [slots]);

  const statsOf = (swimmerId: string | null) =>
    swimmerId ? stats.find((c) => c.swimmerId === swimmerId) ?? null : null;

  useMemo(() => {
    recommend(slots, stats);
  }, [slots, stats]);

  async function submitAdd(fields: SwimmerFields) {
    setAddOpen(false);
    const id = await onAddSwimmer(fields);
    // 방금 추가한 선수를 아직 배정 안 된 첫 슬롯에 배정
    const target = slots.find((s) => !s.swimmerId) ?? slots[0];
    if (target) target.swimmerId = id;
    bump();
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t.aTitle}</Text>
      <Text style={styles.lead}>{t.aLead}</Text>

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
                          {/* 화살표에 명시적 색 — 부모 기본색(검정)이 어두운 배경에 묻히는 문제 */}
                          <Text style={styles.arrow}>{'  →  '}</Text>
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

        {/* 이스터 에그 (docs/09-sharks-game.md) — Add Swimmer 바로 아래 */}
        {sharksEgg && (
          <Pressable
            style={({ pressed }) => [styles.sharksBtn, pressed && styles.sharksPressed]}
            onPress={() =>
              router.push({ pathname: '/game', params: { stroke, distance: String(distance), courseUnit: unit } })
            }>
            <Text style={styles.sharksText}>{t.sharksBtn}</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Save / Time Again 세로 스택 (PWA) */}
      <Pressable style={({ pressed }) => [styles.saveBtn, pressed && styles.savePressed]} onPress={onSave}>
        <Text style={styles.saveText}>{t.saveRec}</Text>
      </Pressable>
      <Pressable style={styles.againBtn} onPress={onAgain}>
        <Text style={styles.againText}>{t.again}</Text>
      </Pressable>

      {/* 선수 추가 — 선수 관리와 동일한 폼 화면 */}
      <SwimmerFormModal
        visible={addOpen}
        swimmer={null}
        onClose={() => setAddOpen(false)}
        onSave={(fields) => void submitAdd(fields)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  title: { color: color.text, fontSize: 20, fontWeight: '800' },
  lead: { color: color.textMuted, fontSize: 12, marginBottom: 4 },
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
  arrow: { color: color.textMuted },
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
  sharksBtn: {
    height: 50, borderRadius: 12, backgroundColor: '#0b3a55',
    borderWidth: 1, borderColor: '#2e9fd8',
    alignItems: 'center', justifyContent: 'center',
  },
  sharksPressed: { transform: [{ scale: 0.98 }] },
  sharksText: { color: '#7fdcff', fontSize: 15, fontWeight: '800' },
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
});
