// src/test-report-with-mock.ts
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { IncomingWebhook } from '@slack/webhook';
import { PhoneUsageReporter } from './reporters/phoneUsageReporter';
import { Database } from './types/supabase';
import fs from 'fs';

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

// モックデータ生成関数 - データがない場合に使用
async function createMockData(supabase) {
  console.log('モックデータを生成します...');
  
  // 今日の日付
  const today = new Date();
  
  // 過去7日間のデータを生成
  const mockEntries = [];
  const appNames = ['LINE', 'Twitter', 'Instagram', 'YouTube', 'Chrome', 'TikTok', 'Game1', 'Game2'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // 各時間帯にランダムなデータを生成
    for (let hour = 0; hour < 24; hour++) {
      // 一般的な使用パターンをシミュレート（朝と夜に使用時間が増加）
      let usageProbability = 0.3;
      if (hour >= 7 && hour <= 9) usageProbability = 0.6; // 朝
      if (hour >= 18 && hour <= 22) usageProbability = 0.8; // 夜
      
      // この時間帯でスマホを使用する確率
      if (Math.random() < usageProbability) {
        // 使用するアプリ数を決定（1〜3個）
        const appCount = Math.floor(Math.random() * 3) + 1;
        
        // ランダムなアプリを選択
        const shuffledApps = [...appNames].sort(() => 0.5 - Math.random());
        const selectedApps = shuffledApps.slice(0, appCount);
        
        // 各アプリの使用時間と起動回数を生成
        selectedApps.forEach(app => {
          const usageTime = Math.floor(Math.random() * 20) + 1; // 1〜20分
          const openCount = Math.floor(Math.random() * 5) + 1; // 1〜5回
          
          mockEntries.push({
            user_id: testUserId,
            date: dateStr,
            hour,
            app_name: app,
            usage_time: usageTime,
            open_count: openCount
          });
        });
      }
    }
  }
  
  // バッチでデータを挿入（100件ずつ）
  const batchSize = 100;
  for (let i = 0; i < mockEntries.length; i += batchSize) {
    const batch = mockEntries.slice(i, i + batchSize);
    const { error } = await supabase.from('hourly_phone_usage').insert(batch);
    if (error) {
      console.error('モックデータ挿入エラー:', error);
      throw error;
    }
  }
  
  console.log(`${mockEntries.length}件のモックデータを生成しました`);
}

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

    // データがない場合はモックデータを生成
    if (!userData || userData.length === 0) {
      console.log(`指定されたユーザーID (${testUserId}) のデータが見つかりません。モックデータを生成します。`);
      await createMockData(supabase);
    } else {
      console.log('ユーザーデータを確認しました。');
    }

    console.log('レポート生成を開始します...');

    // Slack Webhookの初期化
    const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL!);

    // ストレージのモック化 (GCSの代わりに一時URL生成)
    const mockStorageModule = {
      uploadImageToStorage: async (filePath: string, destination: string) => {
        console.log(`画像アップロード（モック）: ${filePath} -> ${destination}`);
        // 実際の画像ファイルパスを返す（テスト用）
        return `file://${filePath}`;
      },
      getPublicURL: (filename: string) => `https://example.com/mock-image/${filename}`
    };

    // レポーター初期化（カスタムストレージを使用）
    const reporter = new PhoneUsageReporter(supabase, webhook);
    
    // アップロード関数をモックに置き換え
    reporter['uploadImageToStorage'] = mockStorageModule.uploadImageToStorage;

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