// src/routes/index.ts
import express from 'express';
import { logger } from '../utils/logger.js';
import { WeeklyReporter } from '../reporters/WeeklyReporter.js';
import { HourlyReporter } from '../reporters/HourlyReporter.js';

export const apiRouter = express.Router();

apiRouter.use(express.json());
apiRouter.use(express.urlencoded({ extended: true }));

// 循環参照を処理する関数
const safeJson = (data: { total: number; success: number; failed: number; }) => {
  try {
    // 直接循環参照を含むプロパティを除外
    const safeData = { ...data };
    
    // 知られている循環参照のプロパティを削除
    if (typeof safeData === 'object' && safeData !== null) {
      ['_idlePrev', '_idleNext', '_events', '_eventsCount', '_maxListeners'].forEach(prop => {
        if (prop in safeData) {
          delete (safeData as any)[prop];
        }
      });
    }
    
    return safeData;
  } catch (err) {
    logger.error('safeJson変換エラー:', { error: err instanceof Error ? err.message : String(err) });
    return { error: 'データの安全な変換に失敗しました' };
  }
};

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

    // 正しいレポーターインスタンスを取得
    const weeklyReporter = req.app.locals.weeklyReporter as WeeklyReporter;
    if (!weeklyReporter) {
      throw new Error('weeklyReporterが見つかりません');
    }
    
    const result = await weeklyReporter.sendReportToAllUsers();

    res.json({
      success: true,
      message: '週間レポート処理が完了しました',
      stats: safeJson(result)
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

    // 正しいレポーターインスタンスを取得
    const hourlyReporter = req.app.locals.hourlyReporter as HourlyReporter;
    if (!hourlyReporter) {
      throw new Error('hourlyReporterが見つかりません');
    }
    
    const result = await hourlyReporter.sendHourlyReportToAllUsers();
    
    // 循環参照を避けて安全なデータだけを返す
    const safeResult = {
      total: result.total,
      success: result.success,
      failed: result.failed
    };

    res.json({
      success: true,
      message: '毎時レポート処理が完了しました',
      stats: safeResult
    });
  } catch (error) {
    // エラーの詳細情報をログに記録
    logger.error('毎時レポートトリガーエラー:', { 
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
      recentData: safeJson(recentData)
    });
  } catch (error) {
    logger.error('データ確認APIエラー:', { error });
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});