import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { HttpError } from './http.js';

export type Role = 'swimmer' | 'coach' | 'parent';

export interface Claims {
  userId: string;   // Cognito sub
  role: Role;
  email?: string;
}

/**
 * API GW HTTP API + Cognito JWT authorizer가 실은 클레임을 파싱.
 * (authorizer가 검증을 마친 뒤라 여기선 신뢰 가능.)
 */
export function claimsOf(event: APIGatewayProxyEventV2): Claims {
  const jwt = (event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, string> } } })
    ?.authorizer?.jwt?.claims;
  const userId = jwt?.sub;
  if (!userId) throw new HttpError('UNAUTHORIZED', 'missing subject');
  const role = (jwt?.['custom:role'] as Role) ?? 'swimmer';
  return { userId, role, email: jwt?.email };
}

/** 리소스 소유/열람 권한 검사 헬퍼(선수 본인·부모·코치 매핑은 records/auth가 Relation으로 확인). */
export function assertCanViewSwimmer(claims: Claims, allowedSwimmerIds: string[], swimmerId: string): void {
  if (!allowedSwimmerIds.includes(swimmerId)) {
    throw new HttpError('UNAUTHORIZED', 'not permitted for this swimmer');
  }
}
