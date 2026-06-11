import { Component, inject, effect } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationError } from '@angular/router';
import { AccessControl } from './services/access-control';
import { GameCatalog } from './services/game-catalog';
import { NotificationCenter } from './services/notification-center';
import { PwaService } from './services/pwa';
import { SocialNotificationService } from './services/social-notification-service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly access = inject(AccessControl);
  private readonly catalog = inject(GameCatalog);
  private readonly notificationCenter = inject(NotificationCenter);
  private readonly pwa = inject(PwaService);
  private readonly socialNotifications = inject(SocialNotificationService);
  private readonly router = inject(Router);

  protected readonly appName = 'GameShelf';
  protected readonly canEditShelf = this.access.canEditShelf;
  protected readonly notifications = this.notificationCenter.notifications;
  protected readonly online = this.pwa.online;
  protected readonly pendingSyncCount = this.catalog.pendingSyncCount;

  constructor() {
    let hasChunkLoadError = false;

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationError) {
        hasChunkLoadError = true;
        if (!this.online()) {
          this.notificationCenter.error(
            'Navigazione non disponibile',
            'Sei offline. Non è possibile caricare questa pagina perché non è memorizzata in cache.'
          );
        } else {
          this.notificationCenter.error(
            'Errore di caricamento',
            'Si è verificato un errore durante il caricamento della pagina. Ricarico per ripristinare...'
          );
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    });

    effect(() => {
      if (this.online() && hasChunkLoadError) {
        window.location.reload();
      }
    });
  }

  protected dismissNotification(id: number): void {
    this.notificationCenter.dismiss(id);
  }

  protected pendingSyncLabel(): string {
    const count = this.pendingSyncCount();

    return count === 1 ? '1 in coda' : `${count} in coda`;
  }
}
