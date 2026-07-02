import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent,
} from 'react-native';

import { VolumeLap } from '../../../modules/volume-lap';
import { color, laneColor, radius, touch } from '@/theme';
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
      <ScrollView style={styles.lanes} contentContainerStyle={{ gap: 8 }}>
        {engine.state.map((s) => {
          const isNext = next?.idx === s.idx;
          const last = s.splits.slice(-3);
          return (
            <Pressable
              key={s.idx}
              onPressIn={commitFrom((ts) => engine.tapLane(s.idx, ts))}
              disabled={s.status !== 'in_progress'}
              style={[styles.lane, { borderLeftColor: laneColor(s.idx) }, isNext && styles.laneNext, s.status !== 'in_progress' && styles.laneDone]}>
              <View style={styles.laneTop}>
                <Text style={styles.laneName}>Lane {s.idx + 1}</Text>
                {isNext && <Text style={styles.nextTag}>NEXT</Text>}
                {s.status === 'finished' ? (
                  <Text style={styles.fin}>Done {fmtTotal(s.lastCumMs)}</Text>
                ) : (
                  <View style={styles.dots}>
                    {Array.from({ length: engine.segmentCount }, (_, i) => (
                      <View key={i} style={[styles.dot, i < s.nextSegmentIndex && styles.dotOn]} />
                    ))}
                  </View>
                )}
              </View>
              <Text style={styles.splits}>
                {last.length ? last.map((x) => fmtSplit(x.splitMs)).join('  ') : 'Waiting'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.controls}>
        <Pressable style={styles.sideBtn} onPress={() => { engine.undo(); bump(); onPersist(); }}>
          <Text style={styles.sideBtnText}>↶ Undo</Text>
        </Pressable>
        <Pressable style={styles.sideBtn} onPress={onReset}>
          <Text style={styles.sideBtnText}>⟲ Reset</Text>
        </Pressable>
      </View>
      <Pressable style={styles.lapBtn} onPressIn={commitFrom((ts) => engine.lap(ts))}>
        <Text style={styles.lapText}>{next ? `LAP · Next ▸ Lane ${next.idx + 1}` : 'Done'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 10 },
  hint: { color: color.textMuted, fontSize: 13, textAlign: 'center' },
  lanes: { flex: 1 },
  lane: {
    minHeight: touch.min + 14, backgroundColor: color.surface, borderRadius: radius.card,
    borderLeftWidth: 6, padding: 12, gap: 4,
  },
  laneNext: { backgroundColor: color.surface2 },
  laneDone: { opacity: 0.55 },
  laneTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  laneName: { color: color.text, fontSize: 17, fontWeight: '700', flexShrink: 0 },
  nextTag: { color: color.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  fin: { color: color.ok, fontSize: 15, fontWeight: '700', marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.line },
  dotOn: { backgroundColor: color.accent },
  splits: { color: color.textMuted, fontSize: 14, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', gap: 10 },
  sideBtn: {
    flex: 1, height: 48, borderRadius: radius.btn, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  sideBtnText: { color: color.text, fontSize: 15, fontWeight: '700' },
  lapBtn: {
    height: touch.lapButton, borderRadius: radius.btn, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  lapText: { color: '#04221d', fontSize: 22, fontWeight: '800' },
});
