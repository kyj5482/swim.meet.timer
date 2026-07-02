# 공통 데이터 모델

클라이언트 로컬(SQLite)과 백엔드(DynamoDB)가 같은 논리 모델을 공유한다.
원본 상세: `docs/04-data-model.md` (Swimmer, Target, Split, TrainingRecord,
SessionLog, SlotResult, TapEvent, SetPreset, AppPrefs — 그대로 유효).

## 클라이언트 추가 규칙 (동기화 대비)
- 모든 id는 **클라이언트 생성 UUIDv7**(시간순 정렬 가능, 서버 멱등 키).
- 모든 행에 `updatedAt`(epoch ms), `deleted?: boolean`(tombstone) — 델타 동기화용.
- ms는 정수로 저장. 반올림은 표시 계층에서만.

## 백엔드 확장 엔티티

```ts
interface User {            // auth 서비스
  userId: string;           // Cognito sub
  role: 'swimmer'|'coach'|'parent';
  displayName: string;
  swimmerIds: string[];     // 소유(부모) 또는 열람(코치) 대상
}
interface Relation {        // 공유 권한
  swimmerId: string; viewerUserId: string;
  level: 'owner'|'write'|'read';
}
interface SwimmerProfile {  // 선수 메타(동기화 대상)
  swimmerId: string; birthDate?: number; gender?: 'M'|'F';
  clubId?: string; currentGroup?: string;   // 예: 'AGD-SILVER'
}
interface TargetSetting {   // standards 서비스
  swimmerId: string; event: EventKey;       // 예: '100FR-SCY'
  type: 'standard'|'clubGroup'|'customTime';
  ref: string;              // 'usa-swimming/2024-2028/AA' | 'nova-va/AGD-GOLD' | 'ms'
  targetMs: number; targetDate?: number;
}
interface Entitlement {     // 구독
  userId: string; product: 'ai-coach';
  status: 'active'|'expired'; expiresAt: number; store: 'apple'|'google';
}
type EventKey = `${number}${'FR'|'BK'|'BR'|'FL'|'IM'}-${'SCY'|'LCM'|'SCM'}`;
```

## DynamoDB 키 설계 (서비스별 단일 테이블)

| 테이블 | PK | SK | 주요 GSI |
| --- | --- | --- | --- |
| Users | `USER#userId` | `PROFILE` / `REL#swimmerId` | GSI1: `SWIMMER#id`→viewers |
| Records | `SWIMMER#id` | `REC#updatedAt#recordId` | GSI1: `SWIMMER#id / EVENT#key#date` (이벤트별 추세 조회) |
| Standards | `STD#authority#season#course` | `#gender#age#event#level` | — (전량 캐시 가능, 불변 데이터) |
| Targets | `SWIMMER#id` | `TARGET#event` | — |
| Entitlements | `USER#id` | `ENT#product` | — |

접근 패턴이 바뀌면 이 표를 먼저 갱신하고 서비스 티켓을 만든다.
