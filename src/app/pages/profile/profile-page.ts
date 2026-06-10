import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSession } from '../../services/auth-session';
import { AccessControl } from '../../services/access-control';
import { GameCatalog } from '../../services/game-catalog';
import { NotificationCenter, NotificationTone } from '../../services/notification-center';
import { PwaService } from '../../services/pwa';
import { MyShelfPage } from '../my-shelf/my-shelf-page';

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, MyShelfPage],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage {
  private readonly access = inject(AccessControl);
  private readonly auth = inject(AuthSession);
  private readonly catalog = inject(GameCatalog);
  private readonly notifications = inject(NotificationCenter);
  private readonly pwa = inject(PwaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;
  protected readonly authReady = this.auth.authReady;
  protected readonly roleLabel = this.access.roleLabel;
  protected readonly canEditCatalog = this.access.canEditCatalog;
  protected readonly pwaSupported = this.pwa.supported;
  protected readonly pwaInstallable = this.pwa.installable;
  protected readonly pwaStandalone = this.pwa.standalone;
  protected readonly pwaOnline = this.pwa.online;
  protected readonly notificationPermission = this.pwa.notificationPermission;
  protected readonly signInEmail = signal('');
  protected readonly signInPassword = signal('');
  protected readonly registerName = signal('');
  protected readonly registerEmail = signal('');
  protected readonly registerPassword = signal('');
  protected readonly authMessage = signal('');
  protected readonly authMessageTone = signal<NotificationTone>('info');
  protected readonly signInBusy = signal(false);
  protected readonly registerBusy = signal(false);
  protected readonly authBusy = computed(() => this.signInBusy() || this.registerBusy());
  protected readonly games = this.catalog.shelfGames;
  protected readonly favoriteGenres = computed(() => {
    const counts = this.games().reduce<Record<string, number>>((genres, game) => {
      genres[game.genre] = (genres[game.genre] ?? 0) + 1;
      return genres;
    }, {});

    return Object.entries(counts)
      .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
      .slice(0, 3)
      .map(([genre]) => genre);
  });
  protected readonly favoriteGenreLabel = computed(() => {
    const genres = this.favoriteGenres();

    return genres.length ? genres.join(', ') : 'Da scoprire';
  });

  protected readonly totalHours = computed(() =>
    this.games().reduce((total, game) => total + game.hoursPlayed, 0),
  );
  protected readonly pwaStatusLabel = computed(() => {
    const connection = this.pwaSupported()
      ? this.pwaOnline()
        ? 'online'
        : 'offline'
      : 'non supportata';
    const install = this.pwaStandalone() ? 'installata' : 'browser';

    return `${connection} / ${install} / notifiche ${this.notificationPermission()}`;
  });

  protected updateSignInEmail(email: string): void {
    this.signInEmail.set(email);
  }

  protected updateSignInPassword(password: string): void {
    this.signInPassword.set(password);
  }

  protected updateRegisterName(displayName: string): void {
    this.registerName.set(displayName);
  }

  protected updateRegisterEmail(email: string): void {
    this.registerEmail.set(email);
  }

  protected updateRegisterPassword(password: string): void {
    this.registerPassword.set(password);
  }

  protected async signIn(): Promise<void> {
    if (this.authBusy()) {
      return;
    }

    if (!this.signInEmail().trim() || !this.signInPassword()) {
      this.setAuthFeedback('warning', 'Inserisci email e password.');
      return;
    }

    this.signInBusy.set(true);

    try {
      await this.auth.signIn(this.signInEmail(), this.signInPassword());
      this.setAuthFeedback('success', 'Accesso effettuato.');
      this.signInPassword.set('');
      await this.redirectAfterAuth();
    } catch {
      this.setAuthFeedback('error', 'Accesso non riuscito. Controlla email e password.');
    } finally {
      this.signInBusy.set(false);
    }
  }

  protected async register(): Promise<void> {
    if (this.authBusy()) {
      return;
    }

    if (!this.registerEmail().trim() || this.registerPassword().length < 6) {
      this.setAuthFeedback(
        'warning',
        'Inserisci una email valida e una password di almeno 6 caratteri.',
      );
      return;
    }

    this.registerBusy.set(true);

    try {
      await this.auth.register(this.registerName(), this.registerEmail(), this.registerPassword());
      this.registerName.set('');
      this.registerEmail.set('');
      this.registerPassword.set('');
      this.setAuthFeedback('success', 'Profilo creato.');
      await this.redirectAfterAuth();
    } catch {
      this.setAuthFeedback(
        'error',
        'Registrazione non riuscita. La email potrebbe essere gia in uso.',
      );
    } finally {
      this.registerBusy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.setAuthFeedback('info', 'Sessione terminata.');
  }

  protected async installPwa(): Promise<void> {
    const installed = await this.pwa.install();

    if (installed) {
      this.notifications.success('App installata', 'GameShelf e pronta come PWA.');
      return;
    }

    this.notifications.info(
      'Installazione non disponibile',
      'Usa il comando di installazione del browser se il pulsante non appare.',
    );
  }

  protected async enableNotifications(): Promise<void> {
    const permission = await this.notifications.requestPermission();
    this.pwa.notificationPermission.set(permission);

    if (permission === 'granted') {
      this.notifications.success(
        'Notifiche attivate',
        'Le notifiche di sistema native sono ora abilitate.'
      );
    } else if (permission === 'denied') {
      this.notifications.warning(
        'Notifiche bloccate',
        'Hai bloccato le notifiche nel browser. Sbloccale dalle impostazioni del sito.'
      );
    }
  }

  protected async sendReminderNotification(): Promise<void> {
    const sent = await this.pwa.showReminderNotification();

    if (sent) {
      this.notifications.success('Notifica inviata', 'Il promemoria PWA e stato mostrato.');
      return;
    }

    this.notifications.warning(
      'Notifiche non attive',
      'Il browser non supporta le notifiche oppure il permesso non e stato concesso.',
    );
  }

  private setAuthFeedback(tone: NotificationTone, message: string): void {
    this.authMessageTone.set(tone);
    this.authMessage.set(message);

    if (tone === 'success') {
      this.notifications.success('Profilo', message);
      return;
    }

    if (tone === 'warning') {
      this.notifications.warning('Controlla i dati', message);
      return;
    }

    if (tone === 'error') {
      this.notifications.error('Operazione non riuscita', message);
      return;
    }

    this.notifications.info('Profilo', message);
  }

  private redirectAfterAuth(): Promise<boolean> {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');

    if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
      return Promise.resolve(false);
    }

    return this.router.navigateByUrl(redirectTo);
  }
}
