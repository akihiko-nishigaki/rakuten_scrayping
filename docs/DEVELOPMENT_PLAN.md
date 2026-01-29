# Rakuten Rank Check - 開発計画・テスト計画

## 1. 現状サマリー

### プロジェクト概要
楽天アフィリエイトの商品ランキングを定期的に取得し、APIから返される報酬率とユーザーによる検証済み率を比較・管理するシステム。

### 技術スタック
- **Frontend**: Next.js 16.1.4, React 19.2.3, TailwindCSS 4
- **Backend**: Next.js App Router, Server Actions
- **Database**: PostgreSQL 15 + Prisma 7.3.0
- **Testing**: Jest 30.2.0 + ts-jest
- **Infrastructure**: Docker Compose

---

## 2. 機能別 実装状況

### ✅ 完成済み機能
| 機能 | ファイル | テスト状況 |
|------|----------|-----------|
| ダッシュボード (KPI + Top10) | `src/app/page.tsx` | ❌ なし |
| Rakuten API クライアント | `src/lib/rakuten/client.ts` | ❌ なし |
| ランキングインジェスト | `src/lib/ingestor/rankingIngestor.ts` | ❌ なし |
| 優先度計算 | `src/lib/verification/service.ts` | ✅ 7テスト |
| 検証キュー表示 | `src/app/verification/queue/page.tsx` | ❌ なし |
| 個別検証フォーム | `src/app/verification/[itemKey]/page.tsx` | ❌ なし |
| Server Actions (ranking) | `src/app/actions/ranking.ts` | ❌ なし |
| Server Actions (verification) | `src/app/actions/verification.ts` | ❌ なし |
| 監査ログ | `src/lib/audit/service.ts` | ❌ なし |
| 設定管理 | `src/lib/settings/service.ts` | ❌ なし |

### 🔨 開発中 (WIP)
| 機能 | ファイル | 状態 |
|------|----------|------|
| ランキング履歴ページ | `src/app/rankings/page.tsx` | スケルトンのみ |
| スナップショット履歴 | `src/app/snapshots/page.tsx` | スケルトンのみ |
| システム設定ページ | `src/app/settings/page.tsx` | スケルトンのみ |
| CSV エクスポート | `src/app/api/export/csv/route.ts` | ロジック未実装 |

### ❌ 未実装
| 機能 | 優先度 | 備考 |
|------|--------|------|
| Cron ジョブ有効化 | 高 | コメントアウト状態 |
| ユーザー認証 | 高 | demo-user-id 使用中 |
| ロール・権限管理 | 中 | スキーマは定義済み |
| エラーハンドリング強化 | 中 | 一部のみ実装 |

---

## 3. 開発計画

### Phase 1: コア機能の安定化（優先度：高）

#### 1.1 Cronジョブの有効化
- **目的**: 定期的な自動ランキング取得を実現
- **タスク**:
  - [ ] `src/app/api/jobs/ingest/route.ts` のコメントアウト解除
  - [ ] エラーハンドリングの強化
  - [ ] ログ出力の改善
  - [ ] リトライ機構の検討

#### 1.2 インジェスト処理の堅牢化
- **目的**: API取得失敗時の適切な処理
- **タスク**:
  - [ ] 部分失敗時のロールバック戦略
  - [ ] レート制限への対応
  - [ ] タイムアウト設定の最適化

### Phase 2: WIPページの完成

#### 2.1 ランキング履歴ページ
- **目的**: 過去のランキング変動を確認
- **タスク**:
  - [ ] 日付範囲フィルター
  - [ ] カテゴリー別表示
  - [ ] ランク変動のビジュアライズ

#### 2.2 スナップショット履歴ページ
- **目的**: インジェスト履歴の管理
- **タスク**:
  - [ ] スナップショット一覧表示
  - [ ] 詳細表示（取得件数、エラー状況）
  - [ ] スナップショット間の比較機能

#### 2.3 システム設定ページ
- **目的**: 管理者による設定変更
- **タスク**:
  - [ ] カテゴリー追加/削除UI
  - [ ] topN（取得件数）変更
  - [ ] インジェスト有効/無効切替
  - [ ] 設定変更の監査ログ

#### 2.4 CSVエクスポート
- **目的**: データの外部出力
- **タスク**:
  - [ ] 日付範囲指定
  - [ ] カテゴリーフィルター
  - [ ] エクスポート形式選択

### Phase 3: 認証・認可システム

#### 3.1 ユーザー認証
- **目的**: セキュアなアクセス制御
- **選択肢**:
  - NextAuth.js（推奨）
  - Clerk
  - 自前実装
- **タスク**:
  - [ ] 認証ライブラリ選定・導入
  - [ ] ログイン/ログアウトUI
  - [ ] セッション管理
  - [ ] 保護ルート設定

#### 3.2 ロールベースアクセス制御 (RBAC)
- **目的**: 役割に応じた機能制限
- **ロール**:
  - `ADMIN`: 全機能アクセス
  - `OPERATOR`: 検証操作可
  - `VIEWER`: 閲覧のみ
- **タスク**:
  - [ ] ミドルウェア実装
  - [ ] UI要素の出し分け
  - [ ] API保護

### Phase 4: 運用機能強化

#### 4.1 エラー監視・通知
- **タスク**:
  - [ ] エラー通知（Slack/Email）
  - [ ] ダッシュボードへのアラート表示
  - [ ] エラーログの構造化

#### 4.2 パフォーマンス最適化
- **タスク**:
  - [ ] インジェストの並列処理
  - [ ] ページネーション改善
  - [ ] キャッシュ戦略

