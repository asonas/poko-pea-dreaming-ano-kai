#!/bin/bash
#
# 新しい動画が公開されたときにデータを更新するパイプライン
#
# 事前準備:
#   envchain に以下の環境変数を登録しておくこと (namespace: poko-pea)
#
#   # Supabase (Step 5: アップロードで使用)
#   envchain --set poko-pea SUPABASE_URL
#   envchain --set poko-pea SUPABASE_API_KEY
#
#   # リモートトランスクライブ (Step 2: 文字起こしで使用)
#   envchain --set poko-pea REMOTE_HOST
#   envchain --set poko-pea REMOTE_USER
#   envchain --set poko-pea REMOTE_PORT
#   envchain --set poko-pea REMOTE_PROJECT_DIR
#
set -euo pipefail

# envchain namespace
ENVCHAIN_NS="${ENVCHAIN_NS:-poko-pea}"

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Pipeline started at $(date) ==="
echo "Project directory: $PROJECT_DIR"
echo "envchain namespace: $ENVCHAIN_NS"

# Step 1: Download
echo "[1/5] Downloading new videos..."
"${SCRIPT_DIR}/download.sh"

# Step 2: Transcribe (リモートGPUサーバーで実行)
echo "[2/5] Transcribing with Whisper (remote)..."
envchain "$ENVCHAIN_NS" "${SCRIPT_DIR}/remote-transcribe.sh"

# Step 3: Chunk SRT
echo "[3/5] Chunking SRT files..."
cd "${SCRIPT_DIR}" && uv run python chunk_srt.py

# Step 4: Generate embeddings
echo "[4/5] Generating embeddings..."
cd "${SCRIPT_DIR}" && uv run python generate_embeddings.py --device cpu

# Step 5: Upload to Supabase
echo "[5/5] Uploading to Supabase..."
cd "${SCRIPT_DIR}" && envchain "$ENVCHAIN_NS" uv run python upload_to_supabase.py

echo "=== Pipeline completed at $(date) ==="
