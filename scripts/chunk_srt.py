#!/usr/bin/env python3
"""
SRTファイルをセマンティック検索用のチャンクに分割するスクリプト
30秒程度のチャンクに分割し、JSONとして出力
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime


def parse_time(time_str: str) -> float:
    """SRTのタイムコードを秒に変換"""
    # 00:00:00,000 形式
    match = re.match(r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})', time_str)
    if not match:
        return 0.0
    hours, minutes, seconds, millis = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000


def parse_srt(srt_path: str) -> list[dict]:
    """SRTファイルをパースしてセグメントのリストを返す"""
    with open(srt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # SRTのブロックを分割
    blocks = re.split(r'\n\n+', content.strip())
    segments = []
    
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 3:
            continue
        
        # 1行目: 番号
        # 2行目: タイムコード
        # 3行目以降: テキスト
        try:
            time_match = re.match(
                r'(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})',
                lines[1]
            )
            if not time_match:
                continue
            
            start_time = parse_time(time_match.group(1))
            end_time = parse_time(time_match.group(2))
            text = ' '.join(lines[2:]).strip()
            
            if text:
                segments.append({
                    'start': start_time,
                    'end': end_time,
                    'text': text
                })
        except (IndexError, ValueError):
            continue
    
    return segments


def chunk_segments(segments: list[dict], chunk_duration: float = 30.0) -> list[dict]:
    """
    セグメントを指定秒数のチャンクに結合
    
    Args:
        segments: パースされたSRTセグメント
        chunk_duration: 1チャンクの目標秒数
    
    Returns:
        チャンクのリスト
    """
    if not segments:
        return []
    
    chunks = []
    current_chunk = {
        'start': segments[0]['start'],
        'end': segments[0]['end'],
        'texts': [segments[0]['text']]
    }
    
    for segment in segments[1:]:
        chunk_length = segment['end'] - current_chunk['start']
        
        # チャンク長が目標を超えたら新しいチャンクを開始
        if chunk_length > chunk_duration and current_chunk['texts']:
            chunks.append({
                'start': current_chunk['start'],
                'end': current_chunk['end'],
                'text': ' '.join(current_chunk['texts'])
            })
            current_chunk = {
                'start': segment['start'],
                'end': segment['end'],
                'texts': [segment['text']]
            }
        else:
            current_chunk['end'] = segment['end']
            current_chunk['texts'].append(segment['text'])
    
    # 最後のチャンクを追加
    if current_chunk['texts']:
        chunks.append({
            'start': current_chunk['start'],
            'end': current_chunk['end'],
            'text': ' '.join(current_chunk['texts'])
        })
    
    return chunks


def parse_filename(filename: str) -> dict:
    """
    ファイル名からメタデータを抽出
    例: 20250407_＃１タクシーで話しかけらたらどうする？_y9QQS1a1Mzs.srt
    """
    stem = Path(filename).stem
    parts = stem.split('_')
    
    # 日付
    date_str = parts[0] if parts else ''
    try:
        upload_date = datetime.strptime(date_str, '%Y%m%d').strftime('%Y-%m-%d')
    except ValueError:
        upload_date = None
    
    # YouTube ID (最後の部分)
    youtube_id = parts[-1] if len(parts) > 1 else ''
    
    # タイトル (中間部分を結合)
    title = '_'.join(parts[1:-1]) if len(parts) > 2 else ''
    
    # エピソード番号を抽出
    episode_match = re.search(r'[#＃](\d+|[０-９]+)', title)
    if episode_match:
        ep_num = episode_match.group(1)
        # 全角数字を半角に変換
        ep_num = ep_num.translate(str.maketrans('０１２３４５６７８９', '0123456789'))
        episode_number = int(ep_num)
    else:
        episode_number = None
    
    return {
        'youtube_id': youtube_id,
        'title': title,
        'upload_date': upload_date,
        'episode_number': episode_number
    }


def process_all_srt(srt_dir: str, output_dir: str, chunk_duration: float = 30.0):
    """
    ディレクトリ内の全SRTファイルを処理
    """
    srt_path = Path(srt_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    all_episodes = []
    all_chunks = []
    
    srt_files = sorted(srt_path.glob('*.srt'))
    print(f"Found {len(srt_files)} SRT files")
    
    for srt_file in srt_files:
        print(f"Processing: {srt_file.name}")
        
        # メタデータ抽出
        metadata = parse_filename(srt_file.name)
        
        # SRTパース
        segments = parse_srt(str(srt_file))
        
        # チャンキング
        chunks = chunk_segments(segments, chunk_duration)
        
        # 動画の長さを計算
        duration = segments[-1]['end'] if segments else 0
        
        # エピソード情報
        episode = {
            'id': metadata['youtube_id'],
            'title': metadata['title'],
            'episode_number': metadata['episode_number'],
            'upload_date': metadata['upload_date'],
            'duration_seconds': int(duration),
            'chunk_count': len(chunks)
        }
        all_episodes.append(episode)
        
        # チャンクにエピソードIDを追加
        for i, chunk in enumerate(chunks):
            chunk['episode_id'] = metadata['youtube_id']
            chunk['chunk_index'] = i
            all_chunks.append(chunk)
        
        print(f"  -> {len(chunks)} chunks, duration: {int(duration)}s")
    
    # JSON出力
    episodes_file = output_path / 'episodes.json'
    chunks_file = output_path / 'chunks.json'
    
    with open(episodes_file, 'w', encoding='utf-8') as f:
        json.dump(all_episodes, f, ensure_ascii=False, indent=2)
    
    with open(chunks_file, 'w', encoding='utf-8') as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)
    
    print(f"\nOutput:")
    print(f"  Episodes: {episodes_file} ({len(all_episodes)} episodes)")
    print(f"  Chunks: {chunks_file} ({len(all_chunks)} chunks)")
    
    # 統計
    total_duration = sum(ep['duration_seconds'] for ep in all_episodes)
    avg_chunk_text_len = sum(len(c['text']) for c in all_chunks) / len(all_chunks) if all_chunks else 0
    
    print(f"\nStatistics:")
    print(f"  Total duration: {total_duration // 3600}h {(total_duration % 3600) // 60}m")
    print(f"  Average chunk text length: {avg_chunk_text_len:.0f} chars")
    
    return all_episodes, all_chunks


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Chunk SRT files for semantic search')
    parser.add_argument('--srt-dir', default='/app/data/transcripts/srt',
                        help='Directory containing SRT files')
    parser.add_argument('--output-dir', default='/app/data/chunks',
                        help='Output directory for JSON files')
    parser.add_argument('--chunk-duration', type=float, default=30.0,
                        help='Target chunk duration in seconds')
    
    args = parser.parse_args()
    
    process_all_srt(args.srt_dir, args.output_dir, args.chunk_duration)
