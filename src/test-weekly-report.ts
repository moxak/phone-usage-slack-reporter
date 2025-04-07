// src/test-weekly-report.ts
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { IncomingWebhook } from '@slack/webhook';
import { WeeklyReporter } from './reporters/index.js'; // reporters/index.ts 経由で WeeklyReporter をインポート
import { Database } from './types/supabase.js';
import fs from 'fs';
import * as jestMock from 'jest-mock';

// コマンドライン引数の解析
const args = process.argv.slice(2);
let userId = '65327d40-517f-4ab8-8723-e2e3d697be17'; // デフォルトのユーザーID

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--user' && i + 1 < args.length) {
    userId = args[i + 1];
  }
}

// 環境変数の読み込み
const envFiles = ['.env.local', '.env'];
envFiles.forEach(file => {
  if (fs.existsSync(path.resolve(process.cwd(), file))) {
    dotenv.config({ path: path.resolve(process.cwd(), file) });
    console.log(`${file} を読み込みました`);
  }
});

// 必須環境変数のチェック
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SLACK_WEBHOOK_URL',
];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('以下の必須環境変数が設定されていません:');
  missingEnvVars.forEach(envVar => console.error(`- ${envVar}`));
  process.exit(1);
}

async function testWeeklyReport() {
  try {
    console.log('週間レポートのテスト生成を開始します...');
    console.log(`ユーザーID: ${userId}`);

    // Supabaseクライアントの初期化
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // ユーザーの週間データ存在確認（例: daily_usage_summary ビューで直近7日分のデータが存在するか）
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('daily_usage_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('date', oneWeekAgoStr)
      .limit(1);

    if (weeklyError) {
      console.error('Supabase接続エラー:', weeklyError.message);
      process.exit(1);
    }
    if (!weeklyData || weeklyData.length === 0) {
      console.error(`指定されたユーザーID (${userId}) の週間データが見つかりません。`);
      process.exit(1);
    }
    console.log('ユーザーデータを確認しました。週間レポート生成を開始します...');

    // Slack Webhook の初期化
    const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL!);

    // Uploadサービスのモック（本番では実際の実装に置き換えてください）
    const mockStorage = {
      uploadImageToStorage: async (filePath: string, destination: string) => {
        console.log(`画像アップロード（モック）: ${filePath} -> ${destination}`);
        return `https://example.com/mock-image/${destination}`;
      },
      getPublicURL: (filename: string) => `https://example.com/mock-image/${filename}`
    };
    jestMock.fn(() => mockStorage);

    // WeeklyReporter の初期化
    const weeklyReporter = new WeeklyReporter(supabase, webhook);

    // 週間レポート送信実行
    console.log('週間レポート生成中...');
    await weeklyReporter.sendReport(userId);

    console.log('週間レポートが正常に送信されました！');
    process.exit(0);
  } catch (error) {
    console.error('週間レポート生成中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 使用方法の表示
function printUsage() {
  console.log(`
使用方法: npm run test-weekly-report -- [オプション]

オプション:
  --user <id>     ユーザーIDを指定 (デフォルト: 65327d40-517f-4ab8-8723-e2e3d697be17)

例:
  npm run test-weekly-report
  npm run test-weekly-report -- --user 123456-abcdef
  `);
}

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

// テスト実行
testWeeklyReport();
