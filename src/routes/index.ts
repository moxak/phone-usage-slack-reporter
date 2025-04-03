// src/routes/index.ts
import express from 'express';
import { logger } from '../utils/logger';

export const apiRouter = express.Router();

apiRouter.use(express.json());
apiRouter.use(express.urlencoded({ extended: true }));

// APIのルートを定義
apiRouter.get('/', (req, res) => {
  res.json({
    message: 'API is running',
    routes: {
      '/test-report': 'テスト用の週間レポートを生成',
      '/test-hourly-report': 'テスト用の毎時レポートを生成',
      '/trigger-weekly-reports': '全ユーザー向け週間レポートを手動トリガー',
      '/trigger-hourly-reports': '全ユーザー向け毎時レポートを手動トリガー',
      '/check-data': 'データ確認エンドポイント'
    }
  });
});

// 既存の週間レポートテストエンドポイント
apiRouter.post('/test-report', async (req, res) => {
  try {
    const { userId = 'test-user' } = req.body;
    logger.info(`テスト用の週間レポートを生成します for user: ${userId}`);

    const reporter = req.app.locals.reporter;
    await reporter.sendReport(userId);

    res.json({
      success: true,
      message: `週間レポートが送信されました for user: ${userId}`
    });
  } catch (error) {
    logger.error('テストレポートエラー:', { error });
    res.status(500).json({ 
      success: false, 
      error: 'レポート送信中にエラーが発生しました' 
    });
  }
});

// 毎時レポートのテストエンドポイント
apiRouter.post('/test-hourly-report', async (req, res) => {
  try {
    const { userId = 'test-user' } = req.body;
    logger.info(`テスト用の毎時レポートを生成します for user: ${userId}`);

    const reporter = req.app.locals.reporter;
    await reporter.sendHourlyReport(userId);

    res.json({
      success: true,
      message: `毎時レポートが送信されました for user: ${userId}`
    });
  } catch (error) {
    logger.error('毎時テストレポートエラー:', { error });
    res.status(500).json({ 
      success: false, 
      error: 'レポート送信中にエラーが発生しました' 
    });
  }
});

// 全ユーザー向け週間レポートを手動トリガーするエンドポイント
apiRouter.post('/trigger-weekly-reports', async (req, res) => {
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
    logger.error('週間レポートトリガーエラー:', { error });
    res.status(500).json({ 
      success: false, 
      error: 'レポート処理中にエラーが発生しました' 
    });
  }
});

// 全ユーザー向け毎時レポートを手動トリガーするエンドポイント
apiRouter.post('/trigger-hourly-reports', async (req, res) => {
  try {
    logger.info('全ユーザー向け毎時レポートの生成を手動でトリガーします');

    const reporter = req.app.locals.reporter;
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
    logger.error('毎時レポートトリガーエラー:', { error });
    res.status(500).json({ 
      success: false, 
      error: 'レポート処理中にエラーが発生しました' 
    });
  }
});

// データ確認エンドポイント（開発用）
apiRouter.get('/check-data', async (req, res) => {
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