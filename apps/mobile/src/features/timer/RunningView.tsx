import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent,
} from 'react-native';

import { VolumeLap } from '../../../modules/volume-lap';
import { color, font, laneColor, radius, touch } from '@/theme';
import { fmtSplit, fmtTotal, type TimerEngine } from '@splitlane/timer-core';

interface Props {
  engine: TimerEngine;
  t0: number;
  toEventBase: (perfMs: number) => number;
  /** 모든 슬롯 완주 시 */
  onFinished: () => void;
  onReset: () => void;
  /** 매 탭 직후 크래시 복구 스냅샷 저장 (NFR-7) */
  onPersist: () => void;
  ClockSlot: React.ReactNode;
}

/**
 * 측정 화면. 입력 2종(§3.4):
 * - 단일 LAP 버튼 → 예측 슬롯(peekNext)
 * - 레인 행 직접 탭 → 그 슬롯(WYSIWYG, 역전에도 100%)
 * 모든 입력은 onPressIn + e.nativeEvent.timestamp — 렌더 지연과 무관한 캡처 시각.
 */
export default function RunningView({ engine, onFinished, onReset, onPersist, ClockSlot }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const applyCommit = useCallback(
    (r: ReturnType<TimerEngine['lap']>) => {
      if (!r) return;
      // 젖은 손 피드백 — 입력 경로와 무관(fire-and-forget)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      bump();
      onPersist();
      if (r.allDone) onFinished();
    },
    [onFinished, onPersist],
  );

  const commitFrom = useCallback(
    (fn: (ts: number) => ReturnType<TimerEngine['lap']>) => (e: GestureResponderEvent) =>
      applyCommit(fn(e.nativeEvent.timestamp)),
    [applyCommit],
  );

  // 볼륨 키 LAP (Android, FR-T3c eyes-free): KeyEvent의 커널 캡처 시각을 그대로
  // 엔진에 주입 — 터치 timestamp와 동일한 uptimeMillis 베이스라 t0와 호환된다.
  useEffect(() => {
    if (!VolumeLap.available) return;
    const sub = VolumeLap.addListener(({ eventTimeMs }) => applyCommit(engine.lap(eventTimeMs)));
    VolumeLap.setEnabled(true);
    return () => {
      VolumeLap.setEnabled(false);
      sub.remove();
    };
  }, [engine, applyCommit]);

  const next = engine.peekNext();
  const totalSegs = engine.segmentCount * engine.slotCount;
  const doneSegs = engine.state.reduce((a, s) => a + s.splits.length, 0);

  return (
    <View style={styles.screen}>
      {ClockSlot}
      <Text style={styles.hint}>
        {doneSegs === 0
          ? 'Tap a lane row — or press LAP for the predicted next'
          : `Lap ${doneSegs}/${totalSegs} · ${engine.state.filter((s) => s.status === 'in_progress').length} remaining`}
      </Text>

      <ScrollView style={styles.lanes} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {engine.state.map((s) => {
          const lc = laneColor(s.idx);
          const isNext = next?.idx === s.idx;
          const done = s.status !== 'in_progress';
          const last = s.splits.slice(-3);
          return (
            <Pressable
              key={s.idx}
              onPressIn={commitFrom((ts) => engine.tapLane(s.idx, ts))}
              disabled={done}
              style={({ pressed }) => [
                styles.lane,
                isNext && { borderColor: lc, borderWidth: 1.5 },
                done && styles.laneDone,
                pressed && !done && { backgroundColor: color.surface2 },
              ]}>
              <View style={[styles.laneBar, { backgroundColor: lc }]} />
              <View style={styles.laneBody}>
                <View style={styles.laneRow1}>
                  <Text style={[styles.laneName, { color: lc }]}>Lane {s.idx + 1}</Text>
                  {isNext && (
                    <View style={[styles.nextTag, { borderColor: lc }]}>
                      <Text style={[styles.nextTagText, { color: lc }]}>NEXT</Text>
                    </View>
                  )}
                  {s.status === 'finished' ? (
                    <Text style={styles.fin}>✓ {fmtTotal(s.lastCumMs)}</Text>
                  ) : s.status === 'dnf' ? (
                    <Text style={styles.dnf}>DNF</Text>
                  ) : (
                    <View style={styles.dots}>
                      {Array.from({ length: engine.segmentCount }, (_, i) => (
                        <View
                          key={i}
                          style={[styles.dot, { borderColor: lc }, i < s.nextSegmentIndex && { backgroundColor: lc }]}
                        />
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.splitsRow}>
                  {last.length ? (
                    last.map((x, i) => (
                      <Text key={i} style={styles.splitVal}>{fmtSplit(x.splitMs)}</Text>
                    ))
                  ) : (
                    <Text style={styles.waiting}>Waiting</Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.controls}>
        <Pressable style={styles.ghostBtn} onPress={() => { engine.undo(); bump(); onPersist(); }}>
          <Text style={styles.ghostText}>↶ Undo</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={onReset}>
          <Text style={styles.ghostText}>⟲ Reset</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.lapBtn, pressed && styles.lapPressed]}
        onPressIn={commitFrom((ts) => engine.lap(ts))}>
        <Text style={styles.lapWord}>LAP</Text>
        <Text style={styles.lapNext}>{next ? `Next ▸ Lane ${next.idx + 1}` : 'Done'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14, gap: 8 },
  hint: { color: color.textMuted, fontSize: 12, textAlign: 'center' },
  lanes: { flex: 1 },
  lane: {
    flexDirection: 'row', minHeight: touch.min + 8,
    backgroundColor: color.surface, borderRadius: 14,
    borderWidth: 1, borderColor: color.line, overflow: 'hidden',
  },
  laneDone: { opacity: 0.7 },
  laneBar: { width: 6 },
  laneBody: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 4, justifyContent: 'center' },
  laneRow1: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  laneName: { fontWeight: '800', fontSize: 15, minWidth: 52 },
  nextTag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  nextTagText: { fontSize: 10, fontWeight: '700' },
  fin: { marginLeft: 'auto', color: color.ok, fontWeight: '700', fontSize: 14, fontFamily: font.mono },
  dnf: { marginLeft: 'auto', color: color.warn, fontWeight: '800', fontSize: 12 },
  dots: { marginLeft: 'auto', flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  splitsRow: { flexDirection: 'row', gap: 12 },
  splitVal: { color: color.text, fontSize: 13, fontWeight: '600', fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  waiting: { color: color.textMuted, fontSize: 12.5 },
  controls: { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    flex: 1, height: 46, borderRadius: radius.btn, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostText: { color: color.text, fontSize: 15, fontWeight: '700' },
  lapBtn: {
    height: touch.lapButton, borderRadius: 26, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  lapPressed: { transform: [{ scale: 0.98 }], backgroundColor: color.accentPress },
  lapWord: { color: color.accentInk, fontSize: 32, fontWeight: '800', letterSpacing: 1, lineHeight: 36 },
  lapNext: { color: color.accentInk, fontSize: 14, fontWeight: '700', opacity: 0.85 },
});
