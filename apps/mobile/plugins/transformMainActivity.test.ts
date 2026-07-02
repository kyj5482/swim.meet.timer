import { describe, expect, it } from 'vitest';
import { transformMainActivity } from './transformMainActivity';

const SAMPLE = `package com.example.app

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

describe('withVolumeLap MainActivity 변환', () => {
  it('onKeyDown 훅을 클래스 선언 뒤에 삽입한다', () => {
    const out = transformMainActivity(SAMPLE);
    expect(out).toContain('VolumeLapKeyHandler.onKeyDown(keyCode, event)');
    expect(out.indexOf('override fun onKeyDown')).toBeGreaterThan(out.indexOf('class MainActivity'));
    expect(out).toContain('return super.onKeyDown(keyCode, event)');
  });
  it('멱등: 두 번 적용해도 훅은 1개', () => {
    const once = transformMainActivity(SAMPLE);
    const twice = transformMainActivity(once);
    expect(twice).toBe(once);
    expect(twice.match(/override fun onKeyDown/g)?.length).toBe(1);
  });
  it('앵커를 못 찾으면 명확히 실패한다', () => {
    expect(() => transformMainActivity('class Other {}')).toThrow(/MainActivity/);
  });
});
