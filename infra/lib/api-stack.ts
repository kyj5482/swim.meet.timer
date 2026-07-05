import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

import { PROJECT, type StageConfig } from './config.js';
import type { DataStack } from './data-stack.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const svc = (p: string) => path.resolve(here, '..', '..', 'services', p);

/** HTTP API Gateway + 서비스별 Lambda(NodejsFunction) + Cognito JWT authorizer. */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, cfg: StageConfig, data: DataStack, props?: StackProps) {
    super(scope, id, props);

    const commonEnv = (service: string): Record<string, string> => ({
      SERVICE_NAME: service,
      LOG_LEVEL: cfg.stage === 'prod' ? 'INFO' : 'DEBUG',
      POWERTOOLS_SERVICE_NAME: service,
    });

    const fn = (name: string, entry: string, env: Record<string, string>) =>
      new NodejsFunction(this, name, {
        functionName: `${PROJECT}-${cfg.stage}-${name}`,
        entry,
        handler: 'handler',
        runtime: undefined, // 기본 최신 Node
        memorySize: 256,
        timeout: Duration.seconds(10),
        tracing: Tracing.ACTIVE, // X-Ray
        logRetention: cfg.logRetentionDays as unknown as logs.RetentionDays,
        environment: env,
        bundling: { format: undefined, minify: cfg.stage === 'prod', sourceMap: true },
      });

    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${data.userPool.userPoolId}`,
      { jwtAudience: [data.userPoolClient.userPoolClientId] },
    );

    const api = new HttpApi(this, 'HttpApi', {
      apiName: `${PROJECT}-${cfg.stage}`,
      defaultAuthorizer: authorizer,
    });

    // 표준기록: 공개(인증 불필요) — 앱이 로그인 전에도 타겟 표준을 읽음
    const standardsFn = fn('standards', svc('standards/src/handler.ts'), {
      ...commonEnv('standards'), STANDARDS_TABLE: data.standardsTable.tableName,
    });
    data.standardsTable.grantReadData(standardsFn);
    api.addRoutes({
      path: '/v1/standards', methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('StdInt', standardsFn), authorizer: undefined,
    });
    api.addRoutes({
      path: '/v1/standards/clubs/{clubId}/groups', methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('ClubInt', standardsFn), authorizer: undefined,
    });

    // 기록 동기화: 인증 필요(기본 authorizer)
    const recordsFn = fn('records', svc('records/src/handler.ts'), {
      ...commonEnv('records'), RECORDS_TABLE: data.recordsTable.tableName,
    });
    data.recordsTable.grantReadWriteData(recordsFn);
    api.addRoutes({
      path: '/v1/records/batch', methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration('RecPut', recordsFn),
    });
    api.addRoutes({
      path: '/v1/records', methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('RecGet', recordsFn),
    });
    // 이스터 에그 게임 리더보드(api-spec §game) — records 핸들러가 서빙, 인증 필요
    api.addRoutes({
      path: '/v1/game/scores', methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration('GameScorePut', recordsFn),
    });
    api.addRoutes({
      path: '/v1/game/leaderboard', methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GameBoardGet', recordsFn),
    });
  }
}
