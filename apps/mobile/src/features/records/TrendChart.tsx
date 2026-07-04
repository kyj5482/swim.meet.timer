import { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { CloseIcon, ExpandIcon } from '@/components/Icons';
import type { TrainingRecord } from '@/db';
import { levelLabel } from '@/features/targets/standards';
import { useT } from '@/store/settings';
import { color, stdLevelColor } from '@/theme';
import { fmtTotal, paceInsight, type LadderStep, type TrendPoint } from '@splitlane/timer-core';

import { labelIndices, labelSides, trendDomain, xScale } from './chartMath';

const H = 180;

/**
 * 종목 추세 라인 차트(단일 시리즈, 낮을수록 좋음 → 아래 = 향상).
 *
 * 기본(카드) 뷰: Y축 없이 기록선·점·시간 라벨만 — 라벨이 점과 겹치지 않게
 * 여백을 넉넉히 잡고 좌우 밸런스를 맞춘다. 헤더에는 향상 가속도
 * (Accelerating/Steady/Slowing + 주당 단축)를 보여준다.
 *
 * 확대(⤢) 뷰: 가로 전체 화면(회전) — Y축에 표준 레벨 컷 라인·밴드를 그려
 * 현재 기록이 표준 사다리 어느 구간에 있는지 보여준다(myswimio 방식).
 */
export default function TrendChart({ records, title, ladder }: {
  records: TrainingRecord[];
  title: string;
  /** 표준 사다리(확대 뷰 Y축 밴드에 사용). */
  ladder?: LadderStep[] | null;
}) {
  const [width, setWidth] = useState(0);
  const [full, setFull] = useState(false);
  const t = useT();
  if (records.length === 0) return null;

  const h = [...records].sort((a, b) => a.date - b.date);
  const points: TrendPoint[] = h.map((r) => ({ date: r.date, totalMs: r.totalMs }));

  // 페이스 요약 — 로버스트 판정(timer-core paceInsight). 정체(plateau)는
  // 계단식 향상의 정상 구간이라는 걸 문장으로 알려주고, 비현실적 기울기
  // (점이 몰려 생긴 수치)는 숫자 없이 상태만 보여준다.
  const pace = paceInsight(points);
  const paceText =
    pace.state === 'improving'
      ? pace.plausible && pace.perMonthMs != null
        ? t.paceImprovingMo((-pace.perMonthMs / 1000).toFixed(1))
        : t.paceImproving
      : pace.state === 'regressing' ? t.paceRegressing : t.pacePlateau;

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headRight}>
          <Text style={[styles.accel, pace.state === 'improving' && { color: color.ok }, pace.state === 'regressing' && { color: color.warn }]}>
            {paceText}
          </Text>
          <Pressable onPress={() => setFull(true)} hitSlop={12} style={styles.expandBtn}>
            <ExpandIcon color={color.accent} size={18} />
          </Pressable>
        </View>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <ChartBody records={h} w={width} h={H} ladder={null} showBands={false} />
        )}
      </View>

      {/* 확대: 가로 모드 전체 화면 + 표준 레벨 Y축 */}
      <Modal visible={full} animationType="fade" onRequestClose={() => setFull(false)}>
        <FullScreenChart records={h} title={t.fullChartTitle(title)} ladder={ladder} onClose={() => setFull(false)} />
      </Modal>
    </View>
  );
}

