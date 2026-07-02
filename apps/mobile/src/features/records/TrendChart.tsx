import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TrainingRecord } from '@/db';
import { color } from '@/theme';
import { fmtTotal } from '@splitlane/timer-core';

const H = 140;
const PAD_Y = 18;
const DOT = 10;

/**
 * 한 종목의 기록 추세 — 단일 시리즈 도트 트렌드 (낮을수록 좋음 → 아래 = 향상).
 * 막대 대신 도트: 0-기준선 없이 min~max 구간을 확대해도 정직한 형태.
 * 직접 라벨은 베스트·최신만(선택적 라벨), 텍스트는 텍스트 토큰만 사용.
 */
export default function TrendChart({ records }: { records: TrainingRecord[] }) {
  const [width, setWidth] = useState(0);
  if (records.length < 2) return null;

  const sorted = [...records].sort((a, b) => a.date - b.date);
  const times = sorted.map((r) => r.totalMs);
  const best = Math.min(...times);
  const worst = Math.max(...times);
  const span = Math.max(worst - best, 500); // 전부 동일해도 퍼지지 않게 최소 스팬
  const innerH = H - PAD_Y * 2;
  const y = (ms: number) => PAD_Y + ((ms - best) / span) * innerH;
  const x = (i: number) => (width <= DOT ? 0 : (i / (sorted.length - 1)) * (width - DOT));
  const lastIdx = sorted.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.grid, { top: PAD_Y - 1 }]} />
        <View style={[styles.grid, { top: H - PAD_Y - 1 }]} />
        {width > 0 && sorted.map((r, i) => {
          const isBest = r.totalMs === best;
          const isLast = i === lastIdx;
          return (
            <View key={r.id}>
              <View
                style={[
                  styles.dot,
                  { left: x(i), top: y(r.totalMs) - DOT / 2 },
                  isBest && styles.dotBest,
                ]}
              />
              {(isBest || isLast) && (
                <Text
                  style={[styles.dotLabel, { left: Math.min(Math.max(x(i) - 24, 0), width - 60), top: y(r.totalMs) + DOT }]}
                  numberOfLines={1}>
                  {isBest ? `🏅 ${fmtTotal(r.totalMs)}` : fmtTotal(r.totalMs)}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{`best ${fmtTotal(best)}`}</Text>
        <Text style={styles.axisText}>{`${sorted.length} sessions · lower is better`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  chart: { height: H, backgroundColor: color.surface, borderRadius: 12, overflow: 'hidden' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: color.line },
  dot: {
    position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2,
    backgroundColor: color.accent,
    // 겹침 대비 2px 서피스 링
    borderWidth: 2, borderColor: color.surface,
  },
  dotBest: { width: DOT + 4, height: DOT + 4, borderRadius: (DOT + 4) / 2, backgroundColor: color.ok },
  dotLabel: { position: 'absolute', color: color.textMuted, fontSize: 11, fontVariant: ['tabular-nums'], width: 64 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { color: color.textMuted, fontSize: 11 },
});
