/**
 * 진학 코치 AI — 학교 적합도·준비 가이드 엔진(순수·결정적).
 * 입력: 선수의 수영 수준(athleticTier) + 학업(수학·ELA·GPA·AP) + 활동/경험.
 * 출력: 목표 학교별 reach/match/safety 판정 + 나이별 준비 단계.
 *
 * ⚠️ 시드 임계값: 아래 학교 프로필은 공개 통념(경쟁 강도)에 근거한 **시드**이며
 * 공식 입학 데이터로 검증되지 않았다. 실제 서비스에서는 IPEDS/커먼데이터셋 등
 * 공식 소스로 교체하고, 개인화는 Bedrock이 이 구조화 결과 위에 문장을 얹는다.
 * 수학·ELA 점수는 업로드한 학교 평가 PDF에서 파싱(민감정보 — 저장 시 암호화).
 */

export type AthleticTier = 'recruit-d1' | 'recruit-d3' | 'club' | 'developing';

export interface Academics {
  /** 표준화/학교 평가 수학 백분위(0-100) 또는 SAT 수학 환산. */
  mathPct: number;
  /** ELA(영어) 백분위(0-100). */
  elaPct: number;
  gpa?: number;              // 4.0 스케일
  apCourses?: string[];      // 고교부터
}

export interface Activity { name: string; role?: string; years?: number; }

export interface SchoolProfile {
  id: string;
  name: string;
  /** 학업 경쟁 강도(백분위 기준 매치 라인). */
  academicMatchPct: number;
  /** 수영 특기 반영 여부·필요 수준. */
  swimTier: AthleticTier;
  /** 이 학교가 선호하는 준비 요소(개인화 안내에 사용). */
  valued: string[];
}

/** 시드 학교 프로필(예시 — UChicago 등). 공식 데이터로 교체 예정. */
export const SCHOOLS: SchoolProfile[] = [
  { id: 'uchicago', name: 'University of Chicago', academicMatchPct: 97, swimTier: 'recruit-d3', valued: ['intellectual depth (essays)', 'rigor: max AP/IB', 'research or academic projects'] },
  { id: 'stanford', name: 'Stanford University', academicMatchPct: 98, swimTier: 'recruit-d1', valued: ['national-level athletics', 'distinctive impact', 'STEM/leadership'] },
  { id: 'michigan', name: 'University of Michigan', academicMatchPct: 90, swimTier: 'recruit-d1', valued: ['strong GPA + rigor', 'sustained commitment', 'community leadership'] },
  { id: 'emory', name: 'Emory University', academicMatchPct: 92, swimTier: 'recruit-d3', valued: ['academic consistency', 'service depth', 'well-rounded profile'] },
  { id: 'uva', name: 'University of Virginia', academicMatchPct: 91, swimTier: 'recruit-d1', valued: ['character & citizenship', 'rigor', 'athletic + academic balance'] },
];

export type Fit = 'safety' | 'match' | 'reach';

export interface SchoolFit {
  school: SchoolProfile;
  fit: Fit;
  /** 왜 이 판정인지 짧은 근거. */
  rationale: string;
  /** 이 학교 기준 개인화 준비 제안(valued + 부족분). */
  prep: string[];
}

export interface CollegeGuidance {
  athleticTier: AthleticTier;
  academicPct: number;      // (math+ela)/2
  fits: SchoolFit[];
  /** 나이/학년별 다음 단계. */
  roadmap: { stage: string; steps: string[] }[];
  note: string;
}

function academicPct(a: Academics): number {
  return Math.round((a.mathPct + a.elaPct) / 2);
}

/** 학업 백분위 대비 학교 매치 라인으로 fit 판정. */
function fitOf(pct: number, school: SchoolProfile): Fit {
  const gap = school.academicMatchPct - pct;
  if (gap <= -3) return 'safety';   // 학생이 라인보다 뚜렷이 위
  if (gap <= 5) return 'match';
  return 'reach';
}

/** 나이별 로드맵 — 준비의 계단. */
function roadmap(age: number): { stage: string; steps: string[] }[] {
  if (age <= 12) {
    return [{ stage: 'Middle school (build habits)', steps: [
      'Consistent study routine & reading breadth',
      'Try activities widely; keep swimming fun and consistent',
      'Track times and grades in one place (this app)',
    ] }];
  }
  if (age <= 15) {
    return [{ stage: 'Early high school (rigor + depth)', steps: [
      'Take the most rigorous courses you can handle (honors → AP)',
      'Deepen 1–2 activities into leadership/impact',
      'Log AP scores and volunteering; keep a swim progression record',
      'Draft a first list of reach/match/safety schools',
    ] }];
  }
  return [{ stage: 'Upper high school (position & apply)', steps: [
    'Maximize AP/IB rigor aligned to intended major',
    'Recruiting: send swim times + video to target-school coaches',
    'Craft essays that show intellectual depth and distinctive impact',
    'Finalize a balanced reach/match/safety list',
  ] }];
}

export function collegeGuidance(
  athleticTier: AthleticTier, academics: Academics, activities: Activity[],
  targetSchoolIds: string[], age: number,
): CollegeGuidance {
  const pct = academicPct(academics);
  const targets = targetSchoolIds.length
    ? SCHOOLS.filter((s) => targetSchoolIds.includes(s.id))
    : SCHOOLS;

  const activityDepth = activities.some((a) => (a.years ?? 0) >= 2 || a.role);

  const fits: SchoolFit[] = targets.map((school) => {
    const fit = fitOf(pct, school);
    const prep: string[] = [...school.valued];
    if ((academics.apCourses?.length ?? 0) < 3 && age >= 15) prep.push('Add AP courses aligned to your major');
    if (!activityDepth) prep.push('Deepen one activity into a multi-year leadership role');
    if (school.swimTier.startsWith('recruit') && athleticTier === 'developing') {
      prep.push('Keep improving swim times; email coaches once you hit their recruiting range');
    }
    const rationale =
      fit === 'reach' ? `Academic line ~${school.academicMatchPct}pct vs your ${pct}pct — reach; strengthen rigor & essays.`
      : fit === 'match' ? `Your ${pct}pct is near the ${school.academicMatchPct}pct line — a realistic match.`
      : `Your ${pct}pct is above the ${school.academicMatchPct}pct line — a likely admit academically.`;
    return { school, fit, rationale, prep };
  });

  return {
    athleticTier,
    academicPct: pct,
    fits,
    roadmap: roadmap(age),
    note:
      'Seed guidance from public competitiveness signals — not official admissions data. '
      + 'Academic PDFs are private and stored encrypted. Personalized narrative is generated on top of these facts.',
  };
}
