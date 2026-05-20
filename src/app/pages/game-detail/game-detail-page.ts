import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Game, GameStatus } from '../../models/game';
import { ShelfEntry } from '../../models/shelf-entry';
import { GameCatalog } from '../../services/game-catalog';

@Component({
  selector: 'app-game-detail-page',
  imports: [FormsModule, RouterLink],
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
  protected readonly draftGameId = signal('');
  protected readonly draftStatus = signal<GameStatus>('Wishlist');
  protected readonly draftHoursPlayed = signal(0);
  protected readonly draftRating = signal(0);
  protected readonly draftProgress = signal(0);
  protected readonly draftNotes = signal('');
  protected readonly draftPersonalGoal = signal('');
  protected readonly draftDirty = signal(false);
  protected readonly saveMessage = signal('');

  constructor() {
    effect(() => {
      const game = this.game();

      if (!game) {
        return;
      }

      const switchedGame = this.draftGameId() !== game.id;

      if (switchedGame || !this.draftDirty()) {
        this.loadDraft(game, switchedGame);
      }
    });
  }

  protected setDraftStatus(status: GameStatus): void {
    this.draftStatus.set(status);
    this.markDraftDirty();
  }

  protected updateDraftProgress(progress: number | string): void {
    this.draftProgress.set(this.clampNumber(progress, 0, 100));
    this.markDraftDirty();
  }

  protected updateDraftHours(hoursPlayed: number | string): void {
    this.draftHoursPlayed.set(this.clampNumber(hoursPlayed, 0, 999));
    this.markDraftDirty();
  }

  protected updateDraftRating(rating: number | string): void {
    this.draftRating.set(this.clampNumber(rating, 0, 5));
    this.markDraftDirty();
  }

  protected updateDraftNotes(notes: string): void {
    this.draftNotes.set(notes);
    this.markDraftDirty();
  }

  protected updateDraftPersonalGoal(personalGoal: string): void {
    this.draftPersonalGoal.set(personalGoal);
    this.markDraftDirty();
  }

  protected saveShelfEntry(game: Game): void {
    this.catalog.updateShelfEntry(game.id, this.draftEntry());
    this.draftDirty.set(false);
    this.saveMessage.set('Modifiche salvate su MyShelf.');
  }

  protected resetDraft(game: Game): void {
    this.loadDraft(game);
    this.saveMessage.set('Modifiche annullate.');
  }

  protected ratingStars(game: Game): string {
    return game.rating === 0 ? 'Da valutare' : '\u2605'.repeat(game.rating);
  }

  protected draftRatingStars(): string {
    const rating = this.draftRating();

    return rating === 0 ? 'Da valutare' : '\u2605'.repeat(rating);
  }

  private loadDraft(game: Game, clearMessage = true): void {
    this.draftGameId.set(game.id);
    this.draftStatus.set(game.status);
    this.draftHoursPlayed.set(game.hoursPlayed);
    this.draftRating.set(game.rating);
    this.draftProgress.set(game.progress);
    this.draftNotes.set(game.notes);
    this.draftPersonalGoal.set(game.personalGoal);
    this.draftDirty.set(false);

    if (clearMessage) {
      this.saveMessage.set('');
    }
  }

  private draftEntry(): ShelfEntry {
    return {
      status: this.draftStatus(),
      rating: this.draftRating(),
      hoursPlayed: this.draftHoursPlayed(),
      progress: this.draftProgress(),
      notes: this.draftNotes(),
      personalGoal: this.draftPersonalGoal()
    };
  }

  private markDraftDirty(): void {
    this.draftDirty.set(true);
    this.saveMessage.set('');
  }

  private clampNumber(value: number | string, min: number, max: number): number {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return min;
    }

    return Math.min(max, Math.max(min, Math.round(numericValue)));
  }
}
