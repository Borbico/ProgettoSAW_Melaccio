import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Unsubscribe,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { MOCK_GAMES } from '../data/mock-games';
import { CatalogGame, toCatalogGame } from '../models/catalog-game';
import { FirebaseClient } from './firebase-client';

@Injectable({
  providedIn: 'root',
})
export class CatalogStorage {
  private readonly firebase = inject(FirebaseClient);
  private readonly keyPrefix = 'gameshelf:catalog';

  watch(onGames: (games: CatalogGame[]) => void): Unsubscribe {
    const catalogRef = this.catalogDocument();

    return onSnapshot(
      catalogRef,
      (snapshot) => {
        const games = snapshot.exists() ? this.normalizeGames(snapshot.data()) : this.readLocal();

        onGames(games);
      },
      () => {
        onGames(this.readLocal());
      },
    );
  }

  async write(games: CatalogGame[]): Promise<void> {
    const normalizedGames = this.normalizeList(games);
    this.writeLocal(normalizedGames);

    await setDoc(
      this.catalogDocument(),
      {
        games: normalizedGames,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  private catalogDocument() {
    return doc(this.firebase.db, 'catalog', 'default');
  }

  private normalizeGames(data: DocumentData): CatalogGame[] {
    const rawGames = data['games'];

    if (!Array.isArray(rawGames)) {
      return this.defaultGames();
    }

    return this.normalizeList(rawGames as Partial<CatalogGame>[]);
  }

  private readLocal(): CatalogGame[] {
    const storedGames = this.readJson<CatalogGame[]>(this.storageKey());

    return storedGames ? this.normalizeList(storedGames) : this.defaultGames();
  }

  private writeLocal(games: CatalogGame[]): void {
    if (this.hasStorage()) {
      localStorage.setItem(this.storageKey(), JSON.stringify(games));
    }
  }

  private defaultGames(): CatalogGame[] {
    return MOCK_GAMES.map((game) => toCatalogGame(game));
  }

  private normalizeList(games: Partial<CatalogGame>[]): CatalogGame[] {
    return games
      .map((game) => this.normalizeGame(game))
      .filter((game): game is CatalogGame => Boolean(game));
  }

  private normalizeGame(game: Partial<CatalogGame>): CatalogGame | null {
    if (!game.id || !game.title) {
      return null;
    }

    const normalizedGame: CatalogGame = {
      id: String(game.id),
      title: String(game.title),
      developer: String(game.developer ?? 'Sviluppatore non indicato'),
      publisher: String(game.publisher ?? 'Publisher non indicato'),
      genre: String(game.genre ?? 'Altro'),
      platform: String(game.platform ?? 'PC'),
      modes: this.normalizeStringList(game.modes),
      tags: this.normalizeStringList(game.tags),
      releaseYear: this.clampNumber(game.releaseYear, 1970, 2035),
      description: String(game.description ?? ''),
      coverTheme: String(game.coverTheme ?? 'cover-neon'),
    };

    const coverImageUrl = this.normalizeUrl(game.coverImageUrl);
    const sourceUrl = this.normalizeUrl(game.sourceUrl);
    const sourceName = String(game.sourceName ?? '').trim();

    if (coverImageUrl) {
      normalizedGame.coverImageUrl = coverImageUrl;
    }

    if (sourceUrl && sourceName) {
      normalizedGame.sourceName = sourceName;
      normalizedGame.sourceUrl = sourceUrl;
    }

    return normalizedGame;
  }

  private normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  private clampNumber(value: unknown, min: number, max: number): number {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return min;
    }

    return Math.min(max, Math.max(min, Math.round(numericValue)));
  }

  private normalizeUrl(value: unknown): string {
    const url = String(value ?? '').trim();

    return url.startsWith('https://') ? url : '';
  }

  private storageKey(): string {
    return `${this.keyPrefix}:global`;
  }

  private readJson<T>(key: string): T | null {
    if (!this.hasStorage()) {
      return null;
    }

    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private hasStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
