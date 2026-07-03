import {
  CreateTableCommand, DescribeTableCommand, DynamoDBClient, ResourceNotFoundException,
  ScalarAttributeType, type AttributeDefinition,
} from '@aws-sdk/client-dynamodb';

import { TABLE_DEFS, tableName } from '@splitlane/svc-shared';
import { runImport } from '@splitlane/svc-standards';
import { PROJECT, STAGE, endpoint } from './env.js';

/**
 * DynamoDB Local에 테이블을 만들고(멱등) 표준기록·클럽조건을 임포트한다.
 * `npm run setup -w @splitlane/local-api` — 서버 시작 전 1회(또는 데이터 리셋 시).
 */
async function main() {
  const client = new DynamoDBClient({
    endpoint, region: 'local', credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });

  for (const def of TABLE_DEFS) {
    const name = tableName(PROJECT, STAGE, def);
    const exists = await tableExists(client, name);
    if (exists) {
      console.log(`✓ table exists: ${name}`);
      continue;
    }
    const attrs: AttributeDefinition[] = [
      { AttributeName: 'pk', AttributeType: ScalarAttributeType.S },
      { AttributeName: 'sk', AttributeType: ScalarAttributeType.S },
      ...(def.gsis?.flatMap((g) => [
        { AttributeName: g.pk, AttributeType: ScalarAttributeType.S },
        { AttributeName: g.sk, AttributeType: ScalarAttributeType.S },
      ]) ?? []),
    ].filter((a, i, arr) => arr.findIndex((x) => x.AttributeName === a.AttributeName) === i);

    await client.send(new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: attrs,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: def.gsis?.map((g) => ({
        IndexName: g.indexName,
        KeySchema: [
          { AttributeName: g.pk, KeyType: 'HASH' as const },
          { AttributeName: g.sk, KeyType: 'RANGE' as const },
        ],
        Projection: { ProjectionType: 'ALL' as const },
      })),
      BillingMode: 'PAY_PER_REQUEST',
    }));
    console.log(`+ created table: ${name}`);
  }

  const standardsTable = tableName(PROJECT, STAGE, { name: 'Standards' });
  process.env.DYNAMODB_ENDPOINT = endpoint;
  const result = await runImport(standardsTable);
  console.log(`✓ seeded standards: ${result.standards} rows, ${result.clubGroups} club groups`);
}

async function tableExists(client: DynamoDBClient, name: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (e) {
    if (e instanceof ResourceNotFoundException) return false;
    throw e;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
