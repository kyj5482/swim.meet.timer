import { Logger } from '@aws-lambda-powertools/logger';

/**
 * 구조화 JSON 로거 (common/architecture.md). correlation-id를 모든 로그에 부착.
 * PII(이름·이메일) 로그 금지 — userId만.
 */
export function makeLogger(service: string): Logger {
  return new Logger({ serviceName: service, logLevel: (process.env.LOG_LEVEL as 'INFO') ?? 'INFO' });
}

export function withCorrelation(logger: Logger, correlationId: string): Logger {
  logger.appendKeys({ correlationId });
  return logger;
}
