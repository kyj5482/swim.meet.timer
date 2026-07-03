/**
 * 자동 생성 파일 — 직접 수정 금지. 재생성: `npm run import -w tools/standards-import -- --write`
 * 소스: USA Swimming 2024-2028 Motivational Time Standards (공식 PDF,
 * websitedevsa.blob.core.windows.net .../2028-motivational-standards-age-group.pdf)
 *
 * MOTIVATIONAL[course][gender][ageGroup][eventCode][level] = 컷타임(ms)
 *
 * 현재 내용: 공식 PDF 원문 텍스트를 직접 대조해 확인한 subset
 * (10&under·11-12, 남녀, 50FR/100FR/100BK/50FL SCY). 이전 버전에 있던 값은
 * 웹 요약 출처라 실제 PDF와 달라 전부 교체했다(2026-07 원문 대조로 수정).
 * 전체(전 연령그룹·전 종목)는 개발 Mac에서 위 임포터를 1회 실행하면 채워진다
 * (tools/standards-import/README.md).
 */
export const MOTIVATIONAL: Record<string, Record<string, Record<string, Record<string, Record<string, number>>>>> = {
  SCY: {
    F: {
      '10U': {
        '50FR': { B: 39790, BB: 35990, A: 32090, AA: 30890, AAA: 29590, AAAA: 28290 },
      },
      '11-12': {
        '50FR': { B: 33990, BB: 31690, A: 29290, AA: 28090, AAA: 26990, AAAA: 25790 },
        '100FR': { B: 74690, BB: 69390, A: 63990, AA: 61390, AAA: 58690, AAAA: 55990 },
        '100BK': { B: 86590, BB: 79790, A: 72990, AA: 69590, AAA: 66190, AAAA: 62690 },
        '50FL': { B: 36890, BB: 34290, A: 31590, AA: 30290, AAA: 28990, AAAA: 27690 },
      },
    },
    M: {
      '10U': {
        '50FR': { B: 38190, BB: 34590, A: 31090, AA: 29890, AAA: 28690, AAAA: 27490 },
      },
      '11-12': {
        '50FR': { B: 32790, BB: 30490, A: 28090, AA: 26990, AAA: 25790, AAAA: 24590 },
        '100FR': { B: 71490, BB: 66390, A: 61290, AA: 58690, AAA: 56190, AAAA: 53590 },
        '100BK': { B: 82190, BB: 75690, A: 69290, AA: 65990, AAA: 62790, AAAA: 59490 },
        '50FL': { B: 37090, BB: 34190, A: 31190, AA: 29690, AAA: 28190, AAAA: 26690 },
      },
    },
  },
};
