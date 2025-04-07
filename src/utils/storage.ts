// src/utils/storage.ts
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { config as storageConfig } from '../config.js';
import { logger } from './logger.js';

// Supabaseクライアントの初期化
const supabase = createClient(
  storageConfig.supabase.url,
  storageConfig.supabase.serviceKey
);

// バケット名（Supabase Storageのバケット名）
const BUCKET_NAME = storageConfig.supabase.storageBucket || 'phone-usage-reports';

/**
 * Supabase Storageバケットが存在するか確認し、なければ作成
 */
async function ensureBucketExists(): Promise<void> {
  try {
    // バケットが存在するか確認
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    // バケットが存在しない場合は作成
    if (!bucketExists) {
      logger.info(`バケット '${BUCKET_NAME}' が存在しないため作成します`);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true, // 公開バケットとして作成
        fileSizeLimit: 10485760, // 10MB制限
      });
      
      if (error) {
        throw new Error(`バケット作成エラー: ${error.message}`);
      }
      
      logger.info(`バケット '${BUCKET_NAME}' を作成しました`);
    }
  } catch (error) {
    logger.error('バケット確認/作成中にエラーが発生しました', { error });
    throw error;
  }
}

/**
 * 画像ファイルをSupabase Storageにアップロード
 */
export async function uploadImageToStorage(
  filePath: string,
  destination: string
): Promise<string> {
  try {
    // バケットの存在確認
    await ensureBucketExists();
    
    // ファイルデータの読み込み
    const fileBuffer = fs.readFileSync(filePath);
    
    // Supabaseへアップロード
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(destination, fileBuffer, {
        contentType: 'image/png',
        upsert: true // 同名ファイルが存在する場合は上書き
      });
    
    if (error) {
      throw new Error(`ファイルアップロードエラー: ${error.message}`);
    }
    
    // アップロードに成功したら公開URLを返す
    return getPublicURL(destination);
  } catch (error) {
    logger.error('ファイルアップロード中にエラーが発生しました', { 
      error, 
      filePath, 
      destination 
    });
    throw error;
  }
}

/**
 * Supabase Storageの公開URLを取得
 */
export function getPublicURL(filePath: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * ファイルを削除（オプション・必要に応じて）
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);
    
    if (error) {
      throw new Error(`ファイル削除エラー: ${error.message}`);
    }
    
    logger.debug(`ファイル削除成功: ${filePath}`);
  } catch (error) {
    logger.error('ファイル削除中にエラーが発生しました', { error, filePath });
    throw error;
  }
}