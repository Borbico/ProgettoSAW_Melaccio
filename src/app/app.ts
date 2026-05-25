import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccessControl } from './services/access-control';
import { AuthSession } from './services/auth-session';
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
  private readonly auth = inject(AuthSession);
  private readonly notificationCenter = inject(NotificationCenter);
  private readonly pwa = inject(PwaService);
  private readonly router = inject(Router);

  protected readonly appName = 'GameShelf';
  protected readonly user = this.auth.currentUser;
  protected readonly authReady = this.auth.authReady;
  protected readonly canEditShelf = this.access.canEditShelf;
  protected readonly notifications = this.notificationCenter.notifications;

  protected dismissNotification(id: number): void {
    this.notificationCenter.dismiss(id);
  }

  protected async quickSignOut(): Promise<void> {
    try {
      await this.auth.signOut();
      this.notificationCenter.info('Sessione terminata', 'Sei tornato alla modalita ospite.');

      if (this.router.url.startsWith('/myshelf')) {
        await this.router.navigate(['/catalogo']);
      }
    } catch {
      this.notificationCenter.error('Logout non riuscito', 'Riprova tra qualche secondo.');
    }
  }
}
