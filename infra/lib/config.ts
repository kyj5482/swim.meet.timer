/** 스테이지 설정 (common/architecture.md). us-east-1, on-demand, 최소 비용. */
export type Stage = 'dev' | 'prod';

export interface StageConfig {
  stage: Stage;
  /** CloudWatch 로그 보존일 (dev 7 / prod 30) */
  logRetentionDays: number;
  /** 월 예산 알람(USD) */
  monthlyBudgetUsd: number;
  /** 삭제 정책: dev는 destroy, prod는 retain */
  removalRetain: boolean;
}

export function stageConfig(stage: Stage): StageConfig {
  return stage === 'prod'
    ? { stage, logRetentionDays: 30, monthlyBudgetUsd: 100, removalRetain: true }
    : { stage, logRetentionDays: 7, monthlyBudgetUsd: 20, removalRetain: false };
}

export const PROJECT = 'splitlane';
export const REGION = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';
