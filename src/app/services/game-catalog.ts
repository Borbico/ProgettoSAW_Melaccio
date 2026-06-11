import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Unsubscribe, collection, doc, setDoc } from 'firebase/firestore';
import { CatalogGame, toCatalogGame } from '../models/catalog-game';
import { Game, GameStatus } from '../models/game';
import { ShelfEntry } from '../models/shelf-entry';
import type { PersistenceResult } from '../models/persistence-result';
import { defaultShelfEntry } from '../utils/shelf-entry-utils';
import { composeShelfGames, publicShelfSummary } from '../utils/shelf-summary';
import { AccessControl } from './access-control';
import { AuthSession } from './auth-session';
import { CatalogStorage } from './catalog-storage';
import { ShelfStorage } from './shelf-storage';
import { NotificationCenter } from './notification-center';
import { PwaService } from './pwa';
import { FirebaseClient } from './firebase-client';

export type { PersistenceResult };

@Injectable({
  providedIn: 'root',
})
export class GameCatalog {
  private readonly access = inject(AccessControl);
  private readonly auth = inject(AuthSession);
  private readonly catalogStorage = inject(CatalogStorage);
  private readonly shelfStorage = inject(ShelfStorage);
  private readonly notifications = inject(NotificationCenter);
  private readonly pwa = inject(PwaService);
  private readonly firebase = inject(FirebaseClient);
  private readonly guestUserId = 'guest';
  private readonly catalogGamesState = signal<CatalogGame[]>([]);
  private readonly shelfEntriesState = signal<Record<string, ShelfEntry>>({});
  private readonly pendingSyncCountState = signal(0);

  readonly catalogGames = this.catalogGamesState.asReadonly();
  readonly shelfGames = computed(() =>
    composeShelfGames(this.catalogGamesState(), this.shelfEntriesState()),
  );
  readonly games = this.catalogGames;
  readonly pendingSyncCount = this.pendingSyncCountState.asReadonly();
  readonly hasPendingSync = computed(() => this.pendingSyncCountState() > 0);

