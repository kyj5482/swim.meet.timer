import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiGet, apiPut, ApiError, checkHealth } from './client';

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return vi.fn().mockResolvedValue({
    ok, status,
    text: async () => JSON.stringify(body),
  } as Response);
}

describe('apiGet / apiPut', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('베이스 URL 없으면 즉시 실패(요청 안 보냄)', async () => {
    await expect(apiGet({ baseUrl: '' }, '/records')).rejects.toThrow(ApiError);
  });

  it('성공 응답을 그대로 반환', async () => {
    const fetchMock = mockFetch(200, { records: [] });
    vi.stubGlobal('fetch', fetchMock);
    const res = await apiGet<{ records: unknown[] }>({ baseUrl: 'http://x/v1' }, '/records?swimmerId=s1');
    expect(res.records).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://x/v1/records?swimmerId=s1',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-dev-user': 'mobile-app', 'x-dev-role': 'coach' }) }),
    );
  });

  it('베이스 URL 끝 슬래시 정리', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);
    await apiGet({ baseUrl: 'http://x/v1/' }, '/records');
    expect(fetchMock).toHaveBeenCalledWith('http://x/v1/records', expect.anything());
  });

  it('devUser/devRole 오버라이드 헤더 반영', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);
    await apiGet({ baseUrl: 'http://x/v1', devUser: 'me', devRole: 'parent' }, '/records');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-dev-user': 'me', 'x-dev-role': 'parent' }) }),
    );
  });

  it('에러 응답은 ApiError(code/message/correlationId)로 변환', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { error: { code: 'NOT_FOUND', message: 'nope', correlationId: 'c1' } }));
    await expect(apiGet({ baseUrl: 'http://x/v1' }, '/records')).rejects.toMatchObject({
      code: 'NOT_FOUND', message: 'nope', correlationId: 'c1',
    });
  });

  it('apiPut은 body를 JSON 직렬화해 PUT으로 전송', async () => {
    const fetchMock = mockFetch(200, { upserted: 1 });
    vi.stubGlobal('fetch', fetchMock);
    await apiPut({ baseUrl: 'http://x/v1' }, '/records/batch', { records: [{ id: 'r1' }] });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://x/v1/records/batch',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ records: [{ id: 'r1' }] }) }),
    );
  });
});

describe('checkHealth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('/v1 접미사를 떼고 /health를 호출', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const ok = await checkHealth('http://x:4000/v1');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://x:4000/health');
  });

  it('네트워크 실패는 false(throw 안 함)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    expect(await checkHealth('http://x:4000/v1')).toBe(false);
  });
});
