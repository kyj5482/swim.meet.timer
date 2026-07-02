import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color, font } from '@/theme';
import { fmtClock } from '@splitlane/timer-core';

/**
 * 표시 전용 시계 (PWA .clock 디자인: 큰 MM:SS + 액센트색 .hh).
 * rAF로 자기만 리렌더 — 레인 목록 등 무거운 트리와 분리(§3.1).
 * 입력 정확도와 무관: 엔진 탭 시각은 터치 이벤트 타임스탬프를 그대로 쓴다.
 */
export default function Clock({ t0, toEventBase, running, frozenMs }: {
  t0: number;
  toEventBase: (perfMs: number) => number;
  running: boolean;
  /** 측정 종료 후 고정 표시할 값 */
  frozenMs?: number;
}) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      setMs(toEventBase(performance.now()) - t0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, t0, toEventBase]);

  const [main, frac] = fmtClock(frozenMs ?? ms).split('.');
  return (
    <View style={styles.wrap}>
      <Text style={styles.main}>
        {main}
        <Text style={styles.frac}>{`.${frac}`}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 4 },
  main: {
    color: color.text, fontSize: 64, fontWeight: '700', fontFamily: font.mono,
    fontVariant: ['tabular-nums'], letterSpacing: -2, lineHeight: 68,
  },
  frac: { color: color.accent, fontSize: 30, letterSpacing: 0 },
});
