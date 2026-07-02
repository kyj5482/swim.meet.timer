import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import type { TrainingRecord } from '@/db';
import { color, font, laneColor } from '@/theme';

const H = 190;
const PAD_L = 40, PAD_R = 12, PAD_T = 14, PAD_B = 22;

/**
 * 세션 간 구간 스플릿 비교 라인 차트 — PWA cmpSvg 포팅.
 * x = 세그먼트(누적 거리), y = 구간 시간(초, 낮을수록 좋음).
 * ≥2 시리즈이므로 범례 필수(색+날짜). 색은 선택 순서 고정 배정(레인 팔레트).
 */
export default function CompareChart({ records, splitInterval, unit }: {
  records: TrainingRecord[];
  splitInterval: number;
  unit: string;
}) {
  const [width, setWidth] = useState(0);
  if (records.length < 2) return null;

  const maxSegs = Math.max(...records.map((r) => r.splits.length));
  const all = records.flatMap((r) => r.splits.map((s) => s.splitMs));
  const yMin = Math.min(...all);
  const yMax = Math.max(...all);
  const m = (yMax - yMin || 1000) * 0.15;
  const lo = yMin - m, hi = yMax + m, span = hi - lo;

  const W = Math.max(width, PAD_L + PAD_R + 10);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const X = (i: number) => (maxSegs < 2 ? PAD_L + plotW / 2 : PAD_L + (i * plotW) / (maxSegs - 1));
  const Y = (v: number) => PAD_T + ((hi - v) / span) * plotH;
  const secs = (ms: number) => (ms / 1000).toFixed(1);
  const dateLbl = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <View style={styles.wrap}>
      {/* 범례 (≥2 시리즈 — 색만으로 식별 금지) */}
      <View style={styles.legend}>
        {records.map((r, i) => (
          <View key={r.id} style={styles.legendItem}>
            <View style={[styles.legendChip, { backgroundColor: laneColor(i) }]} />
            <Text style={styles.legendText}>{dateLbl(r.date)}</Text>
          </View>
        ))}
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={W} height={H}>
            <Line x1={PAD_L} y1={Y(yMax)} x2={W - PAD_R} y2={Y(yMax)} stroke={color.line} strokeDasharray="2 3" />
            <Line x1={PAD_L} y1={Y(yMin)} x2={W - PAD_R} y2={Y(yMin)} stroke={color.line} strokeDasharray="2 3" />
            <SvgText x={PAD_L - 6} y={Y(yMax) + 3} fill={color.textMuted} fontSize={9} textAnchor="end">
              {secs(yMax)}
            </SvgText>
            <SvgText x={PAD_L - 6} y={Y(yMin) + 3} fill={color.ok} fontSize={9} textAnchor="end">
              {secs(yMin)}
            </SvgText>
            {Array.from({ length: maxSegs }, (_, i) => (
              <SvgText key={i} x={X(i)} y={H - 2} fill={color.textMuted} fontSize={9} textAnchor="middle">
                {`${(i + 1) * splitInterval}${unit}`}
              </SvgText>
            ))}
            {records.map((r, ri) => {
              const c = laneColor(ri);
              const pts = r.splits.map((s, i) => `${X(i).toFixed(1)},${Y(s.splitMs).toFixed(1)}`).join(' ');
              return (
                <G key={r.id}>
                  <Polyline points={pts} fill="none" stroke={c} strokeWidth={2.5} />
                  {r.splits.map((s, i) => (
                    <Circle key={i} cx={X(i)} cy={Y(s.splitMs)} r={3.5} fill={c} stroke={color.surface} strokeWidth={1.5} />
                  ))}
                </G>
              );
            })}
          </Svg>
        )}
      </View>
      <Text style={styles.axisNote}>segment split (s) · lower is better</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendChip: { width: 12, height: 3, borderRadius: 2 },
  legendText: { color: color.textMuted, fontSize: 12, fontFamily: font.mono },
  axisNote: { color: color.textMuted, fontSize: 10, textAlign: 'right' },
});
