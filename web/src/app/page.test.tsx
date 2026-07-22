// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './page';

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.searchParams,
}));

const episode = {
  id: 'episode-1',
  title: 'テスト回',
  episode_number: 1,
  upload_date: '2026-07-22',
  duration_seconds: 3600,
};

const searchResult = {
  episode_id: 'episode-1',
  episode_title: 'テスト回',
  episode_number: 1,
  chunk_index: 0,
  text: 'テストの会話です',
  start_time: 10,
  end_time: 20,
  similarity: 0.9,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Home accessibility structure', () => {
  beforeEach(() => {
    navigation.searchParams = new URLSearchParams();
    navigation.push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('places the primary episode list before podcast embeds in DOM order', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ episodes: [episode] })));

    render(<Home />);

    const episodeList = await screen.findByRole('region', { name: '配信一覧' });
    const platforms = screen.getByRole('complementary', { name: '配信を聴く' });
    const position = episodeList.compareDocumentPosition(platforms);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('binds accessible contrast surfaces to labels and the search input', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ episodes: [episode] })));

    render(<Home />);

    const listHeading = await screen.findByRole('heading', { level: 2, name: '配信一覧' });
    const searchInput = screen.getByRole('textbox', { name: '検索キーワード' });

    expect(listHeading.parentElement?.classList.contains('section-label')).toBe(true);
    expect(listHeading.classList.contains('text-white')).toBe(true);
    expect(searchInput.classList.contains('search-input')).toBe(true);
  });

  it('exposes result headings and count as a status message', async () => {
    navigation.searchParams = new URLSearchParams('q=テスト');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/search')) {
        return jsonResponse({
          results: [searchResult],
          meta: {
            query: 'テスト',
            resultCount: 1,
            embeddingTimeMs: 5,
            totalTimeMs: 10,
          },
        });
      }
      return jsonResponse({ episodes: [episode] });
    }));

    render(<Home />);

    expect(await screen.findByRole('heading', { level: 2, name: '検索結果' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'テスト回' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1件');
  });

  it('announces search failures as alerts', async () => {
    navigation.searchParams = new URLSearchParams('q=テスト');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/search')) {
        return jsonResponse({ message: 'failed' }, 500);
      }
      return jsonResponse({ episodes: [episode] });
    }));

    render(<Home />);

    expect((await screen.findByRole('alert')).textContent).toContain('検索に失敗しました');
  });

  it('exposes one status message while a search is loading', async () => {
    navigation.searchParams = new URLSearchParams('q=テスト');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/search')) {
        return new Promise<Response>(() => undefined);
      }
      return jsonResponse({ episodes: [episode] });
    }));

    render(<Home />);

    expect((await screen.findByRole('status')).textContent).toContain('ゆめのなかを探しています');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('exposes one status message when a search has no results', async () => {
    navigation.searchParams = new URLSearchParams('q=テスト');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/search')) {
        return jsonResponse({
          results: [],
          meta: {
            query: 'テスト',
            resultCount: 0,
            embeddingTimeMs: 5,
            totalTimeMs: 10,
          },
        });
      }
      return jsonResponse({ episodes: [episode] });
    }));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('まだ見つかっていません')).toBeTruthy();
    });

    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].textContent).toContain('まだ見つかっていません');
  });
});
