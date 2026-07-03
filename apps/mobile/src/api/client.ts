/**
 * common/api-spec.md 클라이언트 — tools/local-api(로컬) 또는 실제 AWS API GW
 * 둘 다 이 클라이언트로 붙는다(베이스 URL만 다름). 로컬 개발 중엔 실제 로그인이
 * 없으므로 tools/local-api가 인식하는 x-dev-user/x-dev-role 헤더를 보낸다 —
 * 이 헤더는 AWS 배포본에서는 무시된다(Cognito authorizer가 별도로 검증).
 */
export class ApiError extends Error {
  constructor(public code: string, message: string, public correlationId?: string) {
    super(message);
  }
}

export interface ApiConfig {
  baseUrl: string;
  devUser?: string;
  devRole?: 'swimmer' | 'coach' | 'parent';
}

async function request<T>(cfg: ApiConfig, path: string, init?: RequestInit): Promise<T> {
  if (!cfg.baseUrl) throw new ApiError('VALIDATION', 'server URL not set');
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-dev-user': cfg.devUser ?? 'mobile-app',
      'x-dev-role': cfg.devRole ?? 'coach',
      ...init?.headers,
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? 'INTERNAL', body?.error?.message ?? res.statusText, body?.error?.correlationId);
  }
  return body as T;
}

export function apiGet<T>(cfg: ApiConfig, path: string): Promise<T> {
  return request<T>(cfg, path, { method: 'GET' });
}

export function apiPut<T>(cfg: ApiConfig, path: string, body: unknown): Promise<T> {
  return request<T>(cfg, path, { method: 'PUT', body: JSON.stringify(body) });
}

/** 서버 도달 확인 — 헬스체크는 /health(v1 프리픽스 밖)에 있다. */
export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    const root = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const res = await fetch(`${root}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
