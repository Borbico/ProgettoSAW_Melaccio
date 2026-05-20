import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { CatalogGame, toCatalogGame, toShelfEntry } from '../models/catalog-game';
import { Game, GameStatus } from '../models/game';
import { ShelfEntry } from '../models/shelf-entry';
import { AccessControl } from './access-control';
import { AuthSession } from './auth-session';
import { CatalogStorage } from './catalog-storage';
import { ShelfStorage } from './shelf-storage';

export type PersistenceResult = 'firebase' | 'local' | 'fallback' | 'denied';

@Injectable({
  providedIn: 'root',
})
export class GameCatalog {
  private readonly access = inject(AccessControl);
  private readonly auth = inject(AuthSession);
  private readonly catalogStorage = inject(CatalogStorage);
  private readonly shelfStorage = inject(ShelfStorage);
  private readonly guestUserId = 'guest';
  private readonly catalogGamesState = signal<CatalogGame[]>([]);
  private readonly shelfEntriesState = signal<Record<string, ShelfEntry>>({});
  private readonly shelfGamesState = signal<Game[]>([]);

  readonly catalogGames = this.catalogGamesState.asReadonly();
  readonly shelfGames = this.shelfGamesState.asReadonly();
  readonly games = this.catalogGames;

  constructor() {
    const unsubscribeCatalog: Unsubscribe = this.catalogStorage.watch((catalogGames) => {
      untracked(() => {
        this.catalogGamesState.set(catalogGames);
        this.syncGames();
      });
    });

    effect((onCleanup) => {
      const userId = this.auth.currentUser()?.id ?? this.guestUserId;
      const unsubscribe: Unsubscribe = this.shelfStorage.watch(userId, (entries) => {
        untracked(() => {
          this.shelfEntriesState.set(entries);
          this.syncGames();
        });
      });

      onCleanup(() => {
        unsubscribe();
      });
    });

    effect((onCleanup) => {
      onCleanup(() => unsubscribeCatalog());
    });
  }

  findById(id: string): CatalogGame | undefined {
    return this.findCatalogById(id);
  }

  findCatalogById(id: string): CatalogGame | undefined {
    return this.catalogGames().find((game) => game.id === id);
  }

  findShelfById(id: string): Game | undefined {
    return this.shelfGames().find((game) => game.id === id);
  }

  async createGame(game: CatalogGame): Promise<{ id: string; persistence: PersistenceResult }> {
    if (!this.access.canEditCatalog()) {
      return { id: '', persistence: 'denied' };
    }

    const id = this.uniqueGameId(game.title);
    const nextGame = { ...game, id };

    this.catalogGamesState.update((games) => [...games, toCatalogGame(nextGame)]);
    this.syncGames();
    const persistence = await this.persistCatalog();

    return { id, persistence };
  }

  async updateGame(gameId: string, game: CatalogGame): Promise<PersistenceResult> {
    if (!this.access.canEditCatalog()) {
      return 'denied';
    }

    const nextGame = { ...game, id: gameId };

    this.catalogGamesState.update((games) =>
      games.map((catalogGame) =>
        catalogGame.id === gameId ? toCatalogGame(nextGame) : catalogGame,
      ),
    );
    this.syncGames();

    return this.persistCatalog();
  }

  async deleteGame(gameId: string): Promise<PersistenceResult> {
    if (!this.access.canEditCatalog()) {
      return 'denied';
    }

    this.catalogGamesState.update((games) => games.filter((game) => game.id !== gameId));
    this.shelfEntriesState.update((entries) => {
      const { [gameId]: _deletedEntry, ...remainingEntries } = entries;

      return remainingEntries;
    });
    this.syncGames();

    const [catalogPersistence, shelfPersistence] = await Promise.all([
      this.persistCatalog(),
      this.persistCurrentShelf(),
    ]);

    if (catalogPersistence === 'fallback' || shelfPersistence === 'fallback') {
      return 'fallback';
    }

    if (catalogPersistence === 'firebase' && shelfPersistence === 'firebase') {
      return 'firebase';
    }

    return catalogPersistence;
  }

  updateStatus(gameId: string, status: GameStatus): Promise<PersistenceResult> {
    return this.updateShelfEntry(gameId, { status });
  }

  updateShelfEntry(gameId: string, entry: Partial<ShelfEntry>): Promise<PersistenceResult> {
    if (!this.access.canEditShelf()) {
      return Promise.resolve('denied');
    }

    if (!this.findCatalogById(gameId)) {
      return Promise.resolve('local');
    }

    this.shelfEntriesState.update((entries) => ({
      ...entries,
      [gameId]: {
        ...this.defaultShelfEntry(),
        ...(entries[gameId] ?? {}),
        ...entry,
      },
    }));
    this.syncGames();

    return this.persistCurrentShelf();
  }

  private syncGames(): void {
    this.shelfGamesState.set(
      this.composeShelfGames(this.catalogGamesState(), this.shelfEntriesState()),
    );
  }

  private composeShelfGames(
    catalogGames: CatalogGame[],
    entries: Record<string, ShelfEntry>,
  ): Game[] {
    return catalogGames.map((game) => ({
      ...game,
      ...(entries[game.id] ?? this.defaultShelfEntry()),
    }));
  }

  private async persistCatalog(): Promise<PersistenceResult> {
    try {
      await this.catalogStorage.write(this.catalogGamesState());

      return 'firebase';
    } catch {
      return 'fallback';
    }
  }

  private async persistCurrentShelf(): Promise<PersistenceResult> {
    const userId = this.auth.currentUser()?.id ?? this.guestUserId;
    const entries = Object.fromEntries(
      this.shelfGames().map((game) => [game.id, toShelfEntry(game)]),
    );

    try {
      await this.shelfStorage.write(userId, entries);

      return userId === this.guestUserId ? 'local' : 'firebase';
    } catch {
      return 'fallback';
    }
  }

  private defaultShelfEntry(): ShelfEntry {
    return {
      status: 'Wishlist',
      rating: 0,
      hoursPlayed: 0,
      progress: 0,
      notes: '',
      personalGoal: '',
    };
  }

  private uniqueGameId(title: string): string {
    const baseId =
      title
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'gioco';
    let candidate = baseId;
    let suffix = 2;

    while (this.catalogGamesState().some((game) => game.id === candidate)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }
}
