/**
 * 수영 코치 AI — 가이드 엔진(순수·결정적). ai-coach 철칙: **수치는 코드가,
 * 문장은 LLM이.** 이 엔진은 기록으로부터 수준을 판정하고, 나이에 맞는 체력·수영
 * 훈련 포커스와 (유튜브/영상 위주) 학습 링크를 뽑는다. 문장 다듬기는 Bedrock이
 * 이 구조화 결과를 받아 수행한다(여기서 시간 계산·환각 없음).
 *
 * 나이 감안: 어린 선수는 기술·재미·수중 감각, 사춘기 전후는 유산소·기술 정교화,
 * 상급은 근력·젖산 내성 — 미국수영/USOPC 장기선수육성(LTAD) 통념을 시드로 반영.
 * ⚠️ 훈련량·강도는 반드시 담당 코치·의료진 확인 하에 조정(안전 고지 포함).
 */

export interface BestTime {
  event: string;      // '50FR' 등
  course: string;     // 'SCY' | 'SCM' | 'LCM'
  totalMs: number;
}

/** 표준 레벨 판정용 최소 사다리(레벨→컷). 앱/standards에서 넘겨받는다. */
export interface LevelCut { level: string; timeMs: number; }

export type Tier = 'novice' | 'developing' | 'age-group' | 'competitive' | 'elite';

export interface SwimGuidance {
  tier: Tier;
  /** 대표 수준 문장(레벨 코드 기반, LLM이 자연어로 확장 가능). */
  levelSummary: string;
  /** 이번 시즌 집중 포인트(2~4개). */
  focusAreas: string[];
  /** 주간 훈련 뼈대(나이·수준 맞춤). */
  weeklyPlan: { day: string; focus: string }[];
  /** 학습 영상(제목 + 검색/시청 URL). 나이 눈높이 설명 위주. */
  videos: { title: string; url: string }[];
  /** 안전 고지 — 훈련량은 담당 코치 확인 필수. */
  safetyNote: string;
}

/** 나이대 구분(LTAD 근사). */
function ageBand(age: number): 'kids' | 'preteen' | 'teen' | 'senior' {
  if (age <= 10) return 'kids';
  if (age <= 12) return 'preteen';
  if (age <= 15) return 'teen';
  return 'senior';
}

/** best가 통과한 가장 빠른(높은) 레벨. cuts 정렬 무관. 아무것도 못 미치면 null. */
function reachedLevel(bestMs: number, cuts: LevelCut[]): string | null {
  const fast = [...cuts].sort((a, b) => a.timeMs - b.timeMs); // idx0 = 가장 빠름
  for (const c of fast) {
    if (bestMs <= c.timeMs) return c.level; // 통과한 가장 빠른 레벨
  }
  return null;
}

const TIER_ORDER: Record<string, Tier> = {
  B: 'novice', BB: 'developing', A: 'developing', AA: 'age-group',
  AAA: 'age-group', AAAA: 'competitive',
};
function tierFromLevel(level: string | null): Tier {
  if (!level) return 'novice';
  if (TIER_ORDER[level]) return TIER_ORDER[level]!;
  return 'elite'; // 챔피언십 레벨(WZ 이상)
}

