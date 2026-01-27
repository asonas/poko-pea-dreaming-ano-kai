#!/usr/bin/env python3
"""
Embeddingサイズの試算スクリプト
実際にSRTファイルをチャンキングし、Embeddingを生成してサイズを計測
"""

import os
import sys
import json
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional

# 設定
SRT_DIR = Path("/app/data/transcripts/srt")
OUTPUT_DIR = Path("/app/data/embeddings")
MODEL_NAME = os.environ.get("EMBEDDING_MODEL", "cl-nagoya/ruri-base")
CHUNK_SECONDS = 30  # 30秒ごとにチャンキング


@dataclass
class SRTSegment:
    """SRTの1セグメント"""
    index: int
    start_time: float  # 秒
    end_time: float    # 秒
    text: str


@dataclass 
class Chunk:
    """検索用のチャンク"""
    episode_id: str
    episode_title: str
    start_time: float
    end_time: float
    text: str
    embedding: Optional[List[float]] = None


def parse_srt_time(time_str: str) -> float:
    """SRT形式の時間を秒に変換"""
    # 00:00:02,000 -> 2.0
    parts = time_str.replace(',', '.').split(':')
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = float(parts[2])
    return hours * 3600 + minutes * 60 + seconds


def parse_srt_file(filepath: Path) -> List[SRTSegment]:
    """SRTファイルをパース"""
    segments = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # SRTのブロックを分割
    blocks = re.split(r'\n\n+', content.strip())
    
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) >= 3:
            try:
                index = int(lines[0])
                time_line = lines[1]
                time_match = re.match(r'(\d+:\d+:\d+[,\.]\d+)\s*-->\s*(\d+:\d+:\d+[,\.]\d+)', time_line)
                if time_match:
                    start_time = parse_srt_time(time_match.group(1))
                    end_time = parse_srt_time(time_match.group(2))
                    text = ' '.join(lines[2:]).strip()
                    
                    segments.append(SRTSegment(
                        index=index,
                        start_time=start_time,
                        end_time=end_time,
                        text=text
                    ))
            except (ValueError, IndexError):
                continue
    
    return segments


