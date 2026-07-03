import { describe, expect, it } from 'vitest';

import { claimsOf } from '../src/auth.js';
import { correlationIdOf, fail, HttpError, ok } from '../src/http.js';

describe('http 응답 규약', () => {
  it('ok/fail 포맷 + correlation-id 헤더', () => {
    const res = ok({ a: 1 }, 'c1') as { statusCode: number; headers: Record<string, string>; body: string };
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-correlation-id']).toBe('c1');
    expect(JSON.parse(res.body).a).toBe(1);

    const err = fail('NOT_FOUND', 'nope', 'c1') as { statusCode: number; body: string };
    expect(err.statusCode).toBe(404);
    expect(JSON.parse(err.body).error.code).toBe('NOT_FOUND');
  });

  it('correlationIdOf: 헤더 우선, 없으면 requestId', () => {
    expect(correlationIdOf({ headers: { 'x-correlation-id': 'h' }, requestContext: { requestId: 'r' } } as never)).toBe('h');
    expect(correlationIdOf({ headers: {}, requestContext: { requestId: 'r' } } as never)).toBe('r');
  });
});

describe('auth 클레임', () => {
  it('sub → userId, custom:role → role', () => {
    const c = claimsOf({ requestContext: { authorizer: { jwt: { claims: { sub: 'u1', 'custom:role': 'parent', email: 'x@y.z' } } } } } as never);
    expect(c).toEqual({ userId: 'u1', role: 'parent', email: 'x@y.z' });
  });
  it('sub 없으면 UNAUTHORIZED', () => {
    expect(() => claimsOf({ requestContext: {} } as never)).toThrow(HttpError);
  });
  it('role 기본값 swimmer', () => {
    expect(claimsOf({ requestContext: { authorizer: { jwt: { claims: { sub: 'u2' } } } } } as never).role).toBe('swimmer');
  });
});