/** 유튜브 검색 링크(임베드/특정 영상은 큐레이션 확장 여지 — 지금은 안전한 검색). */
function yt(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

const PLANS: Record<ReturnType<typeof ageBand>, { day: string; focus: string }[]> = {
  kids: [
    { day: 'Mon', focus: 'Play-based water skills · streamline & kicking games' },
    { day: 'Wed', focus: 'Freestyle & backstroke technique · short fun sets' },
    { day: 'Fri', focus: 'Underwater confidence · dolphin kick play · dryland as movement games' },
  ],
  preteen: [
    { day: 'Mon', focus: 'Technique: catch & body line (all 4 strokes)' },
    { day: 'Tue', focus: 'Aerobic base: easy distance, drills' },
    { day: 'Thu', focus: 'Starts & turns · streamline off every wall' },
    { day: 'Sat', focus: 'Bodyweight dryland (core, mobility) · IM skills' },
  ],
  teen: [
    { day: 'Mon', focus: 'Aerobic threshold set + stroke technique' },
    { day: 'Tue', focus: 'Dryland: core, bands, mobility (coach-supervised)' },
    { day: 'Wed', focus: 'Speed/skill: starts, turns, underwaters' },
    { day: 'Fri', focus: 'Race-pace set for main event' },
    { day: 'Sat', focus: 'Aerobic distance + IM' },
  ],
  senior: [
    { day: 'Mon', focus: 'Aerobic + threshold · technique under fatigue' },
    { day: 'Tue', focus: 'Strength (age-appropriate load, supervised) + core' },
    { day: 'Wed', focus: 'Race-pace / lactate tolerance for main event' },
    { day: 'Thu', focus: 'Recovery aerobic + mobility' },
    { day: 'Fri', focus: 'Speed & power · reactive starts/turns' },
    { day: 'Sat', focus: 'Long aerobic / test set' },
  ],
};

const FOCUS: Record<Tier, string[]> = {
  novice: ['Streamline off every wall', 'Comfortable breathing & body position', 'Legal strokes in all 4'],
  developing: ['Consistent stroke tempo', 'Flip turns & underwater kicks', 'Build aerobic base'],
  'age-group': ['Distance per stroke (efficiency)', 'Pace awareness & even splits', 'IM balance across strokes'],
  competitive: ['Race-pace repeatability', 'Underwater speed (15m)', 'Back-half strength'],
  elite: ['Event specialization & taper', 'Lactate tolerance', 'Marginal gains: starts, turns, finishes'],
};

/**
 * best 타임(종목별) + 나이로 가이드 생성. cutsByEvent는 각 종목의 레벨 사다리
 * (없으면 그 종목은 수준 판정에서 제외). videosExtra로 큐레이션 영상 주입 가능.
 */
export function swimGuidance(
  bests: BestTime[], age: number, cutsByEvent: Record<string, LevelCut[]>,
): SwimGuidance {
  const band = ageBand(age);
  // 각 종목에서 달성 레벨 → 가장 높은 레벨을 대표 수준으로
  let bestTier: Tier = 'novice';
  let bestLevel: string | null = null;
  const tierRank: Tier[] = ['novice', 'developing', 'age-group', 'competitive', 'elite'];
  for (const b of bests) {
    const cuts = cutsByEvent[b.event];
    if (!cuts) continue;
    const lv = reachedLevel(b.totalMs, cuts);
    const tier = tierFromLevel(lv);
    if (tierRank.indexOf(tier) > tierRank.indexOf(bestTier)) { bestTier = tier; bestLevel = lv; }
  }

  const levelSummary = bestLevel
    ? `Around USA Swimming ${bestLevel} standard in your best event — ${bestTier} level for your age.`
    : `Building fundamentals — not yet at a B standard. Focus on technique and consistency.`;

  const videos = [
    { title: 'Freestyle technique basics', url: yt(`freestyle technique for ${band === 'kids' ? 'kids' : 'age group swimmers'}`) },
    { title: 'Streamline & underwater dolphin kick', url: yt('streamline underwater dolphin kick drill') },
    { title: 'Faster flip turns', url: yt('freestyle flip turn tutorial youth swimming') },
    ...(band === 'teen' || band === 'senior'
      ? [{ title: 'Dryland core for swimmers (supervised)', url: yt('dryland core workout for swimmers') }]
      : [{ title: 'Fun dryland movement games', url: yt('fun dryland games for young swimmers') }]),
  ];

  return {
    tier: bestTier,
    levelSummary,
    focusAreas: FOCUS[bestTier],
    weeklyPlan: PLANS[band],
    videos,
    safetyNote:
      'Age-appropriate guidance only. Confirm training volume and any strength work with your coach; '
      + 'young athletes should prioritize skill and fun over heavy load.',
  };
}
