import * as Haptics from 'expo-haptics';
import { useCallback, useReducer, useRef } from 'react';
import {
  Pressable, StyleSheet, Text, View, type GestureResponderEvent,
} from 'react-native';

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
 * 레인 목록은 **스크롤 없이** 화면 높이에 맞춰 행 높이를 나눈다(8레인까지).
 * 스크롤 제스처가 탭을 가로채 미입력되는 오동작을 원천 차단한다.
 *
 * 동시 터치: RN 책임자(responder) 시스템은 한 번에 한 뷰만 응답해 onPressIn으로는
 * 두 레인 동시 탭이 불가능하다. 레인 행은 손가락마다 각자의 타깃 뷰로 전달되는
 * raw touch 이벤트(MultiTapPressable)로 처리 — 두 레인을 동시에 눌러도 각각
 * 자기 손가락이 닿은 시각으로 기록된다(1/100초 유지).
 */
/** 탭 판정 슬롭(px) — 이 이상 움직이면 의도된 탭이 아니라고 본다. */
const TAP_SLOP = 16;
/** 같은 레인 행에 이 간격(ms) 이내 재터치는 중복(팜 터치)으로 무시. */
const DOUBLE_TAP_GUARD_MS = 250;

type MultiTapProps = React.ComponentProps<typeof Pressable> & {
  /** 손가락이 닿았던 시각(이벤트 timestamp)으로 호출. 손가락마다 1회. */
  onMultiTap: (ts: number) => void;
  tapDisabled?: boolean;
};

/**
 * 여러 손가락 동시 탭을 각각 인식하는 Pressable. 커밋 시각은 finger-down의
 * 이벤트 timestamp(정밀). 목록이 스크롤하지 않으므로 finger-down 즉시 커밋해
 * 피드백도 즉각적이다(슬롭 취소 불필요).
 */
function MultiTapPressable({ onMultiTap, tapDisabled, ...rest }: MultiTapProps) {
  const lastCommitTs = useRef(-Infinity);
  return (
    <Pressable
      {...rest}
      onTouchStart={(e) => {
        if (tapDisabled) return;
        for (const tc of e.nativeEvent.changedTouches) {
          if (tc.timestamp - lastCommitTs.current < DOUBLE_TAP_GUARD_MS) continue;
          lastCommitTs.current = tc.timestamp;
          onMultiTap(tc.timestamp);
        }
      }}
    />
  );
}

export default function RunningView({ engine, onFinished, onReset, onPersist, ClockSlot }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const t = useT();
  const { haptics } = useSettings();

  const applyCommit = useCallback(
    (r: ReturnType<TimerEngine['lap']>) => {
      if (!r) return;
      // 젖은 손 피드백 — 짧은 탭에도 확실히 느껴지도록 Heavy 임팩트.
      // 완주(모든 슬롯 종료) 시에는 성공 노티피케이션 패턴으로 구분한다.
      if (haptics) {
        void (r.allDone
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        ).catch(() => {});
      }
      bump();
      onPersist();
      if (r.allDone) onFinished();
    },
    [onFinished, onPersist, haptics],
  );

  // LAP 버튼: finger-down 즉시 커밋(즉각 피드백). 여러 손가락이 한 제스처로
  // 닿아도 1회만 — 새 손가락 배치가 곧 전체 활성 터치일 때만 커밋한다.
  const lapOnTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (e.nativeEvent.touches.length > e.nativeEvent.changedTouches.length) return;
      applyCommit(engine.lap(e.nativeEvent.timestamp));
    },
    [applyCommit, engine],
  );

  const next = engine.peekNext();
  const totalSegs = engine.segmentCount * engine.slotCount;
  const doneSegs = engine.state.reduce((a, s) => a + s.splits.length, 0);
  const compact = engine.slotCount > 5; // 6레인 이상이면 행 내부를 압축

  return (
    <View style={styles.screen}>
      {ClockSlot}
      <Text style={styles.hint}>
        {doneSegs === 0
          ? t.hintStart
          : t.hintRun(doneSegs, totalSegs, engine.state.filter((s) => s.status === 'in_progress').length)}
      </Text>

      {/* 스크롤 없는 레인 목록 — 행 높이가 화면에 맞게 분배된다 */}
      <View style={styles.lanes}>
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
              <View style={[styles.laneBody, compact && styles.laneBodyCompact]}>
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
                  {compact && (
                    last.length > 0 && (
                      <Text style={styles.splitInline} numberOfLines={1}>
                        {fmtSplit(last[last.length - 1]!.splitMs)}
                      </Text>
                    )
                  )}
                </View>
                {!compact && (
                  <View style={styles.splitsRow}>
                    {last.length ? (
                      last.map((x, i) => (
                        <Text key={i} style={styles.splitVal}>{fmtSplit(x.splitMs)}</Text>
                      ))
                    ) : (
                      <Text style={styles.waiting}>{t.waiting}</Text>
                    )}
                  </View>
                )}
              </View>
            </MultiTapPressable>
          );
        })}
      </View>

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
  lanes: { flex: 1, gap: 6 },
  lane: {
    flexDirection: 'row', flexGrow: 1, flexShrink: 1, flexBasis: 0,
    minHeight: 44, maxHeight: 84,
    backgroundColor: color.surface, borderRadius: 14,
    borderWidth: 1, borderColor: color.line, overflow: 'hidden',
  },
  laneDone: { opacity: 0.7 },
  laneBar: { width: 6 },
  laneBody: { flex: 1, paddingVertical: 6, paddingHorizontal: 12, gap: 3, justifyContent: 'center' },
  laneBodyCompact: { paddingVertical: 2 },
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
  splitInline: { marginLeft: 6, color: color.text, fontSize: 12, fontWeight: '600', fontFamily: font.mono, fontVariant: ['tabular-nums'] },
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
  resetText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  lapBtn: {
    height: touch.lapButton, borderRadius: 26, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  lapPressed: { transform: [{ scale: 0.98 }], backgroundColor: color.accentPress },
  lapWord: { color: color.accentInk, fontSize: 32, fontWeight: '800', letterSpacing: 1, lineHeight: 36 },
  lapNext: { color: color.accentInk, fontSize: 14, fontWeight: '700', opacity: 0.85 },
});
