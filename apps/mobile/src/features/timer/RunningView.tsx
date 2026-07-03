import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent,
} from 'react-native';

import { VolumeLap } from '../../../modules/volume-lap';
import { useSettings, useT } from '@/store/settings';
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
 * 모든 입력은 이벤트가 가진 timestamp — 렌더 지연과 무관한 캡처 시각.
 *
 * 동시 터치: RN 책임자(responder) 시스템은 한 번에 한 뷰만 응답해 onPressIn으로는
 * 두 레인 동시 탭이 불가능하다. 레인 행은 손가락마다 각자의 타깃 뷰로 전달되는
 * raw touch 이벤트(MultiTapPressable)로 처리 — 두 레인을 동시에 눌러도 각각
 * 자기 손가락이 닿은 시각으로 기록된다(1/100초 유지).
 */
/** 스크롤 판정 슬롭(px) — 이 이상 움직이면 탭이 아니라 스크롤. */
const TAP_SLOP = 12;
/** 같은 레인 행에 이 간격(ms) 이내 재터치는 중복(팜 터치)으로 무시. */
const DOUBLE_TAP_GUARD_MS = 250;

type MultiTapProps = React.ComponentProps<typeof Pressable> & {
  /** 손가락이 닿았던 시각(이벤트 timestamp)으로 호출. 손가락마다 1회. */
  onMultiTap: (ts: number) => void;
  tapDisabled?: boolean;
};

/**
 * 여러 손가락 동시 탭을 각각 인식하는 Pressable. 커밋 시각은 finger-down의
 * 이벤트 timestamp(정밀), 확정은 finger-up(스크롤 시작이면 move-slop 또는
 * 네이티브 touchCancel로 취소되어 오탭 방지).
 */
