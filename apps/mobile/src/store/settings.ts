import { useSyncExternalStore } from 'react';

import { getPref, setPref } from '@/db';
import { STRINGS, type Lang } from '@/i18n/strings';

export interface AppSettings {
  lang: Lang;
  haptics: boolean;
  /** Android 볼륨 키 LAP (iOS에서는 무시됨) */
  volumeLap: boolean;
}

const PREF_KEY = 'appSettings';
const DEFAULTS: AppSettings = { lang: 'en', haptics: true, volumeLap: true };

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
