// src/reporters/DailyReporter.ts
import { BaseReporter } from './BaseReporter.js';
import { DailyReportData } from '../types/phoneUsage.js';
import { logger } from '../utils/logger.js';
import { generateHourlyStackedBarChart, generatePieChart } from '../utils/chart-generator.js';

export class DailyReporter extends BaseReporter {
  /**
   * 特定日の時間帯別合計使用時間を取得
   */
  private async fetchDailyHourlyUsage(userId: string, date: string): Promise<number[]> {
    try {
      // 24時間分の配列を0で初期化
      const hourlyUsage = Array(24).fill(0);
      
      // データベースから時間帯別データを取得
      const { data, error } = await this.supabase
        .from('hourly_phone_usage')
        .select('hour, usage_time')
        .eq('user_id', userId)
        .eq('date', date);
        
      if (error) {
        throw new Error(`時間帯別使用時間取得エラー: ${error.message}`);
      }
      
      // データが見つからない場合は空の配列を返す
      if (!data || data.length === 0) {
        logger.warn(`${userId}の${date}の時間帯別データが見つかりませんでした`);
        return hourlyUsage;
      }
      
      // 各時間帯の使用時間を集計
      data.forEach(record => {
        if (record.hour >= 0 && record.hour < 24) {
          hourlyUsage[record.hour] += record.usage_time;
        }
      });
      
      return hourlyUsage;
    } catch (error) {
      logger.error(`時間帯別使用時間取得エラー:`, { error, userId, date });
      return Array(24).fill(0); // エラー時は0埋めの配列を返す
    }
  }

  /**
   * 特定日のアプリ別使用時間を取得
   */
  private async fetchDailyAppUsage(userId: string, date: string): Promise<Array<{
    appName: string;
    usageTime: number;
    percentage: number;
    openCount: number;
  }>> {
    try {
      // アプリごとの使用時間を集計するクエリ
      const { data, error } = await this.supabase
        .from('hourly_phone_usage')
        .select('app_name, usage_time, open_count')
        .eq('user_id', userId)
        .eq('date', date);
        
      if (error) {
        throw new Error(`アプリ使用時間取得エラー: ${error.message}`);
      }
      
      // データが見つからない場合は空の配列を返す
      if (!data || data.length === 0) {
        logger.warn(`${userId}の${date}のアプリ使用データが見つかりませんでした`);
        return [];
      }
      
      // アプリごとに集計
      const appMap = new Map<string, { time: number, openCount: number }>();
      
      data.forEach(record => {
        if (!record.app_name) return; // アプリ名がない場合はスキップ
        
        const current = appMap.get(record.app_name) || { time: 0, openCount: 0 };
        appMap.set(record.app_name, {
          time: current.time + (record.usage_time || 0),
          openCount: current.openCount + (record.open_count || 0)
        });
      });
      
      // 合計使用時間を計算
      const totalTime = Array.from(appMap.values()).reduce((sum, app) => sum + app.time, 0);
      
      // 使用時間でソートし、パーセンテージを計算
      const appUsage = Array.from(appMap.entries())
        .map(([appName, { time, openCount }]) => ({
          appName,
          usageTime: time,
          percentage: totalTime > 0 ? (time / totalTime) * 100 : 0,
          openCount
        }))
        .sort((a, b) => b.usageTime - a.usageTime)
        .slice(0, 10); // 上位10アプリに制限
      
      return appUsage;
    } catch (error) {
      logger.error(`アプリ使用時間取得エラー:`, { error, userId, date });
      return []; // エラー時は空の配列を返す
    }
  }

