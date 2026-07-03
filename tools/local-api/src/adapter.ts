import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { Request, Response } from 'express';

/**
 * Express req → API Gateway HTTP API v2 이벤트, 그리고 Lambda 결과 → Express
 * 응답으로 변환하는 순수 함수. 여기서 실제 Cognito authorizer가 채우는
 * requestContext.authorizer.jwt.claims 모양을 로컬 개발용 헤더로 흉내 낸다 —
 * 그래서 서비스 핸들러 코드는 로컬/AWS에서 완전히 동일하게 동작한다.
 *
 * 로컬 인증 규약: `x-dev-user`(기본 local-dev-user), `x-dev-role`
 * (swimmer|coach|parent, 기본 coach) 헤더. 실제 토큰 검증은 하지 않는다
 * (로컬 전용 — 프로덕션에는 배포되지 않는 코드).
 */
export function toApiGatewayEvent(req: Request): APIGatewayProxyEventV2 {
  const userId = String(req.header('x-dev-user') ?? 'local-dev-user');
  const role = String(req.header('x-dev-role') ?? 'coach');
  const requestId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    version: '2.0',
    routeKey: `${req.method} ${req.path}`,
    rawPath: req.path,
    rawQueryString: new URLSearchParams(req.query as Record<string, string>).toString(),
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v ?? '']),
    ),
    queryStringParameters: Object.keys(req.query).length
      ? Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]))
      : undefined,
    pathParameters: req.params && Object.keys(req.params).length ? req.params : undefined,
    requestContext: {
      accountId: 'local', apiId: 'local', domainName: 'localhost',
      domainPrefix: 'local', requestId, routeKey: `${req.method} ${req.path}`,
      stage: 'local', time: new Date().toISOString(), timeEpoch: Date.now(),
      http: {
        method: req.method, path: req.path, protocol: 'HTTP/1.1',
        sourceIp: req.ip ?? '127.0.0.1', userAgent: req.header('user-agent') ?? '',
      },
      authorizer: { jwt: { claims: { sub: userId, 'custom:role': role }, scopes: [] } },
    } as unknown as APIGatewayProxyEventV2['requestContext'],
    body: req.body != null && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined,
    isBase64Encoded: false,
  };
}

/** Lambda 결과(APIGatewayProxyResultV2)를 Express 응답으로 그대로 반영. */
export function sendLambdaResult(res: Response, result: APIGatewayProxyResultV2): void {
  if (typeof result === 'string') {
    res.send(result);
    return;
  }
  const { statusCode = 200, headers, body } = result as {
    statusCode?: number; headers?: Record<string, string | number | boolean>; body?: string;
  };
  if (headers) res.set(headers as Record<string, string>);
  res.status(statusCode);
  if (body != null) res.send(body); else res.end();
}
