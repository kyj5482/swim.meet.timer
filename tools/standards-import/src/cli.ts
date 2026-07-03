/**
 * USA Swimming 공식 Motivational Standards PDF → 데이터셋 생성 CLI.
 *
 *   npm run import -w tools/standards-import                  # 다운로드 + 파싱 + 요약(쓰기 없음)
 *   npm run import -w tools/standards-import -- --write       # 검증 통과 시 파일 생성
 *   npm run import -w tools/standards-import -- ./local.pdf --write   # 로컬 PDF 사용
 *
 * 생성 파일:
 *   common/standards/seed/usa-swimming-motivational.json   (계약 소스)
 *   apps/mobile/src/features/targets/standards.data.ts     (온디바이스 데이터셋)
 *
 * 주의: 이 스크립트는 인터넷이 열린 환경(개발자 Mac)에서 실행한다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// pdf-parse의 index.js는 직접 import 시 데모 코드가 실행되는 버그가 있어 lib를 직접 사용
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

import { seedJson, mobileDataTs } from './generate.js';
import { checkAnchors, parsePdfText, AGE_GROUPS, type Course, type Gender } from './parse.js';

const OFFICIAL_URL =
  'https://websitedevsa.blob.core.windows.net/sitefinity/docs/default-source/timesdocuments/time-standards/2025/2028-motivational-standards-age-group.pdf';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

async function loadPdf(src: string): Promise<Buffer> {
  if (/^https?:\/\//.test(src)) {
    console.log(`다운로드: ${src}`);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`다운로드 실패 HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  console.log(`로컬 PDF: ${src}`);
  return readFile(src);
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const src = args.find((a) => !a.startsWith('--')) ?? OFFICIAL_URL;

  const buf = await loadPdf(src);
  const { text } = await pdfParse(buf);
  const { records, errors, warnings } = parsePdfText(text);

  for (const w of warnings) console.warn(`⚠ ${w}`);
  for (const e of errors) console.error(`✗ ${e}`);

  // 요약: 코스×연령×성별 종목 수
  console.log('\n파싱 요약 (종목 수):');
  for (const c of ['SCY', 'SCM', 'LCM'] as Course[]) {
    for (const g of ['F', 'M'] as Gender[]) {
      const row = AGE_GROUPS.map((ag) => {
        const n = new Set(records.filter((r) => r.course === c && r.gender === g && r.ageGroup === ag).map((r) => r.event)).size;
        return `${ag}:${n}`;
      }).join('  ');
      console.log(`  ${c} ${g} — ${row}`);
    }
  }
  console.log(`  총 레코드 ${records.length}개`);

  const anchorFailures = checkAnchors(records);
  for (const f of anchorFailures) console.error(`✗ ${f}`);

  if (errors.length > 0 || anchorFailures.length > 0) {
    console.error('\n검증 실패 — 파일을 쓰지 않습니다. 위 오류를 확인하세요.');
    process.exit(1);
  }
  if (records.length === 0) {
    console.error('\n파싱된 레코드가 없습니다 — PDF 포맷이 예상과 다릅니다.');
    process.exit(1);
  }

  if (!write) {
    console.log('\n확인 완료(dry-run). 파일 생성은 --write 를 붙이세요.');
    return;
  }

  const jsonPath = resolve(repoRoot, 'common/standards/seed/usa-swimming-motivational.json');
  const tsPath = resolve(repoRoot, 'apps/mobile/src/features/targets/standards.data.ts');
  await writeFile(jsonPath, seedJson(records, src));
  await writeFile(tsPath, mobileDataTs(records, src));
  console.log(`\n생성 완료:\n  ${jsonPath}\n  ${tsPath}`);
  console.log('앱 테스트로 확인: npm test -w apps/mobile');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
