/**
 * 자동 생성 파일 — 직접 수정 금지. 재생성: `npm run import -w tools/standards-import -- --write`
 * 소스: USA Swimming 2024-2028 Motivational Time Standards
 *
 * MOTIVATIONAL[course][gender][ageGroup][eventCode][level] = 컷타임(ms)
 *
 * 현재 내용: 독립 검증된 subset(여자 11-12 SCY 50/100 Free)만 포함.
 * 전체(전 연령그룹·남녀·전 종목)는 개발 Mac에서 위 임포터를 1회 실행하면 채워진다
 * (tools/standards-import/README.md).
 */
export const MOTIVATIONAL: Record<string, Record<string, Record<string, Record<string, Record<string, number>>>>> = {
  SCY: {
    F: {
      '11-12': {
        '50FR': { B: 31790, BB: 29490, A: 27290, AA: 26090, AAA: 24990, AAAA: 23890 },
        '100FR': { B: 68790, BB: 63790, A: 58890, AA: 56490, AAA: 53990, AAAA: 51590 },
      },
    },
  },
};
