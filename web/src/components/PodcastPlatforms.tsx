export default function PodcastPlatforms() {
  return (
    <div className="surface rounded-2xl p-3 space-y-3">
      {/* Apple Podcasts */}
      <iframe
        title="Apple Podcasts で聴く"
        allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
        frameBorder="0"
        height="450"
        style={{ display: 'block', width: '100%', overflow: 'hidden', borderRadius: '12px' }}
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
        src="https://embed.podcasts.apple.com/jp/podcast/%E3%81%BD%E3%81%93%E3%83%94%E3%83%BC%E3%81%AE%E3%82%86%E3%82%81%E3%81%86%E3%81%A4%E3%81%A4/id1818355288"
      />

      {/* Spotify（コンパクト） */}
      <iframe
        title="Spotify で聴く"
        style={{ display: 'block', borderRadius: '12px', width: '100%' }}
        src="https://open.spotify.com/embed/show/315rSWYLluySzZ23ubctEZ?utm_source=generator"
        height="152"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
