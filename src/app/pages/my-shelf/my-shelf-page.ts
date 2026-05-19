import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game, GameStatus } from '../../models/game';
import { AuthSession } from '../../services/auth-session';
import { GameCatalog } from '../../services/game-catalog';

interface ShelfLane {
  title: GameStatus;
  games: Game[];
}

@Component({
  selector: 'app-my-shelf-page',
  imports: [RouterLink],
  templateUrl: './my-shelf-page.html',
  styleUrl: './my-shelf-page.css'
})
export class MyShelfPage {
  private readonly auth = inject(AuthSession);
  private readonly catalog = inject(GameCatalog);

  protected readonly user = this.auth.currentUser;
  protected readonly displayName = this.auth.displayName;
  protected readonly games = this.catalog.games;
  protected readonly lanes = computed<ShelfLane[]>(() => [
    { title: 'In corso', games: this.games().filter((game) => game.status === 'In corso') },
    { title: 'Backlog', games: this.games().filter((game) => game.status === 'Backlog') },
    { title: 'Wishlist', games: this.games().filter((game) => game.status === 'Wishlist') },
    { title: 'Completato', games: this.games().filter((game) => game.status === 'Completato') }
  ]);

  protected readonly activeGames = computed(
    () => this.games().filter((game) => game.status === 'In corso').length
  );

  protected readonly plannedGames = computed(
    () => this.games().filter((game) => game.status === 'Backlog' || game.status === 'Wishlist').length
  );

  protected readonly completedGames = computed(
    () => this.games().filter((game) => game.status === 'Completato').length
  );

  protected setStatus(game: Game, status: GameStatus): void {
    this.catalog.updateStatus(game.id, status);
  }
}
