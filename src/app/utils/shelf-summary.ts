import { CatalogGame } from '../models/catalog-game';
import { Game } from '../models/game';
import { PublicShelfGameSummary, PublicShelfSummary } from '../models/public-shelf-summary';
import { ShelfEntry } from '../models/shelf-entry';
import { updatedAtTime } from './number-utils';

export function composeShelfGames(
  catalogGames: CatalogGame[],
  entries: Record<string, ShelfEntry>,
): Game[] {
  return catalogGames.flatMap((game) => {
    const entry = entries[game.id];

    return entry ? [{ ...game, ...entry }] : [];
  });
}

export function publicShelfSummary(games: Game[]): PublicShelfSummary {
  const recentGames = [...games]
    .sort((first, second) => updatedAtTime(second) - updatedAtTime(first))
    .slice(0, 3)
    .map((game) => publicShelfGameSummary(game));

  return {
    savedCount: games.length,
    activeCount: games.filter((game) => game.status === 'In corso').length,
    completedCount: games.filter((game) => game.status === 'Completato').length,
    totalHours: games.reduce((total, game) => total + game.hoursPlayed, 0),
    lastActivityAt: recentGames[0]?.updatedAt ?? '',
    recentGames,
  };
}

export function publicShelfGameSummary(game: Game): PublicShelfGameSummary {
  return {
    id: game.id,
    title: game.title,
    status: game.status,
    rating: game.rating,
    hoursPlayed: game.hoursPlayed,
    progress: game.progress,
    ...(game.updatedAt ? { updatedAt: game.updatedAt } : {}),
  };
}

export function alignSummaryWithCatalog(
  summary: PublicShelfSummary,
  catalogGames: CatalogGame[],
): PublicShelfSummary {
  const titlesById = new Map(catalogGames.map((game) => [game.id, game.title]));

  return {
    ...summary,
    recentGames: summary.recentGames
      .filter((game) => titlesById.has(game.id))
      .map((game) => ({
        ...game,
        title: titlesById.get(game.id) ?? game.title,
      })),
  };
}
