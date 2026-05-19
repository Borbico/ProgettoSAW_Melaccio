export type GameStatus = 'Wishlist' | 'Backlog' | 'In corso' | 'Completato';

export interface Game {
  id: string;
  title: string;
  genre: string;
  platform: string;
  releaseYear: number;
  status: GameStatus;
  rating: number;
  hoursPlayed: number;
  description: string;
  coverTheme: string;
}
