import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { color, font, radius, touch } from '@/theme';
import {
  COURSES, STROKES, courseUnit, distanceOptions, segmentCount, splitOptions, type TimerConfig,
} from './config';

const STROKE_LABEL: Record<string, string> = {
  free: 'Freestyle', back: 'Backstroke', breast: 'Breaststroke', fly: 'Butterfly', im: 'IM',
};
const COURSE_LABEL: Record<string, string> = { '25m': '25 Meter', '25y': '25 Yard', '50m': '50 Meter' };

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
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
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
    if (!distanceOptions(next.course).includes(next.distance)) next.distance = 100;
    const opts = splitOptions(next.course, next.distance);
    if (!opts.includes(next.splitInterval)) next.splitInterval = opts[0]!;
    onChange(next);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 코스는 자주 안 바뀌므로 상단 요약 행 (PWA .setrow) */}
        <View style={styles.setrow}>
          <Text style={styles.setrowKey}>Course</Text>
          <Text style={styles.setrowVal}>{COURSE_LABEL[config.course]}</Text>
        </View>
        <PillRow label="" options={COURSES} value={config.course} format={(c) => COURSE_LABEL[c]!.replace(' ', '')} onSelect={(v) => set('course', v)} />

        <PillRow label="Stroke" options={STROKES} value={config.stroke} format={(s) => STROKE_LABEL[s]!} onSelect={(v) => set('stroke', v)} />
        <PillRow label="Distance" options={distanceOptions(config.course)} value={config.distance} format={(d) => `${d}`} onSelect={(v) => set('distance', v)} />
        <PillRow label="Split" options={splitOptions(config.course, config.distance)} value={config.splitInterval} format={(d) => (d === config.distance ? 'once' : `${d}${unit}`)} onSelect={(v) => set('splitInterval', v)} />

        {segs != null ? (
          <Text style={styles.segInfo}>
            <Text style={styles.segInfoStrong}>{segs}</Text>
            {segs === 1 ? ` split · ${config.distance} ${unit} at once` : ` segments · LAP every ${config.splitInterval} ${unit}`}
          </Text>
        ) : (
          <Text style={styles.segWarn}>{`${config.distance} doesn't fit in a ${config.course} pool`}</Text>
        )}

        {/* 인원 스테퍼 (PWA .stepper) */}
        <View style={styles.stepper}>
          <View>
            <Text style={styles.stepperLabel}>Swimmers</Text>
            <Text style={styles.stepperSub}>Time first, assign after</Text>
          </View>
          <View style={styles.stepperCtrl}>
            <Pressable style={styles.stepBtn} onPress={() => set('slotCount', Math.max(1, config.slotCount - 1))}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepNum}>{config.slotCount}</Text>
            <Pressable style={styles.stepBtn} onPress={() => set('slotCount', Math.min(8, config.slotCount + 1))}>
              <Text style={styles.stepBtnText}>＋</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.stepTip}>Slots are anonymous during timing. Assign swimmers after.</Text>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.startBtn, segs == null && styles.startDisabled, pressed && styles.pressed]}
        disabled={segs == null}
        onPressIn={onStart}>
        <Text style={styles.startText}>START</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: 16, gap: 10 },
  scroll: { gap: 12, paddingBottom: 12 },
  setrow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: 12, paddingHorizontal: 14, height: 52,
  },
  setrowKey: { color: color.textMuted, fontSize: 13, width: 64 },
  setrowVal: { color: color.text, fontSize: 16, fontWeight: '700' },
  field: { gap: 8 },
  fieldLabel: { color: color.textMuted, fontSize: 13 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, minHeight: 44, justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line,
  },
  pillOn: { backgroundColor: color.accent, borderColor: color.accent },
  pillText: { color: color.text, fontSize: 15, fontWeight: '600' },
  pillTextOn: { color: color.accentInk, fontWeight: '800' },
  segInfo: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  segInfoStrong: { color: color.accent, fontWeight: '800' },
  segWarn: { color: color.warn, fontSize: 12, fontWeight: '600', marginTop: 2 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 14, marginTop: 4,
  },
  stepperLabel: { color: color.text, fontSize: 15, fontWeight: '600' },
  stepperSub: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  stepperCtrl: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: color.text, fontSize: 26, fontWeight: '700', lineHeight: 30 },
  stepNum: {
    color: color.text, fontSize: 30, minWidth: 34, textAlign: 'center',
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  stepTip: { color: color.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 2 },
  startBtn: {
    height: touch.lapButton, borderRadius: 26, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  startDisabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.98 }], backgroundColor: color.accentPress },
  startText: { color: color.accentInk, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
});
