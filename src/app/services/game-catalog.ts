import { Injectable, signal } from '@angular/core';
import { MOCK_GAMES } from '../data/mock-games';
import { Game } from '../models/game';

@Injectable({
  providedIn: 'root'
})
export class GameCatalog {
  private readonly gamesState = signal<Game[]>(MOCK_GAMES);

  readonly games = this.gamesState.asReadonly();
}
