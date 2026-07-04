/**
 * 앱 문자열 — 영어 단일 언어(제품 결정: 한국어 제거, Settings에서 언어 항목 삭제).
 * 값이 함수인 키는 t.key(...args)로 호출된다.
 */

export const strings = {
  tabTimer: 'Timer', tabRec: 'Event Detail', tabAth: 'Athletes', tabAll: 'All Events',
  settings: 'Settings', done: 'Done', cancel: 'Cancel', add: 'Add', back: 'Back',

  // all-events overview
  manageAthletes: 'Manage athletes',
  ovBest: 'Best', ovLevel: 'Std', ovNext: 'Next level',
  ovDrop: (level: string, pct: number) => `−${pct}% to ${level}`,
  ovTopLevel: 'Top level',
  ovNoStd: 'No standard',
  ovNoStdHint: 'Set age & gender in Manage athletes to see USA Swimming standards',
  ovEmpty: 'No records yet',
  ovEmptySub: 'Finish a timed session in the Timer tab and results appear here',
  ovShortCourse: 'Short Course', ovLongCourse: 'Long Course',
  ovPbAgo: (days: number) => (days === 0 ? 'PB today' : days === 1 ? 'PB 1 day ago' : `PB ${days} days ago`),
  ovLastAt: (d: string) => `Last swim ${d}`,
  ovTgDrop: (label: string, pct: number) => `🎯 −${pct}% to ${label}`,
  ovTgDone: (label: string) => `🎯 ${label} ✓`,
  officialTimes: 'Official times',

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
  rec: 'Rec', firstRec: 'First record',
  prev: 'Prev', pb: '🏅 PB', pbShort: 'PB',
  swapBtn: '↔ Swap',
  nearWarn: (n: number, g: string) => `⚠ ${g}s gap with lane ${n} — confirm`,
  saveRec: 'Save Records', again: 'Time Again', pickTitle: 'Select Swimmer', addSw: 'Add Swimmer',
  savedToast: (n: number) => `${n} ${n === 1 ? 'record' : 'records'} saved`,
  undoBtn: 'Undo', okBtn: 'OK',
  undone: 'Save undone',

  // records
  sessions: 'Sessions', compareSplits: 'Compare Splits',
  selectMode: 'Select 2+ sessions', compareN: (n: number) => `Compare ${n} sessions`,
  splitCmp: 'Split Comparison', segSplits: 'Segment Splits',
  delRec: 'Delete record', delConfirm: 'Delete this record?', delYes: 'Delete',
  trend: 'Trend', seg: 'Seg', total2: 'Total', bestWord: 'Best',
  accelImprovingSub: 'improving faster', accelSteadySub: 'steady pace', accelSlowingSub: 'gains slowing',
  perWeekSub: (v: string) => `▼${v}/wk`,
  expandChart: 'Expand',
  fullChartTitle: (ev: string) => `${ev} — Standards position`,
  switchLbl: 'Switch', event: 'Event', yo: (n: number) => `${n} yo`, noGroup: 'No group',
  cmpAxisNote: 'segment split (s) · lower is better',
  noRecords: 'No records yet. Time a session and save it.',
  noSwimmers: 'No swimmers yet',
  noSwimmersSub: 'Add swimmers in Manage athletes, then time a session.',

  // athletes
  namePH: 'e.g. Minjun',
  athEmpty: 'No swimmers yet. Add one to assign records after timing.',
  delSwTitle: (name: string) => `Delete ${name}?`,
  delSwMsg: 'Saved records are kept.',
  editSw: 'Edit Swimmer', lName: 'Name', lAge: 'Age', lGroup: 'Group', lGender: 'Gender',
  female: 'Female', male: 'Male',
  lUsaId: 'USA Swimming ID',
  usaIdPH: 'e.g. 1045380 (optional)',
  usaIdHint: 'Links this swimmer to official meet results (SWIMS best times).',
  deleteSw: 'Delete Swimmer', save: 'Save', groupPH: 'e.g. Elite (optional)',

  // targets
  target: 'Target', setTarget: 'Set a target', editTarget: 'Edit target', removeTarget: 'Remove',
  targetHint: 'Pick a goal time and see how close you are.',
  achievedTag: '✓ Achieved', toGo: (v: string) => `${v} to go`,
  onTrack: 'On track', behind: 'Behind pace', noProjection: 'Keep training to project',
  projected: (d: string) => `Projected ${d}`, byDate: (d: string) => `by ${d}`,
  perWeek: (v: string) => `${v}/wk`, accelImproving: 'Accelerating', accelSteady: 'Steady', accelSlowing: 'Slowing',
  tByLevel: 'Standard level', tByClub: 'Club group', tCustom: 'Custom time',
  ageGroupLbl: 'Age group',
  pickLevel: 'Pick a level (USA Swimming)', pickTime: 'Target time (e.g. 58.50)',
  targetWhen: 'Target date (optional)', noDate: 'No date', in3mo: '3 months', in6mo: '6 months',
  ladderReached: (l: string) => `Reached ${l}`, ladderNext: (l: string, v: string) => `${v} to ${l}`,
  levelUnavailable: 'Standards for this event/age coming soon — use a custom time.',

  // settings
  haptics: 'Haptics', hapticsSub: 'Strong vibration on every lap tap',
  clearDemo: 'Clear demo data', clearDemoSub: 'Remove the 5 sample swimmers and their history',
  clearDemoConfirm: 'Sample swimmers and their demo records will be removed. Your own data is kept.',
  settingsTip: 'Settings are saved on this device.',

  backend: 'Backend Sync', serverUrlPH: 'http://192.168.x.x:4000/v1',
  testConnection: 'Test Connection', syncNow: 'Sync Now',
  connOk: '✓ Server reachable', connFail: '✗ Could not reach server',
  neverSynced: 'Never synced', lastSynced: (t: string) => `Last synced ${t}`,
  syncOk: (sw: number, push: number, pull: number) => `✓ Synced ${sw} swimmer${sw === 1 ? '' : 's'} — pushed ${push}, pulled ${pull}`,
  syncFail: (msg: string) => `✗ Sync failed: ${msg}`,
};

export type Strings = typeof strings;
