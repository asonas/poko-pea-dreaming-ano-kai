export default function PodcastPlatforms() {
  return (
    <div className="mb-6 md:mb-8">
      {/* セクション見出し */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-pokopea-pink" />
        <h2 className="text-sm md:text-base font-bold text-pokopea-navy tracking-wide">
          ポッドキャストを聴く
        </h2>
      </div>

      {/* 埋め込みプレイヤー */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Apple Podcasts */}
        <div className="min-w-0">
          <iframe
            allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
            frameBorder="0"
            height="450"
            style={{ width: '100%', overflow: 'hidden', borderRadius: '10px' }}
            sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
            src="https://embed.podcasts.apple.com/jp/podcast/%E3%81%BD%E3%81%93%E3%83%94%E3%83%BC%E3%81%AE%E3%82%86%E3%82%81%E3%81%86%E3%81%A4%E3%81%A4/id1818355288"
          />
        </div>

        {/* Spotify */}
        <div className="min-w-0">
          <iframe
            style={{ borderRadius: '12px', width: '100%' }}
            src="https://open.spotify.com/embed/show/315rSWYLluySzZ23ubctEZ?utm_source=generator"
            height="352"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
