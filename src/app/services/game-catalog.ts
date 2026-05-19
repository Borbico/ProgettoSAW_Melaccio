import { Injectable, effect, inject, signal } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { MOCK_GAMES } from '../data/mock-games';
import { Game, GameStatus } from '../models/game';
import { ShelfEntry } from '../models/shelf-entry';
import { AuthSession } from './auth-session';
import { ShelfStorage } from './shelf-storage';

@Injectable({
  providedIn: 'root'
})
export class GameCatalog {
  private readonly auth = inject(AuthSession);
  private readonly shelfStorage = inject(ShelfStorage);
  private readonly guestUserId = 'guest';
  private readonly gamesState = signal<Game[]>([]);

  readonly games = this.gamesState.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const userId = this.auth.currentUser()?.id ?? this.guestUserId;
      const unsubscribe: Unsubscribe = this.shelfStorage.watch(userId, (entries) => {
        this.gamesState.set(this.composeGames(entries));
      });

      onCleanup(() => unsubscribe());
    });
  }

  findById(id: string): Game | undefined {
    return this.games().find((game) => game.id === id);
  }

  updateStatus(gameId: string, status: GameStatus): void {
    this.gamesState.update((games) =>
      games.map((game) => (game.id === gameId ? { ...game, status } : game))
    );
    this.persistCurrentShelf();
  }

  private composeGames(entries: Record<string, ShelfEntry>): Game[] {
    return MOCK_GAMES.map((game) => ({
      ...game,
      ...(entries[game.id] ?? {})
    }));
  }

  private persistCurrentShelf(): void {
    const userId = this.auth.currentUser()?.id ?? this.guestUserId;
    const entries = Object.fromEntries(
      this.games().map((game) => [
        game.id,
        {
          status: game.status,
          rating: game.rating,
          hoursPlayed: game.hoursPlayed,
          progress: game.progress,
          notes: game.notes,
          personalGoal: game.personalGoal
        }
      ])
    );

    void this.shelfStorage.write(userId, entries);
  }
}
