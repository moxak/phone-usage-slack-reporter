// src/test-storage.ts
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { uploadImageToStorage, getPublicURL, deleteFile } from './utils/storage';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

// 環境変数の読み込み
const envFiles = ['.env.local', '.env'];
envFiles.forEach(file => {
  if (fs.existsSync(path.resolve(process.cwd(), file))) {
    dotenv.config({ path: path.resolve(process.cwd(), file) });
    console.log(`${file} を読み込みました`);
  }
});

// サンプルグラフの作成
async function createSampleChart(): Promise<string> {
  console.log('サンプルグラフを生成しています...');
  
  // グラフ生成用キャンバス
  const width = 800;
  const height = 400;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
  
  // 単純な棒グラフを作成
  const configuration = {
    type: 'bar' as const,
    data: {
      labels: ['月', '火', '水', '木', '金', '土', '日'],
      datasets: [{
        label: 'テスト使用時間 (分)',
        data: [65, 59, 80, 81, 56, 90, 70],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Supabase Storage テスト',
          font: {
            size: 18
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  };
  
  // グラフ画像をバッファとして生成
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  
  // 一時ファイルパス
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, `test_chart_${Date.now()}.png`);
  fs.writeFileSync(filePath, buffer);
  
  console.log(`サンプルグラフを生成しました: ${filePath}`);
  return filePath;
}

// Supabase Storageのテスト
async function testStorage() {
  try {
    console.log('Supabase Storageテストを開始します...');
    
    // 1. サンプルグラフの生成
    const filePath = await createSampleChart();
    
    // 2. ファイルのアップロード
    console.log('ファイルをアップロードしています...');
    const timestamp = Date.now();
    const destination = `test/storage_test_${timestamp}.png`;
    const publicUrl = await uploadImageToStorage(filePath, destination);
    
    console.log('ファイルのアップロードに成功しました');
    console.log(`パス: ${destination}`);
    console.log(`公開URL: ${publicUrl}`);
    
    // 3. URLの取得テスト
    console.log('\ngetPublicURL関数をテストしています...');
    const retrievedUrl = getPublicURL(destination);
    console.log(`取得したURL: ${retrievedUrl}`);
    
    if (publicUrl === retrievedUrl) {
      console.log('✅ URL取得テスト成功: URLが一致しました');
    } else {
      console.error('❌ URL取得テスト失敗: URLが一致しません');
    }
    
    // 4. ファイル削除テスト（オプション）
    const shouldDelete = process.argv.includes('--delete');
    if (shouldDelete) {
      console.log('\nファイルの削除をテストしています...');
      await deleteFile(destination);
      console.log('✅ ファイル削除テスト成功');
    } else {
      console.log('\nファイル削除テストはスキップします。削除するには --delete オプションを付けて実行してください。');
    }
    
    // 一時ファイルを削除
    fs.unlinkSync(filePath);
    console.log('一時ファイルを削除しました');
    
    console.log('\nテスト完了! ✨');
    process.exit(0);
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// テスト実行
testStorage();