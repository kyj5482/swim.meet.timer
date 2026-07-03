import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let cached: DynamoDBDocumentClient | null = null;

/**
 * 전역 재사용 DynamoDB DocumentClient (Lambda 콜드스타트 최소화).
 * `DYNAMODB_ENDPOINT`가 설정되면 로컬 DynamoDB Local(tools/local-api)로 붙는다 —
 * 핸들러 코드는 이 분기를 몰라도 된다(같은 코드가 로컬/AWS에서 동일하게 동작).
 */
export function docClient(): DynamoDBDocumentClient {
  if (!cached) {
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    cached = DynamoDBDocumentClient.from(
      new DynamoDBClient(
        endpoint
          ? { endpoint, region: 'local', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }
          : {},
      ),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  return cached;
}

/** 테스트/재초기화용 — 로컬 서버가 endpoint 설정 후 첫 호출 전에 클라이언트를 새로 만들 때 사용. */
export function resetDocClient(): void {
  cached = null;
}
