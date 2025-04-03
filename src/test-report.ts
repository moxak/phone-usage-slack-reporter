// src/test-report.ts
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { IncomingWebhook } from '@slack/webhook';
import { PhoneUsageReporter } from './reporters/phoneUsageReporter';
import { Database } from './types/supabase';
import fs from 'fs';
import * as jestMock from 'jest-mock';

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

// テスト対象ユーザーID
const testUserId = '65327d40-517f-4ab8-8723-e2e3d697be17';

async function testReport() {
  try {
    console.log('テストレポート生成を開始します...');
    console.log(`ユーザーID: ${testUserId}`);

    // Supabaseクライアントの初期化
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // ユーザーのデータ存在確認
    const { data: userData, error: userError } = await supabase
      .from('hourly_phone_usage')
      .select('id')
      .eq('user_id', testUserId)
      .limit(1);

    if (userError) {
      console.error('Supabase接続エラー:', userError.message);
      process.exit(1);
    }

    if (!userData || userData.length === 0) {
      console.error(`指定されたユーザーID (${testUserId}) のデータが見つかりません。`);
      process.exit(1);
    }

    console.log('ユーザーデータを確認しました。レポート生成を開始します...');

    // Slack Webhookの初期化
    const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL!);

    // UploadサービスのモックアップをGCS実装の代わりに使用
    // 実際の本番環境ではこのモックを削除してください
    const mockStorage = {
      uploadImageToStorage: async (filePath: string, destination: string) => {
        console.log(`画像アップロード（モック）: ${filePath} -> ${destination}`);
        return `https://example.com/mock-image/${destination}`;
      },
      getPublicURL: (filename: string) => `https://example.com/mock-image/${filename}`
    };
    jestMock.fn(() => mockStorage);

    // レポーター初期化
    const reporter = new PhoneUsageReporter(supabase, webhook);

    // レポート送信実行
    console.log('レポート生成中...');
    await reporter.sendReport(testUserId);
    
    console.log('テストレポートが正常に送信されました！');
    process.exit(0);
  } catch (error) {
    console.error('テストレポート生成中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// テスト実行
testReport();