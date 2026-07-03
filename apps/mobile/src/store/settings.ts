import { useSyncExternalStore } from 'react';

import { getPref, setPref } from '@/db';
import { STRINGS, type Lang } from '@/i18n/strings';

export interface AppSettings {
  lang: Lang;
  haptics: boolean;
  /** Android 볼륨 키 LAP (iOS에서는 무시됨) */
  volumeLap: boolean;
  /** 다니는 풀의 코스 단위 — 앱 전역 기본값(PWA는 설정에서만 변경) */
  course: '25m' | '25y' | '50m';
  /** 백엔드 API 베이스 URL (예: http://192.168.0.5:4000/v1). 비어있으면 동기화 비활성. */
  apiBaseUrl: string;
  /** 마지막 동기화 성공 시각(epoch ms). 0이면 아직 동기화한 적 없음. */
  lastSyncAt: number;
}

const PREF_KEY = 'appSettings';
const DEFAULTS: AppSettings = {
  lang: 'en', haptics: true, volumeLap: true, course: '25y', apiBaseUrl: '', lastSyncAt: 0,
};

let state: AppSettings = DEFAULTS;
let loaded = false;
const subs = new Set<() => void>();

function notify() {
  for (const fn of subs) fn();
}

/** 앱 시작 시 1회 — prefs에서 복원. */
export async function loadSettings(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const saved = await getPref<Partial<AppSettings>>(PREF_KEY);
  if (saved) {
    state = { ...DEFAULTS, ...saved };
    notify();
  }
}

export function setSettings(patch: Partial<AppSettings>): void {
  state = { ...state, ...patch };
  void setPref(PREF_KEY, state);
  notify();
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => state,
  );
}

/** 번역 훅: const t = useT(); t.saveRec / t.hintRun(1, 12, 2) */
export function useT() {
  const { lang } = useSettings();
  return STRINGS[lang];
}
