// src/utils/chart-generator.ts
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

// D3関数をラップして使用するためのユーティリティ
// この関数内でD3をダイナミックインポートして使用する
async function withD3(callback: (d3: any) => any) {
  try {
      // ダイナミックインポートを使用
      const d3Module = await import('d3');
      // D3 v7では、importの結果がdefaultプロパティを持つオブジェクトになる場合がある
      const d3 = d3Module.default || d3Module;
      return callback(d3);
  } catch (error) {
      logger.error('D3インポートエラー:', { error });
      throw error;
  }
}

// 共通の設定
const width = 800;
const height = 400;
const margin = { top: 50, right: 80, bottom: 60, left: 60 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

/**
 * 棒グラフを生成する関数
 */
export async function generateBarChart(
  labels: string[],
  data: number[],
  title: string,
  yAxisLabel = '使用時間 (分)',
  xAxisLabel = '日付'
): Promise<string> {
  try {
    return await withD3(async (d3) => {
      // キャンバスの作成
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      
      // 背景を白に設定
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      
      // データの準備
      const chartData = labels.map((label, i) => ({
        label,
        value: data[i]
      }));
      
      // X軸のスケール
      const xScale = d3.scaleBand()
        .domain(labels)
        .range([0, innerWidth])
        .padding(0.2);
      
      // Y軸のスケール
      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data) || 0])
        .nice()
        .range([innerHeight, 0]);
      
      // 棒グラフの色
      const colorScale = d3.scaleOrdinal()
        .domain(labels)
        .range([
          'rgba(54, 162, 235, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(255, 99, 132, 0.7)',
          'rgba(153, 102, 255, 0.7)',
          'rgba(255, 159, 64, 0.7)',
          'rgba(199, 199, 199, 0.7)'
        ]);
      
      // グラフ描画の原点を移動
      context.translate(margin.left, margin.top);
      
      // グリッド線の描画
      context.beginPath();
      context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      context.lineWidth = 0.5;
      
      // 水平グリッド線
      const yTicks = yScale.ticks(5);
      yTicks.forEach((tick: any) => {
        context.moveTo(0, yScale(tick));
        context.lineTo(innerWidth, yScale(tick));
      });
      
      context.stroke();
      
      // X軸の描画
      context.beginPath();
      context.moveTo(0, innerHeight);
      context.lineTo(innerWidth, innerHeight);
      context.strokeStyle = '#000000';
      context.lineWidth = 1;
      context.stroke();
      
      // X軸のラベル
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = '#333333';
      context.font = '12px Arial, sans-serif';
      
      labels.forEach(label => {
        context.fillText(
          label, 
          (xScale(label) || 0) + xScale.bandwidth() / 2, 
          innerHeight + 10
        );
      });
      
      // X軸のタイトル
      context.font = '14px Arial, sans-serif';
      context.fillText(xAxisLabel, innerWidth / 2, innerHeight + 40);
      
      // Y軸の描画
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, innerHeight);
      context.strokeStyle = '#000000';
      context.lineWidth = 1;
      context.stroke();
      
      // Y軸のラベル
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      context.fillStyle = '#333333';
      context.font = '12px Arial, sans-serif';
      
      yTicks.forEach((tick: { toString: () => string; }) => {
        context.fillText(tick.toString(), -10, yScale(tick));
      });
      
      // Y軸のタイトル
      context.save();
      context.translate(-40, innerHeight / 2);
      context.rotate(-Math.PI / 2);
      context.textAlign = 'center';
      context.font = '14px Arial, sans-serif';
      context.fillText(yAxisLabel, 0, 0);
      context.restore();
      
      // 棒グラフの描画
      chartData.forEach(d => {
        const x = xScale(d.label) || 0;
        const y = yScale(d.value);
        const barWidth = xScale.bandwidth();
        const barHeight = innerHeight - y;
        
        context.fillStyle = colorScale(d.label);
        context.fillRect(x, y, barWidth, barHeight);
        
        // 枠線
        context.strokeStyle = colorScale(d.label).replace('0.7', '1');
        context.lineWidth = 1;
        context.strokeRect(x, y, barWidth, barHeight);
        
        // 値のラベル
        if (d.value > 0) {
          context.textAlign = 'center';
          context.textBaseline = 'bottom';
          context.fillStyle = '#333333';
          context.font = '12px Arial, sans-serif';
          context.fillText(d.value.toString(), x + barWidth / 2, y - 5);
        }
      });
      
      // グラフのタイトル
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.font = 'bold 18px Arial, sans-serif';
      context.fillStyle = '#333333';
      context.fillText(title, innerWidth / 2, -30);
      
      // 一時ディレクトリの確認
      const tempDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // ユニークなファイル名の生成
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const filename = `bar_chart_${timestamp}_${random}.png`;
      const filePath = path.join(tempDir, filename);
      
      // 画像として保存
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(filePath, buffer);
      
      logger.debug(`棒グラフを生成しました: ${filePath}`);
      return filePath;
    });
  } catch (error) {
    logger.error('棒グラフ生成エラー:', { error });
    throw error;
  }
}

