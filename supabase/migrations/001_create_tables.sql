-- pgvector拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- エピソードテーブル
CREATE TABLE episodes (
    id TEXT PRIMARY KEY,                    -- YouTube動画ID
    title TEXT NOT NULL,                    -- エピソードタイトル
    episode_number INTEGER,                 -- 回数（#1, #2...）
    upload_date DATE,                       -- 投稿日
    duration_seconds INTEGER,               -- 動画の長さ（秒）
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- チャンクテーブル
CREATE TABLE chunks (
    id SERIAL PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,           -- チャンク番号（エピソード内）
    start_time FLOAT NOT NULL,              -- 開始時間（秒）
    end_time FLOAT NOT NULL,                -- 終了時間（秒）
    text TEXT NOT NULL,                     -- 文字起こしテキスト
    embedding VECTOR(384),                  -- multilingual-e5-smallの次元数
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(episode_id, chunk_index)
);

-- ベクトル検索用インデックス（IVFFlat）
-- lists数はデータ量に応じて調整（sqrt(rows)が目安）
CREATE INDEX chunks_embedding_idx ON chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- エピソード検索用インデックス
CREATE INDEX chunks_episode_id_idx ON chunks(episode_id);

-- 類似検索用のRPC関数
CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding VECTOR(384),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id INT,
    episode_id TEXT,
    episode_title TEXT,
    episode_number INT,
    chunk_index INT,
    start_time FLOAT,
    end_time FLOAT,
    text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.episode_id,
        e.title AS episode_title,
        e.episode_number,
        c.chunk_index,
        c.start_time,
        c.end_time,
        c.text,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    JOIN episodes e ON c.episode_id = e.id
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Row Level Security（読み取り専用で公開）
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

-- 全員が読み取り可能
CREATE POLICY "Allow public read access to episodes"
    ON episodes FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to chunks"
    ON chunks FOR SELECT
    USING (true);
