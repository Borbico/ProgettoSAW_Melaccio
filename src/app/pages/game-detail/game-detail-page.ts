import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Game, GameStatus } from '../../models/game';
import { GameCatalog } from '../../services/game-catalog';

@Component({
  selector: 'app-game-detail-page',
  imports: [RouterLink],
  templateUrl: './game-detail-page.html',
  styleUrl: './game-detail-page.css'
})
export class GameDetailPage {
  private readonly catalog = inject(GameCatalog);
  private readonly route = inject(ActivatedRoute);
  private readonly gameId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' }
  );

  protected readonly statuses: GameStatus[] = ['Wishlist', 'Backlog', 'In corso', 'Completato'];
  protected readonly game = computed(() => this.catalog.findById(this.gameId()));

  protected setStatus(game: Game, status: GameStatus): void {
    this.catalog.updateStatus(game.id, status);
  }

  protected ratingStars(game: Game): string {
    return game.rating === 0 ? 'Da valutare' : '\u2605'.repeat(game.rating);
  }
}
