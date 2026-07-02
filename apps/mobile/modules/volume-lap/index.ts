import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export interface VolumeLapEvent {
  /** KeyEvent.getEventTime() — uptimeMillis, RN 터치 timestamp와 동일 베이스 */
  eventTimeMs: number;
  keyCode: number;
}

interface VolumeLapNative {
  setEnabled(enabled: boolean): void;
  addListener(eventName: 'onVolumeLap', listener: (event: VolumeLapEvent) => void): EventSubscription;
}

const native = requireOptionalNativeModule<VolumeLapNative>('VolumeLap');

/**
 * 볼륨 키 LAP (Android 전용 — iOS는 정책상 미지원, docs/08 §4).
 * 미지원 플랫폼에서는 available=false인 no-op.
 */
export const VolumeLap = {
  available: native != null,
  /** 측정 화면에서만 켠다. 켜져 있는 동안 시스템 볼륨 변경은 억제된다. */
  setEnabled(enabled: boolean): void {
    native?.setEnabled(enabled);
  },
  addListener(listener: (event: VolumeLapEvent) => void): EventSubscription {
    return native?.addListener('onVolumeLap', listener) ?? { remove() {} };
  },
};
