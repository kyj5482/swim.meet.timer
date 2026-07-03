import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import Select from '@/components/Select';
import { useT } from '@/store/settings';
import { color, font, touch } from '@/theme';
import {
  STROKES, courseName, courseWord, distanceOptions, segmentCount, splitOptions, type TimerConfig,
} from './config';

interface Props {
  config: TimerConfig;
  onChange: (c: TimerConfig) => void;
  /** START — 누른 순간의 터치 이벤트를 그대로 전달(타임스탬프가 t0). */
  onStart: (e: GestureResponderEvent) => void;
}

export default function SetupView({ config, onChange, onStart }: Props) {
  const t = useT();
  const router = useRouter();
  const word = courseWord(config.course); // 'Yard' | 'Meter' — 전체 표기
  const segs = segmentCount(config);

  function set<K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) {
    const next = { ...config, [key]: value };
    const opts = splitOptions(next.course, next.distance);
    if (!opts.includes(next.splitInterval)) next.splitInterval = opts[0]!;
    onChange(next);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 코스: 읽기 전용 요약 행 + 설정에서 변경 (PWA .setrow) */}
        <View style={styles.setrow}>
          <Text style={styles.setrowKey}>{t.lCourse}</Text>
          <Text style={styles.setrowVal}>{courseName(config.course)}</Text>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Text style={styles.link}>{t.changeInSettings}</Text>
          </Pressable>
        </View>

        {/* Stroke / Distance / Split: 라벨 + 드롭다운 (PWA .field) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.lStroke}</Text>
          <View style={styles.control}>
            <Select
              value={config.stroke}
              options={STROKES.map((s) => ({ value: s, label: t.strokes[s]! }))}
              onChange={(v) => set('stroke', v)}
              title={t.lStroke}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.lDist}</Text>
          <View style={styles.control}>
            <Select
              value={config.distance}
              options={distanceOptions(config.course).map((d) => ({ value: d, label: `${d}` }))}
              onChange={(v) => set('distance', v)}
              title={t.lDist}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.lSplit}</Text>
          <View style={styles.control}>
            <Select
              value={config.splitInterval}
              options={splitOptions(config.course, config.distance).map((d) => ({
                value: d,
                label: d === config.distance ? t.splitOnce : t.splitEvery(d, word),
              }))}
              onChange={(v) => set('splitInterval', v)}
              title={t.lSplit}
            />
          </View>
        </View>

        {segs != null ? (
          <Text style={styles.segInfo}>
            {segs === 1 ? t.segOnce(config.distance, word) : t.segInfo(segs, config.splitInterval, word)}
          </Text>
        ) : (
          <Text style={styles.segWarn}>{t.segWarn(config.distance, courseName(config.course))}</Text>
        )}

        {/* 인원 스테퍼 (PWA .stepper) */}
        <View style={styles.stepper}>
          <View>
            <Text style={styles.stepperLabel}>{t.lSwimmers}</Text>
            <Text style={styles.stepperSub}>{t.lSwimmersSub}</Text>
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
        <Text style={styles.stepTip}>{t.steptip}</Text>
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
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 18, paddingBottom: 14, gap: 10 },
  scroll: { gap: 14, paddingTop: 4, paddingBottom: 12 },
  setrow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: 14, paddingHorizontal: 16, height: 56,
  },
  setrowKey: { color: color.textMuted, fontSize: 14 },
  setrowVal: { color: color.text, fontSize: 18, fontWeight: '700' },
  link: { color: color.accent, fontSize: 14, fontWeight: '700', marginLeft: 'auto' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldLabel: { width: 64, color: color.textMuted, fontSize: 14 },
  control: { flex: 1 },
  segInfo: { color: color.textMuted, fontSize: 13, marginTop: -2 },
  segWarn: { color: color.warn, fontSize: 13, fontWeight: '600', marginTop: -2 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: 16, padding: 16, marginTop: 2,
  },
  stepperLabel: { color: color.text, fontSize: 17, fontWeight: '700' },
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
  stepTip: { color: color.textMuted, fontSize: 12, lineHeight: 17 },
  startBtn: {
    height: touch.lapButton, borderRadius: 26, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  startDisabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.98 }], backgroundColor: color.accentPress },
  startText: { color: color.accentInk, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
});
