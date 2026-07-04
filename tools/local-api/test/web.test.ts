import { describe, expect, it } from 'vitest';

import { eventName, fmtTotal, renderRecordsPage, type WebRecord } from '../src/web.js';

const rec = (over: Partial<WebRecord> = {}): WebRecord => ({
  swimmerId: 'sw1', id: 'r1', date: Date.UTC(2026, 6, 1, 14, 30),
  stroke: 'free', distance: 50, course: '25y', totalMs: 31230, status: 'finished',
  ...over,
});

describe('web viewer 렌더링', () => {
  it('시간 포맷: 분 유무에 따라 s.hh / m:ss.hh', () => {
    expect(fmtTotal(31230)).toBe('31.23');
    expect(fmtTotal(92450)).toBe('1:32.45');
  });

  it('종목 이름은 앱과 동일한 미트 표기', () => {
    expect(eventName({ stroke: 'free', distance: 50, course: '25y' })).toBe('50 Yard Free');
    expect(eventName({ stroke: 'fly', distance: 100, course: '50m' })).toBe('100 Meter Fly');
  });

  it('선수별 섹션으로 묶고 최신 기록이 먼저', () => {
    const html = renderRecordsPage([
      rec({ id: 'a', date: Date.UTC(2026, 6, 1) }),
      rec({ id: 'b', date: Date.UTC(2026, 6, 3), totalMs: 30990 }),
      rec({ id: 'c', swimmerId: 'sw2' }),
    ]);
    expect(html).toContain('sw1');
    expect(html).toContain('sw2');
    expect(html.indexOf('30.99')).toBeLessThan(html.indexOf('31.23')); // 최신(더 빠른 날짜) 먼저
  });

  it('tombstone(deleted)은 제외, DNF는 시간 대신 DNF', () => {
    const html = renderRecordsPage([
      rec({ id: 'gone', deleted: true, totalMs: 11111 }),
      rec({ id: 'dnf', status: 'dnf' }),
    ]);
    expect(html).not.toContain('11.11');
    expect(html).toContain('DNF');
  });

  it('기록 없으면 안내 문구', () => {
    expect(renderRecordsPage([])).toContain('No records synced yet');
  });

  it('swimmerId의 HTML 특수문자는 이스케이프', () => {
    const html = renderRecordsPage([rec({ swimmerId: '<img>' })]);
    expect(html).not.toContain('<img>');
    expect(html).toContain('&lt;img&gt;');
  });
});
