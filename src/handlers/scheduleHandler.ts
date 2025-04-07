// src/handlers/scheduleHandler.ts
import cron from 'node-cron';
import { DailyReporter, HourlyReporter, WeeklyReporter } from '../reporters/index.js'; // reporters/index.ts 経由でインポート
import { logger } from '../utils/logger.js';

export class ScheduleHandler {
  private dailyReporter: DailyReporter;
  private hourlyReporter: HourlyReporter;
  private weeklyReporter: WeeklyReporter;
  private weeklySchedule: string; // 週次レポートのcron表現
  private hourlySchedule: string; // 毎時レポートのcron表現
  private dailySchedule: string;  // 日次レポートのcron表現

  private weeklyTask: cron.ScheduledTask | null = null;
  private hourlyTask: cron.ScheduledTask | null = null;
  private dailyTask: cron.ScheduledTask | null = null;

  constructor(
    dailyReporter: DailyReporter,
    hourlyReporter: HourlyReporter,
    weeklyReporter: WeeklyReporter,
    weeklySchedule: string = '0 9 * * 1',   // デフォルト: 毎週月曜9時
    hourlySchedule: string = '0 * * * *',     // デフォルト: 毎時0分
    dailySchedule: string = '0 10 * * *'       // デフォルト: 毎日10時
  ) {
    this.dailyReporter = dailyReporter;
    this.hourlyReporter = hourlyReporter;
    this.weeklyReporter = weeklyReporter;
    this.weeklySchedule = weeklySchedule;
    this.hourlySchedule = hourlySchedule;
    this.dailySchedule = dailySchedule;
  }

  /**
   * 週次レポートスケジュールを開始
   */
  public startWeeklySchedule(): void {
    if (this.weeklyTask) {
      logger.warn('週次レポートスケジュールは既に実行中です');
      return;
    }

    logger.info(`週次レポートスケジュール設定: ${this.weeklySchedule}`);
    this.weeklyTask = cron.schedule(this.weeklySchedule, async () => {
      try {
        logger.info('週次レポート送信処理を開始します');
        const result = await this.weeklyReporter.sendReportToAllUsers();
        logger.info(`週次レポート送信完了: 合計${result.total}ユーザー、成功${result.success}、失敗${result.failed}`);
      } catch (error) {
        logger.error('週次レポート送信中にエラーが発生しました:', { error });
      }
    });

    logger.info('週次レポートスケジュールを開始しました');
  }

  /**
   * 毎時レポートスケジュールを開始
   */
  public startHourlySchedule(): void {
    if (this.hourlyTask) {
      logger.warn('毎時レポートスケジュールは既に実行中です');
      return;
    }

    logger.info(`毎時レポートスケジュール設定: ${this.hourlySchedule}`);
    this.hourlyTask = cron.schedule(this.hourlySchedule, async () => {
      try {
        logger.info('毎時レポート送信処理を開始します');
        const result = await this.hourlyReporter.sendHourlyReportToAllUsers();
        logger.info(`毎時レポート送信完了: 合計${result.total}ユーザー、成功${result.success}、失敗${result.failed}`);
      } catch (error) {
        logger.error('毎時レポート送信中にエラーが発生しました:', { error });
      }
    });

    logger.info('毎時レポートスケジュールを開始しました');
  }

  /**
   * 日次レポートスケジュールを開始
   */
  public startDailySchedule(): void {
    if (this.dailyTask) {
      logger.warn('日次レポートスケジュールは既に実行中です');
      return;
    }

    logger.info(`日次レポートスケジュール設定: ${this.dailySchedule}`);
    this.dailyTask = cron.schedule(this.dailySchedule, async () => {
      try {
        logger.info('日次レポート送信処理を開始します');
        const result = await this.dailyReporter.sendDailyReportToAllUsers();
        logger.info(`日次レポート送信完了: 合計${result.total}ユーザー、成功${result.success}、失敗${result.failed}`);
      } catch (error) {
        logger.error('日次レポート送信中にエラーが発生しました:', { error });
      }
    });

    logger.info('日次レポートスケジュールを開始しました');
  }

  /**
   * 全てのスケジュールを開始
   */
  public startAllSchedules(): void {
    this.startWeeklySchedule();
    this.startHourlySchedule();
    this.startDailySchedule();
  }

  /**
   * 週次レポートスケジュールを停止
   */
  public stopWeeklySchedule(): void {
    if (this.weeklyTask) {
      this.weeklyTask.stop();
      this.weeklyTask = null;
      logger.info('週次レポートスケジュールを停止しました');
    }
  }

  /**
   * 毎時レポートスケジュールを停止
   */
  public stopHourlySchedule(): void {
    if (this.hourlyTask) {
      this.hourlyTask.stop();
      this.hourlyTask = null;
      logger.info('毎時レポートスケジュールを停止しました');
    }
  }

  /**
   * 日次レポートスケジュールを停止
   */
  public stopDailySchedule(): void {
    if (this.dailyTask) {
      this.dailyTask.stop();
      this.dailyTask = null;
      logger.info('日次レポートスケジュールを停止しました');
    }
  }

  /**
   * 全てのスケジュールを停止
   */
  public stopAllSchedules(): void {
    this.stopWeeklySchedule();
    this.stopHourlySchedule();
    this.stopDailySchedule();
  }
}
