import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CatalogGame } from '../../models/catalog-game';
import { Game, GameStatus } from '../../models/game';
import { ShelfEntry } from '../../models/shelf-entry';
import { AccessControl } from '../../services/access-control';
import { GameCatalog, PersistenceResult } from '../../services/game-catalog';
import { NotificationCenter, NotificationTone } from '../../services/notification-center';

@Component({
  selector: 'app-game-detail-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './game-detail-page.html',
  styleUrl: './game-detail-page.css',
})
export class GameDetailPage {
  private readonly access = inject(AccessControl);
  private readonly catalog = inject(GameCatalog);
  private readonly notifications = inject(NotificationCenter);
  private readonly route = inject(ActivatedRoute);
  private readonly gameId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly statuses: GameStatus[] = ['Wishlist', 'Backlog', 'In corso', 'Completato'];
  protected readonly canEditShelf = this.access.canEditShelf;
  protected readonly roleLabel = this.access.roleLabel;
  protected readonly game = computed(() => this.catalog.findCatalogById(this.gameId()));
  protected readonly shelfGame = computed(() => this.catalog.findShelfById(this.gameId()));
  protected readonly draftGameId = signal('');
  protected readonly draftStatus = signal<GameStatus>('Wishlist');
  protected readonly draftHoursPlayed = signal(0);
  protected readonly draftRating = signal(0);
  protected readonly draftProgress = signal(0);
  protected readonly draftNotes = signal('');
  protected readonly draftPersonalGoal = signal('');
  protected readonly draftDirty = signal(false);
  protected readonly saveMessage = signal('');
  protected readonly saveMessageTone = signal<NotificationTone>('info');
  protected readonly savingShelf = signal(false);

  constructor() {
    effect(() => {
      const catalogGame = this.game();

      if (!catalogGame) {
        return;
      }

      const game = this.shelfGame() ?? this.gameWithDefaultShelf(catalogGame);
      const switchedGame = this.draftGameId() !== game.id;

      if (switchedGame || !this.draftDirty()) {
        this.loadDraft(game, switchedGame);
      }
    });
  }

  protected setDraftStatus(status: GameStatus): void {
    if (!this.ensureShelfPermission()) {
      return;
    }

    this.draftStatus.set(status);
    this.markDraftDirty();
  }

  protected updateDraftProgress(progress: number | string): void {
    if (!this.canEditShelf()) {
      return;
    }

    this.draftProgress.set(this.clampNumber(progress, 0, 100));
    this.markDraftDirty();
  }

  protected updateDraftHours(hoursPlayed: number | string): void {
    if (!this.canEditShelf()) {
      return;
    }

    this.draftHoursPlayed.set(this.clampNumber(hoursPlayed, 0, 999));
    this.markDraftDirty();
  }

  protected updateDraftRating(rating: number | string): void {
    if (!this.canEditShelf()) {
      return;
    }

    this.draftRating.set(this.clampNumber(rating, 0, 5));
    this.markDraftDirty();
  }

  protected updateDraftNotes(notes: string): void {
    if (!this.canEditShelf()) {
      return;
    }

    this.draftNotes.set(notes);
    this.markDraftDirty();
  }

  protected updateDraftPersonalGoal(personalGoal: string): void {
    if (!this.canEditShelf()) {
      return;
    }

    this.draftPersonalGoal.set(personalGoal);
    this.markDraftDirty();
  }

