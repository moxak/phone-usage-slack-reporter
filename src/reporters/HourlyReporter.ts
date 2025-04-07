// src/reporters/HourlyReporter.ts
import { BaseReporter } from './BaseReporter.js';
import { HourlyReportData } from '../types/phoneUsage.js';
import { logger } from '../utils/logger.js';
import { generateHourlyStackedBarChart, generatePieChart } from '../utils/chart-generator.js';

export class HourlyReporter extends BaseReporter {
  /**
   * 過去N時間の使用傾向データを取得
   */
  private async fetchRecentHourlyTrend(userId: string, hoursCount: number = 6): Promise<{hours: string[], values: number[]}> {
    try { 
      const now = new Date();
      const hours: string[] = [];
      const values: number[] = [];
      
      for (let i = hoursCount - 1; i >= 0; i--) {
        const targetDate = new Date(now);
        targetDate.setHours(now.getHours() - i);
        
        const dateStr = targetDate.toISOString().split('T')[0];
        const hour = targetDate.getHours();
        const hourLabel = `${hour}時`;
        
        const { data, error } = await this.supabase
          .from('hourly_phone_usage')
          .select('usage_time')
          .eq('user_id', userId)
          .eq('date', dateStr)
          .eq('hour', hour);
          
        if (error) {
          throw new Error(`時間別使用傾向データ取得エラー: ${error.message}`);
        }
        
        const hourlyTotal = data.reduce((sum, record) => sum + record.usage_time, 0);
        
        hours.push(hourLabel);
        values.push(hourlyTotal);
      }
      
      return { hours, values };
    } catch (error) {
      logger.error(`過去の使用傾向データ取得エラー:`, { 
        error: error instanceof Error ? { 
          message: error.message,
          stack: error.stack 
        } : error,
        userId
      });
      throw error;
    }
  }

  /**
   * 時間帯とアプリごとの使用時間データを取得
   * 直近N時間分の各時間におけるアプリごとの使用時間を取得
   */
  private async fetchHourlyAppStackData(userId: string, hoursCount: number = 6): Promise<{
    hours: string[],
    appStackData: Array<{appName: string, values: number[]}>
  }> {
    try {
      const now = new Date();
      const hours: string[] = [];
      
      // 各時間帯のデータを保存する配列 (インデックス = 時間帯の順序)
      const hourlyData: Array<{hour: number, date: string, apps: {appName: string, usage: number}[]}> = [];
      
      // 過去N時間のデータを収集
      for (let i = 0; i < hoursCount; i++) {
        // i時間前の日時を計算
        const hourOffset = hoursCount - 1 - i;
        const targetDate = new Date(now);
        targetDate.setHours(now.getHours() - hourOffset);
        
        const dateStr = targetDate.toISOString().split('T')[0];
        const hour = targetDate.getHours();
        const hourLabel = `${hour}時`;
        
        hours.push(hourLabel);
        
        logger.debug(`${userId}の${dateStr} ${hourLabel}データを取得中...`);
        
        // この時間帯のデータを取得
        const { data, error } = await this.supabase
          .from('hourly_phone_usage')
          .select('app_name, usage_time')
          .eq('user_id', userId)
          .eq('date', dateStr)
          .eq('hour', hour);
          
        if (error) {
          logger.error(`時間帯別データ取得エラー: ${error.message}`, { userId, date: dateStr, hour });
          // エラーがあってもスキップして次の時間帯に進む
          hourlyData.push({ hour, date: dateStr, apps: [] });
          continue;
        }
        
        // 取得したデータを整形
        const apps = data
          .filter(record => record.app_name && record.usage_time > 0) // 有効なデータのみ
          .map(record => ({
            appName: record.app_name,
            usage: record.usage_time
          }));
          
        hourlyData.push({ hour, date: dateStr, apps });
        
        logger.debug(`${dateStr} ${hourLabel}: ${apps.length}アプリのデータを取得`);
      }
      
      // すべてのアプリ名を収集
      const allAppNames = new Set<string>();
      hourlyData.forEach(hourData => {
        hourData.apps.forEach(app => {
          allAppNames.add(app.appName);
        });
      });
      
      logger.debug(`取得したユニークアプリ数: ${allAppNames.size}`);
      
      // アプリごとの時間帯別使用時間を計算
      const appUsageMap = new Map<string, {
        name: string,
        totalUsage: number,
        hourlyUsage: number[]
      }>();
      
      allAppNames.forEach(appName => {
        const hourlyUsage = Array(hoursCount).fill(0);
        
        // 各時間帯でのこのアプリの使用時間を設定
        hourlyData.forEach((hourData, index) => {
          const appData = hourData.apps.find(app => app.appName === appName);
          if (appData) {
            hourlyUsage[index] = appData.usage;
          }
        });
        
        const totalUsage = hourlyUsage.reduce((sum, usage) => sum + usage, 0);
        
        appUsageMap.set(appName, {
          name: appName,
          totalUsage,
          hourlyUsage
        });
      });
      
      // 使用時間の合計が大きい順にソート
      const sortedApps = Array.from(appUsageMap.values())
        .filter(app => app.totalUsage > 0) // 使用時間が0より大きいアプリのみ
        .sort((a, b) => b.totalUsage - a.totalUsage)
        .slice(0, 5); // 上位5アプリのみ
      
      // 出力フォーマットに変換
      const appStackData = sortedApps.map(app => ({
        appName: app.name,
        values: app.hourlyUsage
      }));
      
      // 結果の記録
      if (appStackData.length > 0) {
        logger.debug(`時間帯別データを取得: ${appStackData.length}アプリ、${hours.length}時間帯`);
        logger.debug(`最も使用されたアプリ: ${appStackData[0].appName}`);
      } else {
        logger.warn(`${userId}のアプリ使用データが見つかりませんでした`);
      }
      
      return { hours, appStackData };
    } catch (error) {
      logger.error(`時間帯別アプリデータ取得エラー:`, { 
        error: error instanceof Error ? { 
          message: error.message,
          stack: error.stack 
        } : error,
        userId 
      });
      // エラー時は空の配列を返す
      return {
        hours: Array(hoursCount).fill(0).map((_, i) => {
          const hour = (new Date().getHours() - hoursCount + 1 + i + 24) % 24;
          return `${hour}時`;
        }),
        appStackData: []
      };
    }
  }

