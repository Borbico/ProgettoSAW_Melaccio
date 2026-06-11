import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { Game } from '../models/game';
import {
  emptyPublicShelfSummary,
  PublicShelfGameSummary,
  PublicShelfSummary,
} from '../models/public-shelf-summary';
import { ShelfEntry } from '../models/shelf-entry';
import { clampNumber, normalizeIsoDate, updatedAtTime } from '../utils/number-utils';
import { normalizeShelfEntry, normalizeStatus } from '../utils/shelf-entry-utils';
import {
  alignSummaryWithCatalog,
  composeShelfGames,
  publicShelfSummary,
} from '../utils/shelf-summary';
import { AuthSession } from './auth-session';
import { FirebaseClient } from './firebase-client';
import { GameCatalog } from './game-catalog';

export interface PublicUserProfile {
  id: string;
  displayName: string;
  handle: string;
  createdAt: string;
  shelfSummary: PublicShelfSummary;
}

export interface CommunityShelfUser extends PublicUserProfile {
  games: Game[];
  recentGames: PublicShelfGameSummary[];
  followed: boolean;
  savedCount: number;
  activeCount: number;
  completedCount: number;
  totalHours: number;
  lastActivityAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class CommunityShelf {
  private readonly auth = inject(AuthSession);
  private readonly catalog = inject(GameCatalog);
  private readonly firebase = inject(FirebaseClient);
  private readonly profilesState = signal<PublicUserProfile[]>([]);
  private readonly entriesByUserState = signal<Record<string, Record<string, ShelfEntry>>>({});
  private readonly followingIdsState = signal<string[]>([]);
  private readonly loadedState = signal(false);
  private readonly shelfWatchers = new Map<string, { refs: number; unsubscribe: Unsubscribe }>();

  readonly loaded = this.loadedState.asReadonly();
  readonly followingIds = this.followingIdsState.asReadonly();
  readonly followingCount = computed(() => this.followingIdsState().length);
  readonly users = computed(() =>
    this.profilesState()
      .map((profile) => this.composeUser(profile))
      .sort((first, second) => this.compareUsers(first, second)),
  );

  constructor() {
    effect((onCleanup) => {
      if (!this.auth.currentUser()) {
        this.loadedState.set(false);
        this.profilesState.set([]);
        this.entriesByUserState.set({});
        this.followingIdsState.set([]);
        this.clearShelfWatchers();
        return;
      }

      const currentUserId = this.auth.currentUser()?.id ?? '';
      const unsubscribeProfiles = onSnapshot(
        collection(this.firebase.db, 'userProfiles'),
        (snapshot) => {
          const profiles = snapshot.docs
            .map((profile) => this.normalizeProfile(profile.id, profile.data()))
            .filter((profile): profile is PublicUserProfile => Boolean(profile));

          untracked(() => {
            this.profilesState.set(profiles);
            this.removeStaleShelfEntries(profiles.map((profile) => profile.id));
            this.loadedState.set(true);
          });
        },
        () => {
          untracked(() => {
            this.profilesState.set([]);
            this.entriesByUserState.set({});
            this.loadedState.set(true);
            this.clearShelfWatchers();
          });
        },
      );
      const unsubscribeFollowing = onSnapshot(
        doc(this.firebase.db, 'users', currentUserId, 'social', 'following'),
        (snapshot) => {
          const followingIds = snapshot.exists()
            ? this.normalizeFollowingIds(snapshot.data(), currentUserId)
            : [];

          untracked(() => this.followingIdsState.set(followingIds));
        },
        () => {
          untracked(() => this.followingIdsState.set([]));
        },
      );

      onCleanup(() => {
        unsubscribeProfiles();
        unsubscribeFollowing();
        this.clearShelfWatchers();
      });
    });
  }

  isFollowing(userId: string): boolean {
    return this.followingIdsState().includes(userId);
  }

  async toggleFollow(userId: string): Promise<boolean> {
    const currentUser = this.auth.currentUser();

    if (!currentUser || userId === currentUser.id) {
      return this.isFollowing(userId);
    }

    const wasFollowing = this.isFollowing(userId);
    const nextFollowingIds = wasFollowing
      ? this.followingIdsState().filter((id) => id !== userId)
      : [...this.followingIdsState(), userId];

    this.followingIdsState.set(this.uniqueIds(nextFollowingIds));

    try {
      await setDoc(
        doc(this.firebase.db, 'users', currentUser.id, 'social', 'following'),
        {
          followedUserIds: this.followingIdsState(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (!wasFollowing) {
        try {
          const notificationRef = doc(
            collection(this.firebase.db, 'userNotifications', userId, 'items'),
          );
          await setDoc(notificationRef, {
            senderId: currentUser.id,
            senderName: currentUser.displayName,
            type: 'follow',
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to write follow notification', err);
        }
      }

      return !wasFollowing;
    } catch {
      this.followingIdsState.set(
        wasFollowing
          ? this.uniqueIds([...this.followingIdsState(), userId])
          : this.followingIdsState().filter((id) => id !== userId),
      );

      throw new Error('FOLLOW_UPDATE_FAILED');
    }
  }

  userById(userId: string): CommunityShelfUser | undefined {
    return this.users().find((user) => user.id === userId);
  }

  isShelfLoaded(userId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.entriesByUserState(), userId);
  }

  watchUserShelf(userId: string): () => void {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId || !this.auth.currentUser()) {
      return () => undefined;
    }

    const currentWatcher = this.shelfWatchers.get(normalizedUserId);

    if (currentWatcher) {
      currentWatcher.refs += 1;

      return () => this.releaseShelfWatcher(normalizedUserId);
    }

    const unsubscribe = onSnapshot(
      doc(this.firebase.db, 'users', normalizedUserId, 'shelf', 'default'),
      (snapshot) => {
        const entries = snapshot.exists() ? this.normalizeEntries(snapshot.data()) : {};

        untracked(() => {
          this.entriesByUserState.update((entriesByUser) => ({
            ...entriesByUser,
            [normalizedUserId]: entries,
          }));
        });
      },
      () => {
        untracked(() => {
          this.entriesByUserState.update((entriesByUser) => {
            const { [normalizedUserId]: _, ...remaining } = entriesByUser;
            return remaining;
          });
        });
      },
    );

    this.shelfWatchers.set(normalizedUserId, { refs: 1, unsubscribe });

    return () => this.releaseShelfWatcher(normalizedUserId);
  }

  private clearShelfWatchers(): void {
    for (const watcher of this.shelfWatchers.values()) {
      watcher.unsubscribe();
    }

    this.shelfWatchers.clear();
    this.entriesByUserState.set({});
  }

  private releaseShelfWatcher(userId: string): void {
    const watcher = this.shelfWatchers.get(userId);

    if (!watcher) {
      return;
    }

    watcher.refs -= 1;

    if (watcher.refs > 0) {
      return;
    }

    watcher.unsubscribe();
    this.shelfWatchers.delete(userId);
    this.entriesByUserState.update((entriesByUser) => {
      const { [userId]: _removed, ...remaining } = entriesByUser;

      return remaining;
    });
  }

  private removeStaleShelfEntries(userIds: string[]): void {
    const activeIds = new Set(userIds);

    this.entriesByUserState.update((entriesByUser) =>
      Object.fromEntries(Object.entries(entriesByUser).filter(([userId]) => activeIds.has(userId))),
    );
  }

  private composeUser(profile: PublicUserProfile): CommunityShelfUser {
    const entriesByUser = this.entriesByUserState();
    const shelfLoaded = Object.prototype.hasOwnProperty.call(entriesByUser, profile.id);
    const games = shelfLoaded
      ? composeShelfGames(this.catalog.catalogGames(), entriesByUser[profile.id] ?? {})
      : [];
    const summary = shelfLoaded
      ? publicShelfSummary(games)
      : alignSummaryWithCatalog(profile.shelfSummary, this.catalog.catalogGames());

    return {
      ...profile,
      games,
      recentGames: summary.recentGames,
      followed: this.isFollowing(profile.id),
      savedCount: summary.savedCount,
      activeCount: summary.activeCount,
      completedCount: summary.completedCount,
      totalHours: summary.totalHours,
      lastActivityAt: summary.lastActivityAt,
    };
  }

  private compareUsers(first: CommunityShelfUser, second: CommunityShelfUser): number {
    const activityDifference =
      updatedAtTime(second.lastActivityAt) - updatedAtTime(first.lastActivityAt);

    return activityDifference || first.displayName.localeCompare(second.displayName);
  }

  private normalizeProfile(id: string, data: DocumentData): PublicUserProfile | null {
    const displayName = String(data['displayName'] ?? '').trim();
    const handle = String(data['handle'] ?? '').trim();

    if (!id || !displayName || !handle) {
      return null;
    }

    return {
      id,
      displayName,
      handle,
      createdAt: String(data['createdAt'] ?? ''),
      shelfSummary: this.normalizeShelfSummary(data['shelfSummary']),
    };
  }

  private normalizeShelfSummary(value: unknown): PublicShelfSummary {
    if (!value || typeof value !== 'object') {
      return emptyPublicShelfSummary();
    }

    const data = value as Record<string, unknown>;
    const recentGames = Array.isArray(data['recentGames'])
      ? data['recentGames']
          .map((game) => this.normalizeRecentGame(game))
          .filter((game): game is PublicShelfGameSummary => Boolean(game))
          .slice(0, 3)
      : [];
    const lastActivityAt = normalizeIsoDate(data['lastActivityAt']) || recentGames[0]?.updatedAt;

    return {
      savedCount: clampNumber(data['savedCount'], 0, 999),
      activeCount: clampNumber(data['activeCount'], 0, 999),
      completedCount: clampNumber(data['completedCount'], 0, 999),
      totalHours: clampNumber(data['totalHours'], 0, 99999),
      lastActivityAt: lastActivityAt ?? '',
      recentGames,
    };
  }

  private normalizeRecentGame(value: unknown): PublicShelfGameSummary | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const data = value as Record<string, unknown>;
    const id = String(data['id'] ?? '').trim();
    const title = String(data['title'] ?? '').trim();

    if (!id || !title) {
      return null;
    }

    return {
      id,
      title,
      status: normalizeStatus(data['status']),
      rating: clampNumber(data['rating'], 0, 5),
      hoursPlayed: clampNumber(data['hoursPlayed'], 0, 999),
      progress: clampNumber(data['progress'], 0, 100),
      ...(normalizeIsoDate(data['updatedAt'])
        ? { updatedAt: normalizeIsoDate(data['updatedAt']) }
        : {}),
    };
  }

  private normalizeEntries(data: DocumentData): Record<string, ShelfEntry> {
    const rawEntries = data['entries'];

    if (!rawEntries || typeof rawEntries !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(rawEntries as Record<string, Partial<ShelfEntry>>).map(([gameId, entry]) => [
        gameId,
        normalizeShelfEntry(entry),
      ]),
    );
  }

  private normalizeFollowingIds(data: DocumentData, currentUserId: string): string[] {
    const rawIds = data['followedUserIds'];

    if (!Array.isArray(rawIds)) {
      return [];
    }

    return this.uniqueIds(
      rawIds.map((id) => String(id ?? '').trim()).filter((id) => id && id !== currentUserId),
    ).slice(0, 500);
  }

  private uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids));
  }
}
