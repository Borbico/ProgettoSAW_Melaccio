import { Game } from './game';
import { ShelfEntry } from './shelf-entry';

export type CatalogGame = Omit<Game, keyof ShelfEntry>;

export function toCatalogGame(game: Game | CatalogGame): CatalogGame {
  const catalogGame: CatalogGame = {
    id: game.id,
    title: game.title,
    developer: game.developer,
    publisher: game.publisher,
    genre: game.genre,
    platform: game.platform,
    modes: game.modes,
    tags: game.tags,
    releaseYear: game.releaseYear,
    description: game.description,
    coverTheme: game.coverTheme,
  };

  if (game.coverImageUrl) {
    catalogGame.coverImageUrl = game.coverImageUrl;
  }

  if (game.sourceName && game.sourceUrl) {
    catalogGame.sourceName = game.sourceName;
    catalogGame.sourceUrl = game.sourceUrl;
  }

  return catalogGame;
}

export function toShelfEntry(game: Game): ShelfEntry {
  return {
    status: game.status,
    rating: game.rating,
    hoursPlayed: game.hoursPlayed,
    progress: game.progress,
    notes: game.notes,
    personalGoal: game.personalGoal,
  };
}
