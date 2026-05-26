import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccessControl } from './services/access-control';
import { NotificationCenter } from './services/notification-center';
import { PwaService } from './services/pwa';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly access = inject(AccessControl);
  private readonly notificationCenter = inject(NotificationCenter);
  private readonly pwa = inject(PwaService);

  protected readonly appName = 'GameShelf';
  protected readonly canEditShelf = this.access.canEditShelf;
  protected readonly notifications = this.notificationCenter.notifications;

  protected dismissNotification(id: number): void {
    this.notificationCenter.dismiss(id);
  }
}
