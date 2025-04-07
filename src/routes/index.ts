// src/routes/index.ts
import express from 'express';
import { logger } from '../utils/logger.js';

export const apiRouter = express.Router();

apiRouter.use(express.json());
apiRouter.use(express.urlencoded({ extended: true }));

// APIのルートを定義
apiRouter.get('/', (_req, res) => {
  res.json({
    message: 'API is running',
    routes: {
      '/trigger-weekly-reports': '全ユーザー向け週間レポートを手動トリガー',
      '/trigger-hourly-reports': '全ユーザー向け毎時レポートを手動トリガー',
      '/check-data': 'データ確認エンドポイント'
    }
  });
});


// 全ユーザー向け週間レポートを手動トリガーするエンドポイント
apiRouter.post('/trigger-weekly-reports', async (req: express.Request, res: express.Response) => {
  try {
    logger.info('全ユーザー向け週間レポートの生成を手動でトリガーします');

    const reporter = req.app.locals.reporter;
    const result = await reporter.sendReportToAllUsers();

    res.json({
      success: true,
      message: '週間レポート処理が完了しました',
      stats: {
        total: result.total,
        success: result.success,
        failed: result.failed
      }
    });
  } catch (error) {
    logger.error('週間レポートトリガーエラー:', { 
      error: error instanceof Error ? { 
        message: error.message, 
        stack: error.stack,
        name: error.name
      } : error 
    });
    res.status(500).json({ 
      success: false, 
      error: 'レポート処理中にエラーが発生しました',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// 全ユーザー向け毎時レポートを手動トリガーするエンドポイント
apiRouter.post('/trigger-hourly-reports', async (req: express.Request, res: express.Response) => {
  try {
    logger.info('全ユーザー向け毎時レポートの生成を手動でトリガーします');

    const reporter = req.app.locals.reporter;
    logger.info('reporter:', { reporter });
    logger.info('reporter.sendHourlyReportToAllUsers:', { sendHourlyReportToAllUsers: reporter.sendHourlyReportToAllUsers });
    const result = await reporter.sendHourlyReportToAllUsers();

    res.json({
      success: true,
      message: '毎時レポート処理が完了しました',
      stats: {
        total: result.total,
        success: result.success,
        failed: result.failed
      }
    });
  } catch (error) {
    // エラーの詳細情報をログに記録
    logger.error('毎時レポートトリガーエラー:', { 
      error: error instanceof Error ? { 
        message: error.message, 
        stack: error.stack,
        name: error.name,
        toString: error.toString()
      } : error 
    });
    res.status(500).json({ 
      success: false, 
      error: 'レポート処理中にエラーが発生しました',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// データ確認エンドポイント（開発用）
apiRouter.get('/check-data', async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const supabase = req.app.locals.supabase;
    
    const { data: recentData, error } = await supabase
      .from('hourly_phone_usage')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('hour', { ascending: false })
      .limit(10);
    
    if (error) {
      logger.error('データ確認エラー:', { error });
      return res.status(500).json({ error: 'データ取得中にエラーが発生しました' });
    }
    
    res.json({
      success: true,
      userId,
      recentData
    });
  } catch (error) {
    logger.error('データ確認APIエラー:', { error });
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});