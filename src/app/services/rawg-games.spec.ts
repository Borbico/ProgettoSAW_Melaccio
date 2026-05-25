import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseClient } from './firebase-client';
import { RawgGames } from './rawg-games';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ segments })),
  getDoc: vi.fn(() =>
    Promise.resolve({
      data: () => ({ apiKey: 'remote-rawg-key-123456' }),
    }),
  ),
}));

describe('RawgGames', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [{ provide: FirebaseClient, useValue: { db: {} } }],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call RAWG for an empty query', async () => {
    const rawg = TestBed.inject(RawgGames);

    const result = await rawg.searchGames('   ');

    expect(result.games).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the admin-only API key document and maps RAWG search results', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          count: 1,
          next: null,
          results: [
            {
              id: 3498,
              slug: 'grand-theft-auto-v',
              name: 'Grand Theft Auto V',
              released: '2013-09-17',
              background_image: 'https://media.rawg.io/media/games/example.jpg',
              genres: [{ name: 'Action' }, { name: 'Adventure' }],
              platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation' } }],
            },
          ],
        }),
    });
    const rawg = TestBed.inject(RawgGames);

    const result = await rawg.searchGames('gta');
    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);

    expect(calledUrl.pathname).toBe('/api/games');
    expect(calledUrl.searchParams.get('key')).toBe('remote-rawg-key-123456');
    expect(calledUrl.searchParams.get('page_size')).toBe('12');
    expect(result.games).toEqual([
      {
        rawgId: 3498,
        title: 'Grand Theft Auto V',
        releaseYear: 2013,
        genres: ['Action', 'Adventure'],
        platforms: ['PC', 'PlayStation'],
        coverImageUrl: 'https://media.rawg.io/media/games/example.jpg',
        sourceUrl: 'https://rawg.io/games/grand-theft-auto-v',
      },
    ]);
  });
});
