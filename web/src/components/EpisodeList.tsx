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
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface rounded-2xl p-3.5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[rgba(33,51,128,0.08)] flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 bg-[rgba(33,51,128,0.08)] rounded w-3/4" />
                <div className="h-3 bg-[rgba(33,51,128,0.05)] rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="surface rounded-2xl text-center py-8 text-ink-soft">
        <p className="text-sm">配信情報を取得できませんでした</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {episodes.map((episode) => (
        <a
          key={episode.id}
          href={getYouTubeUrl(episode.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="group surface block rounded-2xl press focus-ring transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div className="flex items-center gap-3 p-3 md:p-3.5">
            {/* エピソード番号バッジ */}
            <div className="flex-shrink-0 w-11 h-11 rounded-xl ep-badge flex items-center justify-center">
              <span className="text-sm font-bold leading-none">
                {episode.episode_number != null ? `#${episode.episode_number}` : '--'}
              </span>
            </div>

            {/* タイトルとメタ情報 */}
            <div className="flex-1 min-w-0">
              <h3
                className="text-sm md:text-[15px] font-bold text-ink truncate group-hover:text-pokopea-navy transition-colors"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {episode.title}
              </h3>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-soft tnum">
                {episode.upload_date && <span>{formatDate(episode.upload_date)}</span>}
                {episode.duration_seconds > 0 && <span>{formatDuration(episode.duration_seconds)}</span>}
              </div>
            </div>

            {/* 再生アイコン */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink-soft/50 group-hover:text-white group-hover:bg-pokopea-pink-deep transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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
  );
}
