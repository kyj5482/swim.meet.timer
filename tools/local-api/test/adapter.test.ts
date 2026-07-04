import { describe, expect, it, vi } from 'vitest';

import { devTokenUser, sendLambdaResult, toApiGatewayEvent } from '../src/adapter.js';

function mockReq(over: Record<string, unknown> = {}) {
  return {
    method: 'GET', path: '/v1/standards', query: {}, params: {}, headers: {}, body: undefined,
    ip: '127.0.0.1',
    header: (name: string) => (over.headers as Record<string, string> | undefined)?.[name.toLowerCase()],
    ...over,
  } as never;
}

describe('toApiGatewayEvent — Express req → API GW v2 이벤트', () => {
  it('기본 요청: 로컬 개발 기본 클레임(coach) 부착', () => {
    const e = toApiGatewayEvent(mockReq());
    const claims = (e.requestContext as unknown as { authorizer: { jwt: { claims: Record<string, string> } } })
      .authorizer.jwt.claims;
    expect(claims.sub).toBe('local-dev-user');
    expect(claims['custom:role']).toBe('coach');
    expect(e.rawPath).toBe('/v1/standards');
    expect(e.requestContext.http.method).toBe('GET');
  });

  it('x-dev-user / x-dev-role 헤더로 클레임 오버라이드', () => {
    const e = toApiGatewayEvent(mockReq({ headers: { 'x-dev-user': 'u9', 'x-dev-role': 'parent' } }));
    const claims = (e.requestContext as unknown as { authorizer: { jwt: { claims: Record<string, string> } } })
      .authorizer.jwt.claims;
    expect(claims.sub).toBe('u9');
    expect(claims['custom:role']).toBe('parent');
  });

  it('Authorization dev 토큰으로 userId 파생(x-dev-user 없을 때)', () => {
    const token = `dev.${Buffer.from('coach@example.com').toString('base64url')}`;
    expect(devTokenUser(`Bearer ${token}`)).toBe('coach@example.com');
    expect(devTokenUser('Bearer not-a-dev-token')).toBeNull();
    expect(devTokenUser(undefined)).toBeNull();

    const e = toApiGatewayEvent(mockReq({ headers: { authorization: `Bearer ${token}` } }));
    const claims = (e.requestContext as unknown as { authorizer: { jwt: { claims: Record<string, string> } } })
      .authorizer.jwt.claims;
    expect(claims.sub).toBe('coach@example.com');
  });

  it('쿼리스트링·path 파라미터 전달', () => {
    const e = toApiGatewayEvent(mockReq({ query: { age: '11-12', gender: 'F' }, params: { clubId: 'nova-va' } }));
    expect(e.queryStringParameters).toEqual({ age: '11-12', gender: 'F' });
    expect(e.pathParameters).toEqual({ clubId: 'nova-va' });
  });

  it('body가 있으면 JSON 문자열로 직렬화', () => {
    const e = toApiGatewayEvent(mockReq({ method: 'PUT', body: { records: [{ id: 'r1' }] } }));
    expect(e.body).toBe(JSON.stringify({ records: [{ id: 'r1' }] }));
  });

  it('빈 body는 undefined(GET 등)', () => {
    const e = toApiGatewayEvent(mockReq({ body: {} }));
    expect(e.body).toBeUndefined();
  });
});

describe('sendLambdaResult — Lambda 결과 → Express 응답', () => {
  function mockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };
    return res as never as import('express').Response & typeof res;
  }

  it('statusCode·headers·body를 그대로 반영', () => {
    const res = mockRes();
    sendLambdaResult(res, { statusCode: 404, headers: { 'x-correlation-id': 'c1' }, body: '{"error":true}' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.set).toHaveBeenCalledWith({ 'x-correlation-id': 'c1' });
    expect(res.send).toHaveBeenCalledWith('{"error":true}');
  });

  it('statusCode 없으면 200 기본값', () => {
    const res = mockRes();
    sendLambdaResult(res, { body: '{}' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
