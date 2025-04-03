// src/reporters/WeeklyReporter.ts
import { BaseReporter } from './BaseReporter';
import { DailyUsageSummary } from '../types/supabase';
import { WeeklyReportData } from '../types/phoneUsage';
import { logger } from '../utils/logger';
import { generateHourlyStackedBarChart, generateLineChart, generatePieChart } from '../utils/chart-generator';

export class WeeklyReporter extends BaseReporter {
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
   * 時間帯別のアプリ使用時間分布を取得
   */
  private async fetchHourlyAppDistribution(userId: string, startDate: string, endDate: string): Promise<{ [hour: number]: { [appName: string]: number } }> {
    const { data, error } = await this.supabase
      .from('hourly_phone_usage')
      .select('hour, app_name, usage_time')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      throw new Error(`時間帯別アプリデータ取得エラー: ${error.message}`);
    }

    // 時間帯とアプリごとに集計
    const hourlyAppUsage: { [hour: number]: { [appName: string]: number } } = {};
    
    // 全時間帯を初期化（0-23時）
    for (let hour = 0; hour < 24; hour++) {
      hourlyAppUsage[hour] = {};
    }
    
    // データを集計
    data.forEach(item => {
      if (!hourlyAppUsage[item.hour][item.app_name]) {
        hourlyAppUsage[item.hour][item.app_name] = 0;
      }
      hourlyAppUsage[item.hour][item.app_name] += item.usage_time;
    });

