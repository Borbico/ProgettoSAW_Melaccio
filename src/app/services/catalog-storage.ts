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
import { clampNumber } from '../utils/number-utils';
import { FirebaseClient } from './firebase-client';
import { IndexedDbStore } from './indexed-db-store';

@Injectable({
  providedIn: 'root',
})
export class CatalogStorage {
  private readonly firebase = inject(FirebaseClient);
  private readonly db = inject(IndexedDbStore);
  private readonly keyPrefix = 'gameshelf:catalog';

  watch(onGames: (games: CatalogGame[]) => void): Unsubscribe {
    const catalogRef = this.catalogDocument();

    // Carica immediatamente il catalogo locale offline asincrono all'avvio
    this.readLocal().then((games) => onGames(games));

    return onSnapshot(
      catalogRef,
      async (snapshot) => {
        const games = snapshot.exists()
          ? this.normalizeGames(snapshot.data())
          : await this.readLocal();

        onGames(games);
      },
      async () => {
        onGames(await this.readLocal());
      },
    );
  }

  async write(games: CatalogGame[]): Promise<void> {
    const normalizedGames = this.normalizeList(games);
    await this.writeLocal(normalizedGames);

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

  private async readLocal(): Promise<CatalogGame[]> {
    const storedGames = await this.db.get<CatalogGame[]>(this.storageKey());

    return storedGames ? this.normalizeList(storedGames) : this.defaultGames();
  }

  private async writeLocal(games: CatalogGame[]): Promise<void> {
    await this.db.set(this.storageKey(), games);
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
      releaseYear: clampNumber(game.releaseYear, 1970, 2035),
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

  private normalizeUrl(value: unknown): string {
    const url = String(value ?? '').trim();

    return url.startsWith('https://') ? url : '';
  }

  private storageKey(): string {
    return `${this.keyPrefix}:global`;
  }
}
