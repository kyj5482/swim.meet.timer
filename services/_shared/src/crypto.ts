import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * 필드 단위 봉투 암호화(AES-256-GCM) — 고객 개인정보(학업 점수·성적 PDF 텍스트·
 * 이메일 등 PII)를 **저장 시 암호화**한다. common/architecture.md의 "고객 데이터
 * 수준 보안" 요구를 충족.
 *
 * 설계:
 * - 대칭키는 환경변수 DATA_ENCRYPTION_KEY(base64, 32바이트) — AWS에서는 KMS
 *   데이터 키(암호화된 채로 저장, 사용 시 복호)로 주입한다. 코드·리포엔 키 없음.
 * - 레코드마다 12바이트 IV 랜덤 생성(재사용 금지 — GCM 안전성 핵심).
 * - 출력 봉투: `v1:<iv b64>:<tag b64>:<ciphertext b64>` — 버전 프리픽스로
 *   후방호환(키 로테이션·알고리즘 교체 시 v2 추가, 기존 데이터 그대로 복호).
 * - 복호는 인증 태그를 검증하므로 변조 시 예외(무결성 보장).
 *
 * 저장 규칙: 평문 PII를 DynamoDB에 절대 쓰지 않는다 — 항상 encryptField() 후 저장,
 * 조회 후 decryptField(). 로그엔 평문/암호문 모두 남기지 않는다(userId만).
 */

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';

/** 32바이트 대칭키. 미설정 시 예외(안전 실패 — 평문 저장 방지). */
export function encryptionKey(): Buffer {
  const b64 = process.env.DATA_ENCRYPTION_KEY;
  if (!b64) throw new Error('DATA_ENCRYPTION_KEY not set — refusing to store PII in plaintext');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error(`DATA_ENCRYPTION_KEY must be 32 bytes (got ${key.length})`);
  return key;
}

/** 로컬 개발용 키 생성 헬퍼(base64). 프로덕션은 KMS. */
export function generateKeyBase64(): string {
  return randomBytes(32).toString('base64');
}

/** 평문 → 봉투 문자열. key 미지정 시 env에서 읽는다. */
export function encryptField(plaintext: string, key: Buffer = encryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** 봉투 문자열 → 평문. 버전/형식 불일치·변조 시 예외. */
export function decryptField(envelope: string, key: Buffer = encryptionKey()): string {
  const parts = envelope.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('bad ciphertext envelope');
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64!, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64!, 'base64')), decipher.final()]).toString('utf8');
}

/** 봉투 문자열인지(암호화된 필드인지) 판별 — 마이그레이션·이중 처리 방지용. */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}
