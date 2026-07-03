import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';

import { ApiStack } from '../lib/api-stack.js';
import { stageConfig } from '../lib/config.js';
import { DataStack } from '../lib/data-stack.js';

function build() {
  const app = new App();
  const cfg = stageConfig('dev');
  const env = { region: 'us-east-1', account: '111111111111' };
  const data = new DataStack(app, 'test-data', cfg, { env });
  const api = new ApiStack(app, 'test-api', cfg, data, { env });
  return { data: Template.fromStack(data), api: Template.fromStack(api) };
}

describe('CDK synth', () => {
  it('DynamoDB 테이블 3개 + on-demand', () => {
    const { data } = build();
    data.resourceCountIs('AWS::DynamoDB::Table', 3);
    data.hasResourceProperties('AWS::DynamoDB::Table', { BillingMode: 'PAY_PER_REQUEST' });
  });

  it('Cognito User Pool + role 커스텀 속성', () => {
    const { data } = build();
    data.resourceCountIs('AWS::Cognito::UserPool', 1);
    data.hasResourceProperties('AWS::Cognito::UserPool', {
      Schema: Match.arrayWith([Match.objectLike({ Name: 'role' })]),
    });
  });

  it('HTTP API + Lambda(X-Ray 추적)', () => {
    const { api } = build();
    api.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    api.hasResourceProperties('AWS::Lambda::Function', { TracingConfig: { Mode: 'Active' } });
  });
});
