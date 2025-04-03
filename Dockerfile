FROM node:18-alpine

WORKDIR /app

# canvasとそのネイティブ依存関係に必要なパッケージをインストール
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pixman-dev \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev

# 依存関係ファイルのみをコピーしてインストール
COPY package*.json ./

# 明示的に TypeScript をグローバルにインストール
RUN npm install -g typescript

# 依存関係を開発モードでインストール（ESMモジュールと互換性のあるようにインストール）
RUN npm install

# TypeScriptビルド用のファイルをコピー
COPY tsconfig.json ./
COPY src ./src

# ビルドを実行し、不要な開発依存関係を削除
RUN npm run build 

# 実行に必要なディレクトリを作成
RUN mkdir -p logs tmp

# 実行ポートの設定
EXPOSE ${PORT:-4600}

# ヘルスチェック用の簡易ユーティリティをインストール
RUN apk --no-cache add curl

# 非rootユーザーでの実行
RUN addgroup -S appuser && adduser -S appuser -G appuser
RUN chown -R appuser:appuser /app
USER appuser

# アプリケーションの実行
CMD ["node", "dist/index.js"]