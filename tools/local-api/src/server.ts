import express from 'express';

import { endpoint, PORT, tables } from './env.js';
import { sendLambdaResult, toApiGatewayEvent } from './adapter.js';

/**
 * 로컬 개발 API 서버 — AWS 배포 없이 Mac에서 백엔드를 실행한다.
 * services/records, services/standards의 **동일한 Lambda 핸들러**를 그대로
 * 불러와 Express 라우트로 감싼다(로직 이중 구현 없음). DynamoDB Local
 * (docker-compose)에 붙는다. 인증은 Cognito 대신 x-dev-user/x-dev-role 헤더로
 * 대체(tools/local-api/src/adapter.ts 참고) — 로컬 전용, 프로덕션 미배포.
 *
 * 실행 전: `npm run setup -w @splitlane/local-api` 로 테이블 생성 + 표준 시드.
 */

// 핸들러 모듈이 상단에서 process.env.*_TABLE 을 읽으므로, import보다 먼저
// env를 확정한다 — 정적 import는 호이스팅되므로 반드시 동적 import를 쓴다.
process.env.DYNAMODB_ENDPOINT = endpoint;
process.env.RECORDS_TABLE = tables.records;
process.env.STANDARDS_TABLE = tables.standards;
process.env.LOG_LEVEL ??= 'DEBUG';

const [{ handler: recordsHandler }, { handler: standardsHandler }] = await Promise.all([
  import('@splitlane/svc-records'),
  import('@splitlane/svc-standards'),
]);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  // 로컬 전용 CORS(웹 프리뷰용) — 프로덕션 API GW는 별도 CORS 설정을 씀
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, tables }));

async function invoke(h: typeof recordsHandler, req: express.Request, res: express.Response) {
  const event = toApiGatewayEvent(req);
  const result = await h(event, {} as never, () => {});
  sendLambdaResult(res, result!);
}

app.get('/v1/standards', (req, res) => void invoke(standardsHandler, req, res));
app.get('/v1/standards/clubs/:clubId/groups', (req, res) => void invoke(standardsHandler, req, res));
app.put('/v1/records/batch', (req, res) => void invoke(recordsHandler, req, res));
app.get('/v1/records', (req, res) => void invoke(recordsHandler, req, res));

// AI 코치 계정 로그인(로컬 대체) — 어떤 이메일/비밀번호든 받아 dev 토큰 발급.
// 프로덕션은 Cognito 기반 /auth/login(T-206)이 같은 응답 모양으로 대체한다.
app.post('/v1/auth/login', (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'email and password required' } });
    return;
  }
  res.json({
    token: `dev.${Buffer.from(email).toString('base64url')}`,
    displayName: email.split('@')[0],
    role: 'coach',
  });
});

// 웹 기록 뷰어 — 앱이 Sync Now로 올린 기록을 브라우저에서 확인(SplitLane Cloud 프리뷰).
app.get('/web', (_req, res) => {
  void (async () => {
    try {
      const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
      const { docClient } = await import('@splitlane/svc-shared');
      const { renderRecordsPage } = await import('./web.js');
      const items: Record<string, unknown>[] = [];
      let lastKey: Record<string, unknown> | undefined;
      do {
        const page = await docClient().send(new ScanCommand({
          TableName: tables.records, ExclusiveStartKey: lastKey,
        }));
        items.push(...(page.Items ?? []));
        lastKey = page.LastEvaluatedKey;
      } while (lastKey);
      res.type('html').send(renderRecordsPage(items as never));
    } catch (e) {
      res.status(500).type('text').send(`web viewer error: ${e instanceof Error ? e.message : e}`);
    }
  })();
});

app.listen(PORT, () => {
  console.log(`splitlane local-api listening on http://localhost:${PORT}`);
  console.log(`  DynamoDB Local: ${endpoint}`);
  console.log(`  tables: ${JSON.stringify(tables)}`);
  console.log('  auth: send x-dev-user / x-dev-role headers (defaults: local-dev-user / coach)');
});
