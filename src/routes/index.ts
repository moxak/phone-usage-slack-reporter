// src/routes/index.ts
import express from 'express';
import { PhoneUsageReporter } from '../reporters/phoneUsageReporter';
import { config } from '../config';
import { logger } from '../utils/logger';

export const apiRouter = express.Router();

// APIキー認証ミドルウェア
const authenticateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== config.app.apiKey) {
    logger.warn('無効なAPIキーによるアクセス試行', { 
      ip: req.ip, 
      path: req.path, 
      userAgent: req.headers['user-agent'] 
    });
    return res.status(401).json({ error: '無効なAPIキーです' });
  }
  next();
};

// 手動でレポートを送信するエンドポイント
apiRouter.post('/report', authenticateApiKey, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'ユーザーIDが必要です' });
    }

    const reporter = req.app.locals.reporter as PhoneUsageReporter;
    
    // レポート送信を非同期で開始
    logger.info(`ユーザー ${userId} のレポート送信を開始します`);
    reporter.sendReport(userId)
      .then(() => {
        logger.info(`ユーザー ${userId} のレポート送信が完了しました`);
      })
      .catch(error => {
        logger.error(`ユーザー ${userId} のレポート送信に失敗しました`, { error });
      });
    
    // 処理開始のレスポンスをすぐに返す
    return res.json({ 
      success: true, 
      message: `ユーザー ${userId} のレポート送信をバックグラウンドで開始しました` 
    });
  } catch (error: any) {
    logger.error('レポート送信エラー:', { error });
    return res.status(500).json({ 
      error: '内部サーバーエラー', 
      message: error.message 
    });
  }
});

// 全ユーザーのレポートを送信するエンドポイント
apiRouter.post('/report-all', authenticateApiKey, async (req, res) => {
  try {
    const reporter = req.app.locals.reporter as PhoneUsageReporter;
    
    // 全ユーザーのレポート送信を非同期で開始
    logger.info('全ユーザーのレポート送信を開始します');
    reporter.sendReportToAllUsers()
      .then(result => {
        logger.info('全ユーザーのレポート送信が完了しました', { result });
      })
      .catch(error => {
        logger.error('全ユーザーのレポート送信に失敗しました', { error });
      });
    
    // 処理開始のレスポンスをすぐに返す
    return res.json({ 
      success: true, 
      message: '全ユーザーのレポート送信をバックグラウンドで開始しました' 
    });
  } catch (error: any) {
    logger.error('一括レポート送信エラー:', { error });
    return res.status(500).json({ 
      error: '内部サーバーエラー', 
      message: error.message 
    });
  }
});