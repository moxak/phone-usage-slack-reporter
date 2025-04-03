// src/reporters/phoneUsageReporter.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { IncomingWebhook } from '@slack/webhook';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import path from 'path';
import {
  generateBarChart,
  generatePieChart,
  generateLineChart
} from '../utils/chart-generator';
import { Database, DailyUsageSummary, AppUsageData } from '../types/supabase';
import { uploadImageToStorage, getPublicURL } from '../utils/storage';
import { logger } from '../utils/logger';

// 週間レポートデータの型定義
interface WeeklyReportData {
  userId: string;
  dates: string[];
  usageTimes: number[];
  topApps: Array<{name: string, time: number, openCount: number}>;
  weeklyAverage: number;
  previousWeekAverage: number;
  changePercentage: number;
  hourlyDistribution: number[]; // 時間帯別の使用時間分布 (0-23時)
}

export class PhoneUsageReporter {
  private supabase: SupabaseClient<Database>;
  private webhook: IncomingWebhook;
  private chartJSNodeCanvas: ChartJSNodeCanvas;

  constructor(
    supabase: SupabaseClient<Database>,
    webhook: IncomingWebhook
  ) {
    this.supabase = supabase;
    this.webhook = webhook;
  
    // グラフ生成用キャンバスの初期化 - 修正版
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 400,
      backgroundColour: 'white', // 背景色を白に設定 - 重要
      plugins: {
        modern: [
          'chartjs-plugin-datalabels'  // オプションのプラグイン
        ]
      },
      chartCallback: (ChartJS) => {
        // グローバル設定
        ChartJS.defaults.font.family = 'Arial, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Meiryo, メイリオ, sans-serif';
        ChartJS.defaults.color = '#000000'; // デフォルトのテキスト色を黒に設定
        ChartJS.defaults.borderColor = 'rgba(0, 0, 0, 0.1)'; // デフォルトの枠線色を薄い黒に設定
        ChartJS.defaults.scale.grid.color = 'rgba(0, 0, 0, 0.05)'; // デフォルトのグリッド線色
        
        // 他の設定も必要に応じて追加
      }
    });
  }

  /**
   * 特定ユーザーの過去7日間の日次使用サマリーを取得
   */
  private async fetchLastWeekDailyUsage(userId: string): Promise<DailyUsageSummary[]> {
    // 1週間前の日付を計算
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data, error } = await this.supabase
      .from('daily_usage_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('date', oneWeekAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });
    
    if (error) {
      throw new Error(`Supabaseからのデータ取得エラー: ${error.message}`);
    }
    
    return data as DailyUsageSummary[];
  }

  /**
   * 特定ユーザーの時間帯別使用時間分布を取得
   */
  private async fetchHourlyDistribution(userId: string, startDate: string, endDate: string): Promise<number[]> {
    const { data, error } = await this.supabase
      .from('hourly_phone_usage')
      .select('hour, usage_time')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      throw new Error(`時間帯別データ取得エラー: ${error.message}`);
    }

    // 時間帯別に集計 (0-23時)
    const hourlyDistribution = Array(24).fill(0);
    data.forEach(item => {
      hourlyDistribution[item.hour] += item.usage_time;
    });

    return hourlyDistribution;
  }

  /**
   * 前週の平均使用時間を取得
   */
  private async fetchPreviousWeekAverage(userId: string): Promise<number> {
    // 2週間前と1週間前の日付を計算
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data, error } = await this.supabase
      .from('daily_usage_summary')
      .select('total_usage_time')
      .eq('user_id', userId)
      .gte('date', twoWeeksAgo.toISOString().split('T')[0])
      .lt('date', oneWeekAgo.toISOString().split('T')[0]);
    
    if (error) {
      throw new Error(`前週データ取得エラー: ${error.message}`);
    }
    
    // 平均計算
    if (data.length === 0) return 0;
    
    const sum = data.reduce((acc, curr) => acc + curr.total_usage_time, 0);
    return sum / data.length;
  }

  /**
   * 週間レポートデータの準備
   */
  private async prepareWeeklyReportData(userId: string): Promise<WeeklyReportData> {
    // 日付範囲の計算
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const startDate = oneWeekAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    // 現在週のデータ取得
    const currentWeekData = await this.fetchLastWeekDailyUsage(userId);
    
    // 前週の平均取得
    const previousWeekAvg = await this.fetchPreviousWeekAverage(userId);
    
    // 時間帯別分布の取得
    const hourlyDistribution = await this.fetchHourlyDistribution(userId, startDate, endDate);
    
    // 日付と使用時間の配列を準備
    const dates = currentWeekData.map(d => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    const usageTimes = currentWeekData.map(d => d.total_usage_time);
    
    // 週間平均を計算
    const weeklyAverage = usageTimes.length > 0 
      ? usageTimes.reduce((sum, time) => sum + time, 0) / usageTimes.length 
      : 0;
    
    // 変化率を計算
    const changePercentage = previousWeekAvg > 0 
      ? ((weeklyAverage - previousWeekAvg) / previousWeekAvg) * 100 
      : 0;
    
    // アプリ使用時間の集計
    const appUsageMap: Map<string, { time: number, openCount: number }> = new Map();
    
    currentWeekData.forEach(day => {
      if (day.app_usage && Array.isArray(day.app_usage)) {
        (day.app_usage as unknown as AppUsageData[]).forEach(app => {
          const current = appUsageMap.get(app.appName) || { time: 0, openCount: 0 };
          appUsageMap.set(app.appName, {
            time: current.time + app.usageTime,
            openCount: current.openCount + app.openCount
          });
        });
      }
    });
    
    // 使用時間トップ5アプリを抽出
    const topApps = Array.from(appUsageMap.entries())
      .map(([name, { time, openCount }]) => ({ name, time, openCount }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
    
    return {
      userId,
      dates,
      usageTimes,
      topApps,
      weeklyAverage,
      previousWeekAverage: previousWeekAvg,
      changePercentage,
      hourlyDistribution
    };
  }

  /**
   * 特定ユーザーの週間レポートを送信
   */
  public async sendReport(userId: string): Promise<void> {
    try {
      logger.info(`ユーザー ${userId} のレポート作成を開始します`);
      
      // レポートデータの準備
      const reportData = await this.prepareWeeklyReportData(userId);
      
      // グラフの生成（新しいユーティリティを使用）
      logger.debug(`ユーザー ${userId} のグラフを生成します`);
      
      // 日次使用時間グラフ
      const usageChartPath = await generateBarChart(
        reportData.dates,
        reportData.usageTimes,
        '過去7日間のスマホ使用時間統計',
        '使用時間 (分)',
        '日付'
      );
      
      // トップアプリ使用時間円グラフ
      const topAppsChartPath = await generatePieChart(
        reportData.topApps.map(app => app.name),
        reportData.topApps.map(app => app.time),
        '最もよく使ったアプリ (過去7日間)'
      );
      
      // 時間帯別使用分布折れ線グラフ
      const hourlyChartPath = await generateLineChart(
        Array.from({ length: 24 }, (_, i) => `${i}時`),
        reportData.hourlyDistribution,
        '時間帯別スマホ使用分布',
        '使用時間 (分)',
        '時間帯'
      );
      
      // 画像をストレージにアップロード
      logger.debug(`ユーザー ${userId} のグラフをストレージにアップロードします`);
      const timestamp = Date.now();
      const usageChartUrl = await uploadImageToStorage(usageChartPath, `reports/${userId}/${timestamp}/usage.png`);
      const topAppsChartUrl = await uploadImageToStorage(topAppsChartPath, `reports/${userId}/${timestamp}/apps.png`);
      const hourlyChartUrl = await uploadImageToStorage(hourlyChartPath, `reports/${userId}/${timestamp}/hourly.png`);
      
      // Slackにメッセージ送信
      logger.info(`ユーザー ${userId} のレポートをSlackに送信します`);
      await this.sendSlackMessage(reportData, usageChartUrl, topAppsChartUrl, hourlyChartUrl);
      
      logger.info(`ユーザー ${userId} の週間レポートを送信しました`);
      
      // 一時ファイルの削除
      try {
        fs.unlinkSync(usageChartPath);
        fs.unlinkSync(topAppsChartPath);
        fs.unlinkSync(hourlyChartPath);
        logger.debug('一時ファイルを削除しました');
      } catch (error) {
        logger.warn('一時ファイル削除中にエラーが発生しました', { error });
      }
      
    } catch (error) {
      logger.error(`ユーザー ${userId} のレポート送信エラー:`, { error });
      throw error;
    }
  }


  /**
   * Slackメッセージの送信
   */
  private async sendSlackMessage(
    reportData: WeeklyReportData,
    usageChartUrl: string,
    topAppsChartUrl: string,
    hourlyChartUrl: string
  ): Promise<void> {
    // 変化率に基づいてメッセージとアイコンを決定
    let changeMessage = '';
    let changeIcon = '';
    
    if (reportData.changePercentage > 0) {
      changeMessage = `前週から ${reportData.changePercentage.toFixed(1)}% 増加しました`;
      changeIcon = ':arrow_up:';
    } else if (reportData.changePercentage < 0) {
      changeMessage = `前週から ${Math.abs(reportData.changePercentage).toFixed(1)}% 減少しました`;
      changeIcon = ':arrow_down:';
    } else {
      changeMessage = '前週から変化はありません';
      changeIcon = ':left_right_arrow:';
    }
    
    // Slackメッセージの構成
    await this.webhook.send({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📱 ${reportData.userId}さんの週間スマホ使用時間レポート`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*今週の平均使用時間:* ${reportData.weeklyAverage.toFixed(1)}分/日\n${changeIcon} ${changeMessage}`
          }
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: '過去7日間の使用時間統計',
            emoji: true
          },
          image_url: usageChartUrl,
          alt_text: '過去7日間の使用時間グラフ'
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: '最もよく使ったアプリ',
            emoji: true
          },
          image_url: topAppsChartUrl,
          alt_text: 'トップアプリ使用時間グラフ'
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: '時間帯別使用パターン',
            emoji: true
          },
          image_url: hourlyChartUrl,
          alt_text: '時間帯別使用パターングラフ'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*最もよく使ったアプリ:*'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: reportData.topApps.map((app, index) => 
              `${index + 1}. *${app.name}*: ${app.time}分 (${app.openCount}回起動)`
            ).join('\n')
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*ピーク使用時間帯:* ${reportData.hourlyDistribution.indexOf(Math.max(...reportData.hourlyDistribution))}時台`
            }
          ]
        }
      ]
    });
  }

  /**
   * すべてのアクティブユーザーに週間レポートを送信
   */
  public async sendReportToAllUsers(): Promise<{ total: number; success: number; failed: number }> {
    try {
      // アクティブユーザーの取得（例: 過去2週間以内にデータが記録されたユーザー）
      logger.info('アクティブユーザーの取得を開始します');
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      const { data: activeUsers, error } = await this.supabase
        .from('hourly_phone_usage')
        .select('user_id')
        .gte('date', twoWeeksAgo.toISOString().split('T')[0])
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`アクティブユーザー取得エラー: ${error.message}`);
      }
      
      // ユニークなアクティブユーザーIDの配列を作成
      const uniqueUserIds = Array.from(new Set(activeUsers.map(u => u.user_id)));
      
      logger.info(`週間レポート生成: ${uniqueUserIds.length}人のアクティブユーザーを処理します`);
      
      // 各アクティブユーザーに対して週間レポートを送信
      const results = await Promise.allSettled(
        uniqueUserIds.map(userId => this.sendReport(userId))
      );
      
      // 結果の集計
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      // 失敗したユーザーとエラー内容をログに記録
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`ユーザー ${uniqueUserIds[index]} のレポート送信に失敗:`, { 
            error: (result.reason as Error).message 
          });
        }
      });
      
      return {
        total: uniqueUserIds.length,
        success: successCount,
        failed: failCount
      };
      
    } catch (error) {
      logger.error('全ユーザーレポート送信エラー:', { error });
      throw error;
    }
  }
}