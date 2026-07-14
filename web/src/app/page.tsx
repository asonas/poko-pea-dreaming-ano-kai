'use client';

import { useState, FormEvent, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchResult, Episode } from '@/lib/supabase';
import EpisodeList from '@/components/EpisodeList';
import PodcastPlatforms from '@/components/PodcastPlatforms';

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
        <mark key={i} className="mark">
          {part}
        </mark>
      );
    }
    return part;
  });
}

// セクション見出し
function SectionLabel({ children, count }: { children: React.ReactNode; count?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1.5 h-1.5 rounded-full bg-pokopea-pink" />
      <h2 className="on-sky text-sm font-bold text-white tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
        {children}
      </h2>
      {count && <span className="on-sky text-xs text-white/80 tnum">{count}</span>}
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M3 2.2v7.6c0 .5.55.8.97.53l6-3.8a.63.63 0 000-1.06l-6-3.8A.63.63 0 003 2.2z" />
    </svg>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SearchResponse['meta'] | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(true);

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

  // エピソード一覧を取得
  useEffect(() => {
    async function fetchEpisodes() {
      try {
        const response = await fetch('/api/episodes');
        if (response.ok) {
          const data = await response.json();
          setEpisodes(data.episodes);
        }
      } catch {
        // エピソード取得失敗は無視（検索機能に影響しない）
      } finally {
        setIsLoadingEpisodes(false);
      }
    }
    fetchEpisodes();
  }, []);

  // URLパラメータから初期検索
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      executeSearch(q);
    }
  }, [searchParams, executeSearch]);

  const handleReset = () => {
    setQuery('');
    setResults([]);
    setMeta(null);
    setError(null);
    router.push('/');
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    // URLを更新
    const params = new URLSearchParams();
    params.set('q', query.trim());
    router.push(`?${params.toString()}`);

    await executeSearch(query.trim());
  };

  const showInitial = !isLoading && !meta && groupedResults.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      {/* ヘッダー: 薄明の空に浮かぶ */}
      <header className="pt-12 md:pt-16 pb-6 text-center rise">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); handleReset(); }}
          className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white/90 text-xs md:text-sm backdrop-blur-sm focus-ring press cursor-pointer"
        >
          <span aria-hidden="true">☁︎</span> あの回、どれだっけ？
        </a>
        <h1
          className="text-[1.5rem] leading-tight md:text-5xl font-bold text-white mb-2.5"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', textShadow: '0 2px 22px rgba(20,28,64,0.5)' }}
        >
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); handleReset(); }}
            className="rounded-lg hover:opacity-80 transition-opacity focus-ring cursor-pointer"
          >
            ぽこピーのゆめうつつのあの回
          </a>
        </h1>
        <p className="on-sky text-sm md:text-base text-white/85 max-w-md mx-auto">
          会話の内容や雰囲気から、関連するシーンを検索できます
        </p>
      </header>

      {/* 検索コンソール（メイン機能・全幅・スクロール追従） */}
      <div className="sticky top-3 z-20 rise" style={{ animationDelay: '60ms' }}>
        <form onSubmit={handleSearch} className="console rounded-[20px] p-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例: タクシーの話、おすすめのアニメ…"
              className="flex-1 min-w-0 px-4 py-3 bg-white/70 border border-white/60 rounded-2xl text-base md:text-lg text-ink placeholder:text-ink-soft/60 focus-ring focus:bg-white transition-colors"
              disabled={isLoading}
              aria-label="検索キーワード"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="flex-shrink-0 px-5 md:px-7 py-3 bg-pokopea-pink-deep text-white font-bold rounded-2xl shadow-sm hover:brightness-105 focus-ring press disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {isLoading ? '…' : '検索'}
            </button>
          </div>
        </form>
      </div>

      {/* 2カラム: 左（配信を聴く）/ 右（配信一覧・検索結果） */}
      <div className="md:flex md:gap-6 md:items-start mt-6">
        {/* ── 左レール（配信を聴く） ── */}
        <aside className="md:w-[340px] md:flex-shrink-0 rise" style={{ animationDelay: '120ms' }}>
          <section>
            <SectionLabel>配信を聴く</SectionLabel>
            <PodcastPlatforms />
          </section>
        </aside>

        {/* ── 右カラム（メインコンテンツ） ── */}
        <div className="flex-1 min-w-0 mt-8 md:mt-0">
          {/* エラー表示 */}
          {error && (
            <div className="surface rounded-2xl px-4 py-3.5 text-sm text-pokopea-pink-deep flex items-center gap-2">
              <span aria-hidden="true">⚠︎</span> {error}。もう一度お試しください。
            </div>
          )}

          {/* 検索結果メタ情報 */}
          {meta && !isLoading && (
            <div className="on-sky mb-3 flex items-baseline gap-2 text-sm text-white">
              <span style={{ fontFamily: 'var(--font-display)' }}>「{meta.query}」</span>
              <span className="tnum">{meta.resultCount}件</span>
              <span className="text-white/70 text-xs tnum ml-auto">{meta.totalTimeMs}ms</span>
            </div>
          )}

          {/* 検索結果 */}
          {groupedResults.length > 0 && (
            <div className="space-y-4">
              {groupedResults.map((episode, ei) => (
            <article
              key={episode.episode_id}
              className="surface rounded-2xl overflow-hidden rise"
              style={{ animationDelay: `${ei * 60}ms` }}
            >
              {/* エピソードヘッダー */}
              <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[rgba(33,51,128,0.07)]">
                <span className="flex-shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold ep-badge">
                  {episode.episode_number ? `#${episode.episode_number}` : 'EP'}
                </span>
                <h3 className="font-bold text-ink text-sm md:text-base truncate" style={{ fontFamily: 'var(--font-display)' }}>
                  {episode.episode_title}
                </h3>
                <span className="ml-auto flex-shrink-0 text-xs text-ink-soft tnum">
                  {episode.chunks.length}件
                </span>
              </div>

              {/* チャンク一覧 */}
              <div className="divide-y divide-[rgba(33,51,128,0.05)]">
                {episode.chunks.map((chunk) => (
                  <div
                    key={`${chunk.episode_id}-${chunk.chunk_index}`}
                    className="px-3.5 py-3.5 hover:bg-[rgba(74,133,210,0.035)] transition-colors"
                  >
                    <p className="text-sm md:text-[15px] leading-relaxed text-ink mb-2.5 line-clamp-3">
                      {highlightText(chunk.text, meta?.query || '')}
                    </p>

                    <div className="flex items-center gap-3">
                      {/* 時刻 + 類似度メーター */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-ink-soft tnum whitespace-nowrap">
                          {formatTime(chunk.start_time)}–{formatTime(chunk.end_time)}
                        </span>
                        <span className="meter w-14 md:w-20 flex-shrink-0" aria-hidden="true">
                          <i style={{ width: `${Math.round(chunk.similarity * 100)}%` }} />
                        </span>
                        <span className="text-xs text-ink-soft/80 tnum whitespace-nowrap">
                          {(chunk.similarity * 100).toFixed(0)}%
                        </span>
                      </div>

                      {/* YouTube該当時刻へジャンプ */}
                      <a
                        href={getYouTubeUrl(chunk.episode_id, chunk.start_time)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-pokopea-pink-deep text-white text-xs md:text-sm font-bold rounded-full shadow-sm hover:brightness-105 focus-ring press tnum"
                        aria-label={`YouTubeの ${formatTime(chunk.start_time)} を開く`}
                      >
                        <PlayGlyph />
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

          {/* 検索中 */}
          {isLoading && (
            <div className="on-sky mt-4 text-center text-white rise">
              <p className="text-sm" style={{ fontFamily: 'var(--font-display)' }}>ゆめのなかを探しています…</p>
            </div>
          )}

          {/* 検索結果なし */}
          {!isLoading && meta && groupedResults.length === 0 && (
            <div className="surface rounded-2xl text-center py-10 px-4">
              <p className="text-base font-bold text-ink mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                まだ見つかっていません
              </p>
              <p className="text-sm text-ink-soft">
                言い回しを変えたり、雰囲気で検索してみてください
              </p>
            </div>
          )}

          {/* 初期状態: 配信一覧 */}
          {showInitial && (
            <section className="rise" style={{ animationDelay: '120ms' }}>
              <SectionLabel count={episodes.length ? `${episodes.length}本` : undefined}>配信一覧</SectionLabel>
              <EpisodeList episodes={episodes} isLoading={isLoadingEpisodes} />
            </section>
          )}
        </div>
      </div>

      {/* フッター（空の下側=明るい帯に載るため濃色でコントラストを確保） */}
      <footer className="mt-14 pt-6 border-t border-[rgba(33,51,128,0.18)] text-center text-xs md:text-sm text-ink/75 space-y-1.5">
        <p>ファンによる非公式の検索ツールです。文字起こしデータの全文は公開・検索できません</p>
        <p>
          お問い合わせ:
          <a
            href="https://x.com/asonas"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pokopea-navy font-bold hover:underline ml-1 focus-ring rounded"
          >
            @asonas
          </a>
        </p>
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-3xl px-4">
        <div className="pt-20 text-center text-white/80">読み込み中…</div>
      </main>
    }>
      <SearchContent />
    </Suspense>
  );
}
