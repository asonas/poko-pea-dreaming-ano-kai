#!/usr/bin/env python3
"""
Whisperを使用して音声ファイルを文字起こしするスクリプト
"""

import os
import sys
from pathlib import Path

import whisper

# 設定
AUDIO_DIR = Path("/app/data/audio")
OUTPUT_TXT_DIR = Path("/app/data/transcripts/txt")
OUTPUT_SRT_DIR = Path("/app/data/transcripts/srt")

# Whisperモデル（環境変数で変更可能）
# tiny, base, small, medium, large, large-v2, large-v3
MODEL_NAME = os.environ.get("WHISPER_MODEL", "large")


def format_timestamp(seconds: float) -> str:
    """秒数をSRT形式のタイムスタンプに変換"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_srt(segments: list, output_path: Path):
    """セグメントをSRT形式で書き出し"""
    with open(output_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(segments, 1):
            start = format_timestamp(segment["start"])
            end = format_timestamp(segment["end"])
            text = segment["text"].strip()
            f.write(f"{i}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{text}\n\n")


def write_txt(segments: list, output_path: Path):
    """セグメントをプレーンテキストで書き出し"""
    with open(output_path, "w", encoding="utf-8") as f:
        for segment in segments:
            text = segment["text"].strip()
            if text:
                f.write(f"{text}\n")


def transcribe_file(model, audio_path: Path) -> dict:
    """音声ファイルを文字起こし"""
    print(f"  文字起こし中: {audio_path.name}")
    
    result = model.transcribe(
        str(audio_path),
        language="ja",
        verbose=False,
        task="transcribe",
    )
    
    return result


def main():
    """メイン処理"""
    # 出力ディレクトリ作成
    OUTPUT_TXT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_SRT_DIR.mkdir(parents=True, exist_ok=True)

    # 音声ファイル一覧取得
    audio_files = sorted(AUDIO_DIR.glob("*.mp3"))
    
    if not audio_files:
        print(f"音声ファイルが見つかりません: {AUDIO_DIR}")
        print("先に download.py を実行してください。")
        sys.exit(1)

    print(f"モデル: {MODEL_NAME}")
    print(f"音声ファイル数: {len(audio_files)}")
    print("-" * 50)

    # モデル読み込み
    print(f"Whisperモデル '{MODEL_NAME}' を読み込み中...")
    model = whisper.load_model(MODEL_NAME)
    print("モデル読み込み完了")
    print("-" * 50)

    # 各ファイルを処理
    processed = 0
    skipped = 0
    errors = 0

    for i, audio_path in enumerate(audio_files, 1):
        print(f"\n[{i}/{len(audio_files)}] {audio_path.name}")
        
        # 出力ファイルパス
        stem = audio_path.stem
        txt_path = OUTPUT_TXT_DIR / f"{stem}.txt"
        srt_path = OUTPUT_SRT_DIR / f"{stem}.srt"

        # 既に処理済みならスキップ
        if txt_path.exists() and srt_path.exists():
            print("  スキップ（処理済み）")
            skipped += 1
            continue

        try:
            # 文字起こし実行
            result = transcribe_file(model, audio_path)
            segments = result["segments"]

            # 結果を保存
            write_txt(segments, txt_path)
            write_srt(segments, srt_path)

            print(f"  完了: {len(segments)} セグメント")
            print(f"  出力: {txt_path.name}, {srt_path.name}")
            processed += 1

        except Exception as e:
            print(f"  エラー: {e}")
            errors += 1
            continue

    # 結果サマリー
    print("\n" + "=" * 50)
    print("処理完了")
    print(f"  処理済み: {processed}")
    print(f"  スキップ: {skipped}")
    print(f"  エラー: {errors}")
    print(f"  合計: {len(audio_files)}")


if __name__ == "__main__":
    main()
