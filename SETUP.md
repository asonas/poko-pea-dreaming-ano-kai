# ぽこピーのゆめうつつ セマンティック検索 - セットアップガイド

## 全体の流れ

```
1. 文字起こし完了を待つ
2. Supabaseプロジェクトを作成
3. データベースを初期化
4. チャンキング → Embedding生成 → Supabaseアップロード
5. Next.jsアプリをVercelにデプロイ
```

---

## ステップ1: Supabaseプロジェクト作成

1. [Supabase](https://supabase.com/) にアクセスしてアカウント作成
2. 「New Project」から新しいプロジェクトを作成
   - Name: `poko-pea-search` など
   - Database Password: 安全なパスワードを設定（メモしておく）
   - Region: `Tokyo` (ap-northeast-1)
3. プロジェクト作成後、Settings > API から以下をメモ:
   - `Project URL` (SUPABASE_URL)
   - `service_role` key (SUPABASE_SERVICE_ROLE_KEY) ※秘密

---

## ステップ2: データベース初期化

Supabase Dashboard の SQL Editor で以下を実行:

```sql
-- supabase/migrations/001_create_tables.sql の内容をコピーして実行
```

または、Supabase CLI を使う場合:
```bash
npx supabase db push
```

---

## ステップ3: データ準備（Docker環境）

### 3.1 チャンキング

```bash
# Docker コンテナ内で実行
docker compose run --rm whisper python /app/scripts/chunk_srt.py \
  --srt-dir /app/data/transcripts/srt \
  --output-dir /app/data/chunks \
  --chunk-duration 30
```

出力:
- `data/chunks/episodes.json` - エピソード情報
- `data/chunks/chunks.json` - チャンクデータ

### 3.2 Embedding生成

```bash
# GPUを使用してEmbedding生成
docker compose run --rm whisper python /app/scripts/generate_embeddings.py \
  --chunks-file /app/data/chunks/chunks.json \
  --output-file /app/data/embeddings/chunks_with_embeddings.json \
  --device cuda
```

出力:
- `data/embeddings/chunks_with_embeddings.json` - Embedding付きチャンク

### 3.3 Supabaseへアップロード

```bash
# 環境変数を設定してアップロード
docker compose run --rm \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  whisper python /app/scripts/upload_to_supabase.py \
  --episodes-file /app/data/chunks/episodes.json \
  --chunks-file /app/data/embeddings/chunks_with_embeddings.json
```

---

## ステップ4: フロントエンドのローカル開発

```bash
cd web

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.local を編集してSupabase情報を設定

# 開発サーバー起動
npm run dev
```

http://localhost:3000 でアクセス可能

---

## ステップ5: Vercelへデプロイ

### 5.1 Vercel設定

1. [Vercel](https://vercel.com/) にアクセスしてアカウント作成
2. 「New Project」からGitHubリポジトリをインポート
3. Root Directory を `web` に設定
4. Environment Variables を設定:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy

### 5.2 または CLI でデプロイ

```bash
cd web
npx vercel --prod
```

---

## トラブルシューティング

### Embedding生成が遅い
- GPUが使われているか確認: `--device cuda`
- メモリ不足の場合は `--batch-size 16` など小さくする

### 検索結果が出ない
- Supabaseのテーブルにデータが入っているか確認
- `chunks`テーブルに`embedding`カラムがnullでないか確認

### Vercelでタイムアウト
- 初回の検索はモデル読み込みで時間がかかる（〜20秒）
- 2回目以降は高速（〜1秒）

---

## 構成図

```
┌─────────────────────────────────────────────────────────────┐
│                   ローカル（データ準備）                      │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │   SRT    │→ │ chunk_srt.py │→ │ generate_embeddings │   │
│  │ ファイル  │  │              │  │        .py          │   │
│  └──────────┘  └──────────────┘  └──────────┬──────────┘   │
│                                              │              │
│                                  ┌───────────▼───────────┐  │
│                                  │ upload_to_supabase.py │  │
│                                  └───────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                             │
│           PostgreSQL + pgvector (無料枠 500MB)              │
└─────────────────────────────────────────────────────────────┘
                                               ▲
                                               │
┌──────────────────────────────────────────────┼──────────────┐
│                    Vercel                    │              │
│  ┌─────────────────────────┐   ┌─────────────┴───────────┐ │
│  │   Next.js フロントエンド │──▶│   API Routes            │ │
│  │                         │   │   (Embedding + 検索)     │ │
│  └─────────────────────────┘   └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```