  /**
   * 特定日のユーザーの日次レポートデータを準備
   * @param userId ユーザーID
   * @param targetDate 対象日 (YYYY-MM-DD形式、省略時は昨日)
   */
  private async prepareDailyReportData(userId: string, targetDate?: string): Promise<DailyReportData> {
    try {
      // 対象日を決定 (デフォルトは昨日)
      const now = new Date();
      let reportDate: Date;
      
      if (targetDate) {
        reportDate = new Date(targetDate);
      } else {
        reportDate = new Date(now);
        reportDate.setDate(reportDate.getDate() - 1);
      }
      
      // 日付文字列の生成
      const dateStr = reportDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // 表示用の日付フォーマット
      const formattedDate = new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(reportDate);
      
      logger.info(`${userId}の日次レポート準備: ${dateStr} (${formattedDate})`);
      
      // 前日の日付を計算
      const previousDay = new Date(reportDate);
      previousDay.setDate(previousDay.getDate() - 1);
      const previousDayStr = previousDay.toISOString().split('T')[0];
      
      // 1. 時間帯別の使用時間データを取得
      const hourlyUsage = await this.fetchDailyHourlyUsage(userId, dateStr);
      
      // 時間ラベルの生成 (0時-23時)
      const hourLabels = Array.from({length: 24}, (_, i) => `${i}時`);
      
      // 2. 対象日の合計使用時間を計算
      const totalUsageTime = hourlyUsage.reduce((sum, time) => sum + time, 0);
      
      // 3. 前日の合計使用時間を取得
      const previousDayTotalUsageTime = await this.fetchDayTotalUsage(userId, previousDayStr);
      
      // 4. 前日との変化率を計算
      const changePercentage = previousDayTotalUsageTime > 0 
        ? ((totalUsageTime - previousDayTotalUsageTime) / previousDayTotalUsageTime) * 100
        : (totalUsageTime > 0 ? 100 : 0);
      
      // 5. アプリ別の使用時間データを取得
      const appUsage = await this.fetchDailyAppUsage(userId, dateStr);
      
      // 6. 時間帯別アプリ使用データを取得 (積み上げ棒グラフ用)
      const hourlyAppData = await this.fetchDailyHourlyAppData(userId, dateStr);
      
      // 最も使用時間が多い時間帯
      const mostActiveHour = hourlyUsage.indexOf(Math.max(...hourlyUsage));
      
      // 最も使用時間が長いアプリ
      const mostUsedApp = appUsage.length > 0 ? appUsage[0].appName : "データなし";
      
      // 使用されたアプリの数
      const appCount = appUsage.length;
      
      // レポートデータの構築
      const reportData: DailyReportData = {
        userId,
        date: dateStr,
        formattedDate,
        totalUsageTime,
        previousDayTotalUsageTime,
        changePercentage,
        hourlyUsage,
        hourLabels,
        appUsage,
        hourlyAppData,
        mostActiveHour,
        mostUsedApp,
        appCount
      };
      
      return reportData;
    } catch (error) {
      logger.error(`日次レポートデータ準備エラー:`, { error, userId });
      throw error;
    }
  }
  private async fetchDailyHourlyAppData(userId: string, dateStr: string): Promise<{ appName: string; values: number[]; }[]> {
    try {
      // Fetch hourly app usage data from the database
      const { data, error } = await this.supabase
        .from('hourly_phone_usage')
        .select('hour, app_name, usage_time')
        .eq('user_id', userId)
        .eq('date', dateStr);

      if (error) {
        throw new Error(`時間帯別アプリ使用データ取得エラー: ${error.message}`);
      }

      if (!data || data.length === 0) {
        logger.warn(`${userId}の${dateStr}の時間帯別アプリ使用データが見つかりませんでした`);
        return [];
      }

      // Group data by app name and aggregate hourly usage
      const appDataMap = new Map<string, number[]>();
      data.forEach(record => {
        if (!record.app_name || record.hour < 0 || record.hour >= 24) return;

        if (!appDataMap.has(record.app_name)) {
          appDataMap.set(record.app_name, Array(24).fill(0));
        }

        appDataMap.get(record.app_name)![record.hour] += record.usage_time || 0;
      });

      // Convert the map to the expected format
      return Array.from(appDataMap.entries()).map(([appName, values]) => ({ appName, values }));
    } catch (error) {
      logger.error(`時間帯別アプリ使用データ取得エラー:`, { error, userId, dateStr });
      return [];
    }
  }


