import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MOCK_GAMES } from '../data/mock-games';
import { CatalogGame, toCatalogGame, toShelfEntry } from '../models/catalog-game';
import { Game } from '../models/game';
import { PublicShelfSummary } from '../models/public-shelf-summary';
import { ShelfEntry } from '../models/shelf-entry';
import { AccessControl } from './access-control';
import { AuthSession } from './auth-session';
import { CatalogStorage } from './catalog-storage';
import { GameCatalog } from './game-catalog';
import { ShelfStorage } from './shelf-storage';
import { PwaService } from './pwa';
import { FirebaseClient } from './firebase-client';

const firestore = vi.hoisted(() => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ kind: 'collection', segments })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ kind: 'doc', segments })),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  getFirestore: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => firestore);

class FakeCatalogStorage {
  lastWrittenGames: CatalogGame[] = [];
  private games = MOCK_GAMES.map((game) => toCatalogGame(game));

  watch(
    onGames: (games: CatalogGame[], source: 'firebase' | 'local', error?: any) => void,
  ) {
    onGames(this.games, 'firebase');
    return () => undefined;
  }

  async write(games: CatalogGame[]): Promise<void> {
    this.games = games;
    this.lastWrittenGames = games;
  }
}

class FakeShelfStorage {
  lastWrittenEntries: Record<string, ShelfEntry> = {};
  lastWrittenSummary: PublicShelfSummary | undefined;
  private entries = Object.fromEntries(MOCK_GAMES.map((game) => [game.id, toShelfEntry(game)]));
  shouldFail = false;
  pendingChanges: Record<string, Record<string, ShelfEntry | null>> = {};

  setEntries(entries: Record<string, ShelfEntry>): void {
    this.entries = entries;
  }

  watch(_userId: string, onEntries: (entries: Record<string, ShelfEntry>) => void) {
    onEntries(this.entries);
    return () => undefined;
  }

  async write(
    _userId: string,
    entries: Record<string, ShelfEntry>,
    publicSummary?: PublicShelfSummary,
  ): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Offline');
    }
    this.entries = entries;
    this.lastWrittenEntries = entries;
    this.lastWrittenSummary = publicSummary;
  }

  async markPendingChange(userId: string, gameId: string, entry: ShelfEntry | null): Promise<void> {
    if (!this.pendingChanges[userId]) {
      this.pendingChanges[userId] = {};
    }
    this.pendingChanges[userId][gameId] = entry;
  }

  async clearPendingChange(userId: string, gameId: string): Promise<void> {
    if (this.pendingChanges[userId]) {
      delete this.pendingChanges[userId][gameId];
    }
  }

  async readPendingChanges(userId: string): Promise<Record<string, ShelfEntry | null>> {
    return this.pendingChanges[userId] ?? {};
  }

  async clearPendingChanges(userId: string): Promise<void> {
    delete this.pendingChanges[userId];
  }
}

