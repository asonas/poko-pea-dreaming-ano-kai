#!/bin/bash
set -euo pipefail

# 設定
REMOTE_HOST="${REMOTE_HOST:?REMOTE_HOST is not set}"
REMOTE_USER="${REMOTE_USER:?REMOTE_USER is not set}"
REMOTE_PORT="${REMOTE_PORT:?REMOTE_PORT is not set}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:?REMOTE_PROJECT_DIR is not set}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOCAL_AUDIO_DIR="${PROJECT_DIR}/data/audio"
LOCAL_TRANSCRIPT_DIR="${PROJECT_DIR}/data/transcripts"

# 色付き出力
info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[OK]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

# 使い方
usage() {
    cat <<EOF
Usage: $0 [options]

Options:
  -h, --host HOST     リモートホスト (default: ${REMOTE_HOST})
  -u, --user USER     リモートユーザー (default: ${REMOTE_USER})
  -d, --dir DIR       リモートプロジェクトディレクトリ (default: ${REMOTE_PROJECT_DIR})
  --help              このヘルプを表示

Environment variables:
  REMOTE_HOST           リモートホスト
  REMOTE_USER           リモートユーザー
  REMOTE_PROJECT_DIR    リモートプロジェクトディレクトリ
  WHISPER_MODEL         Whisperモデル (default: large)
EOF
    exit 0
}

# 引数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host) REMOTE_HOST="$2"; shift 2 ;;
        -u|--user) REMOTE_USER="$2"; shift 2 ;;
        -d|--dir) REMOTE_PROJECT_DIR="$2"; shift 2 ;;
        --help) usage ;;
        *) error "Unknown option: $1"; usage ;;
    esac
done

REMOTE="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_AUDIO_DIR="${REMOTE_PROJECT_DIR}/data/audio"
REMOTE_TRANSCRIPT_DIR="${REMOTE_PROJECT_DIR}/data/transcripts"
SSH_OPTS="-p ${REMOTE_PORT}"
RSYNC_SSH="ssh -p ${REMOTE_PORT}"

info "=== Remote Transcribe ==="
info "Remote: ${REMOTE}:${REMOTE_PORT}"
info "Remote project: ${REMOTE_PROJECT_DIR}"
info "Local audio: ${LOCAL_AUDIO_DIR}"
info "Local transcripts: ${LOCAL_TRANSCRIPT_DIR}"
echo ""

# ローカルディレクトリ確認
if [[ ! -d "${LOCAL_AUDIO_DIR}" ]]; then
    error "Audio directory not found: ${LOCAL_AUDIO_DIR}"
    exit 1
fi

# 未処理の音声ファイルを検出
info "Checking for new audio files..."
mkdir -p "${LOCAL_TRANSCRIPT_DIR}/srt"

NEW_FILES=()
for audio_file in "${LOCAL_AUDIO_DIR}"/*.mp3; do
    [[ -f "$audio_file" ]] || continue
    basename=$(basename "$audio_file" .mp3)
    srt_file="${LOCAL_TRANSCRIPT_DIR}/srt/${basename}.srt"
    if [[ ! -f "$srt_file" ]]; then
        NEW_FILES+=("$audio_file")
    fi
done

if [[ ${#NEW_FILES[@]} -eq 0 ]]; then
    success "No new files to transcribe"
    exit 0
fi

info "Found ${#NEW_FILES[@]} new file(s) to transcribe:"
for f in "${NEW_FILES[@]}"; do
    echo "  - $(basename "$f")"
done
echo ""

# リモートディレクトリ作成
info "Setting up remote directory..."
ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p ${REMOTE_AUDIO_DIR} ${REMOTE_TRANSCRIPT_DIR}/srt"

# 音声ファイルを転送
info "Uploading audio files..."
for audio_file in "${NEW_FILES[@]}"; do
    info "  Uploading: $(basename "$audio_file")"
    rsync -avz --progress -e "${RSYNC_SSH}" "$audio_file" "${REMOTE}:${REMOTE_AUDIO_DIR}/"
done
success "Upload complete"
echo ""

# リモートでWhisperを実行（Docker Compose経由）
info "Running Whisper on remote server via Docker Compose..."
WHISPER_MODEL="${WHISPER_MODEL:-large}"

ssh ${SSH_OPTS} "${REMOTE}" bash <<EOF
set -euo pipefail
cd ${REMOTE_PROJECT_DIR}

echo "Whisper model: ${WHISPER_MODEL}"
echo ""

docker compose run --rm whisper python /app/scripts/transcribe.py
EOF

success "Remote transcription complete"
echo ""

# 結果をダウンロード
info "Downloading transcripts..."
rsync -avz --progress -e "${RSYNC_SSH}" "${REMOTE}:${REMOTE_TRANSCRIPT_DIR}/srt/*.srt" "${LOCAL_TRANSCRIPT_DIR}/srt/"
success "Download complete"

echo ""
success "=== All done! ==="
info "Transcripts saved to: ${LOCAL_TRANSCRIPT_DIR}/srt/"
