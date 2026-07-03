import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

/** common/api-spec.md 응답 규약. */
export type ErrorCode =
  | 'UNAUTHORIZED' | 'CONFLICT' | 'VALIDATION' | 'NOT_FOUND' | 'SUBSCRIPTION_REQUIRED' | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401, CONFLICT: 409, VALIDATION: 400,
  NOT_FOUND: 404, SUBSCRIPTION_REQUIRED: 403, INTERNAL: 500,
};

export function ok(body: unknown, correlationId: string): APIGatewayProxyResultV2 {
  return json(200, body, correlationId);
}

export function json(status: number, body: unknown, correlationId: string): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', 'x-correlation-id': correlationId },
    body: JSON.stringify(body),
  };
}

export function fail(code: ErrorCode, message: string, correlationId: string): APIGatewayProxyResultV2 {
  return json(STATUS[code], { error: { code, message, correlationId } }, correlationId);
}

/** 요청 correlation-id: 헤더 우선, 없으면 API GW requestId. 로그·응답·이벤트에 전파. */
export function correlationIdOf(event: APIGatewayProxyEventV2): string {
  return event.headers?.['x-correlation-id'] ?? event.requestContext?.requestId ?? 'no-corr-id';
}

export class HttpError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}