/**
 * 円グラフを生成する関数（数値を小数点第一位まで表示）
 */
export async function generatePieChart(
  labels: string[],
  data: number[],
  title: string
): Promise<string> {
  try {
    return await withD3(async (d3) => {

    // データが空の場合は代替グラフを生成
    if (data.length === 0 || labels.length === 0) {
      return generateEmptyPieChart(title);
    }
    
    // キャンバスの作成
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // 背景を白に設定
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    
    // データの準備
    const chartData = labels.map((label, i) => ({
      label,
      value: data[i] || 0 // nullやundefinedの場合は0にする
    })).filter(item => item.value > 0); // 値が0以下のデータは除外
    
    // データが全て0の場合は代替グラフを生成
    if (chartData.length === 0) {
      return generateEmptyPieChart(title);
    }
    
    // 総計の計算
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    
    // カラースケール
    const colorScale = d3.scaleOrdinal()
      .domain(chartData.map(d => d.label))
      .range([
        'rgba(255, 99, 132, 0.7)',   // 赤
        'rgba(54, 162, 235, 0.7)',   // 青
        'rgba(255, 206, 86, 0.7)',   // 黄
        'rgba(75, 192, 192, 0.7)',   // 緑
        'rgba(153, 102, 255, 0.7)',  // 紫
        'rgba(255, 159, 64, 0.7)',   // オレンジ
        'rgba(199, 199, 199, 0.7)'   // グレー
      ]);
    
    // 円グラフのサイズと位置
    const radius = Math.min(width, height) / 2.8;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // タイトルの描画
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.font = 'bold 18px Arial, sans-serif';
    context.fillStyle = '#333333';
    context.fillText(title, width / 2, 20);
    
    // パイチャートのデータ準備
    const pieData = d3.pie()
      .value((d: { value: any; }) => d.value)
      .sort(null)(chartData);
    
    // 円グラフの描画
    context.save();
    context.translate(centerX, centerY);
    
    for (const d of pieData) {
      // パスの開始
      context.beginPath();
      
      // 弧の角度計算
      const startAngle = d.startAngle;
      const endAngle = d.endAngle;
      
      // 弧の描画
      context.arc(0, 0, radius, startAngle, endAngle);
      context.lineTo(0, 0);
      context.closePath();
      
      // 塗りつぶし
      context.fillStyle = colorScale(d.data.label);
      context.fill();
      
      // 外枠
      context.strokeStyle = colorScale(d.data.label).replace('0.7', '1');
      context.lineWidth = 1;
      context.stroke();
    }
    
    context.restore();
    
    // 凡例の描画
    const legendX = centerX + radius + 20;
    const legendY = centerY - (chartData.length * 20) / 2;
    
    // 凡例のタイトル
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#333333';
    context.font = 'bold 14px Arial, sans-serif';
    context.fillText('凡例', legendX, legendY - 25);
    
    // 凡例の項目
    chartData.forEach((d, i) => {
      const y = legendY + i * 20;
      
      // カラーボックス
      context.fillStyle = colorScale(d.label);
      context.fillRect(legendX, y, 15, 15);
      context.strokeStyle = colorScale(d.label).replace('0.7', '1');
      context.strokeRect(legendX, y, 15, 15);
      
      // ラベルとパーセント
      const percent = (d.value / total) * 100;
      context.fillStyle = '#333333';
      context.font = '12px Arial, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillText(`${d.label}: ${d.value.toFixed(1)}分 (${percent.toFixed(1)}%)`, legendX + 25, y + 7);
    });
    
    // 一時ディレクトリの確認
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // ユニークなファイル名の生成
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const filename = `pie_chart_${timestamp}_${random}.png`;
    const filePath = path.join(tempDir, filename);
    
    // 画像として保存
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    
    logger.debug(`円グラフを生成しました: ${filePath}`);
    return filePath;
    });
  } catch (error) {
    logger.error('円グラフ生成エラー:', { error });
    throw error;
  }
}

