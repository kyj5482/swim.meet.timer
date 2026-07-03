/**
 * DynamoDB 테이블 스키마 — infra/lib/data-stack.ts(CDK)와 tools/local-api
 * (DynamoDB Local 테이블 생성)가 공유하는 단일 소스. 여기를 바꾸면 두 곳 모두
 * 같은 정의를 쓰게 된다(로컬과 AWS가 어긋나지 않도록).
 */
export interface TableDef {
  name: 'Users' | 'Records' | 'Standards';
  gsis?: { indexName: string; pk: string; sk: string }[];
}

export const TABLE_DEFS: TableDef[] = [
  { name: 'Users' },
  { name: 'Records', gsis: [{ indexName: 'byEvent', pk: 'pk', sk: 'eventDate' }] },
  { name: 'Standards' },
];

export function tableName(project: string, stage: string, def: Pick<TableDef, 'name'>): string {
  return `${project}-${stage}-${def.name.toLowerCase()}`;
}
