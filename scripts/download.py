#!/usr/bin/env python3
"""
YouTube チャンネルから音声をダウンロードするスクリプト
"""

import subprocess
import sys
from pathlib import Path

# 設定
CHANNEL_URL = "https://www.youtube.com/@pokopeadreaming"
OUTPUT_DIR = Path("/app/data/audio")
ARCHIVE_FILE = Path("/app/data/downloaded.txt")

# 出力ファイル名のテンプレート
# %(playlist_index)s: プレイリスト内の番号
# %(title)s: 動画タイトル
# %(id)s: 動画ID
OUTPUT_TEMPLATE = str(OUTPUT_DIR / "%(upload_date)s_%(title)s_%(id)s.%(ext)s")


def main():
    """メイン処理"""
    # 出力ディレクトリ作成
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"チャンネル: {CHANNEL_URL}")
    print(f"出力先: {OUTPUT_DIR}")
    print(f"アーカイブファイル: {ARCHIVE_FILE}")
    print("-" * 50)

    # yt-dlp コマンド構築
    cmd = [
        "yt-dlp",
        # 音声のみ抽出
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        # 出力ファイル名
        "-o", OUTPUT_TEMPLATE,
        # ダウンロード済みファイルをスキップ
        "--download-archive", str(ARCHIVE_FILE),
        # メタデータ埋め込み
        "--embed-thumbnail",
        "--add-metadata",
        # 進捗表示
        "--progress",
        "--console-title",
        # エラー時も継続
        "--ignore-errors",
        # 動画一覧取得時の制限（必要に応じて調整）
        # "--playlist-end", "5",  # テスト用：最初の5本のみ
        # チャンネルURL
        CHANNEL_URL,
    ]

    print(f"実行コマンド: {' '.join(cmd)}")
    print("-" * 50)

    # 実行
    try:
        result = subprocess.run(cmd, check=False)
        if result.returncode == 0:
            print("\nダウンロード完了")
        else:
            print(f"\n一部のダウンロードでエラーが発生しました (終了コード: {result.returncode})")
    except KeyboardInterrupt:
        print("\n中断されました")
        sys.exit(1)
    except Exception as e:
        print(f"\nエラー: {e}")
        sys.exit(1)

    # ダウンロードしたファイル一覧を表示
    print("\n" + "=" * 50)
    print("ダウンロード済みファイル:")
    audio_files = sorted(OUTPUT_DIR.glob("*.mp3"))
    for f in audio_files:
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name} ({size_mb:.1f} MB)")
    print(f"\n合計: {len(audio_files)} ファイル")


if __name__ == "__main__":
    main()