  constructor() {
    const unsubscribeCatalog: Unsubscribe = this.catalogStorage.watch((catalogGames) => {
      untracked(() => {
        this.catalogGamesState.set(catalogGames);
      });
    });

    effect((onCleanup) => {
      const userId = this.auth.currentUser()?.id ?? this.guestUserId;
      const unsubscribe: Unsubscribe = this.shelfStorage.watch(userId, (entries) => {
        untracked(() => {
          this.shelfEntriesState.set(entries);
        });
      });

      onCleanup(() => {
        unsubscribe();
      });
    });

    effect((onCleanup) => {
      onCleanup(() => unsubscribeCatalog());
    });

    effect(() => {
      const isOnline = this.pwa.online();
      const currentUser = this.auth.currentUser();
      if (isOnline && currentUser) {
        untracked(() => {
          void this.syncOfflineChanges(currentUser.id);
        });
      }
    });

    effect(() => {
      const userId = this.auth.currentUser()?.id ?? this.guestUserId;
      untracked(() => void this.refreshPendingSyncCount(userId));
    });

    effect(() => {
      const catalogGames = this.catalogGames();
      const shelfEntries = this.shelfEntriesState();
      const userId = this.auth.currentUser()?.id ?? this.guestUserId;

      if (catalogGames.length === 0 || userId === this.guestUserId) {
        return;
      }

      const catalogIds = new Set(catalogGames.map((g) => g.id));
      let hasOrphans = false;
      const cleanedEntries: Record<string, ShelfEntry> = {};
      const orphans: string[] = [];

      for (const [gameId, entry] of Object.entries(shelfEntries)) {
        if (catalogIds.has(gameId)) {
          cleanedEntries[gameId] = entry;
        } else {
          hasOrphans = true;
          orphans.push(gameId);
        }
      }

      if (hasOrphans) {
        untracked(() => {
          this.shelfEntriesState.set(cleanedEntries);
          void this.persistCurrentShelf();

          const removedTitles = orphans.map((id) =>
            id
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' '),
          );

          if (removedTitles.length === 1) {
            this.notifications.info(
              'Gioco rimosso dal catalogo',
              `Il gioco "${removedTitles[0]}" non è più presente nel catalogo ed è stato rimosso dalla tua shelf.`,
            );
          } else {
            this.notifications.info(
              'Giochi rimossi dal catalogo',
              `I seguenti giochi non sono più presenti nel catalogo e sono stati rimossi dalla tua shelf: ${removedTitles.join(', ')}.`,
            );
          }
        });
      }
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

    const catalogPersistence = await this.persistCatalog();

    if (!this.shelfEntriesState()[gameId]) {
      return catalogPersistence;
    }

    const shelfPersistence = await this.persistCurrentShelf();

    return this.combinePersistence(catalogPersistence, shelfPersistence);
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

    const [catalogPersistence, shelfPersistence] = await Promise.all([
      this.persistCatalog(),
      this.persistCurrentShelf(),
    ]);

    return this.combinePersistence(catalogPersistence, shelfPersistence);
  }

  updateStatus(gameId: string, status: GameStatus): Promise<PersistenceResult> {
    return this.updateShelfEntry(gameId, { status });
  }

  async updateShelfEntry(gameId: string, entry: Partial<ShelfEntry>): Promise<PersistenceResult> {
    if (!this.access.canEditShelf()) {
      return Promise.resolve('denied');
    }

    if (!this.findCatalogById(gameId)) {
      return Promise.resolve('local');
    }

    const previousEntry = this.shelfEntriesState()[gameId];
    const isTransitioningToCompleted =
      entry.status === 'Completato' && (!previousEntry || previousEntry.status !== 'Completato');

    let nextEntry: ShelfEntry | null = null;
    this.shelfEntriesState.update((entries) => {
      const updated = {
        ...defaultShelfEntry(),
        ...(entries[gameId] ?? {}),
        ...entry,
        updatedAt: new Date().toISOString(),
      };
      nextEntry = updated;
      return {
        ...entries,
        [gameId]: updated,
      };
    });

    const persistence = await this.persistCurrentShelf();
    const userId = this.auth.currentUser()?.id ?? this.guestUserId;
    if (userId !== this.guestUserId) {
      if (persistence === 'fallback') {
        await this.shelfStorage.markPendingChange(userId, gameId, nextEntry);
      } else if (persistence === 'firebase') {
        await this.shelfStorage.clearPendingChange(userId, gameId);
      }

      await this.refreshPendingSyncCount(userId);

      if (isTransitioningToCompleted) {
        try {
          const activityRef = doc(collection(this.firebase.db, 'activities'));
          const catalogGame = this.findCatalogById(gameId);
          await setDoc(activityRef, {
            userId,
            userName: this.auth.currentUser()?.displayName ?? 'Utente',
            gameId,
            gameTitle: catalogGame?.title ?? gameId,
            type: 'completion',
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to write completion activity', err);
        }
      }
    }

    return persistence;
  }

  async removeFromShelf(gameId: string): Promise<PersistenceResult> {
    if (!this.access.canEditShelf()) {
      return Promise.resolve('denied');
    }

    this.shelfEntriesState.update((entries) => {
      const { [gameId]: _deletedEntry, ...remainingEntries } = entries;
      return remainingEntries;
    });

    const persistence = await this.persistCurrentShelf();
    const userId = this.auth.currentUser()?.id ?? this.guestUserId;
    if (userId !== this.guestUserId) {
      if (persistence === 'fallback') {
        await this.shelfStorage.markPendingChange(userId, gameId, null);
      } else if (persistence === 'firebase') {
        await this.shelfStorage.clearPendingChange(userId, gameId);
      }

      await this.refreshPendingSyncCount(userId);
    }

    return persistence;
  }

  private async syncOfflineChanges(userId: string): Promise<void> {
    const pending = await this.shelfStorage.readPendingChanges(userId);
    const pendingCount = Object.keys(pending).length;

    this.pendingSyncCountState.set(pendingCount);

    if (pendingCount === 0) {
      return;
    }

    const persistence = await this.persistCurrentShelf();
    if (persistence === 'firebase') {
      await this.shelfStorage.clearPendingChanges(userId);
      await this.refreshPendingSyncCount(userId);
      this.notifications.success(
        'Sincronizzazione completata',
        'Le modifiche in attesa sono state salvate su Firebase.',
      );
    }
  }

  private async refreshPendingSyncCount(userId: string): Promise<void> {
    if (userId === this.guestUserId) {
      this.pendingSyncCountState.set(0);
      return;
    }

    const pending = await this.shelfStorage.readPendingChanges(userId);
    this.pendingSyncCountState.set(Object.keys(pending).length);
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
    const entries = this.shelfEntriesState();
    const publicSummary =
      userId === this.guestUserId
        ? undefined
        : publicShelfSummary(composeShelfGames(this.catalogGamesState(), entries));

    try {
      await this.shelfStorage.write(userId, entries, publicSummary);

      return userId === this.guestUserId ? 'local' : 'firebase';
    } catch {
      return 'fallback';
    }
  }

  private combinePersistence(
    first: PersistenceResult,
    second: PersistenceResult,
  ): PersistenceResult {
    if (first === 'fallback' || second === 'fallback') {
      return 'fallback';
    }

    if (first === 'denied' || second === 'denied') {
      return 'denied';
    }

    if (first === 'firebase' && second === 'firebase') {
      return 'firebase';
    }

    return first;
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