  /**
   * 特定日の合計使用時間を取得
   */
  protected async fetchDayTotalUsage(userId: string, date: string): Promise<number> {
    try {
      // サマリーテーブルを参照
      const { data: summaryData, error: summaryError } = await this.supabase
        .from('daily_usage_summary')
        .select('total_usage_time')
        .eq('user_id', userId)
        .eq('date', date)
        .single();
        
      // サマリーデータが見つかった場合はそれを返す
      if (!summaryError && summaryData) {
        return summaryData.total_usage_time;
      }
      
      // サマリーデータがない場合は時間帯データを集計
      const { data, error } = await this.supabase
        .from('hourly_phone_usage')
        .select('usage_time')
        .eq('user_id', userId)
        .eq('date', date);
        
      if (error) {
        throw new Error(`日次使用時間取得エラー: ${error.message}`);
      }
      
      // データが見つからない場合は0を返す
      if (!data || data.length === 0) {
        return 0;
      }
      
      // 使用時間を合計
      return data.reduce((sum, record) => sum + (record.usage_time || 0), 0);
    } catch (error) {
      logger.error(`日次使用時間取得エラー:`, { error, userId, date });
      return 0; // エラー時は0を返す
    }
  }

/**
   * 日次レポートを作成し Slack に送信
   * @param userId ユーザーID
   * @param targetDate 対象日 (YYYY-MM-DD形式、省略時は昨日)
   */
public async sendDailyReport(userId: string, targetDate?: string): Promise<void> {
  try {
    logger.info(`ユーザー ${userId} の日次レポート作成を開始します`);
    
    // レポートデータを準備
    const reportData: DailyReportData = await this.prepareDailyReportData(userId, targetDate);
    
    // グラフ生成
    const stackedBarChartPath = await generateHourlyStackedBarChart(
      reportData.hourLabels,
      reportData.hourlyAppData,
      `時間帯別アプリ使用（${reportData.formattedDate}）`,
      '使用時間 (分)',
      '時間帯'
    );
    
    const appNames = reportData.appUsage.map(item => item.appName);
    const appUsageTimes = reportData.appUsage.map(item => item.usageTime);
    const pieChartPath = await generatePieChart(
      appNames,
      appUsageTimes,
      `アプリ使用分布（${reportData.formattedDate}）`
    );
    
    // 画像をストレージにアップロード
    const timestamp = Date.now();
    const imageUrls = await this.uploadImages(
      { stackedBar: stackedBarChartPath, pieChart: pieChartPath },
      `reports/${userId}/${timestamp}`
    );
    
    // Slack メッセージブロックの作成
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📅 ${reportData.formattedDate} の日次スマホ使用レポート`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*総使用時間:* ${reportData.totalUsageTime.toFixed(1)}分\n` +
            `*前日使用時間:* ${reportData.previousDayTotalUsageTime.toFixed(1)}分\n` +
            `*変化率:* ${reportData.changePercentage.toFixed(1)}%\n` +
            `*最も使用した時間帯:* ${reportData.mostActiveHour}時\n` +
            `*最も使用したアプリ:* ${reportData.mostUsedApp}\n` +
            `*使用アプリ数:* ${reportData.appCount}`
        }
      },
      {
        type: 'image',
        title: {
          type: 'plain_text',
          text: '時間帯別アプリ使用（積み上げ棒グラフ）',
          emoji: true
        },
        image_url: imageUrls.stackedBar,
        alt_text: '時間帯別アプリ使用積み上げ棒グラフ'
      },
      {
        type: 'image',
        title: {
          type: 'plain_text',
          text: 'アプリ使用分布（円グラフ）',
          emoji: true
        },
        image_url: imageUrls.pieChart,
        alt_text: 'アプリ使用分布円グラフ'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `レポート生成時刻: ${new Date().toLocaleTimeString('ja-JP')}`
          }
        ]
      }
    ];
    
    // Slack にメッセージ送信
    await this.webhook.send({ blocks });
    
    // 一時ファイルの削除
    this.cleanupTempFiles([stackedBarChartPath, pieChartPath]);
    
    logger.info(`ユーザー ${userId} の日次レポートを送信しました`);
  } catch (error) {
    logger.error(`ユーザー ${userId} の日次レポート送信エラー:`, { error });
    throw error;
  }
}

/**
 * すべてのアクティブユーザーに対して日次レポートを送信
 */
public async sendDailyReportToAllUsers(): Promise<{ total: number; success: number; failed: number }> {
  try {
    logger.info('日次レポート用アクティブユーザーの取得を開始します');
    // 例として、前日分のサマリーデータが存在するユーザーを対象とする
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const { data: activeUsers, error } = await this.supabase
      .from('daily_usage_summary')
      .select('user_id')
      .eq('date', yesterdayStr);
    
    if (error) {
      throw new Error(`アクティブユーザー取得エラー: ${error.message}`);
    }
    
    const uniqueUserIds = Array.from(new Set(activeUsers.map(u => u.user_id)));
    logger.info(`日次レポート生成: ${uniqueUserIds.length}人のアクティブユーザーを処理します`);
    
    const results = await Promise.allSettled(
      uniqueUserIds.map(userId => this.sendDailyReport(userId))
    );
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`ユーザー ${uniqueUserIds[index]} の日次レポート送信に失敗:`, {
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
    logger.error('全ユーザーへの日次レポート送信エラー:', { error });
    throw error;
  }
}
}