import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GameStatus } from '../../models/game';
import { AuthSession } from '../../services/auth-session';
import { CommunityShelf, CommunityShelfUser } from '../../services/community-shelf';
import { NotificationCenter } from '../../services/notification-center';
import { PwaService } from '../../services/pwa';
import { followFeedback } from '../../utils/follow-feedback';
import { gameStatusLabel } from '../../utils/status-labels';

type CommunityMode = 'following' | 'discover';

@Component({
  selector: 'app-community-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './community-page.html',
  styleUrl: './community-page.css',
})
export class CommunityPage {
  private readonly auth = inject(AuthSession);
  private readonly community = inject(CommunityShelf);
  private readonly notifications = inject(NotificationCenter);
  private readonly pwa = inject(PwaService);

  protected readonly currentUser = this.auth.currentUser;
  protected readonly pwaOnline = this.pwa.online;
  protected readonly loaded = this.community.loaded;
  protected readonly users = this.community.users;
  protected readonly followingCount = this.community.followingCount;
  protected readonly searchTerm = signal('');
  protected readonly viewMode = signal<CommunityMode>('following');
  protected readonly expandedUserId = signal('');
  protected readonly followBusyId = signal('');
  protected readonly visibleUsers = computed(() => {
    const currentUserId = this.currentUser()?.id ?? '';
    const users = this.users().filter((user) => user.id !== currentUserId);

    return this.viewMode() === 'following' ? users.filter((user) => user.followed) : users;
  });
  protected readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const users = this.visibleUsers();

    if (!term) {
      return users;
    }

    return users.filter((user) => {
      const profileText = `${user.displayName} ${user.handle}`.toLowerCase();
      const recentGamesText = user.recentGames
        .map((game) => `${game.title} ${this.statusLabel(game.status)}`)
        .join(' ')
        .toLowerCase();

      return profileText.includes(term) || recentGamesText.includes(term);
    });
  });

  protected readonly totalUsers = computed(() => this.users().length);
  protected readonly followedActivePlayers = computed(
    () => this.users().filter((user) => user.followed && user.activeCount > 0).length,
  );

  protected updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  protected selectViewMode(mode: CommunityMode): void {
    this.viewMode.set(mode);
    this.expandedUserId.set('');
  }

  protected async toggleFollow(user: CommunityShelfUser): Promise<void> {
    if (this.followBusyId()) {
      return;
    }

    this.followBusyId.set(user.id);

    try {
      const followed = await this.community.toggleFollow(user.id);
      const feedback = followFeedback(user.displayName, followed);

      this.notifications.success(feedback.title, feedback.message);
    } catch {
      this.notifications.error(
        'Aggiornamento non riuscito',
        'Non è stato possibile aggiornare i profili seguiti. Riprova tra qualche secondo.',
      );
    } finally {
      this.followBusyId.set('');
    }
  }

  protected toggleRecentGames(userId: string): void {
    this.expandedUserId.update((currentId) => (currentId === userId ? '' : userId));
  }

  protected isExpanded(userId: string): boolean {
    return this.expandedUserId() === userId;
  }

  protected statusLabel(status: GameStatus): string {
    return gameStatusLabel(status);
  }

  protected formatActivity(value: string): string {
    if (!value) {
      return 'Nessun aggiornamento';
    }

    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}
