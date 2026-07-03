/**
 * 표준기록 데이터 소스(백엔드). 임포터가 이 데이터를 DynamoDB로 적재하고,
 * 앱은 API로 조회한다 = 사용자 요청의 "미리 읽어와서 업데이트".
 *
 * verified: 실제 확인값. USA Swimming 2024-2028 SCY Motivational — 공식 PDF
 * (websitedevsa.blob.core.windows.net .../2028-motivational-standards-age-group.pdf)
 * 원문 텍스트를 직접 대조해 확인(2026-07). 현재 여자 11-12 50/100 Free 확인.
 * 전체 종목/연령/성별은 tools/standards-import로 확장(같은 PDF 전량 파싱).
 */
export type Gender = 'F' | 'M';
export type Level = 'B' | 'BB' | 'A' | 'AA' | 'AAA' | 'AAAA';
export const LEVELS: Level[] = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];

export interface StandardRow {
  authority: string;    // 'usa-swimming'
  season: string;       // '2024-2028'
  course: 'SCY' | 'LCM' | 'SCM';
  gender: Gender;
  ageGroup: string;     // '11-12'
  event: string;        // '50FR'
  level: Level;
  timeMs: number;
  verified: boolean;
}

const sec = (s: number) => Math.round(s * 1000);

/** 확인된 시드(여자 11-12 SCY) — 공식 PDF 원문 대조값. */
const F_11_12: Record<string, Record<Level, number>> = {
  '50FR': { B: sec(33.99), BB: sec(31.69), A: sec(29.29), AA: sec(28.09), AAA: sec(26.99), AAAA: sec(25.79) },
  '100FR': { B: sec(74.69), BB: sec(69.39), A: sec(63.99), AA: sec(61.39), AAA: sec(58.69), AAAA: sec(55.99) },
};

export function buildStandardRows(): StandardRow[] {
  const rows: StandardRow[] = [];
  for (const [event, levels] of Object.entries(F_11_12)) {
    for (const level of LEVELS) {
      rows.push({
        authority: 'usa-swimming', season: '2024-2028', course: 'SCY',
        gender: 'F', ageGroup: '11-12', event, level, timeMs: levels[level], verified: true,
      });
    }
  }
  return rows;
}

/** 클럽 그룹 조건(NOVA — common/standards 리서치). 표준 레벨 참조. */
export interface ClubGroupRow {
  clubId: string;
  clubName: string;
  groupId: string;
  name: string;
  requirements: { event: string; level: Level }[];
  note?: string;
}

export const CLUB_GROUPS: ClubGroupRow[] = [
  {
    clubId: 'nova-va', clubName: 'NOVA of Virginia Aquatics', groupId: 'AGD-SILVER',
    name: 'Age Group Dev · Silver',
    requirements: [{ event: '100FR', level: 'B' }, { event: '100IM', level: 'B' }],
    note: 'AGD Silver: 100 Free·100 IM B time + 2~3 practices/wk',
  },
  {
    clubId: 'nova-va', clubName: 'NOVA of Virginia Aquatics', groupId: 'AGD-GOLD',
    name: 'Age Group Dev · Gold',
    requirements: [{ event: '100FR', level: 'BB' }, { event: '100IM', level: 'BB' }],
    note: '10&U top group (estimated — verify with club)',
  },
];

/** DynamoDB 키: 조회 패턴 = authority+season+course+gender+ageGroup 로 이벤트 묶음. */
export function standardPk(r: Pick<StandardRow, 'authority' | 'season' | 'course' | 'gender' | 'ageGroup'>): string {
  return `STD#${r.authority}#${r.season}#${r.course}#${r.gender}#${r.ageGroup}`;
}
export function standardSk(r: Pick<StandardRow, 'event' | 'level'>): string {
  return `${r.event}#${r.level}`;
}