  protected async saveShelfEntry(game: CatalogGame): Promise<void> {
    if (this.savingShelf()) {
      return;
    }

    if (!this.ensureShelfPermission()) {
      return;
    }

    this.savingShelf.set(true);
    this.saveMessageTone.set('info');
    this.saveMessage.set('Salvataggio in corso...');

    try {
      const persistence = await this.catalog.updateShelfEntry(game.id, this.draftEntry());

      if (persistence === 'denied') {
        this.saveMessageTone.set('error');
        this.saveMessage.set('Accedi per salvare modifiche su MyShelf.');
        this.notifyPersistence(persistence, 'MyShelf', `${game.title} non e stato aggiornato.`);
        return;
      }

      this.draftDirty.set(false);
      this.setSaveFeedback(persistence);
      this.notifyPersistence(
        persistence,
        'MyShelf aggiornata',
        `${game.title} e stato aggiornato.`,
      );
    } catch {
      this.saveMessageTone.set('error');
      this.saveMessage.set('Salvataggio non riuscito.');
      this.notifications.error(
        'Salvataggio non riuscito',
        'Non e stato possibile aggiornare la tua MyShelf. Riprova tra qualche secondo.',
      );
    } finally {
      this.savingShelf.set(false);
    }
  }

  protected resetDraft(game: CatalogGame): void {
    const shelfGame = this.shelfGame() ?? this.gameWithDefaultShelf(game);

    this.loadDraft(shelfGame);
    this.saveMessageTone.set('info');
    this.saveMessage.set('Modifiche annullate.');
    this.notifications.info('Modifiche annullate', `${game.title} e tornato ai valori salvati.`);
  }

  protected draftRatingStars(): string {
    const rating = this.draftRating();

    return rating === 0 ? 'Da valutare' : '\u2605'.repeat(rating);
  }

  protected coverImageStyle(game: CatalogGame): string | null {
    const imageUrl = game.coverImageUrl?.trim();

    if (!imageUrl) {
      return null;
    }

    return `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.46)), url("${imageUrl}")`;
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
      this.saveMessageTone.set('info');
      this.saveMessage.set('');
    }
  }

  private gameWithDefaultShelf(game: CatalogGame): Game {
    return {
      ...game,
      status: 'Wishlist',
      rating: 0,
      hoursPlayed: 0,
      progress: 0,
      notes: '',
      personalGoal: '',
    };
  }

  private draftEntry(): ShelfEntry {
    return {
      status: this.draftStatus(),
      rating: this.draftRating(),
      hoursPlayed: this.draftHoursPlayed(),
      progress: this.draftProgress(),
      notes: this.draftNotes(),
      personalGoal: this.draftPersonalGoal(),
    };
  }

  private markDraftDirty(): void {
    this.draftDirty.set(true);
    this.saveMessage.set('');
  }

  private notifyPersistence(
    persistence: PersistenceResult,
    successTitle: string,
    successMessage: string,
  ): void {
    if (persistence === 'firebase') {
      this.notifications.success(successTitle, `${successMessage} Salvato su Firebase.`);
      return;
    }

    if (persistence === 'fallback') {
      this.notifications.warning(
        'Salvataggio locale',
        `${successMessage} Firebase non ha risposto: la copia locale e aggiornata.`,
      );
      return;
    }

    if (persistence === 'denied') {
      this.notifications.error(
        'Accesso richiesto',
        'Accedi con un profilo per modificare la tua MyShelf.',
      );
      return;
    }

    this.notifications.info(successTitle, `${successMessage} Salvataggio locale attivo.`);
  }

  private setSaveFeedback(persistence: PersistenceResult): void {
    if (persistence === 'firebase') {
      this.saveMessageTone.set('success');
      this.saveMessage.set('Modifiche salvate su Firebase.');
      return;
    }

    if (persistence === 'fallback') {
      this.saveMessageTone.set('warning');
      this.saveMessage.set('Firebase non ha risposto: copia locale aggiornata.');
      return;
    }

    this.saveMessageTone.set('info');
    this.saveMessage.set('Modifiche salvate in locale.');
  }

  private ensureShelfPermission(): boolean {
    if (this.canEditShelf()) {
      return true;
    }

    this.saveMessageTone.set('warning');
    this.saveMessage.set('Accedi per modificare la tua MyShelf.');
    this.notifications.warning(
      'Accesso richiesto',
      'Gli ospiti possono consultare il catalogo, ma non salvare modifiche personali.',
    );

    return false;
  }

  private clampNumber(value: number | string, min: number, max: number): number {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return min;
    }

    return Math.min(max, Math.max(min, Math.round(numericValue)));
  }
}
