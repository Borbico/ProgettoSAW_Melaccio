export type GameStatus = 'Wishlist' | 'Backlog' | 'In corso' | 'Completato';

export interface Game {
  id: string;
  title: string;
  developer: string;
  publisher: string;
  genre: string;
  platform: string;
  modes: string[];
  tags: string[];
  releaseYear: number;
  status: GameStatus;
  rating: number;
  hoursPlayed: number;
  progress: number;
  description: string;
  notes: string;
  personalGoal: string;
  coverTheme: string;
  coverImageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
}
