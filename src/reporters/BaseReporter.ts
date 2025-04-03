// src/reporters/BaseReporter.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { IncomingWebhook } from '@slack/webhook';
import fs from 'fs';
import { Database } from '../types/supabase';
import { uploadImageToStorage } from '../utils/storage';
import { logger } from '../utils/logger';

/**
 * ベースレポーター基底クラス
 * 共通のユーティリティメソッドを提供
 */
export abstract class BaseReporter {
  protected supabase: SupabaseClient<Database>;
  protected webhook: IncomingWebhook;

  constructor(
    supabase: SupabaseClient<Database>,
    webhook: IncomingWebhook
  ) {
    this.supabase = supabase;
    this.webhook = webhook;
  }

  /**
   * 特定日の特定時間までの累積使用時間を取得
   */
  protected async fetchAccumulatedTimeUntilHour(userId: string, date: string, untilHour: number): Promise<number> {
    const { data, error } = await this.supabase
      .from('hourly_phone_usage')
      .select('usage_time')
      .eq('user_id', userId)
      .eq('date', date)
      .lte('hour', untilHour);
      
    if (error) {
      throw new Error(`累積使用時間取得エラー: ${error.message}`);
    }
    
    return data.reduce((sum, record) => sum + record.usage_time, 0);
  }

  /**
   * 特定の時間とユーザーのアプリ使用データを取得
   */
  protected async fetchHourlyAppUsage(userId: string, date: string, hour: number): Promise<Array<{app_name: string, usage_time: number, open_count: number}>> {
    try {
      logger.debug(`${userId}の${date} ${hour}時のアプリ使用データを取得中...`);
      
      const { data, error } = await this.supabase
        .from('hourly_phone_usage')
        .select('app_name, usage_time, open_count')
        .eq('user_id', userId)
        .eq('date', date)
        .eq('hour', hour);
        
      if (error) {
        throw new Error(`時間別アプリ使用データ取得エラー: ${error.message}`);
      }
      
      // データが空だった場合のログ
      if (!data || data.length === 0) {
        logger.warn(`${userId}の${date} ${hour}時のアプリ使用データが見つかりませんでした`);
        return [];
      }
      
      // データをフィルタリング・整形
      const validData = data
        .filter(record => record.app_name && record.usage_time > 0) // 有効なデータのみ
        .map(record => ({
          app_name: record.app_name,
          usage_time: record.usage_time,
          open_count: record.open_count || 0
        }));
      
      logger.debug(`${date} ${hour}時のアプリ使用データ: ${validData.length}件取得`);
      
      return validData;
    } catch (error) {
      logger.error(`アプリ使用データ取得エラー:`, { error, userId, date, hour });
      return []; // エラー時は空配列を返す
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
   * ユーザーの時間帯別使用時間分布を取得
   */
  protected async fetchHourlyDistribution(userId: string, startDate: string, endDate: string): Promise<number[]> {
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
   * 一時ファイルを削除するユーティリティメソッド
   */
  protected cleanupTempFiles(filePaths: string[]): void {
    try {
      filePaths.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      logger.debug('一時ファイルを削除しました');
    } catch (error) {
      logger.warn('一時ファイル削除中にエラーが発生しました', { error });
    }
  }

  /**
   * 画像をストレージにアップロードしてURLを取得するユーティリティメソッド
   */
  protected async uploadImages(filePaths: Record<string, string>, baseDir: string): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};
    const timestamp = Date.now();

    for (const [key, filePath] of Object.entries(filePaths)) {
      const fileName = `${key}.png`;
      const destination = `${baseDir}/${timestamp}/${fileName}`;
      urls[key] = await uploadImageToStorage(filePath, destination);
    }

    return urls;
  }
}