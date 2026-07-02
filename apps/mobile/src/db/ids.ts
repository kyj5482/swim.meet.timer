/**
 * 시간순 정렬 가능한 클라이언트 생성 id (common/data-model.md — 서버 멱등 키).
 * 형식: <epoch ms 12자리 hex><랜덤 10자리> — UUIDv7과 같은 성질(시간 prefix).
 */
export function newId(now: number = Date.now()): string {
  const time = now.toString(16).padStart(12, '0');
  let rand = '';
  for (let i = 0; i < 10; i++) rand += Math.floor(Math.random() * 36).toString(36);
  return `${time}${rand}`;
}

/** id에서 생성 시각(epoch ms) 복원. */
export function idTime(id: string): number {
  return parseInt(id.slice(0, 12), 16);
}