  /**
   * ユーザーの毎時レポートデータを準備
   */
  private async prepareHourlyReportData(userId: string): Promise<HourlyReportData> {
    try { 
      const now = new Date();
      const currentHour = now.getHours();
      const todayDate = now.toISOString().split('T')[0];
      
      // 現在の時間のアプリ使用データを取得
      const currentHourData = await this.fetchHourlyAppUsage(userId, todayDate, currentHour);
      const currentHourUsage = currentHourData.reduce((sum, app) => sum + app.usage_time, 0);
      
      // トップアプリを取得
      const topAppsCurrentHour = currentHourData
        .map(app => ({
          name: app.app_name,
          time: app.usage_time,
          openCount: app.open_count || 0
        }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 5);
      
      // アプリデータが空であることをログに記録
      if (topAppsCurrentHour.length === 0) {
        logger.warn(`${userId}の${todayDate} ${currentHour}時のアプリ使用データが空です`);
      }
      
      // 前の時間のデータを取得
      const previousHour = (currentHour - 1 + 24) % 24;
      let previousHourDate = todayDate;
      
      // 前の時間が昨日の場合
      if (currentHour === 0) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        previousHourDate = yesterday.toISOString().split('T')[0];
      }
      
      const previousHourData = await this.fetchHourlyAppUsage(userId, previousHourDate, previousHour);
      const previousHourUsage = previousHourData.reduce((sum, app) => sum + app.usage_time, 0);
      
      // 変化率を計算
      const changePercentage = previousHourUsage > 0
        ? ((currentHourUsage - previousHourUsage) / previousHourUsage) * 100
        : (currentHourUsage > 0 ? 100 : 0);
      
      // 今日の累積使用時間
      const dailyAccumulatedTime = await this.fetchAccumulatedTimeUntilHour(userId, todayDate, currentHour);
      
      // 昨日の同時刻までの累積使用時間
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];
      const yesterdayAccumulatedTime = await this.fetchAccumulatedTimeUntilHour(userId, yesterdayDate, currentHour);
      
      // 昨日との比較
      const dailyChangePercentage = yesterdayAccumulatedTime > 0
        ? ((dailyAccumulatedTime - yesterdayAccumulatedTime) / yesterdayAccumulatedTime) * 100
        : (dailyAccumulatedTime > 0 ? 100 : 0);
      
      // 過去6時間の時間別使用時間傾向
      const hourlyTrend = await this.fetchRecentHourlyTrend(userId);
      
      // 過去6時間のアプリ別積み上げデータを取得
      const { hours, appStackData } = await this.fetchHourlyAppStackData(userId);
      
      // 取得したデータの整合性チェック
      logger.debug(`毎時レポートデータの確認:`, {
        userId,
        date: todayDate,
        hour: currentHour,
        appCount: topAppsCurrentHour.length,
        currentHourUsage,
        stackedAppCount: appStackData.length,
        hoursCount: hours.length
      });
      
      return {
        userId,
        currentHour,
        currentHourUsage,
        previousHourUsage,
        changePercentage,
        topAppsCurrentHour,
        dailyAccumulatedTime,
        yesterdayAccumulatedTime,
        dailyChangePercentage,
        hourlyTrend,
        hourlyAppStackData: appStackData
      };
    } catch (error) {
      logger.error(`毎時レポートデータ準備エラー:`, { 
        error: error instanceof Error ? { 
          message: error.message,
          stack: error.stack 
        } : error,
        userId 
      });
      throw error;
    }
  }

  /**
   * Slack毎時レポートメッセージの送信
   */
  private async sendHourlySlackMessage(
    reportData: HourlyReportData,
    hourlyTrendChartUrl: string,
    currentHourPieChartUrl: string
  ): Promise<void> {
    try { 
      // 変化率に基づいてメッセージとアイコンを決定
      let changeMessage = '';
      let changeIcon = '';
      
      if (reportData.changePercentage > 20) {
        changeMessage = `前の時間から ${reportData.changePercentage.toFixed(1)}% 大幅に増加しました`;
        changeIcon = ':arrow_double_up:';
      } else if (reportData.changePercentage > 0) {
        changeMessage = `前の時間から ${reportData.changePercentage.toFixed(1)}% 増加しました`;
        changeIcon = ':arrow_up:';
      } else if (reportData.changePercentage < -20) {
        changeMessage = `前の時間から ${Math.abs(reportData.changePercentage).toFixed(1)}% 大幅に減少しました`;
        changeIcon = ':arrow_double_down:';
      } else if (reportData.changePercentage < 0) {
        changeMessage = `前の時間から ${Math.abs(reportData.changePercentage).toFixed(1)}% 減少しました`;
        changeIcon = ':arrow_down:';
      } else {
        changeMessage = '前の時間から変化はありません';
        changeIcon = ':left_right_arrow:';
      }
      
      // 日次比較のメッセージとアイコン
      let dailyChangeMessage = '';
      let dailyChangeIcon = '';
      
      if (reportData.dailyChangePercentage > 20) {
        dailyChangeMessage = `昨日の同時刻より ${reportData.dailyChangePercentage.toFixed(1)}% 多く利用しています`;
        dailyChangeIcon = ':chart_with_upwards_trend:';
      } else if (reportData.dailyChangePercentage > 0) {
        dailyChangeMessage = `昨日の同時刻より ${reportData.dailyChangePercentage.toFixed(1)}% 多く利用しています`;
        dailyChangeIcon = ':small_red_triangle:';
      } else if (reportData.dailyChangePercentage < -20) {
        dailyChangeMessage = `昨日の同時刻より ${Math.abs(reportData.dailyChangePercentage).toFixed(1)}% 少なく利用しています`;
        dailyChangeIcon = ':chart_with_downwards_trend:';
      } else if (reportData.dailyChangePercentage < 0) {
        dailyChangeMessage = `昨日の同時刻より ${Math.abs(reportData.dailyChangePercentage).toFixed(1)}% 少なく利用しています`;
        dailyChangeIcon = ':small_red_triangle_down:';
      } else {
        dailyChangeMessage = '昨日の同時刻と同じ使用状況です';
        dailyChangeIcon = ':scales:';
      }
      
      // アプリのリストを作成
      // 空の場合は代替テキストを使用
      let appListText = reportData.topAppsCurrentHour.map((app, index) => 
        `${index + 1}. *${app.name}*: ${app.time.toFixed(1)}分 (${app.openCount}回起動)`
      ).join('\n');
      
      // アプリリストが空の場合は代替テキストを設定
      if (!appListText) {
        appListText = "この時間帯のアプリ使用データはありません";
      }
      
      // 現在時刻を日本語フォーマットで
      const now = new Date();
      const timeString = now.toLocaleTimeString('ja-JP');
      
      // Slackメッセージブロックの構成
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `⏰ ${reportData.currentHour}時台のスマホ使用レポート`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*現在の時間の使用時間:* ${reportData.currentHourUsage.toFixed(1)}分\n${changeIcon} ${changeMessage}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*今日の累積使用時間:* ${reportData.dailyAccumulatedTime.toFixed(1)}分\n${dailyChangeIcon} ${dailyChangeMessage}`
          }
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: '直近の使用時間推移',
            emoji: true
          },
          image_url: hourlyTrendChartUrl,
          alt_text: '直近の使用時間推移'
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: `${reportData.currentHour}時台のアプリ使用分布`,
            emoji: true
          },
          image_url: currentHourPieChartUrl,
          alt_text: '現在の時間のアプリ使用分布'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*この時間に最もよく使ったアプリ:*'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: appListText
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*レポート生成時刻:* ${timeString}`
            }
          ]
        }
      ];

      // Slackにメッセージを送信
      await this.webhook.send({
        blocks: blocks
      });
    } catch (error) {
      logger.error(`毎時Slackメッセージ作成エラー:`, {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error,
        userId: reportData.userId
      });
      throw error;
    }
  }

  /**
   * 特定ユーザーの毎時レポートを送信
   */
  public async sendHourlyReport(userId: string): Promise<void> {
    try {
      logger.info(`ユーザー ${userId} の毎時レポート作成を開始します`);
      
      // レポートデータの準備
      const reportData = await this.prepareHourlyReportData(userId);
      
      // グラフの生成
      logger.debug(`ユーザー ${userId} の毎時レポート用グラフを生成します`);
      
      // 過去6時間のアプリ使用状況（積み上げ棒グラフ）
      const hourlyStackedChartPath = await generateHourlyStackedBarChart(
        reportData.hourlyTrend.hours,
        reportData.hourlyAppStackData,
        '直近6時間のアプリ使用履歴',
        '使用時間 (分)',
        '時間帯'
      );
      
      // 現在の時間のアプリ使用分布（円グラフ）
      const currentHourPieChartPath = await generatePieChart(
        reportData.topAppsCurrentHour.map(app => app.name),
        reportData.topAppsCurrentHour.map(app => app.time),
        `${reportData.currentHour}時台のアプリ使用分布`
      );
      
      // 画像をストレージにアップロード
      logger.debug(`ユーザー ${userId} のグラフをストレージにアップロードします`);
      const timestamp = Date.now();
      const hourlyStackedChartUrl = await this.uploadImages(
        { hourlyStacked: hourlyStackedChartPath }, 
        `reports/${userId}/${timestamp}`
      ).then(urls => urls.hourlyStacked);
      
      const currentHourPieChartUrl = await this.uploadImages(
        { currentHourPie: currentHourPieChartPath }, 
        `reports/${userId}/${timestamp}`
      ).then(urls => urls.currentHourPie);
      
      // アプリリストが空かどうかをログに記録
      if (reportData.topAppsCurrentHour.length === 0) {
        logger.warn(`ユーザー ${userId} の ${reportData.currentHour}時台のアプリ使用データが空です`);
      }
      
      // Slackにメッセージ送信
      logger.info(`ユーザー ${userId} の毎時レポートをSlackに送信します`);
      try {
        await this.sendHourlySlackMessage(reportData, hourlyStackedChartUrl, currentHourPieChartUrl);
        logger.info(`ユーザー ${userId} の毎時レポートを送信しました`);
      } catch (slackError) {
        logger.error(`Slackへのメッセージ送信エラー:`, { 
          error: slackError, 
          userId, 
          appDataCount: reportData.topAppsCurrentHour.length,
          currentHour: reportData.currentHour
        });
        if (slackError instanceof Error) {
          throw new Error(`Slackへのメッセージ送信に失敗しました: ${slackError.message}`);
        } else {
          throw new Error('Slackへのメッセージ送信に失敗しました: 不明なエラー');
        }
      }
      
      // 一時ファイルの削除
      this.cleanupTempFiles([hourlyStackedChartPath, currentHourPieChartPath]);
      
    } catch (error) {
      logger.error(`ユーザー ${userId} の毎時レポート送信エラー:`, { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
      throw error;
    }
  }

  /**
     * すべてのアクティブユーザーに毎時レポートを送信
     */
  public async sendHourlyReportToAllUsers(): Promise<{ total: number; success: number; failed: number }> {
    try {
      // アクティブユーザーの取得（例: 過去24時間以内にデータが記録されたユーザー）
      logger.info('毎時レポート用アクティブユーザーの取得を開始します');
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { data: activeUsers, error } = await this.supabase
        .from('hourly_phone_usage')
        .select('user_id')
        .gte('date', oneDayAgo.toISOString().split('T')[0])
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`アクティブユーザー取得エラー: ${error.message}`);
      }
      
      // ユニークなアクティブユーザーIDの配列を作成
      const uniqueUserIds = Array.from(new Set(activeUsers.map((u: { user_id: any; }) => u.user_id)));
      
      logger.info(`毎時レポート生成: ${uniqueUserIds.length}人のアクティブユーザーを処理します`);
      
      // 各アクティブユーザーに対して毎時レポートを送信
      const results = await Promise.allSettled(
        uniqueUserIds.map(userId => this.sendHourlyReport(userId as string))
      );
      
      // 結果の集計
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      // 失敗したユーザーとエラー内容をログに記録
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`ユーザー ${uniqueUserIds[index]} の毎時レポート送信に失敗:`, { 
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
      logger.error('全ユーザー毎時レポート送信エラー:', { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
      throw error;
    }
  }
}