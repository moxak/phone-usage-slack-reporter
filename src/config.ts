// src/config.ts
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// 環境変数の検証
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SLACK_WEBHOOK_URL',
  'GCP_PROJECT_ID',
  'GCP_STORAGE_BUCKET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// 設定オブジェクト
export const config = {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    apiKey: process.env.API_KEY || 'default-api-key-change-me',
    cronSchedule: process.env.CRON_SCHEDULE || '0 9 * * 1', // 毎週月曜日の午前9時
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL!
  },
  storage: {
    projectId: process.env.GCP_PROJECT_ID!,
    bucketName: process.env.GCP_STORAGE_BUCKET!,
    keyFilename: process.env.GCP_KEY_FILE || './google-credentials.json'
  }
};