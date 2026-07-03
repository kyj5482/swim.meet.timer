/**
 * en/ko 문자열 — PWA(docs/app/index.html의 S 객체) 이식.
 * 값이 함수인 키는 t('key', ...args)로 호출된다.
 */
export type Lang = 'en' | 'ko';

const en = {
  tabTimer: 'Timer', tabRec: 'Records', tabAth: 'Athletes',
  settings: 'Settings', done: 'Done', cancel: 'Cancel', add: 'Add',
  lang: 'Language',

  // setup
  lCourse: 'Course', lStroke: 'Stroke', lDist: 'Distance', lSplit: 'Split',
  changeInSettings: 'Change in Settings', courseUnit: 'Course',
  splitEvery: (d: number, u: string) => `${d} ${u} splits`,
  lSwimmers: 'Swimmers', lSwimmersSub: 'Time first, assign after',
  steptip: 'Slots are anonymous during timing. Assign swimmers after.',
  segInfo: (n: number, iv: number, u: string) => `${n} segments · LAP every ${iv} ${u}`,
  segOnce: (d: number, u: string) => `1 split · ${d} ${u} at once`,
  segWarn: (d: number, p: string) => `${d} doesn't fit in a ${p} pool`,
  splitOnce: 'once',
  strokes: { free: 'Freestyle', back: 'Backstroke', breast: 'Breaststroke', fly: 'Butterfly', im: 'IM' } as Record<string, string>,

  // running
  hintStart: 'Tap a lane row — or press LAP for the predicted next',
  hintRun: (d: number, tot: number, r: number) => `Lap ${d}/${tot} · ${r} remaining`,
  lapNext: (n: number) => `Next ▸ Lane ${n}`, lapDone: 'Done',
  laneN: (n: number) => `Lane ${n}`, waiting: 'Waiting', next: 'NEXT',
  undo: '↶ Undo', reset: '⟲ Reset',
  resetTitle: 'Reset timer?', resetMsg: 'Current measurements will be lost.',
  resumeTitle: 'Resume timing?', resumeMsg: 'A session was interrupted while running.',
  resume: 'Resume', discard: 'Discard',

  // assign
  aTitle: 'Done — Assign Swimmers',
  aLead: 'Match each slot to a swimmer. Pre-filled by pace history.',
  impCount: (n: number) => `improved`, rec: 'Rec', firstRec: 'First record',
  prev: 'Prev', pb: '🏅 PB', pbShort: 'PB', totalWord: 'total', improvedWord: 'improved',
  swapBtn: '↔ Swap',
  nearWarn: (n: number, g: string) => `⚠ ${g}s gap with lane ${n} — confirm`,
  saveRec: 'Save Records', again: 'Time Again', pickTitle: 'Select Swimmer', addSw: 'Add Swimmer',
  savedToast: (n: number) => `✓ ${n} ${n === 1 ? 'record' : 'records'} saved`,
  undoBtn: 'Undo',

  // records
  sessions: 'Sessions', compareSplits: 'Compare Splits',
  selectMode: 'Select 2+ sessions', compareN: (n: number) => `Compare ${n} sessions`,
  splitCmp: 'Split Comparison', segSplits: 'Segment Splits',
  delRec: '🗑 Delete', delConfirm: 'Delete this record?', delYes: 'Delete',
  trendSub: (n: number) => `${n} sessions · lower is better`,
  trend: 'Trend', seg: 'Seg', total2: 'Total', bestWord: 'Best',
  switchLbl: 'Switch', event: 'Event', yo: (n: number) => `${n} yo`, noGroup: 'No group',
  cmpAxisNote: 'segment split (s) · lower is better',
  exportCsv: 'Export CSV', exportFail: 'Export failed',
  noRecords: 'No records yet. Time a session and save it.',
  noSwimmers: 'No swimmers yet',
  noSwimmersSub: 'Add swimmers in the Athletes tab, then time a session.',

  // athletes
  namePH: 'e.g. Minjun',
  athEmpty: 'No swimmers yet. Add one to assign records after timing.',
  delSwTitle: (name: string) => `Delete ${name}?`,
  delSwMsg: 'Saved records are kept.',
  editSw: 'Edit Swimmer', lName: 'Name', lAge: 'Age', lGroup: 'Group',
  deleteSw: 'Delete Swimmer', save: 'Save', groupPH: 'e.g. Elite (optional)',

  // settings
  haptics: 'Haptics', hapticsSub: 'Vibrate on every lap',
  volumeLap: 'Volume-key LAP', volumeLapSub: 'Press volume buttons to lap (Android)',
  volumeLapIos: 'Not available on iOS (App Store policy). Use the on-screen LAP button.',
  clearDemo: 'Clear demo data', clearDemoSub: 'Remove the 5 sample swimmers and their history',
  clearDemoConfirm: 'Sample swimmers and their demo records will be removed. Your own data is kept.',
  settingsTip: 'Settings are saved on this device.',
};

