#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

CHANNEL_URL="https://www.youtube.com/@pokopeadreaming"
OUTPUT_DIR="${PROJECT_DIR}/data/audio"
ARCHIVE_FILE="${PROJECT_DIR}/data/downloaded.txt"

mkdir -p "$OUTPUT_DIR"

echo "Channel: ${CHANNEL_URL}"
echo "Output: ${OUTPUT_DIR}"
echo "Archive: ${ARCHIVE_FILE}"
echo "--------------------------------------------------"

yt-dlp -x --audio-format mp3 --audio-quality 0 \
  -o "${OUTPUT_DIR}/%(upload_date)s_%(title)s_%(id)s.%(ext)s" \
  --download-archive "$ARCHIVE_FILE" \
  --embed-thumbnail --add-metadata \
  --progress --ignore-errors \
  "$CHANNEL_URL"

echo ""
echo "Download complete!"
echo "Files in ${OUTPUT_DIR}:"
ls -lh "$OUTPUT_DIR"/*.mp3 2>/dev/null | wc -l | xargs echo "Total:"
