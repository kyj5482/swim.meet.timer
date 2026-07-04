import { describe, expect, it } from 'vitest';

import {
  collegeCoachPage, coachInboxPage, coachProfilePage, collegeGuidance, cutsFrom, esc,
  homePage, loginPage, matchCoach, swimCoachPage, swimGuidance,
  type CoachProfile, type ReviewRequest,
} from '../src/portal.js';

describe('포털 렌더러(순수)', () => {
  it('로그인/가입 페이지에 폼과 토글 링크', () => {
    expect(loginPage('login')).toContain('action="/web/login"');
    expect(loginPage('signup')).toContain('Create your account');
    expect(loginPage('login', 'bad')).toContain('bad');
  });

  it('홈: 미로그인은 가입 유도, 로그인은 이름·역할·메뉴', () => {
    expect(homePage(null)).toContain('Create an account');
    const h = homePage({ email: 'a@b.c', role: 'coach', displayName: 'Coach A' });
    expect(h).toContain('Coach A');
    expect(h).toContain('/web/coach/inbox'); // 코치 도구 노출
    expect(h).toContain('Soon');             // 라이브 영상 코칭 Soon
  });

  it('HTML 이스케이프로 주입 방지', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
    expect(homePage({ email: 'x', role: 'parent', displayName: '<img>' })).not.toContain('<img>');
  });

  it('수영 코치 페이지: 가이드 결과 렌더', () => {
    const cuts = cutsFrom([
      { event: '50FR', level: 'B', timeMs: 33990 },
      { event: '50FR', level: 'AAAA', timeMs: 25790 },
    ]);
    const g = swimGuidance([{ event: '50FR', course: 'SCY', totalMs: 25000 }], 12, cuts);
    const html = swimCoachPage(12, g);
    expect(html).toContain('Weekly plan');
    expect(html).toContain('youtube.com'); // 영상 링크
  });

  it('진학 코치 페이지: fit 배지 렌더', () => {
    const g = collegeGuidance('developing', { mathPct: 70, elaPct: 70 }, [], ['uchicago'], 15);
    expect(collegeCoachPage(g)).toContain('REACH');
  });

  it('코치 프로필 폼은 기존 값 채움', () => {
    const p: CoachProfile = { email: 'c', kind: 'swim', bio: 'hi', specialties: ['sprint'], ageMin: 10, ageMax: 14, levelMin: 'B', levelMax: 'A' };
    expect(coachProfilePage(p)).toContain('sprint');
  });

  it('코치 인박스: 대기중 요청에 수락/거절 버튼', () => {
    const r: ReviewRequest = { id: 'r1', fromEmail: 'p', toCoachEmail: 'c', swimmerName: 'Min', age: 12, note: 'help fly', videoUrls: ['https://x'], status: 'pending', createdAt: 0 };
    const html = coachInboxPage([r]);
    expect(html).toContain('Accept');
    expect(html).toContain('help fly');
  });
});

describe('cutsFrom / matchCoach', () => {
  it('cutsFrom는 종목별로 묶는다', () => {
    const c = cutsFrom([{ event: '50FR', level: 'B', timeMs: 1 }, { event: '50FR', level: 'A', timeMs: 2 }, { event: '100FR', level: 'B', timeMs: 3 }]);
    expect(c['50FR']!.length).toBe(2);
    expect(c['100FR']!.length).toBe(1);
  });
  it('matchCoach는 나이·종류가 맞는 코치를 고른다', () => {
    const ps: CoachProfile[] = [
      { email: 'young', kind: 'swim', bio: '', specialties: [], ageMin: 6, ageMax: 10, levelMin: 'B', levelMax: 'A' },
      { email: 'teen', kind: 'swim', bio: '', specialties: [], ageMin: 13, ageMax: 18, levelMin: 'A', levelMax: 'AAAA' },
    ];
    expect(matchCoach(ps, 'swim', 14)?.email).toBe('teen');
    expect(matchCoach(ps, 'college', 14)).toBeNull();
  });
});
