import { tableName } from '@splitlane/svc-shared';

export const PROJECT = 'splitlane';
export const STAGE = process.env.STAGE ?? 'local';
export const PORT = Number(process.env.PORT ?? 4000);
export const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';

export const tables = {
  users: tableName(PROJECT, STAGE, { name: 'Users' }),
  records: tableName(PROJECT, STAGE, { name: 'Records' }),
  standards: tableName(PROJECT, STAGE, { name: 'Standards' }),
};
