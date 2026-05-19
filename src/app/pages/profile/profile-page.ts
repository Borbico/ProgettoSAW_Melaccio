import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthSession } from '../../services/auth-session';
import { GameCatalog } from '../../services/game-catalog';

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css'
})
export class ProfilePage {
  private readonly auth = inject(AuthSession);
  private readonly catalog = inject(GameCatalog);

  protected readonly user = this.auth.currentUser;
  protected readonly authReady = this.auth.authReady;
  protected readonly signInEmail = signal('');
  protected readonly signInPassword = signal('');
  protected readonly registerName = signal('');
  protected readonly registerEmail = signal('');
  protected readonly registerPassword = signal('');
  protected readonly authMessage = signal('');
  protected readonly games = this.catalog.games;
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

  protected readonly totalHours = computed(() =>
    this.games().reduce((total, game) => total + game.hoursPlayed, 0)
  );

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
    if (!this.signInEmail().trim() || !this.signInPassword()) {
      this.authMessage.set('Inserisci email e password.');
      return;
    }

    try {
      await this.auth.signIn(this.signInEmail(), this.signInPassword());
      this.authMessage.set('Accesso effettuato.');
    } catch {
      this.authMessage.set('Accesso non riuscito. Controlla email e password.');
    }
  }

  protected async register(): Promise<void> {
    if (!this.registerEmail().trim() || this.registerPassword().length < 6) {
      this.authMessage.set('Inserisci una email valida e una password di almeno 6 caratteri.');
      return;
    }

    try {
      await this.auth.register(this.registerName(), this.registerEmail(), this.registerPassword());
      this.registerName.set('');
      this.registerEmail.set('');
      this.registerPassword.set('');
      this.authMessage.set('Profilo creato.');
    } catch {
      this.authMessage.set('Registrazione non riuscita. La email potrebbe essere gia in uso.');
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.authMessage.set('Sessione terminata.');
  }
}
