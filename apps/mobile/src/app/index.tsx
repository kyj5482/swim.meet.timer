import { useCallback, useRef, useState } from 'react';
import { Alert, type GestureResponderEvent } from 'react-native';

import AssignView from '@/features/timer/AssignView';
import Clock from '@/features/timer/Clock';
import RunningView from '@/features/timer/RunningView';
import SetupView from '@/features/timer/SetupView';
import { DEFAULT_CONFIG, clockBase, segmentCount, type TimerConfig } from '@/features/timer/config';
import { TimerEngine, type SlotState, type Target } from '@splitlane/timer-core';

type ViewState = 'setup' | 'running' | 'assign';

/** Timer 탭: 설정 → 측정 → 배정 (docs/03 §3.2 상태 기계). */
export default function TimerScreen() {
  const [view, setView] = useState<ViewState>('setup');
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const engineRef = useRef<TimerEngine | null>(null);
  const baseRef = useRef<ReturnType<typeof clockBase> | null>(null);

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

  const target: Target = {
    stroke: config.stroke, distance: config.distance,
    course: config.course, splitInterval: config.splitInterval,
  };

  if (view === 'running' && engineRef.current && baseRef.current) {
    const engine = engineRef.current;
    const base = baseRef.current;
    return (
      <RunningView
        engine={engine}
        t0={base.t0}
        toEventBase={base.toEventBase}
        onFinished={() => setView('assign')}
        onReset={() =>
          Alert.alert('Reset timer?', 'Current measurements will be lost.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: () => setView('setup') },
          ])
        }
        ClockSlot={
          <Clock
            t0={base.t0}
            toEventBase={base.toEventBase}
            running
          />
        }
      />
    );
  }

  if (view === 'assign' && engineRef.current) {
    return (
      <AssignView
        slots={engineRef.current.state as SlotState[]}
        target={target}
        onAgain={() => setView('setup')}
        onSaved={(count) => {
          Alert.alert(`✓ ${count} record${count === 1 ? '' : 's'} saved`);
          setView('setup');
        }}
      />
    );
  }

  return <SetupView config={config} onChange={setConfig} onStart={onStart} />;
}
