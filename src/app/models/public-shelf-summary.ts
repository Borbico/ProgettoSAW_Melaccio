import { GameStatus } from './game';

export interface PublicShelfGameSummary {
  id: string;
  title: string;
  status: GameStatus;
  rating: number;
  hoursPlayed: number;
  progress: number;
  updatedAt?: string;
}

export interface PublicShelfSummary {
  savedCount: number;
  activeCount: number;
  completedCount: number;
  totalHours: number;
  lastActivityAt: string;
  recentGames: PublicShelfGameSummary[];
}

export function emptyPublicShelfSummary(): PublicShelfSummary {
  return {
    savedCount: 0,
    activeCount: 0,
    completedCount: 0,
    totalHours: 0,
    lastActivityAt: '',
    recentGames: [],
  };
}
