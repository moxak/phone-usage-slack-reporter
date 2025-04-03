// src/check-data.ts
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
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

// テスト対象ユーザーID
const testUserId = '65327d40-517f-4ab8-8723-e2e3d697be17';

async function checkData() {
  try {
    console.log('データ確認を開始します...');
    console.log(`ユーザーID: ${testUserId}`);

    // Supabaseクライアントの初期化
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // hourly_phone_usageテーブルのデータ確認
    const { data: hourlyData, error: hourlyError } = await supabase
      .from('hourly_phone_usage')
      .select('*')
      .eq('user_id', testUserId)
      .order('date', { ascending: false })
      .limit(10);

    if (hourlyError) {
      console.error('hourly_phone_usageテーブル検索エラー:', hourlyError.message);
    } else {
      console.log(`\n=== hourly_phone_usage テーブルデータ (最新10件) ===`);
      if (hourlyData && hourlyData.length > 0) {
        hourlyData.forEach(row => {
          console.log(`日付: ${row.date}, 時間: ${row.hour}時, アプリ: ${row.app_name}, 使用時間: ${row.usage_time}分, 起動回数: ${row.open_count}回`);
        });
        console.log(`合計 ${hourlyData.length} 件のデータが見つかりました\n`);
      } else {
        console.log('データが見つかりませんでした');
      }
    }

    // daily_usage_summaryビューの確認
    try {
      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_usage_summary')
        .select('*')
        .eq('user_id', testUserId)
        .order('date', { ascending: false })
        .limit(7);

      if (dailyError) {
        console.error('daily_usage_summaryビュー検索エラー:', dailyError.message);
      } else {
        console.log(`\n=== daily_usage_summary ビューデータ (最新7日間) ===`);
        if (dailyData && dailyData.length > 0) {
          dailyData.forEach(row => {
            console.log(`日付: ${row.date}, 総使用時間: ${row.total_usage_time}分, ユニークアプリ数: ${row.unique_apps_used}`);
            
            // アプリ使用状況の詳細表示
            if (row.app_usage && Array.isArray(row.app_usage)) {
              console.log('  アプリ使用状況:');
              row.app_usage.slice(0, 3).forEach(app => {
                if (app) {
                  if (typeof app === 'object' && app !== null && 'appName' in app && 'usageTime' in app && 'openCount' in app) {
                    console.log(`    - ${app.appName}: ${app.usageTime}分 (${app.openCount}回起動)`);
                  }
                }
              });
              if (row.app_usage.length > 3) {
                console.log(`    - ...他 ${row.app_usage.length - 3} 個のアプリ`);
              }
            }
            console.log('');
          });
          console.log(`合計 ${dailyData.length} 日分のデータが見つかりました\n`);
        } else {
          console.log('データが見つかりませんでした');
        }
      }
    } catch (viewError) {
      console.error('daily_usage_summaryビューが存在しないか、アクセスできません:', viewError);
      console.log('ビューが正しく作成されているか確認してください。');
    }

    process.exit(0);
  } catch (error) {
    console.error('データ確認中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
checkData();