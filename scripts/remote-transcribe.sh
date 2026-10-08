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

mkdir -p "${LOCAL_TRANSCRIPT_DIR}/srt"

# リモートプロジェクトを最新のmainへ同期
info "Synchronizing remote project..."
ssh -A ${SSH_OPTS} "${REMOTE}" bash -s -- "${REMOTE_PROJECT_DIR}" <<'REMOTE_SYNC'
set -euo pipefail
remote_project_dir="$1"
cd "$remote_project_dir"
git pull --ff-only origin main

for required_file in Dockerfile docker-compose.yml scripts/transcribe.py scripts/download.sh; do
    if [[ ! -f "$required_file" ]]; then
        echo "Required remote runtime file not found: $required_file" >&2
        exit 1
    fi
done

mkdir -p data/audio data/transcripts/txt data/transcripts/srt
docker compose config --quiet
docker compose build whisper
REMOTE_SYNC

# 既存のローカル音源と履歴を引き継ぎ、リモートの取得済みデータを保護する。
if [[ -d "${LOCAL_AUDIO_DIR}" ]]; then
    rsync -av --ignore-existing -e "${RSYNC_SSH}" "${LOCAL_AUDIO_DIR}/" "${REMOTE}:${REMOTE_AUDIO_DIR}/"
fi
if [[ -f "${PROJECT_DIR}/data/downloaded.txt" ]]; then
    rsync -av -e "${RSYNC_SSH}" "${PROJECT_DIR}/data/downloaded.txt" "${REMOTE}:${REMOTE_PROJECT_DIR}/data/downloaded.local.txt"
fi

# リモートでWhisperを実行（Docker Compose経由）
info "Running Whisper on remote server via Docker Compose..."
WHISPER_MODEL="${WHISPER_MODEL:-large}"

ssh ${SSH_OPTS} "${REMOTE}" bash -s -- \
    "${REMOTE_PROJECT_DIR}" "${WHISPER_MODEL}" <<'REMOTE_TRANSCRIBE'
set -euo pipefail
remote_project_dir="$1"
whisper_model="$2"
cd "$remote_project_dir"

echo "Whisper model: ${whisper_model}"
echo ""

if [[ -f data/downloaded.local.txt ]]; then
    touch data/downloaded.txt
    cat data/downloaded.txt data/downloaded.local.txt | sort -u > data/downloaded.merged.txt
    mv data/downloaded.merged.txt data/downloaded.txt
    rm data/downloaded.local.txt
fi

docker compose run --rm whisper bash /app/scripts/download.sh
if ! compgen -G "data/audio/*.mp3" > /dev/null; then
    echo "No audio files to transcribe"
    exit 0
fi

WHISPER_MODEL="$whisper_model" \
    docker compose run --rm whisper python /app/scripts/transcribe.py
REMOTE_TRANSCRIBE

success "Remote transcription complete"
echo ""

# 結果をダウンロード
info "Downloading transcripts..."
rsync -avz --progress -e "${RSYNC_SSH}" "${REMOTE}:${REMOTE_TRANSCRIPT_DIR}/srt/" "${LOCAL_TRANSCRIPT_DIR}/srt/"
success "Download complete"

echo ""
success "=== All done! ==="
info "Transcripts saved to: ${LOCAL_TRANSCRIPT_DIR}/srt/"
