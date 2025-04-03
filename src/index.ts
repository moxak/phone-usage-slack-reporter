import express from 'express';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { IncomingWebhook } from '@slack/webhook';
import { DailyReporter, HourlyReporter, WeeklyReporter } from './reporters'; // reporters/index.ts 経由で個別レポーターをインポート
import { apiRouter } from './routes';
import { healthRouter } from './routes/health';
import { config } from './config';
import { logger } from './utils/logger';
import path from 'path';
import fs from 'fs';

// アプリの初期化
const app = express();
app.use(express.json());

// 一時ディレクトリの作成
const tempDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ログディレクトリの作成
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Supabaseクライアントの初期化
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);

// Slack Webhookの初期化
const webhook = new IncomingWebhook(config.slack.webhookUrl);

// 各レポーターの初期化
const dailyReporter = new DailyReporter(supabase, webhook);
const hourlyReporter = new HourlyReporter(supabase, webhook);
const weeklyReporter = new WeeklyReporter(supabase, webhook);

// アプリ全体で利用するオブジェクトをlocalsに保存
app.locals.supabase = supabase;
app.locals.webhook = webhook;
app.locals.dailyReporter = dailyReporter;
app.locals.hourlyReporter = hourlyReporter;
app.locals.weeklyReporter = weeklyReporter;

// ルーターのマウント
app.use('/api', apiRouter);
app.use('/health', healthRouter);

// ルートパスのハンドラ
app.get('/', (req, res) => {
  res.json({
    name: 'phone-usage-slack-reporter',
    version: '1.0.0',
    status: 'running'
  });
});

// 404ハンドラ
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `リクエストされたパス ${req.path} は存在しません`
  });
});

// エラーハンドラ
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('サーバーエラー:', { error: err, path: req.path });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? '内部サーバーエラーが発生しました' : err.message
  });
});

// Cronスケジュールの設定
const weeklySchedule = config.app.cronSchedule;
const hourlySchedule = config.app.hourlySchedule;
const dailySchedule = config.app.dailySchedule;

// 週間レポートのCronジョブ設定（WeeklyReporter を利用）
cron.schedule(weeklySchedule, async () => {
  logger.info('週間レポートCronジョブを実行します');
  try {
    const result = await weeklyReporter.sendReportToAllUsers();
    logger.info(`週間レポートジョブ完了: ${result.total}人処理, 成功: ${result.success}, 失敗: ${result.failed}`);
  } catch (error) {
    logger.error('週間レポートジョブエラー:', { error });
  }
});

// 毎時レポートのCronジョブ設定（HourlyReporter を利用）
cron.schedule(hourlySchedule, async () => {
  logger.info('毎時レポートCronジョブを実行します');
  try {
    const result = await hourlyReporter.sendHourlyReportToAllUsers();
    logger.info(`毎時レポートジョブ完了: ${result.total}人処理, 成功: ${result.success}, 失敗: ${result.failed}`);
  } catch (error) {
    logger.error('毎時レポートジョブエラー:', { error });
  }
});

// 日次レポートのCronジョブ設定（DailyReporter を利用）
cron.schedule(dailySchedule, async () => {
  logger.info('日次レポートCronジョブを実行します');
  try {
    const result = await dailyReporter.sendDailyReportToAllUsers();
    logger.info(`日次レポートジョブ完了: ${result.total}人処理, 成功: ${result.success}, 失敗: ${result.failed}`);
  } catch (error) {
    logger.error('日次レポートジョブエラー:', { error });
  }
});

// サーバーの起動
const PORT = config.app.port;
app.listen(PORT, () => {
  logger.info(`サーバーが起動しました: http://localhost:${PORT}`);
  logger.info(`週間レポートCronスケジュール: ${weeklySchedule}`);
  logger.info(`毎時レポートCronスケジュール: ${hourlySchedule}`);
  logger.info(`日次レポートCronスケジュール: ${dailySchedule}`);
});

// プロセス終了時のクリーンアップ
process.on('SIGTERM', () => {
  logger.info('SIGTERMを受信しました。サーバーをシャットダウンします');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINTを受信しました。サーバーをシャットダウンします');
  process.exit(0);
});

export default app;