    return hourlyAppUsage;
  }

  /**
   * 特定ユーザーの直近24時間のデータを取得（時間別）
   */
  private async fetchLast24HoursData(userId: string): Promise<{ [hour: number]: { [appName: string]: number } }> {
    // 24時間前の日時を計算
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setHours(now.getHours() - 24);
    
    const yesterdayDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    const yesterdayHour = yesterday.getHours();
    
    const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const todayHour = now.getHours();
    
    // 直近24時間のデータを取得（日付と時間で絞り込み）
    const { data, error } = await this.supabase
      .from('hourly_phone_usage')
      .select('date, hour, app_name, usage_time')
      .eq('user_id', userId)
      .or(`and(date.eq.${yesterdayDate},hour.gte.${yesterdayHour}),and(date.eq.${todayDate},hour.lte.${todayHour})`)
      .order('date', { ascending: true })
      .order('hour', { ascending: true });
    
    if (error) {
      throw new Error(`直近24時間のデータ取得エラー: ${error.message}`);
    }
    
    // 時間帯とアプリごとに集計
    const hourlyAppUsage: { [hour: number]: { [appName: string]: number } } = {};
    
    // 先に現在の時刻から24時間分の配列を準備（24要素、時間で循環する形）
    const startHour = now.getHours();
    for (let i = 0; i < 24; i++) {
      const hour = (startHour - 23 + i + 24) % 24; // 0-23の範囲に収める
      hourlyAppUsage[hour] = {};
    }
    
    // データを集計
    data.forEach(item => {
      if (!hourlyAppUsage[item.hour]) {
        hourlyAppUsage[item.hour] = {};
      }
      
      if (!hourlyAppUsage[item.hour][item.app_name]) {
        hourlyAppUsage[item.hour][item.app_name] = 0;
      }
      
      hourlyAppUsage[item.hour][item.app_name] += item.usage_time;
    });
    
    return hourlyAppUsage;
  }

  /**
   * 過去7日間の日次使用時間を取得（折れ線グラフ用）
   */
  private async fetchDailyUsageForLineChart(userId: string): Promise<{dates: string[], values: number[]}> {
    // 7日前の日付を計算
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 日次合計データを取得
    const { data, error } = await this.supabase
      .from('daily_usage_summary')
      .select('date, total_usage_time')
      .eq('user_id', userId)
      .gte('date', oneWeekAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });
    
    if (error) {
      throw new Error(`日次使用時間データ取得エラー: ${error.message}`);
    }
    
    // 日付と使用時間の配列を準備
    const dates = data.map(d => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    const values = data.map(d => d.total_usage_time);
    
    return { dates, values };
  }

  /**
   * ユーザーの週間レポートデータを準備
   */
  private async prepareWeeklyReportData(userId: string): Promise<WeeklyReportData> {
    // 過去7日間のデータ
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const startDate = oneWeekAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    // 前週の平均取得
    const previousWeekAvg = await this.fetchPreviousWeekAverage(userId);
    
    // 直近24時間のアプリ別使用データを取得
    const hourlyAppUsage = await this.fetchLast24HoursData(userId);
    
    // 現在の時刻から24時間前までの時間ラベルを作成
    const now = new Date();
    const currentHour = now.getHours();
    const hourLabels = Array(24).fill(0).map((_, index) => {
      const hour = (currentHour - 23 + index + 24) % 24; // 0-23の範囲に収める
      return `${hour}時`;
    });
    
    // 過去7日間の日次使用時間データを取得（折れ線グラフ用）
    const lineChartData = await this.fetchDailyUsageForLineChart(userId);
    
    // 過去7日間のアプリ使用時間の集計
    const { data: weekData, error: weekError } = await this.supabase
      .from('hourly_phone_usage')
      .select('app_name, usage_time, open_count')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (weekError) {
      throw new Error(`週間アプリ使用データ取得エラー: ${weekError.message}`);
    }
    
    // アプリごとの使用時間と起動回数を集計
    const appUsageMap: Map<string, { time: number, openCount: number }> = new Map();
    
    weekData.forEach(record => {
      const current = appUsageMap.get(record.app_name) || { time: 0, openCount: 0 };
      appUsageMap.set(record.app_name, {
        time: current.time + record.usage_time,
        openCount: current.openCount + (record.open_count || 0)
      });
    });
    
    // 使用時間トップ5アプリを抽出
    const topApps = Array.from(appUsageMap.entries())
      .map(([name, { time, openCount }]) => ({ name, time, openCount }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
    
    // 週間平均を計算
    const weeklyAverage = lineChartData.values.length > 0
      ? lineChartData.values.reduce((sum, time) => sum + time, 0) / lineChartData.values.length
      : 0;
    
    // 変化率を計算
    const changePercentage = previousWeekAvg > 0
      ? ((weeklyAverage - previousWeekAvg) / previousWeekAvg) * 100
      : 0;
    
    // 時間帯別使用時間分布
    const hourlyDistribution = await this.fetchHourlyDistribution(userId, startDate, endDate);
    
    // 時間帯別アプリ使用分布を整理（時間帯別積み上げ棒グラフ用）
    const hourlyStackedData: Array<{ appName: string; values: number[] }> = [];
    
    // トップ5アプリについて時間帯別の使用時間配列を作成
    topApps.forEach(app => {
      const hourlyValues = Array(24).fill(0);
      
      // 各時間帯の使用時間を収集
      for (let i = 0; i < 24; i++) {
        const hour = (currentHour - 23 + i + 24) % 24; // 0-23の範囲に収める
        hourlyValues[i] = hourlyAppUsage[hour]?.[app.name] || 0;
      }
      
      hourlyStackedData.push({
        appName: app.name,
        values: hourlyValues
      });
    });
    
    // 日ごとの積み上げデータ部分は空のまま残す（実装予定）
    const stackedBarData: Array<{appName: string; values: number[]}> = [];
    
    return {
      userId,
      dates: lineChartData.dates,
      usageTimes: lineChartData.values,
      topApps,
      weeklyAverage,
      previousWeekAverage: previousWeekAvg,
      changePercentage,
      hourlyDistribution,
      stackedBarData,
      hourlyStackedData,
      hourLabels
    };
  }

  /**
   * 折れ線グラフを生成する関数
   */
  private async generateLineChart(
    labels: string[],
    data: number[],
    title: string,
    yAxisLabel = '使用時間 (分)',
    xAxisLabel = '日付'
  ): Promise<string> {
    return await generateLineChart(labels, data, title, yAxisLabel, xAxisLabel);
  }
  
  /**
   * 更新されたSlackメッセージの送信
   */
  private async sendUpdatedSlackMessage(
    reportData: WeeklyReportData,
    hourlyChartUrl: string,
    lineChartUrl: string,
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
            text: `📱 スマホ使用時間レポート`,
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
            text: '直近24時間のアプリ使用履歴',
            emoji: true
          },
          image_url: hourlyChartUrl,
          alt_text: '直近24時間のアプリ使用履歴'
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: '過去7日間の使用時間推移',
            emoji: true
          },
          image_url: lineChartUrl,
          alt_text: '過去7日間の使用時間推移'
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
              `${index + 1}. *${app.name}*: ${app.time.toFixed(1)}分 (${app.openCount}回起動)`
            ).join('\n')
          }
        }
      ]
    });
  }

  /**
   * 特定ユーザーの週間レポートを送信
   */
  public async sendReport(userId: string): Promise<void> {
    try {
      logger.info(`ユーザー ${userId} のレポート作成を開始します`);
      
      // レポートデータの準備
      const reportData = await this.prepareWeeklyReportData(userId);
      
      // グラフの生成
      logger.debug(`ユーザー ${userId} のグラフを生成します`);
      
      // 直近24時間の時間帯別使用履歴（積み上げ棒グラフ）
      const hourlyChartPath = await generateHourlyStackedBarChart(
        reportData.hourLabels,
        reportData.hourlyStackedData,
        '直近24時間のアプリ使用履歴',
        '使用時間 (分)',
        '時間帯'
      );
      
      // 過去7日間の使用時間推移（折れ線グラフ）
      const lineChartPath = await this.generateLineChart(
        reportData.dates,
        reportData.usageTimes,
        '過去7日間の使用時間推移',
        '使用時間 (分)',
        '日付'
      );
      
      // 画像をストレージにアップロード
      logger.debug(`ユーザー ${userId} のグラフをストレージにアップロードします`);
      const timestamp = Date.now();
      const baseDir = `reports/${userId}/${timestamp}`;
      
      const imageUrls = await this.uploadImages(
        {
          hourly: hourlyChartPath,
          line: lineChartPath
        },
        baseDir
      );
      
      // Slackにメッセージ送信
      logger.info(`ユーザー ${userId} のレポートをSlackに送信します`);
      await this.sendUpdatedSlackMessage(reportData, imageUrls.hourly, imageUrls.line);
      
      logger.info(`ユーザー ${userId} の週間レポートを送信しました`);
      
      // 一時ファイルの削除
      this.cleanupTempFiles([hourlyChartPath, lineChartPath]);
      
    } catch (error) {
      logger.error(`ユーザー ${userId} のレポート送信エラー:`, { error });
      throw error;
    }
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