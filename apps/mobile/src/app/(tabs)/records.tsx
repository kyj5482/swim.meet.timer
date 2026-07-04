import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoreVertical } from '@/components/Icons';
import Select from '@/components/Select';
import SwimmerHeader from '@/components/SwimmerHeader';
import SwimmerPicker from '@/components/SwimmerPicker';
import {
  ageOf, clearTarget, deleteRecord, getTarget, listRecords, listSwimmers, setTarget,
  type Swimmer, type Target, type TrainingRecord,
} from '@/db';
import CompareChart from '@/features/records/CompareChart';
import TrendChart from '@/features/records/TrendChart';
import { eventKeyOf, eventName, fmtDateTime } from '@/features/records/csv';
import { levelMilestones } from '@/features/records/milestones';
import TargetCard from '@/features/targets/TargetCard';
import { standardLadder, stdCourse } from '@/features/targets/standards';
import { useT } from '@/store/settings';
import { getSelectedSwimmerId, setSelectedSwimmerId } from '@/store/swimmerSelection';
import { color, font, radius, stdLevelColor, touch } from '@/theme';
import { fmtTotal } from '@splitlane/timer-core';

/** 세부 종목 탭: 아바타 헤더 + Switch, 이벤트 드롭다운, 추세 차트(확대 지원), 세션. */
export default function RecordsScreen() {
  const params = useLocalSearchParams<{ event?: string; swimmer?: string }>();
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 세션 선택 모드 — Compare(2개+ 비교) 또는 Delete(선택 삭제). ⋮ 메뉴로 진입.
  const [mode, setMode] = useState<'compare' | 'delete' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cmpIds, setCmpIds] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [savedTarget, setSavedTarget] = useState<Target | null>(null);
  const insets = useSafeAreaInsets();
  const t = useT();

  const loadRecords = useCallback((sid: string) => {
    void listRecords(sid).then(setRecords);
  }, []);

  const reload = useCallback(() => {
    void (async () => {
      const sw = await listSwimmers();
      setSwimmers(sw);
      // 탭 간 공유되는 선택 선수(전체 종목에서 바꾸면 여기도 반영) → 없으면 첫 선수
      const shared = await getSelectedSwimmerId();
      const sid =
        (shared && sw.some((s) => s.id === shared) ? shared : null)
        ?? (swimmerId && sw.some((s) => s.id === swimmerId) ? swimmerId : null)
        ?? sw[0]?.id ?? null;
      setSwimmerId(sid);
      setRecords(sid ? await listRecords(sid) : []);
    })();
  }, [swimmerId]);
  useFocusEffect(reload);

  // 전체 종목 탭에서 행 탭 → 해당 선수·종목으로 진입
  useEffect(() => {
    if (params.swimmer) { setSwimmerId(params.swimmer); loadRecords(params.swimmer); }
    if (params.event) setEventKey(params.event);
  }, [params.swimmer, params.event, loadRecords]);

  const swimmerIdx = Math.max(0, swimmers.findIndex((s) => s.id === swimmerId));
  const swimmer = swimmers.find((s) => s.id === swimmerId);

  // 종목 목록(거리 오름차순) + 각 종목 PB
  const events = useMemo(() => {
    const map = new Map<string, { target: TrainingRecord['target']; bestMs: number }>();
    for (const r of records) {
      const k = eventKeyOf(r.target);
      const cur = map.get(k);
      const best = r.status === 'finished' ? r.totalMs : Infinity;
      if (!cur) map.set(k, { target: r.target, bestMs: best });
      else cur.bestMs = Math.min(cur.bestMs, best);
    }
    return [...map.entries()].sort((a, b) => a[1].target.distance - b[1].target.distance);
  }, [records]);

  const activeEvent = eventKey && events.some(([k]) => k === eventKey) ? eventKey : events[0]?.[0] ?? null;
  const activeTarget = events.find(([k]) => k === activeEvent)?.[1].target ?? null;
  const filtered = useMemo(
    () =>
      records
        .filter((r) => activeEvent && eventKeyOf(r.target) === activeEvent)
        .sort((a, b) => b.date - a.date),
    [records, activeEvent],
  );
  const finished = filtered.filter((r) => r.status === 'finished');
  const bestMs = finished.length ? Math.min(...finished.map((r) => r.totalMs)) : null;
  const selected = filtered.filter((r) => cmpIds.has(r.id)).sort((a, b) => a.date - b.date);
  const unit = activeTarget?.course === '25y' ? 'y' : 'm';

  // 표준 사다리(확대 차트 Y축 밴드용) — 성별·나이 미입력 시 null
  const chartLadder = useMemo(() => {
    if (!swimmer?.gender || !activeTarget) return null;
    return standardLadder(
      stdCourse(activeTarget.course), swimmer.gender === 'M' ? 'M' : 'F',
      ageOf(swimmer), activeTarget.stroke, activeTarget.distance,
    );
  }, [swimmer, activeTarget]);

  // 레벨 승급 세션 배지 — 표준 레벨이 처음 올라간 세션에만 표시
  const milestones = useMemo(
    () => levelMilestones(filtered.filter((r) => r.status === 'finished'), chartLadder),
    [filtered, chartLadder],
  );

  // 현재 선수·종목의 타겟 로드
  useEffect(() => {
    if (!swimmerId || !activeEvent) { setSavedTarget(null); return; }
    let alive = true;
    void getTarget(swimmerId, activeEvent).then((tg) => { if (alive) setSavedTarget(tg); });
    return () => { alive = false; };
  }, [swimmerId, activeEvent]);

  const switchTo = useCallback((sid: string) => {
    setSwimmerId(sid); setCmpIds(new Set()); setMode(null); setExpandedId(null); setSwitching(false);
    void setSelectedSwimmerId(sid); // 전체 종목 탭에도 동일 적용
    loadRecords(sid);
  }, [loadRecords]);

  // 선택 삭제 — 확인 후 선택된 세션을 모두 제거.
  const deleteSelected = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    Alert.alert(t.delSessionsConfirm(ids.length), undefined, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delYes,
        style: 'destructive',
        onPress: () => void Promise.all(ids.map((id) => deleteRecord(id))).then(() => {
          setMode(null); setCmpIds(new Set()); reload();
        }),
      },
    ]);
  }, [reload, t]);

  // 비교 모달을 닫으면 선택 모드도 해제(선택 초기화)
  const closeCompare = useCallback(() => {
    setComparing(false);
    setMode(null);
    setCmpIds(new Set());
  }, []);

  if (swimmers.length === 0) {
    return (
      <View style={[styles.emptyScreen, { paddingTop: insets.top }]}>
        <Text style={styles.emptyIcon}>🏊</Text>
        <Text style={styles.emptyText}>{t.noSwimmers}</Text>
        <Text style={styles.emptySub}>{t.noSwimmersSub}</Text>
        <Pressable style={styles.manageBtn} onPress={() => router.push({ pathname: '/athletes', params: { from: 'records' } })}>
          <Text style={styles.manageBtnText}>{t.manageAthletes}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
      {/* 아바타 헤더 + Switch — 전체 종목 탭과 공용 컴포넌트(공인 기록 링크 포함) */}
      <SwimmerHeader swimmer={swimmer} index={swimmerIdx} onSwitch={() => setSwitching(true)} />

      {/* 이벤트 드롭다운 (PB 인라인) */}
      {events.length > 0 && activeEvent && (
        <View style={styles.eventBlock}>
          <Text style={styles.eventLabel}>{t.event}</Text>
          <Select
            value={activeEvent}
            options={events.map(([k, v]) => ({
              value: k,
              label: `${eventName(v.target)}${Number.isFinite(v.bestMs) ? `  ·  ${fmtTotal(v.bestMs)}` : ''}`,
            }))}
            onChange={setEventKey}
            title={t.event}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            {swimmer && activeTarget && activeEvent && finished.length > 0 && (
              <TargetCard
                swimmer={swimmer}
                target={activeTarget}
                eventKey={activeEvent}
                finished={finished}
                saved={savedTarget}
                onSave={(tg) => { void setTarget(tg).then(() => setSavedTarget(tg)); }}
                onRemove={() => { void clearTarget(swimmer.id, activeEvent).then(() => setSavedTarget(null)); }}
              />
            )}
            {finished.length >= 2 && activeTarget && (
              <TrendChart
                records={finished}
                title={`${eventName(activeTarget)} ${t.trend}`}
                ladder={chartLadder}
              />
            )}
            <View style={styles.histHead}>
              <Text style={styles.histTitle}>{t.sessions}</Text>
              {mode ? (
                <Pressable onPress={() => { setMode(null); setCmpIds(new Set()); }} hitSlop={8}>
                  <Text style={styles.cmpLinkActive}>{t.cancel}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.menuBtn}>
                  <MoreVertical color={color.textMuted} size={20} />
                </Pressable>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptySub}>{t.noRecords}</Text>}
        renderItem={({ item, index }) => {
          const picked = cmpIds.has(item.id);
          const expanded = expandedId === item.id;
          const isPB = bestMs != null && item.status === 'finished' && item.totalMs === bestMs;
          // 직전(더 오래된) 같은 종목 세션 대비 증감 — "잘 가고 있는지" 즉시 표시.
          const prev = filtered[index + 1];
          const deltaMs = prev && item.status === 'finished' && prev.status === 'finished'
            ? item.totalMs - prev.totalMs : null;
          // 이 세션에서 표준 레벨이 처음 올라갔으면 배지 표시 — PB·초단축과 같은 줄에 인라인.
          const milestone = milestones.get(item.id) ?? null;
          const selecting = mode != null;
          return (
            <View>
              <Pressable
                onPress={() => {
                  if (selecting) {
                    const next = new Set(cmpIds);
                    if (picked) next.delete(item.id); else next.add(item.id);
                    setCmpIds(next);
                  } else {
                    setExpandedId(expanded ? null : item.id);
                  }
                }}
                style={[styles.row, picked && styles.rowPicked, expanded && styles.rowOpen]}>
                {selecting && (
                  <View style={[styles.check, picked && styles.checkOn]}>
                    {picked && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                )}
                {/* 기록 날짜·시각 — 한 줄 표기 */}
                <Text style={styles.rowDate} numberOfLines={1}>{fmtDateTime(item.date)}</Text>
                <View style={{ flex: 1 }} />
                {deltaMs != null && deltaMs !== 0 && (
                  <Text style={deltaMs < 0 ? styles.deltaDown : styles.deltaUp}>
                    {`${deltaMs < 0 ? '▼' : '▲'}${(Math.abs(deltaMs) / 1000).toFixed(2)}`}
                  </Text>
                )}
                {isPB && <View style={styles.pbBadge}><Text style={styles.pbBadgeText}>{t.pbShort}</Text></View>}
                {/* 레벨 승급 배지 — PB와 같은 위치(인라인). 초단축·PB·레벨이 함께 뜰 수 있다. */}
                {milestone && (
                  <View style={[styles.lvBadge, { borderColor: stdLevelColor(milestone) }]}>
                    <Text style={[styles.lvBadgeText, { color: stdLevelColor(milestone) }]}>{milestone}</Text>
                  </View>
                )}
                {item.status === 'dnf' && <Text style={styles.dnf}>DNF</Text>}
                <Text style={styles.rowTotal}>{fmtTotal(item.totalMs)}</Text>
              </Pressable>

              {expanded && !selecting && (
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>{t.segSplits}</Text>
                  <View style={styles.segGrid}>
                    {item.splits.map((s, i) => (
                      <View key={i} style={styles.segChip}>
                        <Text style={styles.segChipLabel}>
                          {`${(i + 1) * item.target.splitInterval}${item.target.course === '25y' ? 'y' : 'm'}`}
                        </Text>
                        <Text style={styles.segChipVal}>{(s.splitMs / 1000).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* 선택 모드 하단 액션 — Compare(2개+) 또는 Delete(1개+) */}
      {mode === 'compare' && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.compareBtn, selected.length < 2 && styles.btnDisabled]}
            disabled={selected.length < 2}
            onPress={() => setComparing(true)}>
            <Text style={styles.compareText}>
              {selected.length < 2 ? t.selectMode : t.compareN(selected.length)}
            </Text>
          </Pressable>
        </View>
      )}
      {mode === 'delete' && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.deleteBtn, cmpIds.size < 1 && styles.btnDisabled]}
            disabled={cmpIds.size < 1}
            onPress={() => deleteSelected([...cmpIds])}>
            <Text style={styles.deleteText}>
              {cmpIds.size < 1 ? t.selectDelete : t.deleteN(cmpIds.size)}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ⋮ 메뉴 — Compare / Delete 진입 */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBack} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Pressable
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); setMode('compare'); setCmpIds(new Set()); }}>
              <Text style={styles.menuText}>{t.menuCompare}</Text>
            </Pressable>
            <View style={styles.menuSep} />
            <Pressable
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); setMode('delete'); setCmpIds(new Set()); }}>
              <Text style={[styles.menuText, styles.menuDanger]}>{t.menuDelete}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 선수 전환 모달 (Switch) — 전체 종목 탭과 동일 화면 */}
      <SwimmerPicker
        visible={switching}
        swimmers={swimmers}
        currentId={swimmerId}
        from="records"
        onPick={switchTo}
        onClose={() => setSwitching(false)}
      />

      {/* 구간 비교 모달 (차트 + 표) — 닫으면 비교 모드 자동 해제 */}
      <Modal visible={comparing} transparent animationType="fade" onRequestClose={closeCompare}>
        <Pressable style={styles.modalBack} onPress={closeCompare}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t.splitCmp}</Text>
            {activeTarget && (
              <CompareChart
                records={selected}
                splitInterval={activeTarget.splitInterval}
                unit={unit}
                axisNote={t.cmpAxisNote}
              />
            )}
            <View style={styles.cmpRow}>
              <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>{t.seg}</Text>
              {selected.map((r) => (
                <Text key={r.id} style={[styles.cmpCell, styles.cmpHead]}>
                  {new Date(r.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </Text>
              ))}
            </View>
            {Array.from({ length: Math.max(...selected.map((r) => r.splits.length), 0) }, (_, i) => {
              const vals = selected.map((r) => r.splits[i]?.splitMs ?? null);
              const rowBest = Math.min(...vals.filter((v): v is number => v != null));
              return (
                <View key={i} style={styles.cmpRow}>
                  <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>
                    {activeTarget ? `${(i + 1) * activeTarget.splitInterval}${unit}` : i + 1}
                  </Text>
                  {vals.map((v, vi) => (
                    <Text key={vi} style={[styles.cmpCell, v != null && v === rowBest && styles.cmpBest]}>
                      {v != null ? (v / 1000).toFixed(2) : '—'}
                    </Text>
                  ))}
                </View>
              );
            })}
            <View style={styles.cmpRow}>
              <Text style={[styles.cmpCell, styles.cmpHead, styles.cmpFirst]}>{t.total2}</Text>
              {selected.map((r) => (
                <Text key={r.id} style={[styles.cmpCell, styles.cmpTotal]}>{fmtTotal(r.totalMs)}</Text>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  emptyScreen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyIcon: { fontSize: 40, opacity: 0.7 },
  emptyText: { color: color.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: color.textMuted, fontSize: 13, textAlign: 'center' },
  manageBtn: {
    marginTop: 10, height: 44, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: color.accent, alignItems: 'center', justifyContent: 'center',
  },
  manageBtnText: { color: color.accent, fontSize: 14, fontWeight: '700' },
  eventBlock: { gap: 6 },
  eventLabel: { color: color.textMuted, fontSize: 12 },
  histHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2, marginTop: 2 },
  histTitle: { color: color.text, fontSize: 15, fontWeight: '700' },
  menuBtn: { padding: 4 },
  cmpLinkActive: { color: color.warn, fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touch.min + 6,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12,
  },
  rowPicked: { borderColor: color.accent },
  rowOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { borderColor: color.accent, backgroundColor: color.accent },
  checkMark: { color: color.accentInk, fontSize: 12, fontWeight: '900', lineHeight: 14 },
  rowDate: { color: color.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dnf: { color: color.warn, fontSize: 12, fontWeight: '800' },
  deltaDown: { color: color.ok, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  deltaUp: { color: color.stop, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pbBadge: { backgroundColor: color.ok, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pbBadgeText: { color: color.okInk, fontWeight: '800', fontSize: 11 },
  rowTotal: {
    color: color.text, fontSize: 20, fontWeight: '700',
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  lvBadge: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: color.surface2 },
  lvBadgeText: { fontSize: 10, fontWeight: '800' },
  detail: {
    backgroundColor: color.surface, borderWidth: 1, borderTopWidth: 0, borderColor: color.line,
    borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card,
    padding: 12, gap: 8, marginTop: -1,
  },
  detailLabel: { color: color.textMuted, fontSize: 11, fontWeight: '600' },
  segGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segChip: {
    flexGrow: 1, flexBasis: '22%', minWidth: 56,
    backgroundColor: color.surface2, borderRadius: 8, paddingVertical: 6, alignItems: 'center',
  },
  segChipLabel: { color: color.textMuted, fontSize: 9 },
  segChipVal: { color: color.text, fontSize: 13, marginTop: 2, fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 10 },
  compareBtn: {
    flex: 1, height: 48, borderRadius: 14, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  compareText: { color: color.accentInk, fontSize: 15, fontWeight: '800' },
  deleteBtn: {
    flex: 1, height: 48, borderRadius: 14, backgroundColor: color.stop,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
  // ⋮ 세션 메뉴(Compare / Delete)
  menuBack: { flex: 1, backgroundColor: 'rgba(4,12,20,0.5)', justifyContent: 'center', padding: 40 },
  menuCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: radius.card, overflow: 'hidden' },
  menuItem: { paddingVertical: 15, paddingHorizontal: 18 },
  menuText: { color: color.text, fontSize: 16, fontWeight: '600' },
  menuDanger: { color: color.stop },
  menuSep: { height: 1, backgroundColor: color.line },
  modalBack: { flex: 1, backgroundColor: 'rgba(4,12,20,0.72)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 16, gap: 8, maxHeight: '88%',
  },
  modalTitle: { color: color.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  cmpRow: { flexDirection: 'row', gap: 6, borderBottomWidth: 1, borderBottomColor: color.line, paddingVertical: 6 },
  cmpCell: {
    flex: 1, color: color.text, fontSize: 12, textAlign: 'right',
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  cmpFirst: { textAlign: 'left', fontFamily: undefined },
  cmpHead: { color: color.textMuted, fontWeight: '700' },
  cmpBest: { color: color.ok, fontWeight: '700' },
  cmpTotal: { fontWeight: '800' },
});