const ko: typeof en = {
  tabTimer: '타이머', tabRec: '기록지', tabAth: '선수',
  settings: '설정', done: '완료', cancel: '취소', add: '추가',
  lang: '언어',

  lCourse: '코스', lStroke: '종목', lDist: '거리', lSplit: '스플릿',
  changeInSettings: '설정에서 변경', courseUnit: '코스 단위',
  splitEvery: (d, u) => `${d} ${u}마다`,
  lSwimmers: '인원', lSwimmersSub: '익명 측정 후 선수 배정',
  steptip: '익명 슬롯으로 측정하고, 끝난 뒤 선수를 배정합니다.',
  segInfo: (n, iv, u) => `구간 ${n}개 · ${iv} ${u}마다 LAP`,
  segOnce: (d, u) => `결과 1회 · ${d} ${u} 한 번에 기록`,
  segWarn: (d, p) => `${d}는 ${p} 풀에서 잴 수 없습니다`,
  splitOnce: '전체 1회',
  strokes: { free: '자유형', back: '배영', breast: '평영', fly: '접영', im: '혼영' },

  hintStart: '벽을 찍은 레인을 탭하거나, 예측이 맞으면 LAP을 누르세요',
  hintRun: (d, tot, r) => `랩 ${d}/${tot} · 남은 ${r}명`,
  lapNext: (n) => `다음 예측 ▸ ${n}번`, lapDone: '완료',
  laneN: (n) => `${n}번 레인`, waiting: '출발 대기', next: '다음',
  undo: '↶ 실행취소', reset: '⟲ 리셋',
  resetTitle: '타이머를 리셋할까요?', resetMsg: '현재 측정 내용이 사라집니다.',
  resumeTitle: '측정을 이어서 할까요?', resumeMsg: '측정 중에 앱이 종료되었습니다.',
  resume: '이어서', discard: '버리기',

  aTitle: '기록 완료 — 선수 배정',
  aLead: '기록을 보고 선수를 배정하세요. 기존 기록 기준으로 추천했습니다.',
  impCount: () => '향상', rec: '추천', firstRec: '첫 기록',
  prev: '이전', pb: '🏅 PB', pbShort: 'PB', totalWord: '총', improvedWord: '향상',
  swapBtn: '↔ 맞바꾸기',
  nearWarn: (n, g) => `⚠ ${n}번과 ${g}초 차 — 선수 확인`,
  saveRec: '기록 저장', again: '다시 측정', pickTitle: '선수 선택', addSw: '선수 추가',
  savedToast: (n) => `✓ ${n}명 기록 저장됨`,
  undoBtn: '되돌리기',

  sessions: '세션 기록', compareSplits: '구간 비교',
  selectMode: '2개 이상 선택', compareN: (n) => `${n}개 세션 비교`,
  splitCmp: '구간별 스플릿 비교', segSplits: '구간별 스플릿',
  delRec: '🗑 삭제', delConfirm: '이 기록을 삭제할까요?', delYes: '삭제',
  trendSub: (n) => `최근 ${n}회 · 낮을수록 좋음`,
  trend: '추세', seg: '구간', total2: '합계', bestWord: '베스트',
  switchLbl: '변경', event: '종목', yo: (n) => `만 ${n}세`, noGroup: '그룹 없음',
  cmpAxisNote: '구간 스플릿(초) · 낮을수록 좋음',
  exportCsv: 'CSV 내보내기', exportFail: '내보내기 실패',
  noRecords: '아직 기록이 없습니다. 측정 후 저장하면 표시됩니다.',
  noSwimmers: '선수가 없습니다',
  noSwimmersSub: '선수 탭에서 선수를 추가하고 측정해 보세요.',

  namePH: '예: 민준',
  athEmpty: '아직 선수가 없습니다. 측정 후 배정하려면 선수를 추가하세요.',
  delSwTitle: (name) => `${name} 선수를 삭제할까요?`,
  delSwMsg: '저장된 기록은 유지됩니다.',
  editSw: '선수 정보 수정', lName: '이름', lAge: '나이', lGroup: '그룹',
  deleteSw: '선수 삭제', save: '저장', groupPH: '예: 엘리트반 (선택)',

  haptics: '햅틱', hapticsSub: '랩마다 진동 피드백',
  volumeLap: '볼륨 키 LAP', volumeLapSub: '볼륨 버튼으로 랩 기록 (Android)',
  volumeLapIos: 'iOS는 정책상 지원되지 않습니다. 화면의 LAP 버튼을 사용하세요.',
  clearDemo: '데모 데이터 지우기', clearDemoSub: '샘플 선수 5명과 데모 기록 삭제',
  clearDemoConfirm: '샘플 선수와 데모 기록이 삭제됩니다. 내가 만든 데이터는 유지됩니다.',
  settingsTip: '설정은 이 기기에 저장됩니다.',
};

export const STRINGS: Record<Lang, typeof en> = { en, ko };
