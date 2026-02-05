import { createClient } from '@supabase/supabase-js';

// サーバーサイド専用のSupabaseクライアント
// 環境変数はサーバーサイドでのみアクセス可能
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  // SUPABASE_API_KEY を優先、なければ SUPABASE_SERVICE_ROLE_KEY にフォールバック
  const supabaseKey = process.env.SUPABASE_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL and SUPABASE_API_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// 検索結果の型定義
export interface SearchResult {
  id: number;
  episode_id: string;
  episode_title: string;
  episode_number: number | null;
  chunk_index: number;
  start_time: number;
  end_time: number;
  text: string;
  similarity: number;
}

export interface Episode {
  id: string;
  title: string;
  episode_number: number | null;
  upload_date: string | null;
  duration_seconds: number;
}
