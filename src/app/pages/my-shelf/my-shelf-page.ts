import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game, GameStatus } from '../../models/game';
import { AccessControl } from '../../services/access-control';
import { AuthSession } from '../../services/auth-session';
import { GameCatalog, PersistenceResult } from '../../services/game-catalog';
import { NotificationCenter } from '../../services/notification-center';

interface ShelfLane {
  title: GameStatus;
  games: Game[];
}

@Component({
  selector: 'app-my-shelf-page',
  imports: [RouterLink],
  templateUrl: './my-shelf-page.html',
  styleUrl: './my-shelf-page.css',
})
export class MyShelfPage {
  private readonly access = inject(AccessControl);
  private readonly auth = inject(AuthSession);
  private readonly catalog = inject(GameCatalog);
  private readonly notifications = inject(NotificationCenter);

  protected readonly user = this.auth.currentUser;
  protected readonly displayName = this.auth.displayName;
  protected readonly canEditShelf = this.access.canEditShelf;
  protected readonly games = this.catalog.shelfGames;
  protected readonly lanes = computed<ShelfLane[]>(() => [
    { title: 'In corso', games: this.games().filter((game) => game.status === 'In corso') },
    { title: 'Backlog', games: this.games().filter((game) => game.status === 'Backlog') },
    { title: 'Wishlist', games: this.games().filter((game) => game.status === 'Wishlist') },
    { title: 'Completato', games: this.games().filter((game) => game.status === 'Completato') },
  ]);

  protected readonly activeGames = computed(
    () => this.games().filter((game) => game.status === 'In corso').length,
  );

  protected readonly plannedGames = computed(
    () =>
      this.games().filter((game) => game.status === 'Backlog' || game.status === 'Wishlist').length,
  );

  protected readonly completedGames = computed(
    () => this.games().filter((game) => game.status === 'Completato').length,
  );

  protected async setStatus(game: Game, status: GameStatus): Promise<void> {
    if (!this.canEditShelf()) {
      this.notifications.warning(
        'Accesso richiesto',
        'Accedi con un profilo per modificare la tua MyShelf.',
      );
      return;
    }

    const persistence = await this.catalog.updateStatus(game.id, status);

    this.notifyPersistence(
      persistence,
      'MyShelf aggiornata',
      `${game.title} spostato in ${status}.`,
    );
  }

  protected coverImageStyle(game: Game): string | null {
    const imageUrl = game.coverImageUrl?.trim();

    if (!imageUrl) {
      return null;
    }

    return `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.46)), url("${imageUrl}")`;
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
}
