# GPU対応 Whisper文字起こし環境
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

# 環境変数設定
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

# システムパッケージのインストール
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3.11-venv \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# python3をデフォルトに設定
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

# 作業ディレクトリ設定
WORKDIR /app

# Pythonパッケージのインストール
# PyTorchを先にCUDA版でインストール
RUN pip install --upgrade pip && \
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# その他のパッケージをインストール
RUN pip install yt-dlp openai-whisper

# Embedding用パッケージをインストール
RUN pip install sentence-transformers

# スクリプトディレクトリ作成
RUN mkdir -p /app/scripts /app/data/audio /app/data/transcripts/txt /app/data/transcripts/srt /app/data/embeddings

# デフォルトコマンド
CMD ["python", "--version"]
