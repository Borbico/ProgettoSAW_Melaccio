import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogGame } from '../models/catalog-game';
import { ShelfEntry } from '../models/shelf-entry';
import { AuthSession } from './auth-session';
import { CommunityShelf } from './community-shelf';
import { FirebaseClient } from './firebase-client';
import { GameCatalog } from './game-catalog';

const firestore = vi.hoisted(() => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ kind: 'collection', segments })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ kind: 'doc', segments })),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/firestore', () => firestore);

const hades: CatalogGame = {
  id: 'hades',
  title: 'Hades',
  developer: 'Supergiant Games',
  publisher: 'Supergiant Games',
  genre: 'Roguelike',
  platform: 'PC',
  modes: ['Single player'],
  tags: ['Action'],
  releaseYear: 2020,
  description: 'Roguelike mitologico.',
  coverTheme: 'cover-ember',
};

const profiles = [
  {
    id: 'current-user',
    data: {
      displayName: 'Daniele',
      handle: '@daniele',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  },
  {
    id: 'followed-user',
    data: {
      displayName: 'Player seguito',
      handle: '@seguito',
      createdAt: '2026-01-02T00:00:00.000Z',
      shelfSummary: {
        savedCount: 2,
        activeCount: 1,
        completedCount: 1,
        totalHours: 42,
        lastActivityAt: '2026-05-20T12:00:00.000Z',
        recentGames: [
          {
            id: 'hades',
            title: 'Hades',
            status: 'In corso',
            rating: 5,
            hoursPlayed: 18,
            progress: 60,
            updatedAt: '2026-05-20T12:00:00.000Z',
          },
        ],
      },
    },
  },
];

describe('CommunityShelf', () => {
  const currentUser = signal({ id: 'current-user' });
  let unsubscribedRefs: string[];

  beforeEach(() => {
    currentUser.set({ id: 'current-user' });
    unsubscribedRefs = [];
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.onSnapshot.mockImplementation((ref, next) => {
      const path = ref.segments.join('/');

      if (path === 'userProfiles') {
        next({
          docs: profiles.map((profile) => ({
            id: profile.id,
            data: () => profile.data,
          })),
        });
      }

      if (path === 'users/current-user/social/following') {
        next(docSnapshot({ followedUserIds: ['followed-user'] }));
      }

      if (path === 'users/followed-user/shelf/default') {
        next(
          docSnapshot({
            entries: {
              hades: shelfEntry({
                status: 'Completato',
                rating: 4,
                hoursPlayed: 27,
                progress: 100,
              }),
            },
          }),
        );
      }

      return () => unsubscribedRefs.push(path);
    });

    TestBed.configureTestingModule({
      providers: [
        CommunityShelf,
        { provide: AuthSession, useValue: { currentUser: currentUser.asReadonly() } },
        { provide: FirebaseClient, useValue: { db: {} } },
        { provide: GameCatalog, useValue: { catalogGames: () => [hades] } },
      ],
    });
  });

  it('uses public profile summaries without opening every shelf', () => {
    const community = TestBed.inject(CommunityShelf);
    TestBed.flushEffects();

    const followedUser = community.userById('followed-user');

    expect(followedUser?.savedCount).toBe(2);
    expect(followedUser?.recentGames[0]?.title).toBe('Hades');
    expect(followedUser?.followed).toBe(true);
    expect(snapshotPaths().filter((path) => path.includes('/shelf/'))).toEqual([]);
  });

  it('loads a public shelf only when requested', () => {
    const community = TestBed.inject(CommunityShelf);
    TestBed.flushEffects();

    const release = community.watchUserShelf('followed-user');

    expect(community.isShelfLoaded('followed-user')).toBe(true);
    expect(community.userById('followed-user')?.games).toEqual([
      {
        ...hades,
        ...shelfEntry({
          status: 'Completato',
          rating: 4,
          hoursPlayed: 27,
          progress: 100,
        }),
      },
    ]);

    release();

    expect(unsubscribedRefs).toContain('users/followed-user/shelf/default');
    expect(community.isShelfLoaded('followed-user')).toBe(false);
  });

  it('persists follow changes and returns the new follow state', async () => {
    const community = TestBed.inject(CommunityShelf);
    TestBed.flushEffects();

    const followed = await community.toggleFollow('new-user');

    expect(followed).toBe(true);
    expect(firestore.setDoc).toHaveBeenCalledWith(
      { kind: 'doc', segments: ['users', 'current-user', 'social', 'following'] },
      {
        followedUserIds: ['followed-user', 'new-user'],
        updatedAt: 'SERVER_TIMESTAMP',
      },
      { merge: true },
    );
  });

  it('rolls back optimistic follow changes when persistence fails', async () => {
    firestore.setDoc.mockRejectedValueOnce(new Error('network'));
    const community = TestBed.inject(CommunityShelf);
    TestBed.flushEffects();

    await expect(community.toggleFollow('new-user')).rejects.toThrow('FOLLOW_UPDATE_FAILED');

    expect(community.followingIds()).toEqual(['followed-user']);
  });
});

function snapshotPaths(): string[] {
  return firestore.onSnapshot.mock.calls.map(([ref]) => ref.segments.join('/'));
}

function docSnapshot(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function shelfEntry(overrides: Partial<ShelfEntry>): ShelfEntry {
  return {
    status: 'Wishlist',
    rating: 0,
    hoursPlayed: 0,
    progress: 0,
    notes: '',
    personalGoal: '',
    updatedAt: '2026-05-22T10:00:00.000Z',
    ...overrides,
  };
}
