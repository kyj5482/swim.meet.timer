# standards-import — USA Swimming 표준기록 임포터

공식 USA Swimming 2024-2028 Motivational Time Standards PDF(연령그룹판)를 파싱해
앱·백엔드가 쓰는 데이터셋을 생성한다. **인터넷이 열린 환경(개발자 Mac)에서 실행.**

```bash
npm install                                        # 워크스페이스 루트에서 1회
npm run import -w tools/standards-import           # 다운로드+파싱+검증 (dry-run)
npm run import -w tools/standards-import -- --write  # 통과 시 파일 생성
```

PDF를 직접 받아뒀다면: `npm run import -w tools/standards-import -- ./표준.pdf --write`

## 생성 파일
| 파일 | 용도 |
| --- | --- |
| `common/standards/seed/usa-swimming-motivational.json` | 계약 소스(전 영역 공유) |
| `apps/mobile/src/features/targets/standards.data.ts` | 앱 온디바이스 데이터셋 |

생성 후 `npm test -w apps/mobile`로 확인하고 두 파일을 커밋한다.

## 안전장치
- 시간 6개+종목+시간 6개 패턴만 데이터로 인정, 블록 단조성(레벨이 빠를수록
  시간 감소) 위반은 **오류**로 수집 — 오류가 있으면 파일을 쓰지 않는다.
- 레벨 순서(B→AAAA / AAAA→B)는 단조 방향으로 자동 추론(여자 왼쪽·남자 오른쪽
  클래식 포맷 대응).
- **앵커 검증**: 독립적으로 검증된 여자 11-12 SCY 50/100 Free 값과 정확히
  일치해야 통과(`src/parse.ts`의 `ANCHORS`).
- 파싱 요약(코스×연령×성별 종목 수)을 출력하므로 공식 문서와 눈으로 대조할 것.

포맷이 바뀌어 파싱이 실패하면 `src/parse.ts`의 패턴을 조정한다(테스트 픽스처
`test/parse.test.ts` 참고).
