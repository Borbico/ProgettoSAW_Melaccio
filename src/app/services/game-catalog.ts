import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { CatalogGame, toCatalogGame, toShelfEntry } from '../models/catalog-game';
import { Game, GameStatus } from '../models/game';
import { ShelfEntry } from '../models/shelf-entry';
import { AuthSession } from './auth-session';
import { CatalogStorage } from './catalog-storage';
import { ShelfStorage } from './shelf-storage';

@Injectable({
  providedIn: 'root'
})
export class GameCatalog {
  private readonly auth = inject(AuthSession);
  private readonly catalogStorage = inject(CatalogStorage);
  private readonly shelfStorage = inject(ShelfStorage);
  private readonly guestUserId = 'guest';
  private readonly catalogGamesState = signal<CatalogGame[]>([]);
  private readonly shelfEntriesState = signal<Record<string, ShelfEntry>>({});
  private readonly gamesState = signal<Game[]>([]);

  readonly games = this.gamesState.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const userId = this.auth.currentUser()?.id ?? this.guestUserId;
      const unsubscribeCatalog: Unsubscribe = this.catalogStorage.watch(userId, (catalogGames) => {
        untracked(() => {
          this.catalogGamesState.set(catalogGames);
          this.syncGames();
        });
      });
      const unsubscribe: Unsubscribe = this.shelfStorage.watch(userId, (entries) => {
        untracked(() => {
          this.shelfEntriesState.set(entries);
          this.syncGames();
        });
      });

      onCleanup(() => {
        unsubscribeCatalog();
        unsubscribe();
      });
    });
  }

  findById(id: string): Game | undefined {
    return this.games().find((game) => game.id === id);
  }

  createGame(game: Game): string {
    const id = this.uniqueGameId(game.title);
    const nextGame = { ...game, id };

    this.catalogGamesState.update((games) => [...games, toCatalogGame(nextGame)]);
    this.shelfEntriesState.update((entries) => ({
      ...entries,
      [id]: toShelfEntry(nextGame)
    }));
    this.syncGames();
    this.persistCatalog();
    this.persistCurrentShelf();

    return id;
  }

  updateGame(gameId: string, game: Game): void {
    const nextGame = { ...game, id: gameId };

    this.catalogGamesState.update((games) =>
      games.map((catalogGame) =>
        catalogGame.id === gameId ? toCatalogGame(nextGame) : catalogGame
      )
    );
    this.shelfEntriesState.update((entries) => ({
      ...entries,
      [gameId]: toShelfEntry(nextGame)
    }));
    this.syncGames();
    this.persistCatalog();
    this.persistCurrentShelf();
  }

  deleteGame(gameId: string): void {
    this.catalogGamesState.update((games) => games.filter((game) => game.id !== gameId));
    this.shelfEntriesState.update((entries) => {
      const { [gameId]: _deletedEntry, ...remainingEntries } = entries;

      return remainingEntries;
    });
    this.syncGames();
    this.persistCatalog();
    this.persistCurrentShelf();
  }

  updateStatus(gameId: string, status: GameStatus): void {
    this.updateShelfEntry(gameId, { status });
  }

  updateShelfEntry(gameId: string, entry: Partial<ShelfEntry>): void {
    const game = this.findById(gameId);

    if (!game) {
      return;
    }

    this.shelfEntriesState.update((entries) => ({
      ...entries,
      [gameId]: {
        ...this.defaultShelfEntry(),
        ...(entries[gameId] ?? toShelfEntry(game)),
        ...entry
      }
    }));
    this.syncGames();
    this.persistCurrentShelf();
  }

  private syncGames(): void {
    this.gamesState.set(this.composeGames(this.catalogGamesState(), this.shelfEntriesState()));
  }

  private composeGames(catalogGames: CatalogGame[], entries: Record<string, ShelfEntry>): Game[] {
    return catalogGames.map((game) => ({
      ...game,
      ...(entries[game.id] ?? this.defaultShelfEntry())
    }));
  }

  private persistCatalog(): void {
    const userId = this.auth.currentUser()?.id ?? this.guestUserId;

    void this.catalogStorage.write(userId, this.catalogGamesState()).catch(() => undefined);
  }

  private persistCurrentShelf(): void {
    const userId = this.auth.currentUser()?.id ?? this.guestUserId;
    const entries = Object.fromEntries(
      this.games().map((game) => [game.id, toShelfEntry(game)])
    );

    void this.shelfStorage.write(userId, entries).catch(() => undefined);
  }

  private defaultShelfEntry(): ShelfEntry {
    return {
      status: 'Wishlist',
      rating: 0,
      hoursPlayed: 0,
      progress: 0,
      notes: '',
      personalGoal: ''
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
