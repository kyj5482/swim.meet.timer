import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import type { TrainingRecord } from '@/db';
import { color } from '@/theme';
import { fmtTotal } from '@splitlane/timer-core';

const H = 142;
const PAD_L = 46, PAD_R = 14, PAD_T = 18, PAD_B = 24;

/**
 * 종목 추세 라인 차트 — PWA renderTrend 포팅 (단일 시리즈, 낮을수록 좋음 →
 * 아래 = 향상). 점선 그리드 2줄(최저/최고), 베스트는 ok색 도트 + PB 라벨,
 * x축은 날짜. 시리즈가 1개라 범례 없음(제목이 시리즈를 명명).
 */
export default function TrendChart({ records, title, sub }: {
  records: TrainingRecord[];
  title: string;
  sub: string;
}) {
  const [width, setWidth] = useState(0);
  if (records.length === 0) return null;

  const h = [...records].sort((a, b) => a.date - b.date);
  const tots = h.map((r) => r.totalMs);
  const yMin = Math.min(...tots);
  const yMax = Math.max(...tots);
  const rng = yMax - yMin || 1;
  const m = rng * 0.18 || 400;
  const lo = yMin - m, hi = yMax + m, span = hi - lo;

  const W = Math.max(width, PAD_L + PAD_R + 10);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const X = (i: number) => (h.length < 2 ? PAD_L + plotW / 2 : PAD_L + (i * plotW) / (h.length - 1));
  const Y = (v: number) => PAD_T + ((hi - v) / span) * plotH; // 느림(큰 값)=위, 빠름=아래
  const gy1 = Y(yMax), gy2 = Y(yMin);
  const pts = h.map((r, i) => `${X(i).toFixed(1)},${Y(r.totalMs).toFixed(1)}`).join(' ');
  const bestIdx = h.findIndex((r) => r.totalMs === yMin);
  const dateLbl = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  // x 라벨은 겹치지 않게 최대 5개만
  const lblStep = Math.max(1, Math.ceil(h.length / 5));

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={W} height={H}>
            <Line x1={PAD_L} y1={gy1} x2={W - PAD_R} y2={gy1} stroke={color.line} strokeDasharray="2 3" />
            <Line x1={PAD_L} y1={gy2} x2={W - PAD_R} y2={gy2} stroke={color.line} strokeDasharray="2 3" />
            <SvgText x={PAD_L - 8} y={gy1 + 3} fill={color.textMuted} fontSize={9} textAnchor="end">
              {fmtTotal(yMax)}
            </SvgText>
            <SvgText x={PAD_L - 8} y={gy2 + 3} fill={color.ok} fontSize={9} textAnchor="end">
              {fmtTotal(yMin)}
            </SvgText>
            {h.length >= 2 && (
              <Polyline points={pts} fill="none" stroke={color.accent} strokeWidth={2.5} />
            )}
            {h.map((r, i) => (
              <Circle
                key={r.id}
                cx={X(i)}
                cy={Y(r.totalMs)}
                r={4}
                fill={i === bestIdx ? color.ok : color.accent}
                stroke={color.surface}
                strokeWidth={2}
              />
            ))}
            {h.map((r, i) =>
              i % lblStep === 0 || i === h.length - 1 ? (
                <SvgText key={`l${r.id}`} x={X(i)} y={H - 2} fill={color.textMuted} fontSize={9} textAnchor="middle">
                  {dateLbl(r.date)}
                </SvgText>
              ) : null,
            )}
            {bestIdx >= 0 && (
              <SvgText x={W - PAD_R} y={PAD_T + 9} fill={color.ok} fontSize={10.5} fontWeight="700" textAnchor="end">
                {`PB ${fmtTotal(yMin)}`}
              </SvgText>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: 16, padding: 14, gap: 4,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { color: color.text, fontSize: 14, fontWeight: '700' },
  sub: { color: color.textMuted, fontSize: 11 },
});
