import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

  protected readonly appName = 'GameShelf';
  protected readonly canEditShelf = this.access.canEditShelf;
  protected readonly notifications = this.notificationCenter.notifications;
  protected readonly online = this.pwa.online;
  protected readonly pendingSyncCount = this.catalog.pendingSyncCount;

  protected dismissNotification(id: number): void {
    this.notificationCenter.dismiss(id);
  }

  protected pendingSyncLabel(): string {
    const count = this.pendingSyncCount();

    return count === 1 ? '1 in coda' : `${count} in coda`;
  }
}
