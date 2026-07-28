#!/usr/bin/env python3

import os
import sys
from pathlib import Path


def format_timestamp(seconds: float) -> str:
    total_millis = round(seconds * 1000)
    hours, remainder = divmod(total_millis, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_srt(segments: list[dict], output_path: Path) -> None:
    with output_path.open("w", encoding="utf-8") as output:
        for index, segment in enumerate(segments, 1):
            output.write(f"{index}\n")
            output.write(
                f"{format_timestamp(segment['start'])} --> "
                f"{format_timestamp(segment['end'])}\n"
            )
            output.write(f"{segment['text'].strip()}\n\n")


def write_txt(segments: list[dict], output_path: Path) -> None:
    with output_path.open("w", encoding="utf-8") as output:
        for segment in segments:
            text = segment["text"].strip()
            if text:
                output.write(f"{text}\n")


def run(
    model_loader,
    audio_dir: Path,
    output_txt_dir: Path,
    output_srt_dir: Path,
    model_name: str,
) -> int:
    output_txt_dir.mkdir(parents=True, exist_ok=True)
    output_srt_dir.mkdir(parents=True, exist_ok=True)

    audio_files = sorted(audio_dir.glob("*.mp3"))
    if not audio_files:
        print(f"音声ファイルが見つかりません: {audio_dir}")
        return 1

    pending_files = [
        audio_path
        for audio_path in audio_files
        if not (
            (output_txt_dir / f"{audio_path.stem}.txt").exists()
            and (output_srt_dir / f"{audio_path.stem}.srt").exists()
        )
    ]
    if not pending_files:
        print("すべての音声ファイルは処理済みです")
        return 0

    print(f"Whisperモデル '{model_name}' を読み込み中...")
    model = model_loader(model_name)
    errors = 0

    for audio_path in pending_files:
        txt_path = output_txt_dir / f"{audio_path.stem}.txt"
        srt_path = output_srt_dir / f"{audio_path.stem}.srt"
        print(f"文字起こし中: {audio_path.name}")

        try:
            result = model.transcribe(
                str(audio_path),
                language="ja",
                verbose=False,
                task="transcribe",
            )
            segments = result["segments"]
            write_srt(segments, srt_path)
            write_txt(segments, txt_path)
        except Exception as exception:
            print(f"文字起こしに失敗しました: {audio_path.name}: {exception}")
            errors += 1

    return 1 if errors else 0


def main() -> int:
    import whisper

    return run(
        whisper.load_model,
        Path("/app/data/audio"),
        Path("/app/data/transcripts/txt"),
        Path("/app/data/transcripts/srt"),
        os.environ.get("WHISPER_MODEL", "large"),
    )


if __name__ == "__main__":
    sys.exit(main())