function MultiTapPressable({ onMultiTap, tapDisabled, ...rest }: MultiTapProps) {
  // identifier → 시작 시각/좌표. 이 행에서 시작한 손가락만 들어있다.
  const touches = useRef(new Map<string, { ts: number; x: number; y: number }>()).current;
  const lastCommitTs = useRef(-Infinity);
  return (
    <Pressable
      {...rest}
      onTouchStart={(e) => {
        for (const tc of e.nativeEvent.changedTouches) {
          touches.set(String(tc.identifier), { ts: tc.timestamp, x: tc.pageX, y: tc.pageY });
        }
      }}
      onTouchMove={(e) => {
        for (const tc of e.nativeEvent.changedTouches) {
          const d = touches.get(String(tc.identifier));
          if (d && (Math.abs(tc.pageX - d.x) > TAP_SLOP || Math.abs(tc.pageY - d.y) > TAP_SLOP)) {
            touches.delete(String(tc.identifier));
          }
        }
      }}
      onTouchCancel={(e) => {
        for (const tc of e.nativeEvent.changedTouches) touches.delete(String(tc.identifier));
      }}
      onTouchEnd={(e) => {
        for (const tc of e.nativeEvent.changedTouches) {
          const d = touches.get(String(tc.identifier));
          touches.delete(String(tc.identifier));
          if (!d || tapDisabled) continue;
          if (d.ts - lastCommitTs.current < DOUBLE_TAP_GUARD_MS) continue;
          lastCommitTs.current = d.ts;
          onMultiTap(d.ts);
        }
      }}
    />
  );
}
export default function RunningView({ engine, onFinished, onReset, onPersist, ClockSlot }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const t = useT();
  const { haptics, volumeLap } = useSettings();

  const applyCommit = useCallback(
    (r: ReturnType<TimerEngine['lap']>) => {
      if (!r) return;
      // 젖은 손 피드백 — 입력 경로와 무관(fire-and-forget)
      if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      bump();
      onPersist();
      if (r.allDone) onFinished();
    },
    [onFinished, onPersist, haptics],
  );

  // LAP 버튼: 스크롤 영역 밖이라 finger-down 즉시 커밋(즉각 피드백).
  // 여러 손가락이 한 제스처로 닿아도 1회만 — 새 손가락 배치가 곧 전체 활성
  // 터치일 때(=제스처의 첫 배치)만 커밋한다.
  const lapOnTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (e.nativeEvent.touches.length > e.nativeEvent.changedTouches.length) return;
      applyCommit(engine.lap(e.nativeEvent.timestamp));
    },
    [applyCommit, engine],
  );

  // 볼륨 키 LAP (Android, FR-T3c eyes-free): KeyEvent의 커널 캡처 시각을 그대로
  // 엔진에 주입 — 터치 timestamp와 동일한 uptimeMillis 베이스라 t0와 호환된다.
  useEffect(() => {
    if (!VolumeLap.available || !volumeLap) return;
    const sub = VolumeLap.addListener(({ eventTimeMs }) => applyCommit(engine.lap(eventTimeMs)));
    VolumeLap.setEnabled(true);
    return () => {
      VolumeLap.setEnabled(false);
      sub.remove();
    };
  }, [engine, applyCommit, volumeLap]);

  const next = engine.peekNext();
  const totalSegs = engine.segmentCount * engine.slotCount;
  const doneSegs = engine.state.reduce((a, s) => a + s.splits.length, 0);

  return (
    <View style={styles.screen}>
      {ClockSlot}
      <Text style={styles.hint}>
        {doneSegs === 0
          ? t.hintStart
          : t.hintRun(doneSegs, totalSegs, engine.state.filter((s) => s.status === 'in_progress').length)}
      </Text>

      <ScrollView style={styles.lanes} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {engine.state.map((s) => {
          const lc = laneColor(s.idx);
          const isNext = next?.idx === s.idx;
          const done = s.status !== 'in_progress';
          const last = s.splits.slice(-3);
          return (
            <MultiTapPressable
              key={s.idx}
              onMultiTap={(ts) => applyCommit(engine.tapLane(s.idx, ts))}
              tapDisabled={done}
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
                  <Text style={[styles.laneName, { color: lc }]}>{t.laneN(s.idx + 1)}</Text>
                  {isNext && (
                    <View style={[styles.nextTag, { borderColor: lc }]}>
                      <Text style={[styles.nextTagText, { color: lc }]}>{t.next}</Text>
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
                    <Text style={styles.waiting}>{t.waiting}</Text>
                  )}
                </View>
              </View>
            </MultiTapPressable>
          );
        })}
      </ScrollView>

      <View style={styles.controls}>
        <Pressable style={styles.ghostBtn} onPress={() => { engine.undo(); bump(); onPersist(); }}>
          <Text style={styles.ghostText}>{t.undo}</Text>
        </Pressable>
        <Pressable style={styles.resetBtn} onPress={onReset}>
          <Text style={styles.resetText}>{t.reset}</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.lapBtn, pressed && styles.lapPressed]}
        onTouchStart={lapOnTouchStart}>
        <Text style={styles.lapWord}>LAP</Text>
        <Text style={styles.lapNext}>{next ? t.lapNext(next.idx + 1) : t.lapDone}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14, gap: 8 },
  hint: { color: color.textMuted, fontSize: 12, textAlign: 'center' },
  lanes: { flex: 1 },
  lane: {
    flexDirection: 'row', minHeight: 76,
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
  resetBtn: {
    flex: 1, height: 46, borderRadius: radius.btn, backgroundColor: color.stop,
    alignItems: 'center', justifyContent: 'center',
  },
  resetText: { color: '#2a0a07', fontSize: 15, fontWeight: '800' },
  lapBtn: {
    height: touch.lapButton, borderRadius: 26, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  lapPressed: { transform: [{ scale: 0.98 }], backgroundColor: color.accentPress },
  lapWord: { color: color.accentInk, fontSize: 32, fontWeight: '800', letterSpacing: 1, lineHeight: 36 },
  lapNext: { color: color.accentInk, fontSize: 14, fontWeight: '700', opacity: 0.85 },
});
