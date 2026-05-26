import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Game } from '../../models/game';
import { CommunityShelf } from '../../services/community-shelf';
import { AuthSession } from '../../services/auth-session';
import { NotificationCenter } from '../../services/notification-center';
import { coverImageStyle } from '../../utils/cover-image-style';
import { followFeedback } from '../../utils/follow-feedback';
import { buildShelfLanes } from '../../utils/shelf-lanes';

@Component({
  selector: 'app-public-shelf-page',
  imports: [RouterLink],
  templateUrl: './public-shelf-page.html',
  styleUrl: './public-shelf-page.css',
})
export class PublicShelfPage {
  private readonly auth = inject(AuthSession);
  private readonly community = inject(CommunityShelf);
  private readonly notifications = inject(NotificationCenter);
  private readonly route = inject(ActivatedRoute);
  private readonly userId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('userId') ?? '')),
    { initialValue: '' },
  );

  protected readonly loaded = this.community.loaded;
  protected readonly currentUser = this.auth.currentUser;
  protected readonly user = computed(() => this.community.userById(this.userId()));
  protected readonly shelfLoaded = computed(() => this.community.isShelfLoaded(this.userId()));
  protected readonly followBusy = signal(false);
  protected readonly lanes = computed(() => buildShelfLanes(this.user()?.games ?? []));

  constructor() {
    effect((onCleanup) => {
      const userId = this.userId();

      if (!userId) {
        return;
      }

      const unwatch = this.community.watchUserShelf(userId);

      onCleanup(() => unwatch());
    });
  }

  protected async toggleFollow(): Promise<void> {
    const user = this.user();

    if (!user || user.id === this.currentUser()?.id || this.followBusy()) {
      return;
    }

    this.followBusy.set(true);

    try {
      const followed = await this.community.toggleFollow(user.id);
      const feedback = followFeedback(user.displayName, followed);

      this.notifications.success(feedback.title, feedback.message);
    } catch {
      this.notifications.error(
        'Aggiornamento non riuscito',
        'Non e stato possibile aggiornare i profili seguiti. Riprova tra qualche secondo.',
      );
    } finally {
      this.followBusy.set(false);
    }
  }

  protected coverImageStyle(game: Game): string | null {
    return coverImageStyle(game);
  }
}
