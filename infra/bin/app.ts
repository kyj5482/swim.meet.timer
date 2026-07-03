import { App, Tags } from 'aws-cdk-lib';

import { ApiStack } from '../lib/api-stack.js';
import { PROJECT, REGION, stageConfig, type Stage } from '../lib/config.js';
import { DataStack } from '../lib/data-stack.js';

const app = new App();
const stage = (app.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev') as Stage;
const cfg = stageConfig(stage);
const env = { region: REGION, account: process.env.CDK_DEFAULT_ACCOUNT };

const data = new DataStack(app, `${PROJECT}-${stage}-data`, cfg, { env });
new ApiStack(app, `${PROJECT}-${stage}-api`, cfg, data, { env });

// 비용/추적 태그 (common/architecture.md)
Tags.of(app).add('project', PROJECT);
Tags.of(app).add('stage', stage);
