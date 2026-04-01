# API連携

::: info Enterprise以上
API連携機能はEnterpriseプラン以上でご利用いただけます。
:::

ThreatGuard APIを使用して、外部システムとの連携が可能です。

## 概要

| 項目 | 詳細 |
|------|------|
| ベースURL | `https://api.threatguard.jp/v1` |
| 認証 | Bearer Token（JWT） |
| レスポンス形式 | JSON |
| レート制限 | 1,000リクエスト/時 |

## 認証

### APIキーの取得

1. ダッシュボードにログイン
2. 「設定」→「API連携」を開く
3. 「APIキーを生成」をクリック
4. キーを安全に保存

### リクエスト方法

すべてのAPIリクエストにはAuthorizationヘッダーが必要です：

```bash
curl -X GET "https://api.threatguard.jp/v1/threats" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## エンドポイント一覧

### 脅威管理

#### 脅威一覧の取得

```http
GET /v1/threats
```

**クエリパラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| brandId | string | ブランドIDでフィルタ |
| status | string | ステータスでフィルタ（new, investigating, resolved） |
| riskMin | number | 最小リスクスコア |
| riskMax | number | 最大リスクスコア |
| limit | number | 取得件数（デフォルト: 50、最大: 100） |
| offset | number | オフセット |

**レスポンス例**:

```json
{
  "data": [
    {
      "id": "threat_abc123",
      "domain": "examp1e-bank.com",
      "brandId": "brand_xyz789",
      "riskScore": 86,
      "category": "phishing",
      "status": "new",
      "detectedAt": "2026-03-15T10:30:00Z",
      "webProbe": {
        "screenshotUrl": "https://...",
        "httpStatus": 200,
        "sslValid": true
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

#### 脅威詳細の取得

```http
GET /v1/threats/{threatId}
```

**レスポンス例**:

```json
{
  "id": "threat_abc123",
  "domain": "examp1e-bank.com",
  "brandId": "brand_xyz789",
  "riskScore": 86,
  "category": "phishing",
  "confidence": 0.95,
  "reasoning": "御社ロゴと酷似した画像を使用...",
  "status": "new",
  "detectedAt": "2026-03-15T10:30:00Z",
  "webProbe": {
    "screenshotUrl": "https://...",
    "httpStatus": 200,
    "httpHeaders": {...},
    "sslInfo": {...},
    "whoisInfo": {...}
  },
  "statusHistory": [
    {
      "status": "new",
      "changedAt": "2026-03-15T10:30:00Z",
      "changedBy": "system"
    }
  ]
}
```

#### 脅威ステータスの更新

```http
PUT /v1/threats/{threatId}
```

**リクエストボディ**:

```json
{
  "status": "investigating",
  "note": "調査中"
}
```

### ブランド管理

#### ブランド一覧の取得

```http
GET /v1/brands
```

#### ブランドの作成

```http
POST /v1/brands
```

**リクエストボディ**:

```json
{
  "name": "Example Bank",
  "primaryDomain": "example-bank.co.jp",
  "keywords": ["examplebank", "エグザンプル銀行"]
}
```

### テイクダウン

#### テイクダウン申請の作成

```http
POST /v1/takedowns
```

**リクエストボディ**:

```json
{
  "threatId": "threat_abc123",
  "targetType": "registrar",
  "language": "en"
}
```

#### テイクダウン一覧の取得

```http
GET /v1/takedowns
```

### スキャン

#### 手動スキャンの実行

```http
POST /v1/scans/trigger
```

**リクエストボディ**:

```json
{
  "brandId": "brand_xyz789"
}
```

### ダッシュボード

#### 統計情報の取得

```http
GET /v1/dashboard
```

**レスポンス例**:

```json
{
  "threats": {
    "total": 150,
    "byCategory": {
      "phishing": 45,
      "brand_abuse": 30,
      "parked": 60,
      "unknown": 15
    },
    "byStatus": {
      "new": 20,
      "investigating": 15,
      "resolved": 115
    }
  },
  "takedowns": {
    "total": 50,
    "successful": 42,
    "pending": 8
  },
  "period": {
    "start": "2026-03-01T00:00:00Z",
    "end": "2026-03-31T23:59:59Z"
  }
}
```

## Webhook

脅威検知時にWebhookでリアルタイム通知を受け取れます。

### 設定方法

1. ダッシュボードで「設定」→「Webhook」を開く
2. エンドポイントURLを入力
3. 通知対象イベントを選択
4. シークレットキーを生成

### イベント一覧

| イベント | 説明 |
|----------|------|
| `threat.detected` | 新規脅威を検知 |
| `threat.updated` | 脅威ステータスが更新 |
| `takedown.completed` | テイクダウンが完了 |
| `scan.completed` | スキャンが完了 |

### ペイロード例

```json
{
  "event": "threat.detected",
  "timestamp": "2026-03-15T10:30:00Z",
  "data": {
    "threatId": "threat_abc123",
    "domain": "examp1e-bank.com",
    "riskScore": 86,
    "category": "phishing"
  },
  "signature": "sha256=..."
}
```

### 署名検証

リクエストの真正性を検証するため、`X-ThreatGuard-Signature`ヘッダーを確認してください：

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return `sha256=${expected}` === signature;
}
```

## エラーハンドリング

### HTTPステータスコード

| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | リクエストエラー |
| 401 | 認証エラー |
| 403 | 権限エラー |
| 404 | リソースが見つからない |
| 429 | レート制限超過 |
| 500 | サーバーエラー |

### エラーレスポンス

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "brandId is required",
    "details": {
      "field": "brandId",
      "reason": "missing"
    }
  }
}
```

## レート制限

| プラン | 制限 |
|--------|------|
| Enterprise | 1,000リクエスト/時 |
| Enterprise+ | 10,000リクエスト/時 |

制限超過時は`429 Too Many Requests`が返されます。

レスポンスヘッダーで残りリクエスト数を確認できます：

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1710500400
```

## SDKとサンプルコード

### cURL

```bash
# 脅威一覧の取得
curl -X GET "https://api.threatguard.jp/v1/threats?limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Python

```python
import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "https://api.threatguard.jp/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}"
}

# 脅威一覧の取得
response = requests.get(f"{BASE_URL}/threats", headers=headers)
threats = response.json()["data"]

for threat in threats:
    print(f"{threat['domain']}: {threat['riskScore']}点")
```

### JavaScript/TypeScript

```typescript
const API_KEY = "YOUR_API_KEY";
const BASE_URL = "https://api.threatguard.jp/v1";

async function getThreats() {
  const response = await fetch(`${BASE_URL}/threats`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });
  const data = await response.json();
  return data.data;
}
```

## サポート

API連携についてのご質問は、技術サポートまでお問い合わせください。

- **メール**: api-support@threatguard.jp
- **Slack**: 契約企業向けサポートチャンネル
