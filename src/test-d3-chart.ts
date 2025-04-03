// src/test-d3-charts.ts
import {
  generateBarChart,
  generatePieChart,
  generateLineChart
} from './utils/chart-generator';
import fs from 'fs';

async function testD3Charts() {
  try {
    console.log('D3.js グラフテストを開始します...');
    
    // 1. 棒グラフのテスト
    console.log('\n1. 棒グラフをテストします...');
    const labels = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
    const data = [65, 59, 80, 81, 56, 90, 70];
    
    const barChartPath = await generateBarChart(
      labels,
      data,
      '週間スマホ使用時間統計',
      '使用時間 (分)',
      '曜日'
    );
    
    console.log(`棒グラフを生成しました: ${barChartPath}`);
    console.log(`ファイルサイズ: ${fs.statSync(barChartPath).size} バイト`);
    
    // 2. 円グラフのテスト
    console.log('\n2. 円グラフをテストします...');
    const appNames = ['Twitter', 'YouTube', 'LINE', 'Chrome', 'Instagram'];
    const appUsages = [120, 90, 60, 45, 30];
    
    const pieChartPath = await generatePieChart(
      appNames,
      appUsages,
      'アプリ使用時間分布'
    );
    
    console.log(`円グラフを生成しました: ${pieChartPath}`);
    console.log(`ファイルサイズ: ${fs.statSync(pieChartPath).size} バイト`);
    
    // 3. 折れ線グラフのテスト
    console.log('\n3. 折れ線グラフをテストします...');
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}時`);
    const hourlyData = [
      5, 2, 1, 0, 0, 0, 
      10, 25, 30, 20, 15, 10, 
      18, 22, 15, 12, 18, 30, 
      45, 60, 50, 35, 20, 10
    ];
    
    const lineChartPath = await generateLineChart(
      hourLabels,
      hourlyData,
      '時間帯別スマホ使用分布',
      '使用時間 (分)',
      '時間帯'
    );
    
    console.log(`折れ線グラフを生成しました: ${lineChartPath}`);
    console.log(`ファイルサイズ: ${fs.statSync(lineChartPath).size} バイト`);
    
    console.log('\nすべてのテストが成功しました! ✨');
    console.log('生成されたファイルを確認してください:');
    console.log(`- 棒グラフ: ${barChartPath}`);
    console.log(`- 円グラフ: ${pieChartPath}`);
    console.log(`- 折れ線グラフ: ${lineChartPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// テスト実行
testD3Charts();