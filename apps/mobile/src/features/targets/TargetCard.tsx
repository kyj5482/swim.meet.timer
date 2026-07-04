import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import type { Swimmer, Target, TrainingRecord } from '@/db';
import { useT } from '@/store/settings';
import { color, font, radius } from '@/theme';
import {
  fmtTotal, ladderPosition, parseTime, trajectory, type TrendPoint,
} from '@splitlane/timer-core';
import {
  AGE_GROUPS, ageGroup, levelLabel, standardLadder, standardLadderForGroup, stdCourse,
  type AgeGroup, type Gender,
} from './standards';

interface Props {
  swimmer: Swimmer;
  target: TrainingRecord['target'];
  eventKey: string;
  finished: TrainingRecord[];
  saved: Target | null;
  onSave: (t: Target) => void;
  onRemove: () => void;
}

const NOW = () => Date.now();
const fmtYMD = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

export default function TargetCard({ swimmer, target, eventKey, finished, saved, onSave, onRemove }: Props) {
  const t = useT();
  const [sheet, setSheet] = useState(false);

  const bestMs = finished.length ? Math.min(...finished.map((r) => r.totalMs)) : null;
  const gender: Gender = swimmer.gender === 'M' ? 'M' : 'F';
  const age = swimmer.birthYear ? 2026 - swimmer.birthYear : null;
  const ladder = useMemo(
    () => standardLadder(stdCourse(target.course), gender, age, target.stroke, target.distance),
    [gender, age, target.stroke, target.distance, target.course],
  );
  const points: TrendPoint[] = useMemo(
    () => finished.map((r) => ({ date: r.date, totalMs: r.totalMs })),
    [finished],
  );

  if (bestMs == null) return null;

  if (!saved) {
    return (
      <>
        <Pressable style={styles.emptyCard} onPress={() => setSheet(true)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>🎯 {t.setTarget}</Text>
            <Text style={styles.emptySub}>{t.targetHint}</Text>
          </View>
          <Text style={styles.emptyPlus}>＋</Text>
        </Pressable>
        {sheet && (
          <TargetSheet
            onClose={() => setSheet(false)} swimmer={swimmer} target={target} bestMs={bestMs}
            eventKey={eventKey} onSave={(tg) => { onSave(tg); setSheet(false); }}
          />
        )}
      </>
    );
  }

  const tj = trajectory(bestMs, saved.targetMs, points, saved.targetDate, NOW());
  const pct = Math.min(100, Math.max(0, tj.achievement.percent));
  const reached = tj.achievement.reached;
  const lp = ladder ? ladderPosition(bestMs, ladder) : null;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.title}>🎯 {t.target}</Text>
          <Pressable onPress={() => setSheet(true)} hitSlop={8}>
            <Text style={styles.edit}>{t.editTarget}</Text>
          </Pressable>
        </View>

        <View style={styles.goalRow}>
          <Text style={styles.goalLabel}>{saved.label}</Text>
          <Text style={styles.goalTime}>{fmtTotal(saved.targetMs)}</Text>
          {saved.targetDate != null && <Text style={styles.goalDate}>{t.byDate(fmtYMD(saved.targetDate))}</Text>}
        </View>

        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, { width: `${pct}%`, backgroundColor: reached ? color.ok : color.accent }]} />
        </View>
        <View style={styles.gaugeLabels}>
          <Text style={styles.pct}>{tj.achievement.percent}%</Text>
          {reached ? (
            <Text style={styles.achieved}>{t.achievedTag}</Text>
          ) : (
            <Text style={styles.remaining}>{t.toGo(fmtTotal(tj.achievement.remainingMs))}</Text>
          )}
        </View>

        <View style={styles.trajRow}>
          {tj.onTrack != null && !reached && (
            <View style={[styles.chip, tj.onTrack ? styles.chipOk : styles.chipWarn]}>
              <Text style={[styles.chipText, { color: tj.onTrack ? color.okInk : color.warnInk }]}>
                {tj.onTrack ? t.onTrack : t.behind}
              </Text>
            </View>
          )}
          {!reached && (
            <Text style={styles.trajText}>
              {tj.projectedDate != null ? t.projected(fmtYMD(tj.projectedDate)) : t.noProjection}
            </Text>
          )}
          {tj.slopePerWeekMs != null && tj.slopePerWeekMs < 0 && (
            <Text style={styles.trajGood}>▼ {t.perWeek(fmtTotal(-tj.slopePerWeekMs))}</Text>
          )}
          <View style={styles.accelChip}>
            <Text style={styles.accelText}>
              {tj.accel === 'improving' ? t.accelImproving : tj.accel === 'slowing' ? t.accelSlowing : t.accelSteady}
            </Text>
          </View>
        </View>

        {lp && ladder && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ladder}>
            {[...ladder].sort((a, b) => b.timeMs - a.timeMs).map((s) => {
              const passed = bestMs <= s.timeMs;
              const isNext = lp.next?.level === s.level;
              return (
                <View key={s.level} style={[styles.rung, passed && styles.rungOn, isNext && styles.rungNext]}>
                  <Text style={[styles.rungLevel, passed && styles.rungLevelOn]}>{s.level}</Text>
                  <Text style={styles.rungTime}>{fmtTotal(s.timeMs)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {sheet && (
        <TargetSheet
          onClose={() => setSheet(false)} swimmer={swimmer} target={target} bestMs={bestMs}
          eventKey={eventKey} initial={saved}
          onSave={(tg) => { onSave(tg); setSheet(false); }}
          onRemove={() => { onRemove(); setSheet(false); }}
        />
      )}
    </>
  );
}

function TargetSheet({ onClose, swimmer, target, bestMs, eventKey, initial, onSave, onRemove }: {
  onClose: () => void;
  swimmer: Swimmer;
  target: TrainingRecord['target'];
  bestMs: number;
  eventKey: string;
  initial?: Target;
  onSave: (t: Target) => void;
  onRemove?: () => void;
}) {
  const t = useT();
  // 성별은 선수 정보에서 이미 알고 있으므로 여기서 다시 묻지 않는다 — 연령그룹만 선택.
  const gender: Gender = swimmer.gender === 'M' ? 'M' : 'F';
  const swAge = swimmer.birthYear ? new Date().getFullYear() - swimmer.birthYear : null;
  const [ag, setAg] = useState<AgeGroup>(ageGroup(swAge) ?? '11-12');
  const ladder = useMemo(
    () => standardLadderForGroup(stdCourse(target.course), gender, ag, target.stroke, target.distance),
    [gender, ag, target.stroke, target.distance, target.course],
  );
  const [mode, setMode] = useState<'level' | 'custom'>(ladder ? 'level' : 'custom');
  const [level, setLevel] = useState<string | null>(null);
  const [timeText, setTimeText] = useState(initial && !ladder ? fmtTotal(initial.targetMs) : '');
  const [date, setDate] = useState<number | null>(initial?.targetDate ?? null);
  const [showPicker, setShowPicker] = useState(false);

  function commit() {
    let targetMs: number | null = null;
    let label = t.tCustom;
    if (mode === 'level' && ladder && level) {
      targetMs = ladder.find((s) => s.level === level)?.timeMs ?? null;
      label = levelLabel(level);
    } else {
      targetMs = parseTime(timeText);
      label = t.tCustom;
    }
    if (targetMs == null) return;
    onSave({ swimmerId: swimmer.id, eventKey, targetMs, targetDate: date, label });
  }
  const canSave = mode === 'level' ? level != null : parseTime(timeText) != null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.sheetBack} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t.target}</Text>

            {/* 연령그룹 (표준 조회용) — 성별은 선수 프로필 값을 그대로 쓴다 */}
            <Text style={styles.agLabel}>{t.ageGroupLbl}</Text>
            <View style={styles.rowSeg}>
              {AGE_GROUPS.map((g) => (
                <Pressable key={g} style={[styles.miniBtn, ag === g && styles.miniOn]} onPress={() => setAg(g)}>
                  <Text style={[styles.miniText, ag === g && styles.miniTextOn]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            {/* 모드 토글 */}
            <View style={styles.seg}>
              <Pressable style={[styles.segBtn, mode === 'level' && styles.segOn]} onPress={() => setMode('level')}>
                <Text style={[styles.segText, mode === 'level' && styles.segTextOn]}>{t.tByLevel}</Text>
              </Pressable>
              <Pressable style={[styles.segBtn, mode === 'custom' && styles.segOn]} onPress={() => setMode('custom')}>
                <Text style={[styles.segText, mode === 'custom' && styles.segTextOn]}>{t.tCustom}</Text>
              </Pressable>
            </View>

            {mode === 'level' ? (
              ladder ? (
                <ScrollView style={{ maxHeight: 260 }}>
                  {[...ladder].sort((a, b) => b.timeMs - a.timeMs).map((s) => {
                    const on = level === s.level;
                    const passed = bestMs <= s.timeMs;
                    return (
                      <Pressable key={s.level} style={[styles.levelRow, on && styles.levelRowOn]} onPress={() => setLevel(s.level)}>
                        {/* 레벨명 + 컷타임을 한 덩어리로 중앙 정렬 */}
                        <View style={styles.levelCenter}>
                          <Text style={[styles.levelName, passed && { color: color.ok }]}>{levelLabel(s.level)}</Text>
                          <Text style={styles.levelTime}>{fmtTotal(s.timeMs)}</Text>
                        </View>
                        {passed && <Text style={styles.levelPassed}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.unavail}>{t.levelUnavailable}</Text>
              )
            ) : (
              <TextInput
                style={styles.input}
                value={timeText}
                onChangeText={setTimeText}
                placeholder={t.pickTime}
                placeholderTextColor={color.textMuted}
                keyboardType="numbers-and-punctuation"
                autoFocus
              />
            )}

            {/* 목표 날짜 — 캘린더 */}
            <Text style={styles.whenLabel}>{t.targetWhen}</Text>
            <View style={styles.dateRow}>
              <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
                <Text style={styles.dateText}>{date != null ? fmtYMD(date) : t.noDate}</Text>
              </Pressable>
              {date != null && (
                <Pressable style={styles.dateClear} onPress={() => setDate(null)}>
                  <Text style={styles.dateClearText}>✕</Text>
                </Pressable>
              )}
            </View>
            {showPicker && (
              <DateTimePicker
                value={date != null ? new Date(date) : new Date()}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                themeVariant="dark"
                onChange={(e, d) => {
                  if (Platform.OS !== 'ios') setShowPicker(false);
                  if (e.type === 'set' && d) setDate(d.getTime());
                }}
              />
            )}

            <Pressable style={[styles.saveBtn, !canSave && styles.disabled]} disabled={!canSave} onPress={commit}>
              <Text style={styles.saveText}>{t.save}</Text>
            </Pressable>
            {onRemove && (
              <Pressable style={styles.removeBtn} onPress={onRemove}>
                <Text style={styles.removeText}>{t.removeTarget}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.accent, borderStyle: 'dashed',
    borderRadius: 16, padding: 14,
  },
  emptyTitle: { color: color.text, fontSize: 15, fontWeight: '700' },
  emptySub: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  emptyPlus: { color: color.accent, fontSize: 26, fontWeight: '800' },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 16, padding: 14, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: color.text, fontSize: 15, fontWeight: '700' },
  edit: { color: color.accent, fontSize: 13, fontWeight: '600' },
  goalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  goalLabel: {
    color: color.accentInk, backgroundColor: color.accent, fontWeight: '800', fontSize: 12,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden',
  },
  goalTime: { color: color.text, fontSize: 22, fontWeight: '800', fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  goalDate: { color: color.textMuted, fontSize: 12, marginLeft: 'auto' },
  gaugeTrack: { height: 12, borderRadius: 6, backgroundColor: color.surface2, overflow: 'hidden' },
  gaugeFill: { height: 12, borderRadius: 6 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pct: { color: color.text, fontSize: 16, fontWeight: '800', fontFamily: font.mono },
  achieved: { color: color.ok, fontSize: 13, fontWeight: '800' },
  remaining: { color: color.textMuted, fontSize: 13, fontFamily: font.mono },
  trajRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipOk: { backgroundColor: color.ok },
  chipWarn: { backgroundColor: color.warn },
  chipText: { fontSize: 12, fontWeight: '800' },
  trajText: { color: color.textMuted, fontSize: 12 },
  trajGood: { color: color.ok, fontSize: 12, fontWeight: '700', fontFamily: font.mono },
  accelChip: { marginLeft: 'auto', backgroundColor: color.surface2, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  accelText: { color: color.text, fontSize: 11, fontWeight: '700' },
  ladder: { flexDirection: 'row', gap: 4, marginTop: 2 },
  rung: { minWidth: 56, paddingHorizontal: 6, alignItems: 'center', backgroundColor: color.surface2, borderRadius: 8, paddingVertical: 6, borderWidth: 1, borderColor: 'transparent' },
  rungOn: { backgroundColor: 'rgba(91,229,132,0.18)' },
  rungNext: { borderColor: color.accent },
  rungLevel: { color: color.textMuted, fontSize: 11, fontWeight: '800' },
  rungLevelOn: { color: color.ok },
  rungTime: { color: color.textMuted, fontSize: 9, marginTop: 1, fontFamily: font.mono },
  sheetBack: { flex: 1, backgroundColor: 'rgba(2,10,18,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: color.line, padding: 16, paddingBottom: 28, gap: 10 },
  sheetTitle: { color: color.text, fontSize: 17, fontWeight: '800' },
  agLabel: { color: color.textMuted, fontSize: 12 },
  rowSeg: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  miniBtn: { paddingHorizontal: 10, height: 32, borderRadius: 8, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  miniOn: { backgroundColor: color.accent, borderColor: color.accent },
  miniText: { color: color.text, fontSize: 12, fontWeight: '600' },
  miniTextOn: { color: color.accentInk, fontWeight: '800' },
  seg: { flexDirection: 'row', gap: 6 },
  segBtn: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.accent, borderColor: color.accent },
  segText: { color: color.text, fontSize: 14, fontWeight: '600' },
  segTextOn: { color: color.accentInk, fontWeight: '800' },
  levelRow: { flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface2, marginBottom: 6 },
  levelRowOn: { borderColor: color.accent },
  levelCenter: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10 },
  levelName: { color: color.text, fontSize: 15, fontWeight: '800' },
  levelTime: { color: color.text, fontSize: 15, fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  levelPassed: { color: color.ok, fontWeight: '900', position: 'absolute', right: 14 },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 14, backgroundColor: color.surface2, color: color.text, fontSize: 18, fontFamily: font.mono, borderWidth: 1, borderColor: color.line },
  unavail: { color: color.textMuted, fontSize: 13 },
  whenLabel: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  dateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  dateText: { color: color.text, fontSize: 15, fontWeight: '600' },
  dateClear: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  dateClearText: { color: color.textMuted, fontSize: 16 },
  saveBtn: { height: 50, borderRadius: 14, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  disabled: { opacity: 0.4 },
  saveText: { color: color.accentInk, fontSize: 16, fontWeight: '800' },
  removeBtn: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: color.stop, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: color.stop, fontSize: 14, fontWeight: '700' },
});
