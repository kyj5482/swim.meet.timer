import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { ChevronDown, ChevronRight } from '@/components/Icons';
import SwimmerPicker from '@/components/SwimmerPicker';
import {
  ageOf, listRecords, listSwimmers, listTargets,
  type Swimmer, type Target, type TrainingRecord,
} from '@/db';
import { eventKeyOf, eventName, fmtDateShort } from '@/features/records/csv';
import { officialTimesUrl } from '@/features/records/officialTimes';
import { eventProgress, targetDropPct, type EventProgress } from '@/features/targets/progress';
import { standardLadder, stdCourse } from '@/features/targets/standards';
import { useT } from '@/store/settings';
import { color, font, radius, stdLevelColor } from '@/theme';
import { fmtTotal } from '@splitlane/timer-core';

const STROKE_ORDER = ['free', 'back', 'breast', 'fly', 'im'];
const DAY = 86_400_000;

interface EventRow {
  key: string;
  target: TrainingRecord['target'];
  bestMs: number;
  /** PB가 기록된 날짜(Last Best Date) */
  bestDate: number;
  /** 이 종목을 마지막으로 수영한 날짜(Last Swim Date) */
  lastDate: number;
  count: number;
  progress: EventProgress | null;
  /** 사용자가 설정한 목표(있으면 다음 레벨 대신 이것 기준으로 진행률 표시) */
  goal: Target | null;
}

/**
 * 전체 종목 탭 — 선수 한 명의 모든 종목을 쇼트/롱 코스로 나눠 한눈에:
 * 베스트(깨끗한 숫자만) + 현재 달성 표준 레벨 배지 + PB가 얼마나 오래됐는지 +
 * 타겟(또는 다음 레벨)까지 필요한 단축률 %. 행 → 세부 종목.
 */
