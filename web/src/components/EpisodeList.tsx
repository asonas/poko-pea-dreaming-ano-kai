import { Episode } from '@/lib/supabase';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

function getYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

interface EpisodeListProps {
  episodes: Episode[];
  isLoading: boolean;
}

export default function EpisodeList({ episodes, isLoading }: EpisodeListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-1 rounded-full bg-pokopea-pink/30 animate-pulse" />
          <div className="h-5 w-20 rounded bg-gray-200 animate-pulse" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-100 rounded-lg p-3 md:p-4 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="text-center py-8 md:py-12 text-gray-400">
        <p className="text-sm md:text-base">配信情報を取得できませんでした</p>
      </div>
    );
  }

  return (
    <div>
      {/* セクション見出し */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-pokopea-pink" />
        <h2 className="text-sm md:text-base font-bold text-pokopea-navy tracking-wide">
          配信一覧
        </h2>
        <span className="text-xs text-pokopea-gray ml-1">
          {episodes.length}本
        </span>
      </div>

      {/* エピソードカード一覧 */}
      <div className="space-y-2">
        {episodes.map((episode, index) => (
          <a
            key={episode.id}
            href={getYouTubeUrl(episode.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-white border border-gray-100 rounded-lg hover:border-pokopea-pink/40 hover:shadow-md transition-all duration-200"
            style={{
              animationDelay: `${index * 40}ms`,
            }}
          >
            <div className="flex items-center gap-3 p-3 md:p-4">
              {/* エピソード番号バッジ */}
              <div className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-lg bg-gradient-to-br from-pokopea-pink/10 to-pokopea-pink/5 border border-pokopea-pink/15 flex items-center justify-center group-hover:from-pokopea-pink/20 group-hover:to-pokopea-pink/10 transition-colors duration-200">
                <span className="text-sm md:text-base font-bold text-pokopea-pink leading-none">
                  {episode.episode_number != null ? `#${episode.episode_number}` : '--'}
                </span>
              </div>

              {/* タイトルとメタ情報 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-medium text-gray-800 truncate group-hover:text-pokopea-navy transition-colors duration-200">
                  {episode.title}
                </h3>
                <div className="flex items-center gap-3 mt-0.5">
                  {episode.upload_date && (
                    <span className="text-xs text-pokopea-gray">
                      {formatDate(episode.upload_date)}
                    </span>
                  )}
                  {episode.duration_seconds > 0 && (
                    <span className="text-xs text-pokopea-gray">
                      {formatDuration(episode.duration_seconds)}
                    </span>
                  )}
                </div>
              </div>

              {/* 再生アイコン */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pokopea-pink/0 group-hover:bg-pokopea-pink/10 flex items-center justify-center transition-all duration-200">
                <svg
                  className="w-4 h-4 text-pokopea-gray group-hover:text-pokopea-pink transition-colors duration-200"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.132v3.736a1 1 0 001.555.832l3.197-1.868a1 1 0 000-1.664l-3.197-1.868z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
