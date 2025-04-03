// src/utils/storage.ts
import fs from 'fs';
const {Storage} = require('@google-cloud/storage');
import { config as storageConfig } from '../config';

// Google Cloud Storageクライアントの初期化
const storage = new Storage({
  projectId: storageConfig.storage.projectId,
  keyFilename: storageConfig.storage.keyFilename,
});

const bucket = storage.bucket(storageConfig.storage.bucketName);

/**
 * 画像ファイルをGoogle Cloud Storageにアップロード
 */
export async function uploadImageToStorage(
  filePath: string,
  destination: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      destination,
      metadata: {
        contentType: 'image/png',
      },
      public: true,
    };

    bucket.upload(filePath, options, (err: { message: any; }, file: any) => {
      if (err) {
        return reject(new Error(`ファイルアップロードエラー: ${err.message}`));
      }
      
      resolve(getPublicURL(destination));
    });
  });
}

/**
 * Google Cloud Storageの公開URLを取得
 */
export function getPublicURL(filename: string): string {
  return `https://storage.googleapis.com/${storageConfig.storage.bucketName}/${filename}`;
}