import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { color, radius, touch } from '@/theme';
import {
  COURSES, STROKES, courseUnit, distanceOptions, segmentCount, splitOptions, type TimerConfig,
} from './config';

const STROKE_LABEL: Record<string, string> = {
  free: 'Freestyle', back: 'Backstroke', breast: 'Breaststroke', fly: 'Butterfly', im: 'IM',
};

interface Props {
  config: TimerConfig;
  onChange: (c: TimerConfig) => void;
  /** START — 누른 순간의 터치 이벤트를 그대로 전달(타임스탬프가 t0). */
  onStart: (e: GestureResponderEvent) => void;
}

function PillRow<T extends string | number>({ label, options, value, format, onSelect }: {
  label: string; options: T[]; value: T; format?: (v: T) => string; onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.pills}>
        {options.map((o) => (
          <Pressable
            key={String(o)}
            onPress={() => onSelect(o)}
            style={[styles.pill, o === value && styles.pillOn]}>
            <Text style={[styles.pillText, o === value && styles.pillTextOn]}>
              {format ? format(o) : String(o)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function SetupView({ config, onChange, onStart }: Props) {
  const unit = courseUnit(config.course);
  const segs = segmentCount(config);

  function set<K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) {
    const next = { ...config, [key]: value };
    // 코스/거리 변경 시 스플릿을 유효한 값으로 재조정
    const opts = splitOptions(next.course, next.distance);
    if (!opts.includes(next.splitInterval)) next.splitInterval = opts[0]!;
    if (!distanceOptions(next.course).includes(next.distance)) next.distance = 100;
    onChange(next);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PillRow label={`Course (${unit})`} options={COURSES} value={config.course} onSelect={(v) => set('course', v)} />
        <PillRow label="Stroke" options={STROKES} value={config.stroke} format={(s) => STROKE_LABEL[s]!} onSelect={(v) => set('stroke', v)} />
        <PillRow label="Distance" options={distanceOptions(config.course)} value={config.distance} format={(d) => `${d}${unit}`} onSelect={(v) => set('distance', v)} />
        <PillRow label="Split" options={splitOptions(config.course, config.distance)} value={config.splitInterval} format={(d) => (d === config.distance ? `${d}${unit} once` : `every ${d}${unit}`)} onSelect={(v) => set('splitInterval', v)} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Swimmers</Text>
          <View style={styles.counter}>
            <Pressable style={styles.counterBtn} onPress={() => set('slotCount', Math.max(1, config.slotCount - 1))}>
              <Text style={styles.counterBtnText}>−</Text>
            </Pressable>
            <Text style={styles.counterValue}>{config.slotCount}</Text>
            <Pressable style={styles.counterBtn} onPress={() => set('slotCount', Math.min(8, config.slotCount + 1))}>
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.subtle}>Slots are anonymous during timing. Assign swimmers after.</Text>
        </View>
        {segs != null ? (
          <Text style={styles.segInfo}>{segs === 1 ? `1 split · ${config.distance}${unit} at once` : `${segs} segments · every ${config.splitInterval}${unit}`}</Text>
        ) : (
          <Text style={styles.segWarn}>{`${config.distance}${unit} doesn't fit this pool`}</Text>
        )}
      </ScrollView>
      <Pressable style={[styles.startBtn, segs == null && styles.startDisabled]} disabled={segs == null} onPressIn={onStart}>
        <Text style={styles.startText}>START</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16 },
  scroll: { gap: 20, paddingBottom: 16 },
  row: { gap: 8 },
  rowLabel: { color: color.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, minHeight: 44, justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
  },
  pillOn: { backgroundColor: color.surface2, borderColor: color.accent },
  pillText: { color: color.textMuted, fontSize: 15, fontWeight: '600' },
  pillTextOn: { color: color.text },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterBtn: {
    width: touch.min, height: touch.min, borderRadius: radius.btn,
    backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center',
  },
  counterBtnText: { color: color.text, fontSize: 28, fontWeight: '700' },
  counterValue: { color: color.text, fontSize: 32, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  subtle: { color: color.textMuted, fontSize: 12 },
  segInfo: { color: color.accent, fontSize: 14, fontWeight: '600' },
  segWarn: { color: color.warn, fontSize: 14, fontWeight: '600' },
  startBtn: {
    height: touch.lapButton, borderRadius: radius.btn, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  startDisabled: { opacity: 0.4 },
  startText: { color: '#04221d', fontSize: 26, fontWeight: '800', letterSpacing: 2 },
});
