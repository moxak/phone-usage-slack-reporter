# Dockerfile
FROM node:18-alpine

WORKDIR /app

# 依存関係ファイルのコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci

# アプリケーションコードのコピー
COPY . .

# TypeScriptのコンパイル
RUN npm run build

# 実行ポートの設定
EXPOSE 3000

# アプリケーションの実行
CMD ["npm", "start"]