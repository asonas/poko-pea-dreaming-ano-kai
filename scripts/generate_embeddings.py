#!/usr/bin/env python3
"""
チャンクデータからEmbeddingを生成するスクリプト
multilingual-e5-small モデルを使用（Transformers.jsと互換性あり）
"""

import os
import json
from pathlib import Path
import numpy as np

# sentence-transformersがインストールされているか確認
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Error: sentence-transformers is not installed.")
    print("Install with: pip install sentence-transformers")
    exit(1)


# 使用するモデル
# multilingual-e5-small: 384次元、日本語対応、Transformers.jsでも動作
MODEL_NAME = "intfloat/multilingual-e5-small"


def load_chunks(chunks_file: str) -> list[dict]:
    """チャンクJSONを読み込む"""
    with open(chunks_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_embeddings(chunks: list[dict], model: SentenceTransformer, batch_size: int = 32) -> list[dict]:
    """
    チャンクのテキストからEmbeddingを生成
    
    E5モデルは "query: " または "passage: " プレフィックスを使用
    データ投入時は "passage: " を使用
    """
    # テキストにプレフィックスを追加
    texts = [f"passage: {chunk['text']}" for chunk in chunks]
    
    print(f"Generating embeddings for {len(texts)} chunks...")
    print(f"Using model: {MODEL_NAME}")
    
    # バッチ処理でEmbedding生成
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True  # コサイン類似度用に正規化
    )
    
    # チャンクにEmbeddingを追加
    for chunk, embedding in zip(chunks, embeddings):
        chunk['embedding'] = embedding.tolist()
    
    return chunks


def save_embeddings(chunks: list[dict], output_file: str):
    """Embedding付きチャンクを保存"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, ensure_ascii=False)
    
    print(f"Saved embeddings to: {output_file}")
    
    # ファイルサイズを表示
    size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"File size: {size_mb:.2f} MB")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate embeddings for chunks')
    parser.add_argument('--chunks-file', default='/app/data/chunks/chunks.json',
                        help='Input chunks JSON file')
    parser.add_argument('--output-file', default='/app/data/embeddings/chunks_with_embeddings.json',
                        help='Output file with embeddings')
    parser.add_argument('--batch-size', type=int, default=32,
                        help='Batch size for embedding generation')
    parser.add_argument('--device', default='cuda',
                        help='Device to use (cuda, cpu)')
    
    args = parser.parse_args()
    
    # 出力ディレクトリ作成
    Path(args.output_file).parent.mkdir(parents=True, exist_ok=True)
    
    # モデル読み込み
    print(f"Loading model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME, device=args.device)
    print(f"Model loaded. Embedding dimension: {model.get_sentence_embedding_dimension()}")
    
    # チャンク読み込み
    chunks = load_chunks(args.chunks_file)
    print(f"Loaded {len(chunks)} chunks")
    
    # Embedding生成
    chunks_with_embeddings = generate_embeddings(chunks, model, args.batch_size)
    
    # 保存
    save_embeddings(chunks_with_embeddings, args.output_file)
    
    print("\nDone!")
    print(f"Total chunks: {len(chunks_with_embeddings)}")
    print(f"Embedding dimension: {len(chunks_with_embeddings[0]['embedding'])}")


if __name__ == '__main__':
    main()
