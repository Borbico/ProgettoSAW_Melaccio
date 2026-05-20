import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MOCK_GAMES } from '../data/mock-games';
import { CatalogGame, toCatalogGame, toShelfEntry } from '../models/catalog-game';
import { Game } from '../models/game';
import { ShelfEntry } from '../models/shelf-entry';
import { AuthSession } from './auth-session';
import { CatalogStorage } from './catalog-storage';
import { GameCatalog } from './game-catalog';
import { ShelfStorage } from './shelf-storage';

class FakeCatalogStorage {
  lastWrittenGames: CatalogGame[] = [];
  private games = MOCK_GAMES.map((game) => toCatalogGame(game));

  watch(_userId: string, onGames: (games: CatalogGame[]) => void) {
    onGames(this.games);
    return () => undefined;
  }

  async write(_userId: string, games: CatalogGame[]): Promise<void> {
    this.games = games;
    this.lastWrittenGames = games;
  }
}

class FakeShelfStorage {
  lastWrittenEntries: Record<string, ShelfEntry> = {};
  private entries = Object.fromEntries(MOCK_GAMES.map((game) => [game.id, toShelfEntry(game)]));

  watch(_userId: string, onEntries: (entries: Record<string, ShelfEntry>) => void) {
    onEntries(this.entries);
    return () => undefined;
  }

  async write(_userId: string, entries: Record<string, ShelfEntry>): Promise<void> {
    this.entries = entries;
    this.lastWrittenEntries = entries;
  }
}

describe('GameCatalog', () => {
  let catalog: GameCatalog;
  let catalogStorage: FakeCatalogStorage;
  let shelfStorage: FakeShelfStorage;

  beforeEach(() => {
    const currentUser = signal(null);

    catalogStorage = new FakeCatalogStorage();
    shelfStorage = new FakeShelfStorage();

    TestBed.configureTestingModule({
      providers: [
        GameCatalog,
        { provide: AuthSession, useValue: { currentUser: currentUser.asReadonly() } },
        { provide: CatalogStorage, useValue: catalogStorage },
        { provide: ShelfStorage, useValue: shelfStorage }
      ]
    });

    catalog = TestBed.inject(GameCatalog);
    TestBed.flushEffects();
  });

  it('creates a catalog game and persists its shelf entry', () => {
    const game = buildGame({ title: 'Tunic' });

    const id = catalog.createGame(game);

    expect(id).toBe('tunic');
    expect(catalog.findById(id)?.title).toBe('Tunic');
    expect(catalogStorage.lastWrittenGames.some((savedGame) => savedGame.id === id)).toBe(true);
    expect(shelfStorage.lastWrittenEntries[id]).toEqual(toShelfEntry({ ...game, id }));
  });

  it('updates catalog fields and personal shelf fields together', () => {
    const originalGame = catalog.findById('hades') as Game;
    const updatedGame = {
      ...originalGame,
      title: 'Hades II',
      status: 'Completato' as const,
      rating: 5,
      hoursPlayed: 48
    };

    catalog.updateGame(originalGame.id, updatedGame);

    expect(catalog.findById('hades')?.title).toBe('Hades II');
    expect(catalog.findById('hades')?.rating).toBe(5);
    expect(catalogStorage.lastWrittenGames.find((game) => game.id === 'hades')?.title).toBe(
      'Hades II'
    );
    expect(shelfStorage.lastWrittenEntries['hades'].hoursPlayed).toBe(48);
  });

  it('deletes a game from catalog and shelf persistence', () => {
    catalog.deleteGame('hades');

    expect(catalog.findById('hades')).toBeUndefined();
    expect(catalogStorage.lastWrittenGames.some((game) => game.id === 'hades')).toBe(false);
    expect(shelfStorage.lastWrittenEntries['hades']).toBeUndefined();
  });
});

function buildGame(overrides: Partial<Game> = {}): Game {
  return {
    id: '',
    title: 'Nuovo gioco',
    developer: 'Studio',
    publisher: 'Publisher',
    genre: 'Avventura',
    platform: 'PC',
    modes: ['Single player'],
    tags: ['Test'],
    releaseYear: 2026,
    status: 'Wishlist',
    rating: 0,
    hoursPlayed: 0,
    progress: 0,
    description: 'Descrizione di test',
    notes: '',
    personalGoal: '',
    coverTheme: 'cover-neon',
    ...overrides
  };
}