/** 확대 차트 — 화면을 90° 회전시켜 가로 모드로 사용(기기 방향 잠금과 무관). */
function FullScreenChart({ records, title, ladder, onClose }: {
  records: TrainingRecord[];
  title: string;
  ladder?: LadderStep[] | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const landW = Math.max(win.width, win.height);
  const landH = Math.min(win.width, win.height);
  // 90° 회전 상태에서는 가로(좌우) 가장자리가 기기의 상태바/홈 인디케이터와
  // 겹친다 — 제목·X 버튼이 배터리 표시를 침범하지 않게 세이프 에어리어만큼 민다.
  const padH = Math.max(insets.top, insets.bottom, 16);
  const padV = Math.max(insets.left, insets.right, 10);
  const chartW = landW - padH * 2;
  const chartH = landH - padV - 64;

  return (
    <View style={styles.fullBack}>
      <View
        style={{
          width: landW, height: landH,
          transform: win.height >= win.width ? [{ rotate: '90deg' }] : undefined,
          alignItems: 'center', justifyContent: 'center',
        }}>
        <View style={[styles.fullHead, { paddingHorizontal: padH, paddingTop: padV }]}>
          <Text style={styles.fullTitle} numberOfLines={1}>{title}</Text>
          {/* 잠깐 보는 확대 화면 — Done 대신 ✕ 로 닫는다 */}
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <CloseIcon color={color.text} size={20} />
          </Pressable>
        </View>
        <ChartBody records={records} w={chartW} h={chartH} ladder={ladder ?? null} showBands />
      </View>
    </View>
  );
}

/** 공용 차트 본체. showBands=true면 표준 레벨 컷 라인+밴드(Y축) 포함. */
function ChartBody({ records, w, h, ladder, showBands }: {
  records: TrainingRecord[];
  w: number;
  h: number;
  ladder: LadderStep[] | null;
  showBands: boolean;
}) {
  const PAD_L = showBands ? 96 : 16;
  const PAD_R = 16;
  const PAD_T = 18;
  const PAD_B = 26;

  const tots = records.map((r) => r.totalMs);
  const yMin = Math.min(...tots);
  const { lo, hi, cuts } = trendDomain(tots, showBands ? ladder : null);
  const span = hi - lo || 1;

  const W = Math.max(w, PAD_L + PAD_R + 10);
  const plotW = W - PAD_L - PAD_R;
  const plotH = h - PAD_T - PAD_B;
  // 좌우 밸런스: 시간축 자체에 12% 패딩 — 첫 점이 왼쪽 벽에서 시작하지도,
  // 오른쪽으로 쏠리지도 않는다.
  const xs = xScale(records.map((r) => r.date), 0.12);
  const X = (d: number) => PAD_L + xs(d) * plotW;
  const Y = (v: number) => PAD_T + ((hi - v) / span) * plotH; // 느림(큰 값)=위, 빠름=아래

  const pts = records.map((r) => `${X(r.date).toFixed(1)},${Y(r.totalMs).toFixed(1)}`).join(' ');
  const bestIdx = records.findIndex((r) => r.totalMs === yMin);
  const labeled = labelIndices(records.length, bestIdx);
  // 라벨은 선이 지나가지 않는 쪽(기울기 반대편)에 — 겹침 원천 차단
  const sides = labelSides(records.map((r) => r.totalMs));

  const dateLbl = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const n = records.length;
  const xLblIdx = new Set(n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1]);
  const anchorFor = (x: number): 'start' | 'middle' | 'end' =>
    x < PAD_L + 28 ? 'start' : x > W - PAD_R - 28 ? 'end' : 'middle';

  // 표준 레벨 밴드: 레벨 L 달성 구간 = L 컷 라인(위)부터 다음 빠른 컷 라인
  // (없으면 플롯 바닥)까지 — 기록점이 어느 밴드에 있는지로 현재 위치를 읽는다.
  const sortedCuts = [...cuts].sort((a, b) => a.timeMs - b.timeMs); // 빠른→느린
  const bands: { level: string; yTop: number; yBot: number }[] = [];
  if (showBands) {
    for (let i = 0; i < sortedCuts.length; i++) {
      const cut = sortedCuts[i]!;
      const faster = sortedCuts[i - 1];
      bands.push({
        level: cut.level,
        yTop: Y(cut.timeMs),
        yBot: faster ? Y(faster.timeMs) : PAD_T + plotH,
      });
    }
  }

  return (
    <Svg width={W} height={h}>
      {/* 표준 레벨 밴드 + 컷 라인 + Y축 라벨 (확대 뷰 전용) */}
      {bands.map((b) => (
        <Rect
          key={`band-${b.level}`}
          x={PAD_L} y={Math.min(b.yTop, b.yBot)}
          width={plotW} height={Math.abs(b.yBot - b.yTop)}
          fill={stdLevelColor(b.level)} opacity={0.07}
        />
      ))}
      {showBands && sortedCuts.map((c) => {
        const y = Y(c.timeMs);
        const isNext = c.timeMs < yMin && !sortedCuts.some((o) => o.timeMs < yMin && o.timeMs > c.timeMs);
        const lc = stdLevelColor(c.level);
        return (
          <G key={c.level}>
            <Line
              x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke={lc} strokeDasharray={isNext ? '5 3' : '2 4'}
              strokeWidth={isNext ? 1.4 : 1} opacity={isNext ? 0.9 : 0.55}
            />
            <SvgText x={PAD_L - 8} y={y - 2} fill={lc} fontSize={10} fontWeight="700" textAnchor="end">
              {levelLabel(c.level)}
            </SvgText>
            <SvgText x={PAD_L - 8} y={y + 10} fill={color.textMuted} fontSize={9} textAnchor="end">
              {fmtTotal(c.timeMs)}
            </SvgText>
          </G>
        );
      })}

      {/* 추세선 + 점 */}
      {records.length >= 2 && <Polyline points={pts} fill="none" stroke={color.accent} strokeWidth={2.5} />}
      {records.map((r, i) => (
        <Circle
          key={r.id}
          cx={X(r.date)} cy={Y(r.totalMs)}
          r={i === bestIdx ? 5 : 4}
          fill={i === bestIdx ? color.ok : color.accent}
          stroke={color.surface} strokeWidth={2}
        />
      ))}

      {/* 기록 시간 라벨 — 기울기 반대편(위/아래)에 붙여 선·점과 겹치지 않는다 */}
      {records.map((r, i) => {
        if (!labeled.has(i)) return null;
        const x = X(r.date);
        const y = sides[i] === 'above'
          ? Math.max(Y(r.totalMs) - 10, 10)
          : Math.min(Y(r.totalMs) + 18, h - PAD_B + 8);
        return (
          <SvgText
            key={`v${r.id}`}
            x={x} y={y}
            fill={i === bestIdx ? color.ok : color.textMuted}
            fontSize={10} fontWeight={i === bestIdx ? '800' : '400'}
            textAnchor={anchorFor(x)}>
            {fmtTotal(r.totalMs)}
          </SvgText>
        );
      })}

      {/* X축 날짜(점 위치에, 가장자리에서 안쪽 정렬) */}
      {records.map((r, i) => {
        if (!xLblIdx.has(i)) return null;
        const x = X(r.date);
        return (
          <SvgText key={`d${r.id}`} x={x} y={h - 4} fill={color.textMuted} fontSize={9.5} textAnchor={anchorFor(x)}>
            {dateLbl(r.date)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: 16, padding: 14, gap: 4,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title: { color: color.text, fontSize: 14, fontWeight: '700' },
  accel: { color: color.textMuted, fontSize: 11, fontVariant: ['tabular-nums'], flexShrink: 1 },
  expandBtn: { padding: 4 },
  fullBack: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  fullHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    alignSelf: 'stretch', gap: 12,
  },
  fullTitle: { color: color.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center',
  },
});
