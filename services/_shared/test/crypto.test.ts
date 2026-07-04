import { describe, expect, it } from 'vitest';

import { decryptField, encryptField, generateKeyBase64, isEncrypted } from '../src/crypto.js';

const KEY = Buffer.from(generateKeyBase64(), 'base64');

describe('필드 암호화(AES-256-GCM) — 고객 데이터 저장 시 암호화', () => {
  it('암호화→복호화 왕복이 원문과 일치', () => {
    const pt = 'Math 780 / ELA 740 · IEP: none';
    const env = encryptField(pt, KEY);
    expect(env).not.toContain('780');       // 암호문에 평문 노출 없음
    expect(decryptField(env, KEY)).toBe(pt);
  });

  it('같은 평문도 매번 다른 암호문(IV 랜덤)', () => {
    const a = encryptField('secret', KEY);
    const b = encryptField('secret', KEY);
    expect(a).not.toBe(b);
    expect(decryptField(a, KEY)).toBe('secret');
    expect(decryptField(b, KEY)).toBe('secret');
  });

  it('변조된 암호문은 복호 시 예외(무결성 보장)', () => {
    const env = encryptField('sensitive', KEY);
    const tampered = env.slice(0, -4) + 'AAAA';
    expect(() => decryptField(tampered, KEY)).toThrow();
  });

  it('다른 키로는 복호 불가', () => {
    const env = encryptField('sensitive', KEY);
    const other = Buffer.from(generateKeyBase64(), 'base64');
    expect(() => decryptField(env, other)).toThrow();
  });

  it('버전 프리픽스로 암호화 필드 판별', () => {
    expect(isEncrypted(encryptField('x', KEY))).toBe(true);
    expect(isEncrypted('plain text')).toBe(false);
  });

  it('32바이트가 아닌 키/잘못된 봉투는 예외', () => {
    expect(() => encryptField('x', Buffer.alloc(16))).toThrow();
    expect(() => decryptField('not-an-envelope', KEY)).toThrow();
  });
});
