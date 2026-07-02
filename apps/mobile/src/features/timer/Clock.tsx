import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { color } from '@/theme';
import { fmtClock } from '@splitlane/timer-core';

/**
 * 표시 전용 시계. rAF로 자기만 리렌더 — 레인 목록 등 무거운 트리와 분리(§3.1).
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

  return <Text style={styles.clock}>{fmtClock(frozenMs ?? ms)}</Text>;
}

const styles = StyleSheet.create({
  clock: {
    color: color.text, fontSize: 56, fontWeight: '800',
    fontVariant: ['tabular-nums'], textAlign: 'center',
  },
});
