import { CHAMPS } from './championships.data';

/**
 * 모티베이셔널 표준(B~AAAA) 시드 파생 — 실제 검증 subset(standards.data.ts)이
 * 아직 없는 종목·연령그룹·코스를 챔피언십 컷에서 환산해 채운다.
 * 목적: **모든 종목이 항상 B~AAAA 기본 사다리를 갖고**, 그 위에 Western Zones
 * ~ Far Western … NCAA D1 A 챔피언십이 얹히도록 한다.
 *
 * ⚠️ 시드(unverified): 아래 파생값은 실제 subset(SCY 10U·11-12, 50FR/100FR/
 * 100BK/50FL 남녀)에서 뽑은 **레벨 간격 배율 + 연령·성별 앵커**로 만든 근사치다.
 * 공식 Motivational Time Standards가 임포터(tools/standards-import)로 채워지면
 * 그 값이 우선한다(verified override — standards.ts의 times()가 실측을 먼저 본다).
 *
 * 계산: motivational[level] = WZ컷 × 앵커(성별·연령) × 레벨배율(AAAA 기준)
 * - WZ컷: 해당 종목·코스의 Western Zones(가장 느린 챔피언십) 컷 — 연령 무관 기준점.
 * - 앵커: 그 연령·성별의 AAAA가 WZ보다 얼마나 느린지(어릴수록 큼). 상위 연령은
 *   외삽하되 1.02로 하한을 둬 AAAA가 항상 WZ보다 느리게(사다리 역전 방지) 유지.
 * - 레벨배율: AAAA=1.0 기준 각 레벨이 몇 배 느린지(실측 자유·배영 평균).
 */

/** AAAA 대비 레벨 배율 — 실측 11-12(50FR·100FR·100BK) 평균. */
const LEVEL_RATIO: Record<string, number> = {
  AAAA: 1.0, AAA: 1.052, AA: 1.103, A: 1.153, BB: 1.256, B: 1.358,
};

const MOTIV_LEVELS = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'] as const;

/** AAAA/WZ 앵커 — 10U·11-12는 실측, 13-14↑는 외삽(하한 1.02). 성별 분리(여자 조기 성숙 반영). */
const ANCHOR: Record<'M' | 'F', Record<string, number>> = {
  M: { '10U': 1.244, '11-12': 1.108, '13-14': 1.06, '15-16': 1.03, '17-18': 1.02 },
  F: { '10U': 1.141, '11-12': 1.045, '13-14': 1.03, '15-16': 1.02, '17-18': 1.02 },
};

/** 챔피언십 앵커가 없는 스프린트·100 개인혼영은 관련 종목 컷에서 합성. */
const SYNTH: Record<string, { from: string; factor: number }> = {
  '50BK': { from: '100BK', factor: 0.46 },
  '50BR': { from: '100BR', factor: 0.46 },
  '50FL': { from: '100FL', factor: 0.46 },
  '100IM': { from: '200IM', factor: 0.455 },
};

/** 해당 종목·코스의 Western Zones 컷(ms) — 직접 없으면 합성, 그래도 없으면 null. */
function wzCut(course: string, gender: 'M' | 'F', eventCode: string): number | null {
  const direct = CHAMPS[course]?.[gender]?.[eventCode]?.WZ;
  if (direct != null) return direct;
  const syn = SYNTH[eventCode];
  if (syn) {
    const base = CHAMPS[course]?.[gender]?.[syn.from]?.WZ;
    if (base != null) return base * syn.factor;
  }
  return null;
}

/** 파생 모티베이셔널(B~AAAA) ms 맵. 앵커/컷이 없는 조합은 null. */
export function derivedMotivational(
  course: string, gender: 'M' | 'F', ag: string, eventCode: string,
): Record<string, number> | null {
  const wz = wzCut(course, gender, eventCode);
  const anchor = ANCHOR[gender]?.[ag];
  if (wz == null || anchor == null) return null;
  const aaaa = wz * anchor;
  const out: Record<string, number> = {};
  for (const lv of MOTIV_LEVELS) out[lv] = Math.round((aaaa * LEVEL_RATIO[lv]!) / 10) * 10;
  return out;
}
