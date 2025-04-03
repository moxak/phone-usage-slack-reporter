// src/utils/d3-chart-generator.ts
import * as d3 from 'd3';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

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
    const colorScale = d3.scaleOrdinal<string>()
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
    yTicks.forEach(tick => {
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
    
    yTicks.forEach(tick => {
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
    
  } catch (error) {
    logger.error('棒グラフ生成エラー:', { error });
    throw error;
  }
}

/**
 * 円グラフを生成する関数
 */
export async function generatePieChart(
  labels: string[],
  data: number[],
  title: string
): Promise<string> {
  try {
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
    
    // 総計の計算
    const total = d3.sum(data);
    
    // カラースケール
    const colorScale = d3.scaleOrdinal<string>()
      .domain(labels)
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
    const radius = Math.min(innerWidth, innerHeight) / 2; // サイズを少し小さく
    const centerX = width / 2; // 画像の中央に配置
    const centerY = height / 2;

    // 円グラフの描画（中心座標を調整）
    context.translate(centerX, centerY); // キャンバスの原点を円の中心に移動

    // 円弧生成関数
    const arc = d3.arc<any>()
      .innerRadius(0)
      .outerRadius(radius);

    // 円グラフの描画
    const arcs = d3.pie<any>().value(d => d.value)(chartData);

    arcs.forEach((d) => {
      // パスを開始
      context.beginPath();
      
      // 円弧の描画情報を取得
      const arcData = arc.context(context)(d);
      
      // 塗りつぶし
      context.fillStyle = colorScale(d.data.label);
      context.fill();
      
      // 外枠
      context.strokeStyle = colorScale(d.data.label).replace('0.7', '1');
      context.lineWidth = 1;
      context.stroke();
    });

    // 元の座標に戻す
    context.translate(-centerX, -centerY);

    // 凡例の描画（円の右側に表示）
    const legendX = centerX + radius + 20;
    const legendY = centerY - (labels.length * 20) / 2;
        
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
      const percent = Math.round((d.value / total) * 100);
      context.fillStyle = '#333333';
      context.font = '12px Arial, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillText(`${d.label}: ${d.value}分 (${percent}%)`, legendX + 25, y + 7);
    });
    
    // タイトルの描画
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.font = 'bold 18px Arial, sans-serif';
    context.fillStyle = '#333333';
    context.fillText(title, width / 2, 20);
    
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
    
  } catch (error) {
    logger.error('円グラフ生成エラー:', { error });
    throw error;
  }
}

/**
 * 折れ線グラフを生成する関数
 */
export async function generateLineChart(
  labels: string[],
  data: number[],
  title: string,
  yAxisLabel = '使用時間 (分)',
  xAxisLabel = '時間帯'
): Promise<string> {
  try {
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
      .padding(0.1);
    
    // Y軸のスケール
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data) || 0])
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
    yTicks.forEach(tick => {
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
    
    // X軸のラベルを間引いて表示（全部表示すると重なる場合）
    const labelStep = Math.ceil(labels.length / 12); // 最大12個程度のラベルを表示
    
    labels.forEach((label, i) => {
      if (i % labelStep === 0 || i === labels.length - 1) {
        context.fillText(
          label, 
          (xScale(label) || 0) + xScale.bandwidth() / 2, 
          innerHeight + 10
        );
      }
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
    
    yTicks.forEach(tick => {
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
    
    // 折れ線の描画
    context.beginPath();
    chartData.forEach((d, i) => {
      const x = (xScale(d.label) || 0) + xScale.bandwidth() / 2;
      const y = yScale(d.value);
      
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    
    context.strokeStyle = 'rgb(75, 192, 192)';
    context.lineWidth = 3;
    context.stroke();
    
    // 折れ線の下の塗りつぶし
    context.lineTo((xScale(chartData[chartData.length - 1].label) || 0) + xScale.bandwidth() / 2, innerHeight);
    context.lineTo((xScale(chartData[0].label) || 0) + xScale.bandwidth() / 2, innerHeight);
    context.closePath();
    context.fillStyle = 'rgba(75, 192, 192, 0.2)';
    context.fill();
    
    // データポイントの描画
    chartData.forEach(d => {
      const x = (xScale(d.label) || 0) + xScale.bandwidth() / 2;
      const y = yScale(d.value);
      
      // 点の描画
      context.beginPath();
      context.arc(x, y, 4, 0, 2 * Math.PI);
      context.fillStyle = 'rgb(75, 192, 192)';
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.stroke();
      
      // 値のラベル（混雑を避けるため、一部のデータポイントにのみ表示）
      if (d.value === d3.max(data) || d.value === d3.min(data) || Math.random() > 0.7) {
        context.textAlign = 'center';
        context.textBaseline = 'bottom';
        context.fillStyle = '#333333';
        context.font = '10px Arial, sans-serif';
        context.fillText(d.value.toString(), x, y - 10);
      }
    });
    
    // タイトルの描画
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
    
  } catch (error) {
    logger.error('折れ線グラフ生成エラー:', { error });
    throw error;
  }
}