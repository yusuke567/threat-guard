# ThreatGuard 🛡️

ブランドなりすまし検知・テイクダウン支援SaaS

## 技術スタック

- **Backend:** Node.js + Express + TypeScript
- **DB:** PostgreSQL + Prisma ORM
- **AI:** Claude API (Anthropic)
- **Screenshot:** Playwright
- **Monorepo:** npm workspaces

## セットアップ

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.example .env
# .env を編集してDB接続情報、APIキーを設定

# 3. DB セットアップ
npm run db:push -w @threat-guard/api

# 4. shared パッケージビルド
npm run build -w @threat-guard/shared

# 5. API起動
npm run dev:api
```

## API エンドポイント

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | ヘルスチェック |
| GET/POST | /api/brands | ブランド一覧・作成 |
| GET/PUT/DELETE | /api/brands/:id | ブランド詳細・更新・削除 |
| GET | /api/threats | 脅威一覧（フィルタ・ページネーション対応） |
| GET | /api/threats/:id | 脅威詳細 |
| POST | /api/scans/trigger | スキャン開始 |
| GET | /api/scans | スキャンジョブ一覧 |
| POST | /api/takedowns | テイクダウン申請生成 |
| PUT | /api/takedowns/:id | テイクダウンステータス更新 |

## プロジェクト構成

```
threat-guard/
├── packages/shared/     # 共通型定義
├── apps/
│   └── api/             # Express backend
│       ├── prisma/      # DBスキーマ
│       └── src/
│           ├── services/  # コアエンジン
│           ├── routes/    # APIルート
│           └── lib/       # ユーティリティ
└── README.md
```
