import { Injectable, inject, signal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseClient } from './firebase-client';

export interface RawgGameSummary {
  rawgId: number;
  title: string;
  releaseYear: number;
  genres: string[];
  platforms: string[];
  coverImageUrl: string;
  sourceUrl: string;
}

export interface RawgSearchResult {
  games: RawgGameSummary[];
  hasMore: boolean;
  page: number;
  total: number;
}

export interface RawgImportedGame {
  title: string;
  developer: string;
  publisher: string;
  genre: string;
  platform: string;
  modes: string[];
  tags: string[];
  releaseYear: number;
  description: string;
  coverImageUrl: string;
  sourceName: string;
  sourceUrl: string;
}

interface RawgNamedItem {
  name?: string;
}

interface RawgPlatformItem {
  platform?: RawgNamedItem;
}

interface RawgGameListItem {
  id?: number;
  slug?: string;
  name?: string;
  released?: string;
  background_image?: string;
  genres?: RawgNamedItem[];
  platforms?: RawgPlatformItem[];
}

interface RawgSearchResponse {
  count?: number;
  next?: string | null;
  results?: RawgGameListItem[];
}

interface RawgGameDetail extends RawgGameListItem {
  description_raw?: string;
  developers?: RawgNamedItem[];
  publishers?: RawgNamedItem[];
  tags?: RawgNamedItem[];
}

@Injectable({
  providedIn: 'root',
})
export class RawgGames {
  private readonly firebase = inject(FirebaseClient);
  private readonly baseUrl = 'https://api.rawg.io/api';
  private readonly apiKeyState = signal('');
  private remoteApiKeyRequest: Promise<string> | null = null;

  readonly apiKeyConfigured = signal(Boolean(this.apiKeyState()));

  async searchGames(query: string, page = 1, pageSize = 12): Promise<RawgSearchResult> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return {
        games: [],
        hasMore: false,
        page,
        total: 0,
      };
    }

    const url = this.rawgUrl('/games', {
      search: normalizedQuery,
      page: String(page),
      page_size: String(pageSize),
      search_precise: 'true',
    });
    const data = await this.fetchJson<RawgSearchResponse>(url);

    return {
      games: (data.results ?? [])
        .map((game) => this.mapSummary(game))
        .filter((game): game is RawgGameSummary => Boolean(game)),
      hasMore: Boolean(data.next),
      page,
      total: data.count ?? 0,
    };
  }

  async getGameDetails(rawgId: number): Promise<RawgImportedGame> {
    const data = await this.fetchJson<RawgGameDetail>(this.rawgUrl(`/games/${rawgId}`));

    return this.mapImportedGame(data);
  }

  private rawgUrl(path: string, params: Record<string, string> = {}): URL {
    const url = new URL(`${this.baseUrl}${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url;
  }

  private async apiKey(): Promise<string> {
    const localApiKey = this.apiKeyState().trim();

    if (localApiKey) {
      return localApiKey;
    }

    if (!this.remoteApiKeyRequest) {
      this.remoteApiKeyRequest = this.readRemoteApiKey();
    }

    let remoteApiKey = '';

    try {
      remoteApiKey = await this.remoteApiKeyRequest;
    } catch {
      this.remoteApiKeyRequest = null;
      throw new Error('RAWG_API_KEY_UNAVAILABLE');
    }

    if (!remoteApiKey) {
      this.remoteApiKeyRequest = null;
      throw new Error('RAWG_API_KEY_MISSING');
    }

    this.apiKeyState.set(remoteApiKey);
    this.apiKeyConfigured.set(true);

    return remoteApiKey;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    url.searchParams.set('key', await this.apiKey());

    let response: Response;

    try {
      response = await fetch(url.toString());
    } catch {
      throw new Error('RAWG_NETWORK_UNAVAILABLE');
    }

    if (!response.ok) {
      throw new Error(`RAWG_REQUEST_FAILED_${response.status}`);
    }

    return (await response.json()) as T;
  }

  private mapSummary(game: RawgGameListItem): RawgGameSummary | null {
    if (!game.id || !game.name) {
      return null;
    }

    return {
      rawgId: game.id,
      title: game.name,
      releaseYear: this.releaseYear(game.released),
      genres: this.names(game.genres).slice(0, 3),
      platforms: this.platformNames(game.platforms).slice(0, 4),
      coverImageUrl: this.httpsUrl(game.background_image),
      sourceUrl: this.sourceUrl(game.slug),
    };
  }

  private mapImportedGame(game: RawgGameDetail): RawgImportedGame {
    const tags = this.names(game.tags).slice(0, 6);

    return {
      title: game.name?.trim() || 'Gioco RAWG',
      developer: this.joinOrFallback(this.names(game.developers), 'Sviluppatore non indicato'),
      publisher: this.joinOrFallback(this.names(game.publishers), 'Publisher non indicato'),
      genre: this.names(game.genres)[0] ?? 'Altro',
      platform: this.joinOrFallback(this.platformNames(game.platforms).slice(0, 4), 'PC'),
      modes: this.inferModes(tags),
      tags: tags.length ? tags : this.names(game.genres).slice(0, 4),
      releaseYear: this.releaseYear(game.released),
      description: this.shortDescription(game.description_raw),
      coverImageUrl: this.httpsUrl(game.background_image),
      sourceName: 'RAWG',
      sourceUrl: this.sourceUrl(game.slug),
    };
  }

  private names(items: RawgNamedItem[] | undefined): string[] {
    return (items ?? []).map((item) => item.name?.trim() ?? '').filter(Boolean);
  }

  private platformNames(items: RawgPlatformItem[] | undefined): string[] {
    return (items ?? []).map((item) => item.platform?.name?.trim() ?? '').filter(Boolean);
  }

  private inferModes(tags: string[]): string[] {
    const normalizedTags = tags.map((tag) => tag.toLowerCase());
    const modes = ['Single player'];

    if (normalizedTags.some((tag) => tag.includes('multiplayer'))) {
      modes.push('Multiplayer');
    }

    if (normalizedTags.some((tag) => tag.includes('co-op') || tag.includes('coop'))) {
      modes.push('Co-op');
    }

    return modes;
  }

  private releaseYear(value: string | undefined): number {
    const year = Number(value?.slice(0, 4));

    if (Number.isNaN(year)) {
      return new Date().getFullYear();
    }

    return Math.min(2035, Math.max(1970, year));
  }

  private sourceUrl(slug: string | undefined): string {
    return slug ? `https://rawg.io/games/${slug}` : 'https://rawg.io/';
  }

  private shortDescription(value: string | undefined): string {
    const description = (value ?? '').replace(/\s+/g, ' ').trim();

    if (!description) {
      return 'Descrizione importata da RAWG da completare prima del salvataggio.';
    }

    return description.length > 420 ? `${description.slice(0, 417).trim()}...` : description;
  }

  private joinOrFallback(items: string[], fallback: string): string {
    return items.length ? items.slice(0, 2).join(', ') : fallback;
  }

  private httpsUrl(value: string | undefined): string {
    const url = value?.trim() ?? '';

    return url.startsWith('https://') ? url : '';
  }

  private async readRemoteApiKey(): Promise<string> {
    const snapshot = await getDoc(doc(this.firebase.db, 'integrations', 'rawg'));
    const apiKey = snapshot.data()?.['apiKey'];

    return typeof apiKey === 'string' ? apiKey.trim() : '';
  }
}
