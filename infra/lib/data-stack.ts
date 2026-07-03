import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { PROJECT, type StageConfig } from './config.js';

/** DynamoDB(서비스별 단일 테이블, on-demand) + Cognito User Pool(역할 커스텀 속성). */
export class DataStack extends Stack {
  readonly usersTable: dynamodb.Table;
  readonly recordsTable: dynamodb.Table;
  readonly standardsTable: dynamodb.Table;
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, cfg: StageConfig, props?: StackProps) {
    super(scope, id, props);
    const removal = cfg.removalRetain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const table = (name: string, sortKey = true) =>
      new dynamodb.Table(this, name, {
        tableName: `${PROJECT}-${cfg.stage}-${name.toLowerCase()}`,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        ...(sortKey ? { sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING } } : {}),
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 사용량 0 → 비용 0
        pointInTimeRecovery: cfg.stage === 'prod',
        removalPolicy: removal,
      });

    this.usersTable = table('Users');
    this.recordsTable = table('Records');
    this.recordsTable.addGlobalSecondaryIndex({
      indexName: 'byEvent',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventDate', type: dynamodb.AttributeType.STRING },
    });
    this.standardsTable = table('Standards');

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
