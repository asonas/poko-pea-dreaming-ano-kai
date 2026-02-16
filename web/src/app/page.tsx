'use client';

import { useState, FormEvent, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchResult } from '@/lib/supabase';

interface SearchResponse {
  results: SearchResult[];
  meta: {
    query: string;
    resultCount: number;
    embeddingTimeMs: number;
    totalTimeMs: number;
  };
}

interface GroupedEpisode {
  episode_id: string;
  episode_title: string;
  episode_number: number | null;
  chunks: SearchResult[];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getYouTubeUrl(videoId: string, startTime: number): string {
  const startSeconds = Math.floor(startTime);
  return `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`;
}

function groupByEpisode(results: SearchResult[]): GroupedEpisode[] {
  const grouped = new Map<string, GroupedEpisode>();

  for (const result of results) {
    const existing = grouped.get(result.episode_id);
    if (existing) {
      existing.chunks.push(result);
    } else {
      grouped.set(result.episode_id, {
        episode_id: result.episode_id,
        episode_title: result.episode_title,
        episode_number: result.episode_number,
        chunks: [result],
      });
    }
  }

  return Array.from(grouped.values());
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  // クエリをスペースで分割して個別のキーワードに
  const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) return text;

  // 各キーワードをエスケープしてOR条件の正規表現を作成
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = keywords.some(k => part.toLowerCase() === k.toLowerCase());
    if (isMatch) {
      return (
        <mark key={i} className="bg-pokopea-yellow text-gray-900 px-0.5 rounded">
          {part}
        </mark>
      );
    }
    return part;
  });
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SearchResponse['meta'] | null>(null);

  const groupedResults = useMemo(() => groupByEpisode(results), [results]);

  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        limit: '20',
        threshold: '0.3',
      });

      const response = await fetch(`/api/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error('検索に失敗しました');
      }

      const data: SearchResponse = await response.json();
      setResults(data.results);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索中にエラーが発生しました');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // URLパラメータから初期検索
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      executeSearch(q);
    }
  }, [searchParams, executeSearch]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    // URLを更新
    const params = new URLSearchParams();
    params.set('q', query.trim());
    router.push(`?${params.toString()}`);

    await executeSearch(query.trim());
  };

  return (
    <main className="mx-auto px-3 py-4 md:px-4 md:py-8 max-w-4xl">
      <div className="bg-white/95 rounded-2xl shadow-lg px-4 py-5 md:p-8">
      {/* ヘッダー */}
      <header className="text-center mb-5 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold text-pokopea-navy mb-1 whitespace-nowrap">
          ぽこピーのゆめうつつのあの回
        </h1>
        <p className="text-sm md:text-base text-pokopea-gray">
          会話の内容や雰囲気から関連するシーンを検索できます
        </p>
      </header>

      {/* 検索フォーム */}
      <form onSubmit={handleSearch} className="mb-5 md:mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: タクシーの話、おすすめのアニメ..."
            className="flex-1 min-w-0 px-3 py-2.5 md:px-4 md:py-3 border border-pokopea-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-pokopea-pink focus:border-transparent text-base md:text-lg"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="flex-shrink-0 px-4 py-2.5 md:px-6 md:py-3 bg-pokopea-pink text-white font-medium rounded-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-pokopea-pink focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '検索中...' : '検索'}
          </button>
        </div>
      </form>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* 検索結果メタ情報 */}
      {meta && !isLoading && (
        <div className="mb-3 md:mb-4 text-xs md:text-sm text-pokopea-gray">
          「{meta.query}」の検索結果: {meta.resultCount}件
          <span className="ml-2">({meta.totalTimeMs}ms)</span>
        </div>
      )}

      {/* 検索結果 */}
      {groupedResults.length > 0 && (
        <div className="space-y-4 md:space-y-6">
          {groupedResults.map((episode) => (
            <article
              key={episode.episode_id}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              {/* エピソードヘッダー */}
              <div className="px-3 py-2.5 md:px-4 md:py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="flex-shrink-0 px-1.5 py-0.5 md:px-2 md:py-1 bg-pokopea-pink/20 text-pokopea-pink text-xs font-medium rounded">
                    {episode.episode_number ? `#${episode.episode_number}` : 'EP'}
                  </span>
                  <h2 className="font-medium text-gray-800 text-sm md:text-base truncate">
                    {episode.episode_title}
                  </h2>
                  <span className="ml-auto flex-shrink-0 text-xs md:text-sm text-gray-500">
                    {episode.chunks.length}件
                  </span>
                </div>
              </div>

              {/* チャンク一覧 */}
              <div className="divide-y divide-gray-100">
                {episode.chunks.map((chunk) => (
                  <div
                    key={`${chunk.episode_id}-${chunk.chunk_index}`}
                    className="px-3 py-3 md:p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 md:gap-4">
                      <div className="flex-1 min-w-0">
                        {/* 文字起こしテキスト（ハイライト付き） */}
                        <p className="text-sm md:text-base text-gray-700 mb-1.5 md:mb-2 line-clamp-3">
                          {highlightText(chunk.text, meta?.query || '')}
                        </p>

                        {/* メタ情報 */}
                        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-500">
                          <span>
                            {formatTime(chunk.start_time)} - {formatTime(chunk.end_time)}
                          </span>
                          <span>
                            類似度: {(chunk.similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* YouTubeリンク */}
                      <a
                        href={getYouTubeUrl(chunk.episode_id, chunk.start_time)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 px-2.5 py-1 md:px-3 md:py-1.5 bg-pokopea-pink text-white text-xs md:text-sm font-medium rounded hover:brightness-110 transition-colors"
                      >
                        {formatTime(chunk.start_time)}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 検索結果なし */}
      {!isLoading && meta && groupedResults.length === 0 && (
        <div className="text-center py-8 md:py-12 text-gray-500">
          <p className="text-base md:text-lg mb-2">該当する結果が見つかりませんでした</p>
          <p className="text-xs md:text-sm">別のキーワードで検索してみてください</p>
        </div>
      )}

      {/* 初期状態 */}
      {!isLoading && !meta && groupedResults.length === 0 && (
        <div className="text-center py-8 md:py-12 text-gray-400">
          <p className="text-lg mb-4">🔍</p>
          <p className="text-sm md:text-base">検索キーワードを入力してください</p>
          <p className="text-xs md:text-sm mt-2">
            曖昧な言葉や話題でも検索できます
          </p>
        </div>
      )}

      {/* フッター */}
      <footer className="mt-8 pt-5 md:mt-16 md:pt-8 border-t border-pokopea-gray/30 text-center text-xs md:text-sm text-pokopea-gray space-y-1.5 md:space-y-2">
        <p>
          文字起こしデータの全文は公開・検索できません
        </p>
        <p>
          お問い合わせ:
          <a
            href="https://x.com/asonas"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pokopea-pink hover:underline ml-1"
          >
            @asonas
          </a>
        </p>
      </footer>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="mx-auto px-3 py-4 md:px-4 md:py-8 max-w-4xl">
        <div className="bg-white/95 rounded-2xl shadow-lg px-4 py-5 md:p-8">
          <div className="text-center py-12 text-pokopea-gray">
            読み込み中...
          </div>
        </div>
      </main>
    }>
      <SearchContent />
    </Suspense>
  );
}
