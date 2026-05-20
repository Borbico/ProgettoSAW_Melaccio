import { Game } from './game';
import { ShelfEntry } from './shelf-entry';

export type CatalogGame = Omit<Game, keyof ShelfEntry>;

export function toCatalogGame(game: Game): CatalogGame {
  const { status, rating, hoursPlayed, progress, notes, personalGoal, ...catalogGame } = game;

  return catalogGame;
}

export function toShelfEntry(game: Game): ShelfEntry {
  return {
    status: game.status,
    rating: game.rating,
    hoursPlayed: game.hoursPlayed,
    progress: game.progress,
    notes: game.notes,
    personalGoal: game.personalGoal
  };
}