---

## 4. テスト計画

### 現状のテストカバレッジ

```
テストファイル: 1
テストケース: 7
カバー範囲: VerificationService.calculatePriority() のみ
```

### テスト拡充計画

#### Phase T1: ユニットテスト強化（優先度：高）

##### T1.1 サービス層テスト
```
__tests__/
├── verification.test.ts        # 既存（優先度計算）
├── verification-service.test.ts # NEW: upsertTask等
├── settings-service.test.ts    # NEW: 設定CRUD
├── audit-service.test.ts       # NEW: ログ記録
└── rakuten-client.test.ts      # NEW: API呼び出し
```

**verification-service.test.ts**
- [ ] `upsertTaskFromIngest` - 新規アイテム登録
- [ ] `upsertTaskFromIngest` - 既存アイテム更新
- [ ] `upsertTaskFromIngest` - 差分検出時の再オープン
- [ ] エッジケース（null値、境界値）

**settings-service.test.ts**
- [ ] `getSettings` - 初期設定作成
- [ ] `getSettings` - 既存設定取得
- [ ] `updateSettings` - 部分更新
- [ ] バリデーション

**audit-service.test.ts**
- [ ] 各アクションタイプのログ記録
- [ ] メタデータの保存

**rakuten-client.test.ts**
- [ ] 正常レスポンス処理
- [ ] エラーレスポンス処理
- [ ] タイムアウト処理
- [ ] レート制限対応

##### T1.2 インジェスター テスト
```
__tests__/
└── ingestor/
    └── ranking-ingestor.test.ts # NEW
```

**ranking-ingestor.test.ts**
- [ ] 単一カテゴリーのインジェスト
- [ ] 複数カテゴリーの一括処理
- [ ] 部分失敗時の処理
- [ ] スナップショット作成確認

#### Phase T2: インテグレーションテスト

##### T2.1 Server Actions テスト
```
__tests__/
└── actions/
    ├── ranking-actions.test.ts     # NEW
    └── verification-actions.test.ts # NEW
```

**ranking-actions.test.ts**
- [ ] `getLatestRankingAction` - 正常取得
- [ ] `getLatestRankingAction` - データなし

**verification-actions.test.ts**
- [ ] `getVerificationQueueAction` - 優先度順取得
- [ ] `getVerificationDetailAction` - 詳細取得
- [ ] `upsertVerifiedRateAction` - 登録・更新

##### T2.2 API エンドポイントテスト
```
__tests__/
└── api/
    ├── ingest.test.ts    # NEW
    └── jobs-ingest.test.ts # NEW
```

**ingest.test.ts**
- [ ] GET `/api/ingest` - 正常実行
- [ ] エラーハンドリング

**jobs-ingest.test.ts**
- [ ] POST 認証成功
- [ ] POST 認証失敗
- [ ] 処理結果確認

#### Phase T3: E2Eテスト（オプション）

```
e2e/
├── dashboard.spec.ts
├── verification-flow.spec.ts
└── settings.spec.ts
```

**使用ツール**: Playwright または Cypress

**テストシナリオ**:
- [ ] ダッシュボード表示
- [ ] 検証キュー → 個別検証 → 完了フロー
- [ ] 設定変更フロー

---

## 5. テスト環境構成

### Jest設定の拡張

```javascript
// jest.config.js (更新案)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};
```

### テストユーティリティ

```typescript
// __tests__/utils/prisma-mock.ts
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const createMockPrisma = (): MockPrismaClient => {
  return mockDeep<PrismaClient>();
};
```

### テストデータファクトリ

```typescript
// __tests__/factories/index.ts
export const createMockSnapshot = (overrides = {}) => ({
  id: 'snapshot-1',
  categoryId: '100227',
  rankingType: 'ALL',
  capturedAt: new Date(),
  fetchedCount: 30,
  status: 'SUCCESS',
  ...overrides
});

export const createMockSnapshotItem = (overrides = {}) => ({
  id: 'item-1',
  snapshotId: 'snapshot-1',
  rank: 1,
  itemKey: 'item-key-1',
  title: 'テスト商品',
  apiRate: 5.0,
  ...overrides
});
```

---

## 6. 優先度付きロードマップ

### 即座に着手すべき（Critical）
1. **Cronジョブの有効化** - 自動インジェストの実現
2. **ユニットテスト追加** - サービス層のテスト

### 短期目標（High）
3. **WIPページの完成** - ランキング履歴、設定ページ
4. **インテグレーションテスト** - Actions, APIテスト
5. **認証システム導入** - セキュリティ確保

### 中期目標（Medium）
6. **RBAC実装** - ロールベースアクセス制御
7. **CSVエクスポート** - データ出力機能
8. **E2Eテスト** - フロー全体のテスト

### 長期目標（Low）
9. **パフォーマンス最適化** - 並列処理、キャッシュ
10. **運用監視機能** - アラート、通知

---

## 7. 次のアクション

### 開発者向けチェックリスト

```bash
# 1. 開発環境セットアップ
docker-compose up -d
npm install
npx prisma migrate dev

# 2. テスト実行
npm test

# 3. 開発サーバー起動
npm run dev
```

### 推奨する最初のタスク

1. **テスト基盤の整備**
   - `jest.setup.ts` 作成
   - テストユーティリティ整備
   - Prismaモック共通化

2. **サービステスト追加**
   - `VerificationService` の残りメソッド
   - `SettingsService` 全メソッド

3. **Cronジョブ有効化**
   - コメントアウト解除
   - 動作確認

---

*最終更新: 2026-01-27*