describe('GameCatalog', () => {
  let catalog: GameCatalog;
  let catalogStorage: FakeCatalogStorage;
  let shelfStorage: FakeShelfStorage;
  let canEditCatalog = signal(true);
  let canEditShelf = signal(true);
  let isOnline = signal(true);

  beforeEach(() => {
    const currentUser = signal({ id: 'admin-user' });
    canEditCatalog = signal(true);
    canEditShelf = signal(true);
    isOnline = signal(true);

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
        { provide: PwaService, useValue: { online: isOnline.asReadonly() } },
        { provide: FirebaseClient, useValue: { db: {} } },
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
    expect(catalog.findShelfById(id)).toBeUndefined();
    expect(catalogStorage.lastWrittenGames.some((savedGame) => savedGame.id === id)).toBe(true);
    expect(shelfStorage.lastWrittenEntries[id]).toBeUndefined();
  });

  it('keeps MyShelf empty when a user has no saved entries', () => {
    shelfStorage.setEntries({});
    TestBed.resetTestingModule();

    const currentUser = signal({ id: 'new-user' });

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

    const freshCatalog = TestBed.inject(GameCatalog);
    TestBed.flushEffects();

    expect(freshCatalog.shelfGames()).toEqual([]);
    expect(freshCatalog.findShelfById('hades')).toBeUndefined();
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
    expect(shelfStorage.lastWrittenEntries['hades']?.hoursPlayed).toBe(
      originalShelfGame.hoursPlayed,
    );
    expect(
      shelfStorage.lastWrittenSummary?.recentGames.some((game) => game.title === 'Hades II'),
    ).toBe(true);
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
    shelfStorage.setEntries({});
    TestBed.resetTestingModule();

    const currentUser = signal({ id: 'new-user' });

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

    const freshCatalog = TestBed.inject(GameCatalog);
    TestBed.flushEffects();

    const persistence = await freshCatalog.updateShelfEntry('hades', {
      status: 'Completato',
      rating: 2,
      hoursPlayed: 88,
    });

    expect(persistence).toBe('firebase');
    expect(freshCatalog.findShelfById('hades')?.status).toBe('Completato');
    expect(freshCatalog.findShelfById('hades')?.hoursPlayed).toBe(88);
    expect(freshCatalog.shelfGames().length).toBe(1);
    expect(shelfStorage.lastWrittenSummary).toMatchObject({
      savedCount: 1,
      completedCount: 1,
      totalHours: 88,
      recentGames: [
        {
          id: 'hades',
          title: 'Hades',
          status: 'Completato',
          hoursPlayed: 88,
        },
      ],
    });
    expect(
      (freshCatalog.findCatalogById('hades') as unknown as Record<string, unknown>)['status'],
    ).toBeUndefined();
    expect(
      (freshCatalog.findCatalogById('hades') as unknown as Record<string, unknown>)['hoursPlayed'],
    ).toBeUndefined();
  });

  it('denies shelf updates for guests', async () => {
    canEditShelf.set(false);

    const persistence = await catalog.updateShelfEntry('hades', { status: 'Completato' });

    expect(persistence).toBe('denied');
    expect(catalog.findShelfById('hades')?.status).toBe('In corso');
  });

  it('removes a game from the shelf', async () => {
    expect(catalog.findShelfById('hades')).toBeDefined();

    const persistence = await catalog.removeFromShelf('hades');

    expect(persistence).toBe('firebase');
    expect(catalog.findShelfById('hades')).toBeUndefined();
    expect(shelfStorage.lastWrittenEntries['hades']).toBeUndefined();
  });

  it('denies shelf removals for guests', async () => {
    canEditShelf.set(false);

    const persistence = await catalog.removeFromShelf('hades');

    expect(persistence).toBe('denied');
    expect(catalog.findShelfById('hades')).toBeDefined();
  });

  it('queues pending changes on write failure and syncs when back online', async () => {
    // 1. Simulate offline: writing to shelf fails
    isOnline.set(false);
    TestBed.flushEffects();
    shelfStorage.shouldFail = true;

    const persistence = await catalog.updateShelfEntry('hades', {
      status: 'Completato',
      hoursPlayed: 99,
    });

    expect(persistence).toBe('fallback');
    // Change should be queued in pending Changes
    const pending = await shelfStorage.readPendingChanges('admin-user');
    expect(pending['hades']).toBeDefined();
    expect(pending['hades']?.hoursPlayed).toBe(99);
    expect(catalog.pendingSyncCount()).toBe(1);
    expect(catalog.hasPendingSync()).toBe(true);

    // 2. Simulate going online: triggers sync effect
    shelfStorage.shouldFail = false;
    isOnline.set(true); // triggers effect
    TestBed.flushEffects();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The sync should run and clear the pending queue
    const pendingAfterSync = await shelfStorage.readPendingChanges('admin-user');
    expect(pendingAfterSync['hades']).toBeUndefined();
    expect(catalog.pendingSyncCount()).toBe(0);
    expect(catalog.hasPendingSync()).toBe(false);
    expect(shelfStorage.lastWrittenEntries['hades']?.hoursPlayed).toBe(99);
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