def chunk_segments(segments: List[SRTSegment], chunk_seconds: int = 30) -> List[dict]:
    """セグメントをチャンクにまとめる"""
    if not segments:
        return []
    
    chunks = []
    current_chunk_start = 0
    current_texts = []
    current_start_time = segments[0].start_time
    
    for seg in segments:
        chunk_index = int(seg.start_time // chunk_seconds)
        
        if chunk_index > current_chunk_start and current_texts:
            # 新しいチャンクに移行
            chunks.append({
                'start_time': current_start_time,
                'end_time': seg.start_time,
                'text': ' '.join(current_texts)
            })
            current_texts = []
            current_start_time = seg.start_time
            current_chunk_start = chunk_index
        
        current_texts.append(seg.text)
    
    # 最後のチャンク
    if current_texts:
        chunks.append({
            'start_time': current_start_time,
            'end_time': segments[-1].end_time,
            'text': ' '.join(current_texts)
        })
    
    return chunks


def extract_episode_info(filename: str) -> tuple:
    """ファイル名からエピソード情報を抽出"""
    # 20250407_＃１タクシーで話しかけらたらどうする？_y9QQS1a1Mzs.srt
    parts = filename.replace('.srt', '').split('_')
    date = parts[0] if parts else ''
    title = '_'.join(parts[1:-1]) if len(parts) > 2 else ''
    video_id = parts[-1] if parts else ''
    return date, title, video_id


def main():
    print("=" * 60)
    print("Embeddingサイズ試算")
    print("=" * 60)
    
    # SRTファイル一覧
    srt_files = sorted(SRT_DIR.glob("*.srt"))
    print(f"\nSRTファイル数: {len(srt_files)}")
    
    if not srt_files:
        print("SRTファイルが見つかりません")
        return
    
    # 全チャンクを収集
    all_chunks = []
    total_text_bytes = 0
    
    for srt_file in srt_files:
        date, title, video_id = extract_episode_info(srt_file.name)
        segments = parse_srt_file(srt_file)
        chunks = chunk_segments(segments, CHUNK_SECONDS)
        
        print(f"\n{srt_file.name}:")
        print(f"  セグメント数: {len(segments)}")
        print(f"  チャンク数: {len(chunks)}")
        
        for chunk in chunks:
            chunk['episode_id'] = video_id
            chunk['episode_title'] = title
            chunk['episode_date'] = date
            all_chunks.append(chunk)
            total_text_bytes += len(chunk['text'].encode('utf-8'))
    
    print(f"\n" + "=" * 60)
    print(f"チャンク統計")
    print("=" * 60)
    print(f"総チャンク数: {len(all_chunks)}")
    print(f"テキストデータ合計: {total_text_bytes / 1024:.2f} KB")
    
    # Embeddingモデルを読み込んでサイズを計測
    print(f"\n" + "=" * 60)
    print(f"Embeddingモデル: {MODEL_NAME}")
    print("=" * 60)
    
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        
        print("モデルを読み込み中...")
        model = SentenceTransformer(MODEL_NAME)
        
        # サンプルでEmbeddingを生成
        sample_texts = [c['text'] for c in all_chunks[:10]]
        sample_embeddings = model.encode(sample_texts)
        
        embedding_dim = sample_embeddings.shape[1]
        bytes_per_embedding = embedding_dim * 4  # float32 = 4 bytes
        
        print(f"Embedding次元数: {embedding_dim}")
        print(f"1チャンクあたりのEmbeddingサイズ: {bytes_per_embedding} bytes")
        
        # 全体の推定サイズ
        total_embedding_bytes = len(all_chunks) * bytes_per_embedding
        
        print(f"\n" + "=" * 60)
        print("サイズ推定（現在のファイル）")
        print("=" * 60)
        print(f"テキストデータ: {total_text_bytes / 1024:.2f} KB")
        print(f"Embeddingデータ: {total_embedding_bytes / 1024:.2f} KB")
        print(f"合計: {(total_text_bytes + total_embedding_bytes) / 1024:.2f} KB")
        
        # 43エピソード分の推定
        estimated_chunks_43 = int(len(all_chunks) / len(srt_files) * 43)
        estimated_text_43 = int(total_text_bytes / len(srt_files) * 43)
        estimated_embedding_43 = estimated_chunks_43 * bytes_per_embedding
        estimated_total_43 = estimated_text_43 + estimated_embedding_43
        
        print(f"\n" + "=" * 60)
        print("サイズ推定（43エピソード）")
        print("=" * 60)
        print(f"推定チャンク数: {estimated_chunks_43}")
        print(f"テキストデータ: {estimated_text_43 / 1024 / 1024:.2f} MB")
        print(f"Embeddingデータ: {estimated_embedding_43 / 1024 / 1024:.2f} MB")
        print(f"合計: {estimated_total_43 / 1024 / 1024:.2f} MB")
        print(f"\nSupabase無料枠（500MB）: {'OK' if estimated_total_43 < 500 * 1024 * 1024 else 'NG'}")
        
        # 実際に全てEmbeddingを生成してJSONに保存
        print(f"\n" + "=" * 60)
        print("全チャンクのEmbeddingを生成中...")
        print("=" * 60)
        
        all_texts = [c['text'] for c in all_chunks]
        all_embeddings = model.encode(all_texts, show_progress_bar=True)
        
        # チャンクにEmbeddingを追加
        for i, chunk in enumerate(all_chunks):
            chunk['embedding'] = all_embeddings[i].tolist()
        
        # JSONに保存
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_file = OUTPUT_DIR / "chunks_with_embeddings.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_chunks, f, ensure_ascii=False, indent=2)
        
        actual_size = output_file.stat().st_size
        print(f"\n実際のJSONファイルサイズ: {actual_size / 1024:.2f} KB")
        print(f"43エピソード推定: {actual_size / len(srt_files) * 43 / 1024 / 1024:.2f} MB")
        
        # 圧縮版も作成（embedding以外）
        chunks_no_embedding = [{k: v for k, v in c.items() if k != 'embedding'} for c in all_chunks]
        output_file_no_emb = OUTPUT_DIR / "chunks_metadata.json"
        with open(output_file_no_emb, 'w', encoding='utf-8') as f:
            json.dump(chunks_no_embedding, f, ensure_ascii=False, indent=2)
        
        print(f"メタデータのみ: {output_file_no_emb.stat().st_size / 1024:.2f} KB")
        
    except ImportError as e:
        print(f"sentence-transformersがインストールされていません: {e}")
        print("Dockerコンテナ内で実行してください")
        
        # モデルなしでテキストサイズのみ推定
        print(f"\n" + "=" * 60)
        print("サイズ推定（モデルなし、768次元想定）")
        print("=" * 60)
        bytes_per_embedding = 768 * 4
        total_embedding_bytes = len(all_chunks) * bytes_per_embedding
        estimated_chunks_43 = int(len(all_chunks) / len(srt_files) * 43)
        estimated_total_43 = (total_text_bytes + total_embedding_bytes) / len(srt_files) * 43
        
        print(f"推定チャンク数（43エピソード）: {estimated_chunks_43}")
        print(f"推定合計サイズ: {estimated_total_43 / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
