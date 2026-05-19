import { GameStatus } from './game';

export interface ShelfEntry {
  status: GameStatus;
  rating: number;
  hoursPlayed: number;
  progress: number;
  notes: string;
  personalGoal: string;
}