export default function EventsOverviewScreen() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [goals, setGoals] = useState<Target[]>([]);
  const [switching, setSwitching] = useState(false);
  const insets = useSafeAreaInsets();
  const t = useT();

  const loadFor = useCallback(async (sid: string) => {
    setRecords(await listRecords(sid));
    setGoals(await listTargets(sid));
  }, []);

  const reload = useCallback(() => {
    void (async () => {
      const sw = await listSwimmers();
      setSwimmers(sw);
      const sid = swimmerId && sw.some((s) => s.id === swimmerId) ? swimmerId : sw[0]?.id ?? null;
      setSwimmerId(sid);
      if (sid) await loadFor(sid);
      else { setRecords([]); setGoals([]); }
    })();
  }, [swimmerId, loadFor]);
  useFocusEffect(reload);

  const swimmerIdx = Math.max(0, swimmers.findIndex((s) => s.id === swimmerId));
  const swimmer = swimmers.find((s) => s.id === swimmerId);

  const sections = useMemo(() => {
    if (!swimmer) return [];
    const gender = swimmer.gender === 'M' ? 'M' : 'F';
    const age = ageOf(swimmer);
    const goalByEvent = new Map(goals.map((g) => [g.eventKey, g]));
    const map = new Map<string, EventRow>();
    for (const r of records) {
      if (r.status !== 'finished') continue;
      const k = eventKeyOf(r.target);
      const cur = map.get(k);
      if (!cur) {
        map.set(k, {
          key: k, target: r.target, bestMs: r.totalMs, bestDate: r.date, lastDate: r.date,
          count: 1, progress: null, goal: goalByEvent.get(k) ?? null,
        });
      } else {
        if (r.totalMs < cur.bestMs) { cur.bestMs = r.totalMs; cur.bestDate = r.date; }
        cur.lastDate = Math.max(cur.lastDate, r.date);
        cur.count++;
      }
    }
    const rows = [...map.values()];
    for (const row of rows) {
      const ladder = swimmer.gender
        ? standardLadder(stdCourse(row.target.course), gender, age, row.target.stroke, row.target.distance)
        : null;
      row.progress = ladder ? eventProgress(row.bestMs, ladder) : null;
    }
    rows.sort(
      (a, b) =>
        STROKE_ORDER.indexOf(a.target.stroke) - STROKE_ORDER.indexOf(b.target.stroke)
        || a.target.distance - b.target.distance
        || a.target.course.localeCompare(b.target.course),
    );
    // 쇼트(25y·25m) / 롱(50m) 코스 섹션 — myswimio Best Times와 동일 구분
    const short = rows.filter((r) => r.target.course !== '50m');
    const long = rows.filter((r) => r.target.course === '50m');
    return [
      ...(short.length ? [{ title: t.ovShortCourse, data: short }] : []),
      ...(long.length ? [{ title: t.ovLongCourse, data: long }] : []),
    ];
  }, [records, goals, swimmer, t]);

  function metaLine(s: Swimmer): string {
    const age = ageOf(s);
    return [age != null ? t.yo(age) : null, s.group ?? null].filter(Boolean).join(' · ') || t.noGroup;
  }

  /** 진행률 문구: 설정한 목표가 있으면 목표 기준, 없으면 다음 표준 레벨 기준. */
  function progressText(row: EventRow): { text: string | null; goalSet: boolean } {
    if (row.goal) {
      const pct = targetDropPct(row.bestMs, row.goal.targetMs);
      return {
        text: pct == null ? t.ovTgDone(row.goal.label) : t.ovTgDrop(row.goal.label, pct),
        goalSet: true,
      };
    }
    const p = row.progress;
    if (p == null) return { text: null, goalSet: false };
    if (p.next == null) return { text: t.ovTopLevel, goalSet: false };
    return { text: t.ovDrop(p.next.level, p.dropPct ?? 0), goalSet: false };
  }

  const openDetail = useCallback((row: EventRow) => {
    router.navigate({
      pathname: '/(tabs)/records',
      params: { event: row.key, swimmer: swimmerId ?? '' },
    });
  }, [swimmerId]);

  if (swimmers.length === 0) {
    return (
      <View style={[styles.emptyScreen, { paddingTop: insets.top }]}>
        <Text style={styles.emptyIcon}>🏊</Text>
        <Text style={styles.emptyText}>{t.noSwimmers}</Text>
        <Text style={styles.emptySub}>{t.noSwimmersSub}</Text>
        <Pressable style={styles.manageBtn} onPress={() => router.push('/athletes')}>
          <Text style={styles.manageBtnText}>{t.manageAthletes}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
      {/* 선수 헤더 + Switch */}
      <Pressable style={styles.recHeader} onPress={() => setSwitching(true)}>
        <Avatar name={swimmer?.name ?? '?'} index={swimmerIdx} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.recName}>{swimmer?.name}</Text>
          <Text style={styles.recMeta}>{swimmer ? metaLine(swimmer) : ''}</Text>
          {swimmer?.usaId && (
            <Pressable hitSlop={6} onPress={() => void Linking.openURL(officialTimesUrl(swimmer.usaId!))}>
              <Text style={styles.official}>{`${t.officialTimes} ↗`}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.switchWrap}>
          <Text style={styles.switchText}>{t.switchLbl}</Text>
          <ChevronDown color={color.accent} size={16} />
        </View>
      </Pressable>

      <SectionList
        sections={sections}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>{t.ovEmpty}</Text>
            <Text style={styles.emptySub}>{t.ovEmptySub}</Text>
          </View>
        }
        ListFooterComponent={
          swimmer && !swimmer.gender && sections.length > 0 ? (
            <Text style={styles.noStdHint}>{t.ovNoStdHint}</Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionLine} />
          </View>
        )}
        renderItem={({ item }) => {
          const p = item.progress;
          const lvColor = p?.reached ? stdLevelColor(p.reached.level) : color.line;
          const pg = progressText(item);
          const daysAgo = Math.max(0, Math.floor((Date.now() - item.bestDate) / DAY));
          return (
            <Pressable style={styles.row} onPress={() => openDetail(item)}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.nameRow}>
                  {/* "50 Yard Free" / "50 Meter Free" — 코스 단위 포함 이름 */}
                  <Text style={styles.eventName}>{eventName(item.target)}</Text>
                  {/* 현재 달성 표준 레벨 */}
                  <View style={[styles.levelBadge, { borderColor: lvColor }]}>
                    <Text style={[styles.levelText, { color: p?.reached ? lvColor : color.textMuted }]}>
                      {p?.reached ? p.reached.level : '—'}
                    </Text>
                  </View>
                </View>
                {/* PB가 깨진 지 얼마나 지났는지 — 종목별 훈련 분석 신호 */}
                <Text style={styles.dates} numberOfLines={1}>
                  {`${t.ovPbAgo(daysAgo)} · ${t.ovLastAt(fmtDateShort(item.lastDate))}`}
                </Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.best}>{fmtTotal(item.bestMs)}</Text>
                {pg.text != null && (
                  <Text
                    style={[styles.nextText, pg.goalSet && styles.goalText]}
                    numberOfLines={1}>
                    {pg.text}
                  </Text>
                )}
              </View>
              <ChevronRight color={color.textMuted} size={18} />
            </Pressable>
          );
        }}
      />

      {/* 선수 전환 모달 — 세부 종목 탭과 동일 화면(선수 관리 버튼 포함) */}
      <SwimmerPicker
        visible={switching}
        swimmers={swimmers}
        currentId={swimmerId}
        onPick={(sid) => { setSwimmerId(sid); setSwitching(false); void loadFor(sid); }}
        onClose={() => setSwitching(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  emptyScreen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyIcon: { fontSize: 40, opacity: 0.7 },
  emptyText: { color: color.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: color.textMuted, fontSize: 13, textAlign: 'center' },
  emptyBlock: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  manageBtn: {
    marginTop: 10, height: 44, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: color.accent, alignItems: 'center', justifyContent: 'center',
  },
  manageBtnText: { color: color.accent, fontSize: 14, fontWeight: '700' },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  recName: { color: color.text, fontSize: 20, fontWeight: '700' },
  recMeta: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  official: { color: color.accent, fontSize: 12, fontWeight: '600', marginTop: 3 },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  switchText: { color: color.accent, fontSize: 13, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  sectionTitle: { color: color.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: 1, backgroundColor: color.line },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 72,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventName: { color: color.text, fontSize: 16, fontWeight: '800' },
  dates: { color: color.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  rightCol: { alignItems: 'flex-end', gap: 3, maxWidth: 150 },
  best: {
    color: color.text, fontSize: 19, fontWeight: '700',
    fontFamily: font.mono, fontVariant: ['tabular-nums'],
  },
  levelBadge: {
    borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1,
    backgroundColor: color.surface2,
  },
  levelText: { fontSize: 11, fontWeight: '800' },
  nextText: { color: color.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  goalText: { color: color.accent, fontWeight: '700' },
  noStdHint: { color: color.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17 },
});
