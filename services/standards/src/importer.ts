import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

import { docClient } from '@splitlane/svc-shared';
import { buildStandardRows, CLUB_GROUPS, standardPk, standardSk } from './data.js';

/**
 * 표준기록·클럽조건을 DynamoDB에 적재하는 임포트 잡("미리 읽어와서 업데이트").
 * 로컬/CI/EventBridge 스케줄로 실행. 멱등(같은 키 덮어쓰기).
 * 향후 공식 PDF 파서를 data.ts에 연결하면 이 잡이 그대로 전체를 적재한다.
 */
export async function runImport(tableName: string): Promise<{ standards: number; clubGroups: number }> {
  const db = docClient();
  const items = [
    ...buildStandardRows().map((r) => ({
      pk: standardPk(r), sk: standardSk(r),
      type: 'standard', ...r,
    })),
    ...CLUB_GROUPS.map((g) => ({
      pk: `CLUB#${g.clubId}`, sk: `GROUP#${g.groupId}`,
      type: 'clubGroup', ...g,
    })),
  ];

  // 25개씩 배치 쓰기
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await db.send(new BatchWriteCommand({
      RequestItems: { [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })) },
    }));
  }
  return { standards: buildStandardRows().length, clubGroups: CLUB_GROUPS.length };
}

// tsx로 직접 실행 시 (import:dev 스크립트)
if (process.argv[1] && process.argv[1].endsWith('importer.ts')) {
  const table = process.env.STANDARDS_TABLE;
  if (!table) throw new Error('STANDARDS_TABLE env required');
  runImport(table).then((r) => console.log('imported', r)).catch((e) => { console.error(e); process.exit(1); });
}
