import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MOCK_GAMES } from '../data/mock-games';
import { CatalogGame, toCatalogGame, toShelfEntry } from '../models/catalog-game';
import { Game } from '../models/game';
import { ShelfEntry } from '../models/shelf-entry';
import { AccessControl } from './access-control';
import { AuthSession } from './auth-session';
import { CatalogStorage } from './catalog-storage';
import { GameCatalog } from './game-catalog';
import { ShelfStorage } from './shelf-storage';

class FakeCatalogStorage {
  lastWrittenGames: CatalogGame[] = [];
  private games = MOCK_GAMES.map((game) => toCatalogGame(game));

  watch(onGames: (games: CatalogGame[]) => void) {
    onGames(this.games);
    return () => undefined;
  }

  async write(games: CatalogGame[]): Promise<void> {
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
  let canEditCatalog = signal(true);
  let canEditShelf = signal(true);

  beforeEach(() => {
    const currentUser = signal({ id: 'admin-user' });
    canEditCatalog = signal(true);
    canEditShelf = signal(true);

    catalogStorage = new FakeCatalogStorage();
    shelfStorage = new FakeShelfStorage();

    TestBed.configureTestingModule({
      providers: [
        GameCatalog,
        {
          provide: AccessControl,
          useValue: {
            canEditCatalog: canEditCatalog.asReadonly(),
            canEditShelf: canEditShelf.asReadonly(),
          },
        },
        { provide: AuthSession, useValue: { currentUser: currentUser.asReadonly() } },
        { provide: CatalogStorage, useValue: catalogStorage },
        { provide: ShelfStorage, useValue: shelfStorage },
      ],
    });

    catalog = TestBed.inject(GameCatalog);
    TestBed.flushEffects();
  });

  it('creates a catalog game without writing personal shelf stats', async () => {
    const game = buildGame({ title: 'Tunic' });

    const { id, persistence } = await catalog.createGame(game);

    expect(id).toBe('tunic');
    expect(persistence).toBe('firebase');
    expect(catalog.findCatalogById(id)?.title).toBe('Tunic');
    expect(catalog.findShelfById(id)?.status).toBe('Wishlist');
    expect(catalogStorage.lastWrittenGames.some((savedGame) => savedGame.id === id)).toBe(true);
    expect(shelfStorage.lastWrittenEntries[id]).toBeUndefined();
  });

  it('updates public catalog fields without overwriting personal shelf stats', async () => {
    const originalGame = catalog.findCatalogById('hades') as CatalogGame;
    const originalShelfGame = catalog.findShelfById('hades') as Game;
    const updatedGame = {
      ...originalGame,
      title: 'Hades II',
      platform: 'PC, Switch',
    };

    const persistence = await catalog.updateGame(originalGame.id, updatedGame);

    expect(persistence).toBe('firebase');
    expect(catalog.findCatalogById('hades')?.title).toBe('Hades II');
    expect(catalog.findCatalogById('hades')?.platform).toBe('PC, Switch');
    expect(catalog.findShelfById('hades')?.hoursPlayed).toBe(originalShelfGame.hoursPlayed);
    expect(catalogStorage.lastWrittenGames.find((game) => game.id === 'hades')?.title).toBe(
      'Hades II',
    );
    expect(shelfStorage.lastWrittenEntries['hades']).toBeUndefined();
  });

  it('deletes a game from catalog and shelf persistence', async () => {
    const persistence = await catalog.deleteGame('hades');

    expect(persistence).toBe('firebase');
    expect(catalog.findCatalogById('hades')).toBeUndefined();
    expect(catalog.findShelfById('hades')).toBeUndefined();
    expect(catalogStorage.lastWrittenGames.some((game) => game.id === 'hades')).toBe(false);
    expect(shelfStorage.lastWrittenEntries['hades']).toBeUndefined();
  });

  it('denies catalog writes when the user is not an admin', async () => {
    canEditCatalog.set(false);

    const createResult = await catalog.createGame(buildGame({ title: 'Nope' }));
    const updateResult = await catalog.updateGame('hades', buildGame({ id: 'hades' }));
    const deleteResult = await catalog.deleteGame('hades');

    expect(createResult.persistence).toBe('denied');
    expect(updateResult).toBe('denied');
    expect(deleteResult).toBe('denied');
    expect(catalog.findCatalogById('hades')).toBeTruthy();
  });

  it('updates personal shelf stats without changing public catalog stats', async () => {
    const persistence = await catalog.updateShelfEntry('hades', {
      status: 'Completato',
      rating: 2,
      hoursPlayed: 88,
    });

    expect(persistence).toBe('firebase');
    expect(catalog.findShelfById('hades')?.status).toBe('Completato');
    expect(catalog.findShelfById('hades')?.hoursPlayed).toBe(88);
    expect(
      (catalog.findCatalogById('hades') as unknown as Record<string, unknown>)['status'],
    ).toBeUndefined();
    expect(
      (catalog.findCatalogById('hades') as unknown as Record<string, unknown>)['hoursPlayed'],
    ).toBeUndefined();
  });

  it('denies shelf updates for guests', async () => {
    canEditShelf.set(false);

    const persistence = await catalog.updateShelfEntry('hades', { status: 'Completato' });

    expect(persistence).toBe('denied');
    expect(catalog.findShelfById('hades')?.status).toBe('In corso');
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
    ...overrides,
  };
}
