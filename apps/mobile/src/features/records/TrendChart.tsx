import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import type { TrainingRecord } from '@/db';
import { color, stdLevelColor } from '@/theme';
import { fmtTotal, type LadderStep } from '@splitlane/timer-core';

import { labelIndices, trendDomain, xScale } from './chartMath';

const H = 190;
const PAD_L = 64, PAD_R = 14, PAD_T = 12, PAD_B = 24;

/**
 * 종목 추세 라인 차트(단일 시리즈, 낮을수록 좋음 → 아래 = 향상).
 *
 * myswimio 방식: Y축은 선수 기록이 아니라 **표준 레벨 컷타임 기준**으로 잡고
 * (chartMath.trendDomain), 도메인 안의 컷은 레벨명+실제 시간 라벨이 붙은
 * 가로선으로 그린다(다음 레벨이 항상 보임). 점 아래에는 실제 기록 시간을
 * 표시(점이 많으면 처음·베스트·마지막만). X축은 날짜 시간축 + 좌우 패딩.
 */
export default function TrendChart({ records, title, sub, ladder }: {
  records: TrainingRecord[];
  title: string;
  sub: string;
  /** 표준 사다리(있으면 Y 도메인·컷 라인에 사용). */
  ladder?: LadderStep[] | null;
}) {
  const [width, setWidth] = useState(0);
  if (records.length === 0) return null;

  const h = [...records].sort((a, b) => a.date - b.date);
  const tots = h.map((r) => r.totalMs);
  const yMin = Math.min(...tots);
  const { lo, hi, cuts } = trendDomain(tots, ladder);
  const span = hi - lo;

  const W = Math.max(width, PAD_L + PAD_R + 10);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xs = xScale(h.map((r) => r.date));
  const X = (d: number) => PAD_L + xs(d) * plotW;
  const Y = (v: number) => PAD_T + ((hi - v) / span) * plotH; // 느림(큰 값)=위, 빠름=아래

  const pts = h.map((r) => `${X(r.date).toFixed(1)},${Y(r.totalMs).toFixed(1)}`).join(' ');
  const bestIdx = h.findIndex((r) => r.totalMs === yMin);
  const labeled = labelIndices(h.length, bestIdx);

  // 다음 목표 레벨 = 베스트보다 빠른 컷 중 가장 느린 것(도메인 안에 있으면 존재)
  const nextCut = [...cuts].reverse().find((c) => c.timeMs < yMin) ?? null;

  const dateLbl = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  // X 라벨: 처음·중간·끝(겹침 방지) — 점 위치에 그대로.
  const xLblIdx = new Set(h.length <= 2 ? [0, h.length - 1] : [0, Math.floor((h.length - 1) / 2), h.length - 1]);

  // 값 라벨이 좌우로 잘리지 않게 가장자리 점은 앵커 정렬
  const anchorFor = (x: number): 'start' | 'middle' | 'end' =>
    x < PAD_L + 24 ? 'start' : x > W - PAD_R - 24 ? 'end' : 'middle';

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={W} height={H}>
            {/* 다음 목표 레벨보다 빠른 구역(목표 존)을 은은하게 칠함 */}
            {nextCut && (
              <Rect
                x={PAD_L} y={Y(nextCut.timeMs)}
                width={plotW} height={PAD_T + plotH - Y(nextCut.timeMs)}
                fill={color.ok} opacity={0.05}
              />
            )}

            {/* 표준 레벨 컷 라인 + Y축 라벨(레벨명·실제 시간) */}
            {cuts.map((c) => {
              const y = Y(c.timeMs);
              const isNext = nextCut != null && c.level === nextCut.level;
              const lc = stdLevelColor(c.level);
              return (
                <G key={c.level}>
                  <Line
                    x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                    stroke={lc} strokeDasharray={isNext ? '5 3' : '2 4'}
                    strokeWidth={isNext ? 1.4 : 1} opacity={isNext ? 0.9 : 0.55}
                  />
                  <SvgText x={PAD_L - 6} y={y - 3} fill={lc} fontSize={9} fontWeight="700" textAnchor="end">
                    {c.level}
                  </SvgText>
                  <SvgText x={PAD_L - 6} y={y + 8} fill={color.textMuted} fontSize={8.5} textAnchor="end">
                    {fmtTotal(c.timeMs)}
                  </SvgText>
                </G>
              );
            })}

            {/* 추세선 + 점 */}
            {h.length >= 2 && <Polyline points={pts} fill="none" stroke={color.accent} strokeWidth={2.5} />}
            {h.map((r, i) => (
              <Circle
                key={r.id}
                cx={X(r.date)} cy={Y(r.totalMs)}
                r={i === bestIdx ? 5 : 4}
                fill={i === bestIdx ? color.ok : color.accent}
                stroke={color.surface} strokeWidth={2}
              />
            ))}

            {/* 점 아래 실제 기록 시간(선택적 라벨 — 과밀 방지) */}
            {h.map((r, i) => {
              if (!labeled.has(i)) return null;
              const x = X(r.date);
              return (
                <SvgText
                  key={`v${r.id}`}
                  x={x} y={Math.min(Y(r.totalMs) + 16, PAD_T + plotH + 8)}
                  fill={i === bestIdx ? color.ok : color.textMuted}
                  fontSize={9.5} fontWeight={i === bestIdx ? '800' : '400'}
                  textAnchor={anchorFor(x)}>
                  {fmtTotal(r.totalMs)}
                </SvgText>
              );
            })}

            {/* X축 날짜(점 위치에, 가장자리에서 안쪽 정렬) */}
            {h.map((r, i) => {
              if (!xLblIdx.has(i)) return null;
              const x = X(r.date);
              return (
                <SvgText key={`d${r.id}`} x={x} y={H - 2} fill={color.textMuted} fontSize={9} textAnchor={anchorFor(x)}>
                  {dateLbl(r.date)}
                </SvgText>
              );
            })}
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
