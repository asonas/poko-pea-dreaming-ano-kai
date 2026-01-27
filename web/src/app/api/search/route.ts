import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, SearchResult } from '@/lib/supabase';
import { generateQueryEmbedding } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // タイムアウト30秒

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const threshold = parseFloat(searchParams.get('threshold') || '0.3');

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required (use ?q=...)' },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'Query too long (max 500 characters)' },
        { status: 400 }
      );
    }

    console.log(`Searching for: "${query}"`);

    // クエリのEmbeddingを生成
    const startTime = Date.now();
    const queryEmbedding = await generateQueryEmbedding(query);
    const embeddingTime = Date.now() - startTime;
    console.log(`Embedding generated in ${embeddingTime}ms`);

    // Supabaseで類似検索
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase.rpc('search_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    const searchTime = Date.now() - startTime;
    console.log(`Search completed in ${searchTime}ms, found ${data?.length || 0} results`);

    const results: SearchResult[] = data || [];

    return NextResponse.json({
      results,
      meta: {
        query,
        resultCount: results.length,
        embeddingTimeMs: embeddingTime,
        totalTimeMs: searchTime,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
