// src/routes/health.ts
import express from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { IncomingWebhook } from '@slack/webhook';
import { Database } from '../types/supabase';

export const healthRouter = express.Router();

/**
 * ヘルスチェックエンドポイント
 * 各サービスへの接続状態を確認
 */
healthRouter.get('/', async (req, res) => {
  const supabase = req.app.locals.supabase as SupabaseClient<Database>;
  const webhook = req.app.locals.webhook as IncomingWebhook;
  
  try {
    // Supabase接続確認
    const { error: supabaseError } = await supabase.from('hourly_phone_usage').select('id').limit(1);
    
    // ステータスオブジェクト
    const status = {
      timestamp: new Date().toISOString(),
      services: {
        app: 'healthy',
        database: supabaseError ? 'unhealthy' : 'healthy',
        // Webhookは単純な接続確認がないため、常にhealthyと報告
        slack_webhook: 'healthy' 
      }
    };

    // 全てのサービスが正常なら200、それ以外は503を返す
    const isHealthy = Object.values(status.services).every(s => s === 'healthy');
    
    return res.status(isHealthy ? 200 : 503).json(status);
  } catch (error) {
    console.error('ヘルスチェックエラー:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      services: {
        app: 'unhealthy',
        database: 'unknown',
        slack_webhook: 'unknown'
      },
      error: 'ヘルスチェック実行中にエラーが発生しました'
    });
  }
});