/**
 * データが空の場合に表示する代替グラフを生成
 */
function generateEmptyPieChart(title: string): Promise<string> {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  
  // 背景を白に設定
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  
  // タイトルの描画
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.font = 'bold 18px Arial, sans-serif';
  context.fillStyle = '#333333';
  context.fillText(title, width / 2, 20);
  
  // 空のメッセージを中央に表示
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '16px Arial, sans-serif';
  context.fillStyle = '#666666';
  context.fillText('データがありません', width / 2, height / 2);
  
  // 一時ディレクトリの確認
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // ユニークなファイル名の生成
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const filename = `empty_pie_chart_${timestamp}_${random}.png`;
  const filePath = path.join(tempDir, filename);
  
  // 画像として保存
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  
  logger.debug(`空の円グラフを生成しました: ${filePath}`);
  return Promise.resolve(filePath);
}

/**
 * 折れ線グラフを生成する関数（小数点第一位まで表示）
 * @param labels X軸ラベル
 * @param data Y軸データ
 * @param title グラフタイトル
 * @param yAxisLabel Y軸ラベル
 * @param xAxisLabel X軸ラベル
 */
export async function generateLineChart(
  labels: string[],
  data: number[],
  title: string,
  yAxisLabel = '使用時間 (分)',
  xAxisLabel = '日付'
): Promise<string> {
  try {
    return await withD3(async (d3) => {
    // キャンバスの作成
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // 背景を白に設定
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    
    // X軸のスケール
    const xScale = d3.scaleBand()
      .domain(labels)
      .range([0, innerWidth])
      .padding(0.1);
    
    // Y軸のスケール（最小値を0、最大値をデータの最大値として設定）
    const yMax = d3.max(data) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.1]) // 最大値より少し上まで表示
      .nice()
      .range([innerHeight, 0]);
    
    // グラフ描画の原点を移動
    context.translate(margin.left, margin.top);
    
    // グリッド線の描画
    context.beginPath();
    context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    context.lineWidth = 0.5;
    
    // 水平グリッド線
    const yTicks = yScale.ticks(5);
    yTicks.forEach((tick: any) => {
      context.moveTo(0, yScale(tick));
      context.lineTo(innerWidth, yScale(tick));
    });
    
    context.stroke();
    
    // X軸の描画
    context.beginPath();
    context.moveTo(0, innerHeight);
    context.lineTo(innerWidth, innerHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
    context.stroke();
    
    // X軸のラベル
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#333333';
    context.font = '12px Arial, sans-serif';
    
    labels.forEach(label => {
      context.fillText(
        label, 
        (xScale(label) || 0) + xScale.bandwidth() / 2, 
        innerHeight + 10
      );
    });
    
    // X軸のタイトル
    context.font = '14px Arial, sans-serif';
    context.fillText(xAxisLabel, innerWidth / 2, innerHeight + 40);
    
    // Y軸の描画
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, innerHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
    context.stroke();
    
    // Y軸のラベル
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillStyle = '#333333';
    context.font = '12px Arial, sans-serif';
    
    yTicks.forEach((tick: number) => {
      // Y軸の目盛り値を小数点第一位まで表示
      context.fillText(tick.toFixed(1), -10, yScale(tick));
    });
    
    // Y軸のタイトル
    context.save();
    context.translate(-40, innerHeight / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = 'center';
    context.font = '14px Arial, sans-serif';
    context.fillText(yAxisLabel, 0, 0);
    context.restore();
    
    // 線を描画
    context.beginPath();
    data.forEach((value, i) => {
      const x = (xScale(labels[i]) || 0) + xScale.bandwidth() / 2;
      const y = yScale(value);
      
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    
    context.strokeStyle = 'rgba(54, 162, 235, 1)';
    context.lineWidth = 3;
    context.stroke();
    
    // 折れ線の下を塗りつぶす
    context.lineTo((xScale(labels[labels.length - 1]) || 0) + xScale.bandwidth() / 2, innerHeight);
    context.lineTo((xScale(labels[0]) || 0) + xScale.bandwidth() / 2, innerHeight);
    context.closePath();
    context.fillStyle = 'rgba(54, 162, 235, 0.2)';
    context.fill();
    
    // データポイントを描画
    data.forEach((value, i) => {
      const x = (xScale(labels[i]) || 0) + xScale.bandwidth() / 2;
      const y = yScale(value);
      
      // ポイントの描画
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fillStyle = 'rgba(54, 162, 235, 1)';
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.stroke();
      
      // 値のラベル
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillStyle = '#333333';
      context.font = 'bold 12px Arial, sans-serif';
      context.fillText(value.toFixed(1), x, y - 10);
    });
    
    // グラフのタイトル
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.font = 'bold 18px Arial, sans-serif';
    context.fillStyle = '#333333';
    context.fillText(title, innerWidth / 2, -30);
    
    // 一時ディレクトリの確認
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // ユニークなファイル名の生成
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const filename = `line_chart_${timestamp}_${random}.png`;
    const filePath = path.join(tempDir, filename);
    
    // 画像として保存
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    
    logger.debug(`折れ線グラフを生成しました: ${filePath}`);
    return filePath;
    });
  } catch (error) {
    logger.error('折れ線グラフ生成エラー:', { error });
    throw error;
  }
}

/**
 * 積み上げ棒グラフを生成する関数（数値を小数点第一位まで表示）
 * @param labels 日付ラベル
 * @param data 各日付のアプリごとの使用時間データ
 * @param title グラフタイトル
 * @param yAxisLabel Y軸ラベル
 * @param xAxisLabel X軸ラベル
 */
export async function generateStackedBarChart(
  labels: string[],
  data: Array<{
    appName: string;
    values: number[]; // 各日付の使用時間
  }>,
  title: string,
  yAxisLabel = '使用時間 (分)',
  xAxisLabel = '日付'
): Promise<string> {
  try {
    return await withD3(async (d3) => {
    // キャンバスの作成
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // 背景を白に設定
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    
    // 凡例用のスペースを確保するために描画エリアを調整
    const legendWidth = 100; // 凡例の幅
    const adjustedMargin = { ...margin, right: margin.right + legendWidth };
    const adjustedInnerWidth = width - adjustedMargin.left - adjustedMargin.right;
    
    // X軸のスケール
    const xScale = d3.scaleBand()
      .domain(labels)
      .range([0, adjustedInnerWidth])
      .padding(0.2);
    
    // 各日の合計を計算して最大値を取得
    const stackedData = labels.map((_, dayIndex) => {
      let sum = 0;
      data.forEach(app => {
        sum += app.values[dayIndex] || 0;
      });
      return sum;
    });
    
    // Y軸のスケール
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(stackedData) || 0])
      .nice()
      .range([innerHeight, 0]);
    
    // アプリごとの色
    const colorScale = d3.scaleOrdinal()
      .domain(data.map(d => d.appName))
      .range([
        'rgba(255, 99, 132, 0.7)',   // 赤
        'rgba(54, 162, 235, 0.7)',   // 青
        'rgba(255, 206, 86, 0.7)',   // 黄
        'rgba(75, 192, 192, 0.7)',   // 緑
        'rgba(153, 102, 255, 0.7)',  // 紫
        'rgba(255, 159, 64, 0.7)',   // オレンジ
        'rgba(199, 199, 199, 0.7)'   // グレー
      ]);
    
    // グラフ描画の原点を移動
    context.translate(adjustedMargin.left, margin.top);
    
    // グリッド線の描画
    context.beginPath();
    context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    context.lineWidth = 0.5;
    
    // 水平グリッド線
    const yTicks = yScale.ticks(5);
    yTicks.forEach((tick: any) => {
      context.moveTo(0, yScale(tick));
      context.lineTo(adjustedInnerWidth, yScale(tick));
    });
    
    context.stroke();
    
    // X軸の描画
    context.beginPath();
    context.moveTo(0, innerHeight);
    context.lineTo(adjustedInnerWidth, innerHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
    context.stroke();
    
    // X軸のラベル
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#333333';
    context.font = '12px Arial, sans-serif';
    
    labels.forEach(label => {
      context.fillText(
        label, 
        (xScale(label) || 0) + xScale.bandwidth() / 2, 
        innerHeight + 10
      );
    });
    
    // X軸のタイトル
    context.font = '14px Arial, sans-serif';
    context.fillText(xAxisLabel, adjustedInnerWidth / 2, innerHeight + 40);
    
    // Y軸の描画
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, innerHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
    context.stroke();
    
    // Y軸のラベル
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillStyle = '#333333';
    context.font = '12px Arial, sans-serif';
    
    yTicks.forEach((tick: number) => {
      // Y軸の目盛り値を小数点第一位まで表示
      context.fillText(tick.toFixed(1), -10, yScale(tick));
    });
    
    // Y軸のタイトル
    context.save();
    context.translate(-40, innerHeight / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = 'center';
    context.font = '14px Arial, sans-serif';
    context.fillText(yAxisLabel, 0, 0);
    context.restore();
    
    // 積み上げ棒グラフの描画
    labels.forEach((day, dayIndex) => {
      const x = xScale(day) || 0;
      const barWidth = xScale.bandwidth();
      let yOffset = innerHeight; // 積み上げの開始位置（下から上へ）
      
      // 各アプリの使用時間を描画
      data.forEach(app => {
        const value = app.values[dayIndex] || 0;
        if (value > 0) {
          const barHeight = innerHeight - yScale(value);
          const y = yOffset - barHeight; // 前の積み上げ位置から計算
          
          // 棒の描画
          context.fillStyle = colorScale(app.appName);
          context.fillRect(x, y, barWidth, barHeight);
          
          // 枠線
          context.strokeStyle = colorScale(app.appName).replace('0.7', '1');
          context.lineWidth = 1;
          context.strokeRect(x, y, barWidth, barHeight);
          
          // 値が大きい場合はラベルを表示
          if (value > stackedData[dayIndex] * 0.1) { // 合計の10%以上を占める場合
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = '#ffffff';
            context.font = 'bold 11px Arial, sans-serif';
            
            // 値の表示（棒の中央）- 小数点第一位まで表示
            if (barHeight > 20) { // 棒が十分に高い場合のみ表示
              context.fillText(
                value.toFixed(1),
                x + barWidth / 2,
                y + barHeight / 2
              );
            }
          }
          
          // 次の積み上げのための位置を更新
          yOffset = y;
        }
      });
      
      // 合計値の表示
      const totalValue = stackedData[dayIndex];
      if (totalValue > 0) {
        context.textAlign = 'center';
        context.textBaseline = 'bottom';
        context.fillStyle = '#333333';
        context.font = 'bold 12px Arial, sans-serif';
        
        // 合計値を小数点第一位まで表示
        context.fillText(
          totalValue.toFixed(1),
          x + barWidth / 2,
          yScale(totalValue) - 5
        );
      }
    });
    
    // グラフのタイトル
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.font = 'bold 18px Arial, sans-serif';
    context.fillStyle = '#333333';
    context.fillText(title, adjustedInnerWidth / 2, -30);
    
    // 凡例の描画（右端に配置）
    // 凡例の位置を計算
    const legendX = adjustedInnerWidth + 10; // グラフ領域の右端から10px
    const legendY = 0; // グラフ領域の上端
    
    // 凡例のタイトル
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#333333';
    context.font = 'bold 14px Arial, sans-serif';
    context.fillText('アプリ', legendX, legendY);
    
    // 凡例の項目
    data.forEach((app, i) => {
      const y = legendY + 25 + i * 20;
      
      // カラーボックス
      context.fillStyle = colorScale(app.appName);
      context.fillRect(legendX, y, 15, 15);
      context.strokeStyle = colorScale(app.appName).replace('0.7', '1');
      context.strokeRect(legendX, y, 15, 15);
      
      // アプリ名
      context.fillStyle = '#333333';
      context.font = '12px Arial, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillText(app.appName, legendX + 25, y + 7);
    });
    
    // 一時ディレクトリの確認
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // ユニークなファイル名の生成
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const filename = `stacked_bar_chart_${timestamp}_${random}.png`;
    const filePath = path.join(tempDir, filename);
    
    // 画像として保存
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    
    logger.debug(`積み上げ棒グラフを生成しました: ${filePath}`);
    return filePath;
    });
    
  } catch (error) {
    logger.error('積み上げ棒グラフ生成エラー:', { error });
    throw error;
  }
}

/**
 * 時間帯別積み上げ棒グラフを生成する関数（数値を小数点第一位まで表示）
 * @param hourLabels 時間帯ラベル
 * @param data 各時間帯のアプリごとの使用時間データ
 * @param title グラフタイトル
 * @param yAxisLabel Y軸ラベル
 * @param xAxisLabel X軸ラベル
 */
export async function generateHourlyStackedBarChart(
  hourLabels: string[],
  data: Array<{
    appName: string;
    values: number[]; // 各時間帯の使用時間
  }>,
  title: string,
  yAxisLabel = '使用時間 (分)',
  xAxisLabel = '時間帯'
): Promise<string> {
  try {
    return await withD3(async (d3) => {
    // データが空または無効な場合は代替グラフを生成
    if (!hourLabels || hourLabels.length === 0 || !data || data.length === 0) {
      return generateEmptyBarChart(title, '時間帯別データがありません');
    }
    
    // データの整合性チェック
    const validData = data.filter(app => app.values && app.values.length === hourLabels.length);
    if (validData.length === 0) {
      return generateEmptyBarChart(title, 'データの形式が正しくありません');
    }
    
    // キャンバスの作成
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // 背景を白に設定
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    
    // 凡例用のスペースを確保するために描画エリアを調整
    const legendWidth = 140; // 凡例の幅を広げる
    const adjustedMargin = { ...margin, right: margin.right + legendWidth };
    const adjustedInnerWidth = width - adjustedMargin.left - adjustedMargin.right;
    
    // X軸のスケール
    const xScale = d3.scaleBand()
      .domain(hourLabels)
      .range([0, adjustedInnerWidth])
      .padding(0.1);
    
    // 各時間帯の合計を計算して最大値を取得
    const stackedData = hourLabels.map((_, hourIndex) => {
      let sum = 0;
      validData.forEach(app => {
        sum += app.values[hourIndex] || 0;
      });
      return sum;
    });
    
    // 最大値にマージンを追加して表示範囲を決める
    const maxValue = Math.max(...stackedData) * 1.1;
    
    // Y軸のスケール
    const yScale = d3.scaleLinear()
      .domain([0, maxValue > 0 ? maxValue : 10]) // 全てのデータが0の場合は10を最大値とする
      .nice()
      .range([innerHeight, 0]);
    
    // アプリごとの色
    const colorScale = d3.scaleOrdinal()
      .domain(validData.map(d => d.appName))
      .range([
        'rgba(255, 99, 132, 0.7)',   // 赤
        'rgba(54, 162, 235, 0.7)',   // 青
        'rgba(255, 206, 86, 0.7)',   // 黄
        'rgba(75, 192, 192, 0.7)',   // 緑
        'rgba(153, 102, 255, 0.7)',  // 紫
        'rgba(255, 159, 64, 0.7)',   // オレンジ
        'rgba(199, 199, 199, 0.7)'   // グレー
      ]);
    
    // グラフ描画の原点を移動
    context.translate(adjustedMargin.left, margin.top);
    
    // グリッド線の描画
    context.beginPath();
    context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    context.lineWidth = 0.5;
    
    // 水平グリッド線
    const yTicks = yScale.ticks(5);
    yTicks.forEach((tick: any) => {
      context.moveTo(0, yScale(tick));
      context.lineTo(adjustedInnerWidth, yScale(tick));
    });
    
    context.stroke();
    
    // X軸の描画
    context.beginPath();
    context.moveTo(0, innerHeight);
    context.lineTo(adjustedInnerWidth, innerHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
    context.stroke();
    
    // X軸のラベル
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#333333';
    context.font = '12px Arial, sans-serif';
    
    // X軸のラベルを間引いて表示（全部表示すると重なる場合）
    const labelStep = Math.ceil(hourLabels.length / 12); // 最大12個程度のラベルを表示
    
    hourLabels.forEach((label, i) => {
      if (i % labelStep === 0 || i === hourLabels.length - 1) {
        context.fillText(
          label, 
          (xScale(label) || 0) + xScale.bandwidth() / 2, 
          innerHeight + 10
        );
      }
    });
    
    // X軸のタイトル
    context.font = '14px Arial, sans-serif';
    context.fillText(xAxisLabel, adjustedInnerWidth / 2, innerHeight + 40);
    
    // Y軸の描画
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, innerHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
    context.stroke();
    
    // Y軸のラベル
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillStyle = '#333333';
    context.font = '12px Arial, sans-serif';
    
    yTicks.forEach((tick: number) => {
      // Y軸の目盛り値を小数点第一位まで表示
      context.fillText(tick.toFixed(1), -10, yScale(tick));
    });
    
    // Y軸のタイトル
    context.save();
    context.translate(-40, innerHeight / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = 'center';
    context.font = '14px Arial, sans-serif';
    context.fillText(yAxisLabel, 0, 0);
    context.restore();
    
    // 積み上げ棒グラフの描画
    hourLabels.forEach((hour, hourIndex) => {
      const x = xScale(hour) || 0;
      const barWidth = xScale.bandwidth();
      let yOffset = innerHeight; // 積み上げの開始位置（下から上へ）
      
      // 各アプリの使用時間を描画
      validData.forEach(app => {
        const value = app.values[hourIndex] || 0;
        if (value > 0) {
          const barHeight = innerHeight - yScale(value);
          const y = yOffset - barHeight; // 前の積み上げ位置から計算
          
          // 棒の描画
          context.fillStyle = colorScale(app.appName);
          context.fillRect(x, y, barWidth, barHeight);
          
          // 枠線
          context.strokeStyle = colorScale(app.appName).replace('0.7', '1');
          context.lineWidth = 1;
          context.strokeRect(x, y, barWidth, barHeight);
          
          // 大きな値の場合のみラベルを表示（スペース節約のため）
          if (value > stackedData[hourIndex] * 0.15 && barHeight > 25) {
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = '#ffffff';
            context.font = 'bold 11px Arial, sans-serif';
            
            // 値を小数点第一位まで表示
            context.fillText(
              value.toFixed(1),
              x + barWidth / 2,
              y + barHeight / 2
            );
          }
          
          // 次の積み上げのための位置を更新
          yOffset = y;
        }
      });
      
      // 合計値が一定以上の場合のみ、上部に表示
      if (stackedData[hourIndex] > 0) {
        context.textAlign = 'center';
        context.textBaseline = 'bottom';
        context.fillStyle = '#333333';
        context.font = 'bold 12px Arial, sans-serif';
        
        // 合計値を小数点第一位まで表示
        context.fillText(
          stackedData[hourIndex].toFixed(1),
          x + barWidth / 2,
          yScale(stackedData[hourIndex]) - 5
        );
      }
    });
    
    // グラフのタイトル
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.font = 'bold 18px Arial, sans-serif';
    context.fillStyle = '#333333';
    context.fillText(title, adjustedInnerWidth / 2, -30);
    
    // 凡例の描画（右端に配置）
    const legendX = adjustedInnerWidth + 10; // グラフ領域の右端から10px
    const legendY = 0; // グラフ領域の上端
    
    // 凡例のタイトル
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#333333';
    context.font = 'bold 14px Arial, sans-serif';
    context.fillText('アプリ', legendX, legendY);
    
    // 凡例の項目
    validData.forEach((app, i) => {
      const y = legendY + 25 + i * 20;
      
      // カラーボックス
      context.fillStyle = colorScale(app.appName);
      context.fillRect(legendX, y, 15, 15);
      context.strokeStyle = colorScale(app.appName).replace('0.7', '1');
      context.strokeRect(legendX, y, 15, 15);
      
      // アプリ名 (長すぎる場合は切り詰める)
      const maxAppNameLength = 15;
      let displayAppName = app.appName;
      if (displayAppName.length > maxAppNameLength) {
        displayAppName = displayAppName.substring(0, maxAppNameLength - 3) + '...';
      }
      
      context.fillStyle = '#333333';
      context.font = '12px Arial, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillText(displayAppName, legendX + 25, y + 7);
    });
    
    // 一時ディレクトリの確認
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // ユニークなファイル名の生成
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const filename = `hourly_stacked_chart_${timestamp}_${random}.png`;
    const filePath = path.join(tempDir, filename);
    
    // 画像として保存
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    
    logger.debug(`時間帯別積み上げ棒グラフを生成しました: ${filePath}`);
    return filePath;
    });
  } catch (error) {
    logger.error('時間帯別積み上げ棒グラフ生成エラー:', { error });
    throw error;
  }
}

/**
 * データが空の場合に表示する代替棒グラフを生成
 */
function generateEmptyBarChart(title: string, message: string = 'データがありません'): Promise<string> {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  
  // 背景を白に設定
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  
  // タイトルの描画
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.font = 'bold 18px Arial, sans-serif';
  context.fillStyle = '#333333';
  context.fillText(title, width / 2, 20);
  
  // 空のメッセージを中央に表示
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '16px Arial, sans-serif';
  context.fillStyle = '#666666';
  context.fillText(message, width / 2, height / 2);
  
  // 一時ディレクトリの確認
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // ユニークなファイル名の生成
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const filename = `empty_bar_chart_${timestamp}_${random}.png`;
  const filePath = path.join(tempDir, filename);
  
  // 画像として保存
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  
  logger.debug(`空の棒グラフを生成しました: ${filePath}`);
  return Promise.resolve(filePath);
}