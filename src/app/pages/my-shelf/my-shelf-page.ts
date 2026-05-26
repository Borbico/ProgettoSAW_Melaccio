import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game, GameStatus } from '../../models/game';
import { AccessControl } from '../../services/access-control';
import { AuthSession } from '../../services/auth-session';
import { GameCatalog } from '../../services/game-catalog';
import type { PersistenceResult } from '../../services/game-catalog';
import { NotificationCenter } from '../../services/notification-center';
import { coverImageStyle } from '../../utils/cover-image-style';
import { notifyPersistenceResult } from '../../utils/persistence-feedback';
import { buildShelfLanes, SHELF_STATUS_ORDER } from '../../utils/shelf-lanes';
import { gameStatusActionLabel, gameStatusGroupLabel } from '../../utils/status-labels';

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
  protected readonly hasShelfGames = computed(() => this.games().length > 0);
  protected readonly statuses: GameStatus[] = SHELF_STATUS_ORDER;
  protected readonly lanes = computed(() => buildShelfLanes(this.games()));

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
      `${game.title} si trova ora nella sezione ${gameStatusGroupLabel(status)}.`,
    );
  }

  protected statusActionLabel(status: GameStatus): string {
    return gameStatusActionLabel(status);
  }

  protected coverImageStyle(game: Game): string | null {
    return coverImageStyle(game);
  }

  private notifyPersistence(
    persistence: PersistenceResult,
    successTitle: string,
    successMessage: string,
  ): void {
    notifyPersistenceResult(this.notifications, persistence, successTitle, successMessage, {
      deniedTitle: 'Accesso richiesto',
      deniedMessage: 'Accedi con un profilo per modificare la tua MyShelf.',
    });
  }
}
