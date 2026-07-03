import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { TABLE_DEFS, tableName as sharedTableName } from '@splitlane/svc-shared';
import { PROJECT, type StageConfig } from './config.js';

/**
 * DynamoDB(서비스별 단일 테이블, on-demand) + Cognito User Pool(역할 커스텀 속성).
 * 테이블 정의는 services/_shared/table-schema.ts가 단일 소스 —
 * tools/local-api(DynamoDB Local)도 같은 정의로 테이블을 만든다.
 */
export class DataStack extends Stack {
  readonly usersTable: dynamodb.Table;
  readonly recordsTable: dynamodb.Table;
  readonly standardsTable: dynamodb.Table;
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, cfg: StageConfig, props?: StackProps) {
    super(scope, id, props);
    const removal = cfg.removalRetain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const tables: Record<string, dynamodb.Table> = {};
    for (const def of TABLE_DEFS) {
      const t = new dynamodb.Table(this, def.name, {
        tableName: sharedTableName(PROJECT, cfg.stage, def),
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 사용량 0 → 비용 0
        pointInTimeRecovery: cfg.stage === 'prod',
        removalPolicy: removal,
      });
      for (const gsi of def.gsis ?? []) {
        t.addGlobalSecondaryIndex({
          indexName: gsi.indexName,
          partitionKey: { name: gsi.pk, type: dynamodb.AttributeType.STRING },
          sortKey: { name: gsi.sk, type: dynamodb.AttributeType.STRING },
        });
      }
      tables[def.name] = t;
    }
    this.usersTable = tables.Users!;
    this.recordsTable = tables.Records!;
    this.standardsTable = tables.Standards!;

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${PROJECT}-${cfg.stage}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      customAttributes: { role: new cognito.StringAttribute({ mutable: true }) },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireDigits: true },
      removalPolicy: removal,
    });
    this.userPoolClient = this.userPool.addClient('AppClient', {
      authFlows: { userSrp: true },
      idTokenValidity: undefined,
    });
  }
}
