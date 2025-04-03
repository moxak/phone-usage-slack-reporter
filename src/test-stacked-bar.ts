// src/test-hourly-stacked.ts
import { generateHourlyStackedBarChart } from './utils/chart-generator';

async function testHourlyStackedBarChart() {
  try {
    console.log('時間帯別積み上げ棒グラフのテストを開始します...');
    
    // 時間帯ラベル（0-23時）
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}時`);
    
    // テストデータ（使用パターンをシミュレーション）
    // 朝、昼休み、夜にピークがある現実的なパターン
    const morningHours = [6, 7, 8, 9];
    const lunchHours = [12, 13];
    const eveningHours = [18, 19, 20, 21, 22];
    
    const createAppData = (name: string, morningFactor: number, lunchFactor: number, eveningFactor: number, baseFactor: number) => {
      const values = Array(24).fill(0).map((_, hour) => {
        let value = Math.floor(Math.random() * 5) * baseFactor; // ベース値
        
        // 朝のピーク
        if (morningHours.includes(hour)) {
          value += Math.floor(10 + Math.random() * 15) * morningFactor;
        }
        
        // 昼休みのピーク
        if (lunchHours.includes(hour)) {
          value += Math.floor(10 + Math.random() * 20) * lunchFactor;
        }
        
        // 夜のピーク
        if (eveningHours.includes(hour)) {
          value += Math.floor(15 + Math.random() * 25) * eveningFactor;
        }
        
        return value;
      });
      
      return {
        appName: name,
        values
      };
    };
    
    // 各アプリの特性を反映したテストデータ
    const data = [
      createAppData('Twitter', 1.2, 1.5, 2.0, 1), // Twitter：夜に多め、昼休みにも使用
      createAppData('YouTube', 0.5, 1.0, 2.5, 1), // YouTube：夜に非常に多め
      createAppData('LINE', 1.0, 1.2, 1.0, 0.8),  // LINE：一日を通して使用
      createAppData('Chrome', 1.5, 1.2, 1.0, 0.7), // Chrome：朝に多め
      createAppData('Instagram', 0.8, 1.5, 1.5, 0.6) // Instagram：昼と夜に多め
    ];
    
    // グラフの生成
    const filePath = await generateHourlyStackedBarChart(
      hourLabels,
      data,
      '時間帯別アプリ使用分布',
      '使用時間 (分)',
      '時間帯'
    );
    
    console.log(`時間帯別積み上げ棒グラフを生成しました: ${filePath}`);
    console.log('テストが成功しました！');
    
    process.exit(0);
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// テスト実行
testHourlyStackedBarChart();