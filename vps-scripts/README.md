# VPS Scripts for Rakuten Scraping

このディレクトリには、VPS（Ubuntu）で実行するスクリプトが含まれています。

## 構成

- `ingest.ts` - Rakuten APIからランキングデータを取得してSupabaseに保存
- `scrape.ts` - アフィリエイト料率をスクレイピングしてSupabaseに保存
- `login-rakuten.ts` - 楽天アフィリエイトにログインしてセッションを保存

## Ubuntu VPS セットアップ手順

### 1. Node.js インストール

```bash
# Node.js 20.x インストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version
npm --version
```

### 2. 必要なパッケージをインストール

```bash
# Playwright用の依存関係
sudo apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-noto-cjk
```

### 3. プロジェクトセットアップ

```bash
# ディレクトリ作成
mkdir -p ~/rakuten-scripts
cd ~/rakuten-scripts

# ファイルをコピー（scpやgit cloneで）
# scp -r vps-scripts/* user@your-vps:~/rakuten-scripts/

# 依存関係インストール
npm install

# Playwright ブラウザインストール
npm run setup
```

### 4. 環境変数設定

```bash
# .envファイル作成
cp .env.example .env

# 編集
nano .env
```

`.env` に以下を設定:

```
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
RAKUTEN_APP_ID=your_rakuten_app_id
HEADLESS=true
```

### 5. Prisma Client 生成

vps-scriptsディレクトリにはPrisma schemaがないため、メインプロジェクトからコピーする必要があります：

```bash
# メインプロジェクトのprismaディレクトリをコピー
mkdir -p prisma
# schema.prismaとprisma.config.tsをコピー

# Prisma Client生成
npx prisma generate
```

または、メインプロジェクトごとクローンして使用:

```bash
git clone https://github.com/your-repo/rakuten_scrayping.git
cd rakuten_scrayping
npm install
npx prisma generate

# vps-scriptsを直接実行
cd vps-scripts
npm install
```

### 6. 楽天ログイン（初回のみ）

**注意:** GUIが必要です。VNCやX11転送を使用するか、ローカルでセッションを作成してコピーしてください。

```bash
# VNC接続時やローカルで実行
npm run login

# ブラウザが開くので、楽天アフィリエイトにログイン
# ログイン完了後、Enterキーを押してセッションを保存
```

ローカルでセッションを作成した場合:
```bash
# ローカルの.rakuten-session.jsonをVPSにコピー
scp .rakuten-session.json user@your-vps:~/rakuten-scripts/
```

### 7. 手動実行テスト

```bash
# ランキング取得テスト
npm run ingest

# スクレイピングテスト
npm run scrape
```

### 8. Cron設定

```bash
# crontab編集
crontab -e

# 以下を追加:
# ランキング取得: 毎日9時と21時
0 9,21 * * * cd ~/rakuten-scripts && npm run ingest >> ~/logs/ingest.log 2>&1

# スクレイピング: 毎日10時と22時
0 10,22 * * * cd ~/rakuten-scripts && npm run scrape >> ~/logs/scrape.log 2>&1
```

ログディレクトリ作成:
```bash
mkdir -p ~/logs
```

## トラブルシューティング

### セッション期限切れ

エラー: `Session expired. Please run: npm run login`

解決方法:
1. ローカルで `npm run login` を実行
2. `.rakuten-session.json` をVPSにコピー

### Playwright ブラウザエラー

エラー: `browserType.launch: Executable doesn't exist`

解決方法:
```bash
npm run setup
# または
npx playwright install chromium --with-deps
```

### データベース接続エラー

エラー: `DATABASE_URL is not set`

解決方法:
1. `.env` ファイルが存在するか確認
2. DATABASE_URL が正しく設定されているか確認
3. Supabaseのプーラー接続URLを使用しているか確認

## スクリプト説明

### ingest.ts
- Rakuten APIからランキングデータを取得
- 設定されたカテゴリごとにランキングを取得
- topN件に制限してSupabaseに保存
- 古いスナップショットを自動削除（最新2件を保持）

### scrape.ts
- 検証されていない商品の料率をスクレイピング
- 楽天アフィリエイトのフリーリンク機能を使用
- 取得した料率をVerifiedRateCurrentとHistoryに保存
- 1リクエストあたり1-2秒の間隔で実行

### login-rakuten.ts
- ブラウザを開いて楽天アフィリエイトにログイン
- ログイン後のセッション（Cookie）を保存
- 保存したセッションは7日間有効
