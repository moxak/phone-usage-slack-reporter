// src/utils/logger.js を修正
// 循環参照を安全に処理するカスタムフォーマッタを追加

import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

// ログディレクトリの確認と作成
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 循環参照を処理する関数
const safeStringify = (obj: { [key: string]: unknown;[key: symbol]: unknown;[x: number]: unknown; }, replacer = null, space = 2, depth = 3) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, function(key, value) {
    if (typeof value === 'object' && value !== null) {
      // 既に処理したオブジェクトは循環参照
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      
      // 関数の場合は文字列に変換
      if (typeof value === 'function') {
        return '[Function]';
      }
      
      // このオブジェクトを処理済みとしてマーク
      seen.add(value);
      
      // ネストの深さをチェック
      if (depth <= 0) {
        return '[Object]';
      }
      
      // TimerオブジェクトやTimeout、EventEmitterなどの特殊オブジェクトのチェック
      if (
        value.constructor && 
        (
          value.constructor.name === 'Timeout' || 
          value.constructor.name === 'TimersList' ||
          value.constructor.name === 'EventEmitter'
        )
      ) {
        return `[${value.constructor.name}]`;
      }
    }
    
    return value;
  }, space);
};

// カスタムフォーマットの定義
const customFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    try {
      // 安全なJSONシリアライズを使用
      metaStr = safeStringify(metadata);
    } catch (e) {
      metaStr = `[Metadata serialization failed: ${(e as Error).message}]`;
    }
  }
  return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
});

// ロガーの作成
export const logger = createLogger({
  level: config?.app?.logLevel || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'phone-usage-reporter' },
  transports: [
    // コンソールへの出力
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      )
    }),
    
    // 全てのログをファイルに出力
    new transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // エラーログは別ファイルにも出力
    new transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
  // 例外をキャッチしてログに記録
  exceptionHandlers: [
    new transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
  // 未処理のPromiseの拒否をキャッチ
  rejectionHandlers: [
    new transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// 開発環境では詳細なログを出力
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
}

// configが読み込まれる前にloggerが初期化される場合に備えて、
// 環境変数から直接ログレベルを設定
if (process.env.LOG_LEVEL) {
  logger.level = process.env.LOG_LEVEL;
}

// ログのショートカットメソッド
export default {
  debug: (message: string, meta: any) => logger.debug(message, meta),
  info: (message: string, meta: any) => logger.info(message, meta),
  warn: (message: string, meta: any) => logger.warn(message, meta),
  error: (message: string, meta: any) => logger.error(message, meta),
  
  // HTTPリクエストログ用メソッド
  http: (req: { method: any; url: any; ip: any; headers: any; }, res: { statusCode: any; }, responseTime: any) => {
    const { method, url, ip, headers } = req;
    logger.http(`${method} ${url}`, {
      method,
      url,
      ip,
      userAgent: headers['user-agent'],
      responseTime: `${responseTime}ms`,
      status: res.statusCode
    });
  }
};