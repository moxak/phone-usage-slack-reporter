// src/config.ts
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 環境変数の読み込み順序
// 1. .env.local（ローカル環境固有の設定、gitignore対象）
// 2. .env.{NODE_ENV}.local（環境固有のローカル設定、gitignore対象）
// 3. .env.{NODE_ENV}（環境固有の設定）
// 4. .env（デフォルト設定）

const NODE_ENV = process.env.NODE_ENV || 'development';

// 存在するファイルのみ読み込む
const envFiles = [
  `.env.${NODE_ENV}.local`,
  `.env.local`,
  `.env.${NODE_ENV}`,
  '.env'
].filter(file => fs.existsSync(path.resolve(process.cwd(), file)));

// 各ファイルを順番に読み込む
envFiles.forEach(file => {
  dotenv.config({ path: path.resolve(process.cwd(), file) });
});

// 環境変数の検証
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SLACK_WEBHOOK_URL'
];

// GCP関連の環境変数を必須から削除（Supabase Storageを使用するため）
// GCPのストレージ関連の設定は不要になります

// 不足している環境変数をチェック
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('以下の必須環境変数が設定されていません:');
  missingEnvVars.forEach(envVar => console.error(`- ${envVar}`));
  console.error('適切な.envファイルが設定されているか確認してください。');
  process.exit(1);
}

// 設定オブジェクト
export const config = {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    apiKey: process.env.API_KEY || 'default-api-key-change-me',
    cronSchedule: process.env.CRON_SCHEDULE || '0 9 * * 1', // 毎週月曜日の午前9時
    logLevel: process.env.LOG_LEVEL || 'info',
    env: NODE_ENV
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'phone-usage-reports' // デフォルトバケット名
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL!
  }
};

// 設定内容をロギング（機密情報は除く）
console.log('アプリケーション設定を読み込みました:');
console.log(`- 環境: ${config.app.env}`);
console.log(`- ポート: ${config.app.port}`);
console.log(`- ログレベル: ${config.app.logLevel}`);
console.log(`- Cronスケジュール: ${config.app.cronSchedule}`);
console.log(`- Supabase URL: ${config.supabase.url}`);
console.log(`- Supabase Storage バケット: ${config.supabase.storageBucket}`);