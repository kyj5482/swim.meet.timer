import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import TopBar from '@/components/TopBar';
import {
  addSwimmer, deleteSession, getPref, listSwimmers, saveSession, setPref, statsForEvent, type Swimmer,
} from '@/db';
import AssignView from '@/features/timer/AssignView';
import Clock from '@/features/timer/Clock';
import RunningView from '@/features/timer/RunningView';
import SetupView from '@/features/timer/SetupView';
import {
  DEFAULT_CONFIG, clockBase, courseUnit, eventTitle, restoredClockBase, segmentCount,
  type RunningSnapshot, type TimerConfig,
} from '@/features/timer/config';
import { useSettings, useT } from '@/store/settings';
import { color } from '@/theme';
import { TimerEngine, type CandidateStats, type SlotState, type Target } from '@splitlane/timer-core';

type ViewState = 'setup' | 'running' | 'assign';

const CONFIG_PREF = 'timerConfig';
const SNAPSHOT_PREF = 'runningSnapshot';
const KEEP_AWAKE_TAG = 'timer-tab';

/** Timer 탭: 설정 → 측정 → 배정 (docs/03 §3.2 상태 기계). */
export default function TimerScreen() {
  const [view, setView] = useState<ViewState>('setup');
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [assignData, setAssignData] = useState<{ swimmers: Swimmer[]; stats: CandidateStats[] } | null>(null);
  const engineRef = useRef<TimerEngine | null>(null);
  const baseRef = useRef<ReturnType<typeof clockBase> | null>(null);
  const t = useT();
  const { course } = useSettings();

  // 코스 단위는 앱 전역 설정이 소스 — 설정에서 바뀌면 타이머 설정에 반영(PWA와 동일).
  useEffect(() => {
    setConfig((c) => (c.course === course ? c : { ...c, course }));
  }, [course]);

  // 타이머 탭이 보이는 동안 화면 꺼짐 방지 — START 대기 중 포함 (FR, PWA 동작 계승)
  useFocusEffect(
    useCallback(() => {
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }, []),
  );

  // 마지막 타이머 설정 복원(다니는 풀은 잘 안 바뀜 — FR-S1)
  useEffect(() => {
    getPref<TimerConfig>(CONFIG_PREF).then((saved) => {
      if (saved && segmentCount(saved) != null) setConfig(saved);
    });
  }, []);

  // 크래시 복구 (NFR-7): RUNNING 스냅샷이 남아 있으면 복구 제안.
  // 탭 시각 클락(uptime)은 재시작 후에도 이어지므로 이어서 측정해도 정확하다.
  useEffect(() => {
    void getPref<RunningSnapshot>(SNAPSHOT_PREF).then((snap) => {
      if (!snap) return;
      Alert.alert(t.resumeTitle, t.resumeMsg, [
        { text: t.discard, style: 'destructive', onPress: () => void setPref(SNAPSHOT_PREF, null) },
        {
          text: t.resume,
          onPress: () => {
            setConfig(snap.config);
            engineRef.current = TimerEngine.restore(snap.engine);
            baseRef.current = restoredClockBase(snap.engine.t0 ?? 0, snap);
            setView('running');
          },
        },
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSnapshot = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const elapsedMs = Math.max(0, ...engine.state.map((s) => s.lastCumMs));
    const snap: RunningSnapshot = { engine: engine.snapshot(), config, wallMs: Date.now(), elapsedMs };
    void setPref(SNAPSHOT_PREF, snap);
  }, [config]);

  const clearSnapshot = useCallback(() => {
    void setPref(SNAPSHOT_PREF, null);
  }, []);

  const changeConfig = useCallback((c: TimerConfig) => {
    setConfig(c);
    void setPref(CONFIG_PREF, c);
  }, []);

  const target: Target = {
    stroke: config.stroke, distance: config.distance,
    course: config.course, splitInterval: config.splitInterval,
  };

  const onStart = useCallback((e: GestureResponderEvent) => {
    const segs = segmentCount(config);
    if (segs == null) return;
    // START를 누른 터치의 OS 캡처 시각이 t0 — 렌더 지연과 무관 (1/100초 기준점)
    baseRef.current = clockBase(e.nativeEvent.timestamp, performance.now());
    const engine = new TimerEngine(config.slotCount, segs);
    engine.start(baseRef.current.t0);
    engineRef.current = engine;
    setView('running');
  }, [config]);

  const onFinished = useCallback(() => {
    clearSnapshot(); // 측정 종료 — 복구 스냅샷 폐기 (docs/04 §4.4)
    void (async () => {
      const swimmers = await listSwimmers();
      const stats = await statsForEvent(swimmers.map((s) => s.id), target);
      setAssignData({ swimmers, stats });
      setView('assign');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, clearSnapshot]);

  const onSave = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    void (async () => {
      const { sessionId, count } = await saveSession(engine.state, target);
      setView('setup');
      Alert.alert(t.savedToast(count), undefined, [
        { text: t.undoBtn, style: 'destructive', onPress: () => void deleteSession(sessionId) },
        { text: 'OK' },
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const title = eventTitle(config, t.strokes[config.stroke]!);

  let body: React.ReactNode;
  if (view === 'running' && engineRef.current && baseRef.current) {
    const engine = engineRef.current;
    const base = baseRef.current;
    body = (
      <RunningView
        engine={engine}
        t0={base.t0}
        toEventBase={base.toEventBase}
        onFinished={onFinished}
        onPersist={persistSnapshot}
        onReset={() =>
          Alert.alert(t.resetTitle, t.resetMsg, [
            { text: t.cancel, style: 'cancel' },
            { text: t.reset, style: 'destructive', onPress: () => { clearSnapshot(); setView('setup'); } },
          ])
        }
        ClockSlot={<Clock t0={base.t0} toEventBase={base.toEventBase} running />}
      />
    );
  } else if (view === 'assign' && engineRef.current && assignData) {
    body = (
      <AssignView
        slots={engineRef.current.state as SlotState[]}
        swimmers={assignData.swimmers}
        stats={assignData.stats}
        splitInterval={config.splitInterval}
        unit={courseUnit(config.course)}
        onAgain={() => setView('setup')}
        onSave={onSave}
        onAddSwimmer={async (name) => {
          const sw = await addSwimmer(name);
          setAssignData((d) => (d ? { ...d, swimmers: [...d.swimmers, sw] } : d));
          return sw.id;
        }}
      />
    );
  } else {
    body = <SetupView config={config} onChange={changeConfig} onStart={onStart} />;
  }

  return (
    <View style={styles.screen}>
      <TopBar title={title} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
});
