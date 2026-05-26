import { Game, GameStatus } from '../models/game';
import { gameStatusGroupLabel } from './status-labels';

export interface ShelfLane {
  status: GameStatus;
  title: string;
  games: Game[];
}

export const SHELF_STATUS_ORDER: GameStatus[] = ['Wishlist', 'Backlog', 'In corso', 'Completato'];

export const SHELF_LANE_ORDER: GameStatus[] = ['In corso', 'Backlog', 'Wishlist', 'Completato'];

export function buildShelfLanes(games: Game[]): ShelfLane[] {
  return SHELF_LANE_ORDER.map((status) => ({
    status,
    title: gameStatusGroupLabel(status),
    games: games.filter((game) => game.status === status),
  }));
}
