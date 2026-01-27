#!/usr/bin/env python3
"""
Embedding付きチャンクデータをSupabaseにアップロードするスクリプト
"""

import os
import json
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py is not installed.")
    print("Install with: pip install supabase")
    exit(1)


def load_json(file_path: str) -> list[dict]:
    """JSONファイルを読み込む"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def upload_episodes(supabase: Client, episodes: list[dict]):
    """エピソードデータをアップロード"""
    print(f"Uploading {len(episodes)} episodes...")
    
    # 既存データを削除（再実行時のため）
    supabase.table('episodes').delete().neq('id', '').execute()
    
    # バッチでアップロード
    for episode in episodes:
        # chunk_countは不要なので除外
        data = {
            'id': episode['id'],
            'title': episode['title'],
            'episode_number': episode.get('episode_number'),
            'upload_date': episode.get('upload_date'),
            'duration_seconds': episode.get('duration_seconds')
        }
        supabase.table('episodes').insert(data).execute()
    
    print(f"  -> Uploaded {len(episodes)} episodes")


def upload_chunks(supabase: Client, chunks: list[dict], batch_size: int = 100):
    """チャンクデータをアップロード"""
    print(f"Uploading {len(chunks)} chunks...")
    
    # 既存データを削除（再実行時のため）
    supabase.table('chunks').delete().neq('id', 0).execute()
    
    # バッチでアップロード
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        
        data_list = []
        for chunk in batch:
            data = {
                'episode_id': chunk['episode_id'],
                'chunk_index': chunk['chunk_index'],
                'start_time': chunk['start'],
                'end_time': chunk['end'],
                'text': chunk['text'],
                'embedding': chunk['embedding']
            }
            data_list.append(data)
        
        supabase.table('chunks').insert(data_list).execute()
        print(f"  -> Uploaded {min(i + batch_size, len(chunks))}/{len(chunks)} chunks")
    
    print(f"  -> Done!")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Upload data to Supabase')
    parser.add_argument('--episodes-file', default='/app/data/chunks/episodes.json',
                        help='Episodes JSON file')
    parser.add_argument('--chunks-file', default='/app/data/embeddings/chunks_with_embeddings.json',
                        help='Chunks with embeddings JSON file')
    parser.add_argument('--supabase-url', default=os.environ.get('SUPABASE_URL'),
                        help='Supabase project URL')
    parser.add_argument('--supabase-key', default=os.environ.get('SUPABASE_SERVICE_ROLE_KEY'),
                        help='Supabase service role key')
    parser.add_argument('--batch-size', type=int, default=100,
                        help='Batch size for chunk upload')
    
    args = parser.parse_args()
    
    # 環境変数チェック
    if not args.supabase_url or not args.supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        print("Set environment variables or use --supabase-url and --supabase-key arguments")
        exit(1)
    
    # Supabaseクライアント作成
    print(f"Connecting to Supabase: {args.supabase_url}")
    supabase: Client = create_client(args.supabase_url, args.supabase_key)
    
    # データ読み込み
    print(f"Loading episodes from: {args.episodes_file}")
    episodes = load_json(args.episodes_file)
    
    print(f"Loading chunks from: {args.chunks_file}")
    chunks = load_json(args.chunks_file)
    
    # アップロード
    upload_episodes(supabase, episodes)
    upload_chunks(supabase, chunks, args.batch_size)
    
    print("\nUpload complete!")
    print(f"  Episodes: {len(episodes)}")
    print(f"  Chunks: {len(chunks)}")


if __name__ == '__main__':
    main()
