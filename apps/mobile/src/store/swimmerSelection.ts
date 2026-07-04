import { getPref, setPref } from '@/db';

/**
 * 탭 간 공유되는 "현재 보는 선수" — 전체 종목에서 선수를 바꾸면 세부 종목도
 * 같은 선수를 보여준다(반대도 동일). prefs에 저장돼 앱 재시작에도 유지.
 */
const KEY = 'selectedSwimmerId';

export function getSelectedSwimmerId(): Promise<string | null> {
  return getPref<string>(KEY);
}

export function setSelectedSwimmerId(id: string): Promise<void> {
  return setPref(KEY, id);
}
