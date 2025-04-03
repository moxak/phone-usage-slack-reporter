import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 環境変数の読み込み順序
// 1. .env.{NODE_ENV}.local
// 2. .env.local
// 3. .env.{NODE_ENV}
// 4. .env

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

// 必須環境変数の検証
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SLACK_WEBHOOK_URL'
];

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
    // 週間レポートのCronスケジュール（デフォルト：毎週月曜午前9時）
    cronSchedule: process.env.CRON_SCHEDULE || '0 9 * * 1',
    // 毎時レポートのCronスケジュール（デフォルト：毎時0分）
    hourlySchedule: process.env.HOURLY_CRON_SCHEDULE || '0 * * * *',
    // 日次レポートのCronスケジュール（デフォルト：毎日午前10時）
    dailySchedule: process.env.DAILY_CRON_SCHEDULE || '0 10 * * *',
    logLevel: process.env.LOG_LEVEL || 'info',
    env: NODE_ENV
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'phone-usage-reports'
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL!
  }
};

// ログ出力（機密情報除く）
console.log('アプリケーション設定を読み込みました:');
console.log(`- 環境: ${config.app.env}`);
console.log(`- ポート: ${config.app.port}`);
console.log(`- ログレベル: ${config.app.logLevel}`);
console.log(`- Cronスケジュール (週間): ${config.app.cronSchedule}`);
console.log(`- Cronスケジュール (毎時): ${config.app.hourlySchedule}`);
console.log(`- Cronスケジュール (日次): ${config.app.dailySchedule}`);
console.log(`- Supabase URL: ${config.supabase.url}`);
console.log(`- Supabase Storage バケット: ${config.supabase.storageBucket}`);
