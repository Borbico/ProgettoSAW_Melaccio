import { Injectable, signal } from '@angular/core';

export interface RawgGameSummary {
  rawgId: number;
  title: string;
  releaseYear: number;
  genres: string[];
  platforms: string[];
  coverImageUrl: string;
  sourceUrl: string;
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
  private readonly baseUrl = 'https://api.rawg.io/api';
  private readonly apiKeyStorageKey = 'gameshelf:rawg-api-key';
  private readonly apiKeyState = signal(this.readApiKey());

  readonly apiKeyConfigured = signal(Boolean(this.apiKeyState()));

  setApiKey(apiKey: string): void {
    const normalizedKey = apiKey.trim();

    if (!normalizedKey) {
      return;
    }

    if (this.hasStorage()) {
      localStorage.setItem(this.apiKeyStorageKey, normalizedKey);
    }

    this.apiKeyState.set(normalizedKey);
    this.apiKeyConfigured.set(true);
  }

  clearApiKey(): void {
    if (this.hasStorage()) {
      localStorage.removeItem(this.apiKeyStorageKey);
    }

    this.apiKeyState.set('');
    this.apiKeyConfigured.set(false);
  }

  async searchGames(query: string): Promise<RawgGameSummary[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const url = this.rawgUrl('/games', {
      search: normalizedQuery,
      page_size: '6',
      ordering: '-metacritic',
    });
    const data = await this.fetchJson<RawgSearchResponse>(url);

    return (data.results ?? [])
      .map((game) => this.mapSummary(game))
      .filter((game): game is RawgGameSummary => Boolean(game));
  }

  async getGameDetails(rawgId: number): Promise<RawgImportedGame> {
    const data = await this.fetchJson<RawgGameDetail>(this.rawgUrl(`/games/${rawgId}`));

    return this.mapImportedGame(data);
  }

  private rawgUrl(path: string, params: Record<string, string> = {}): URL {
    const apiKey = this.apiKeyState().trim();

    if (!apiKey) {
      throw new Error('RAWG_API_KEY_MISSING');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('key', apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await fetch(url.toString());

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
    return (items ?? [])
      .map((item) => item.name?.trim() ?? '')
      .filter(Boolean);
  }

  private platformNames(items: RawgPlatformItem[] | undefined): string[] {
    return (items ?? [])
      .map((item) => item.platform?.name?.trim() ?? '')
      .filter(Boolean);
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

  private readApiKey(): string {
    if (!this.hasStorage()) {
      return '';
    }

    return localStorage.getItem(this.apiKeyStorageKey)?.trim() ?? '';
  }

  private hasStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
