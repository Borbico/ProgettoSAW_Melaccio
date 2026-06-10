import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from './auth-session';
import { CommunityShelf } from './community-shelf';
import { FirebaseClient } from './firebase-client';
import { NotificationCenter } from './notification-center';
import { SocialNotificationService } from './social-notification-service';

const firestore = vi.hoisted(() => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ kind: 'collection', segments })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ kind: 'doc', segments })),
  query: vi.fn((ref: any, ...clauses: any[]) => ({ kind: 'query', ref, clauses })),
  orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
  limit: vi.fn((value: number) => ({ kind: 'limit', value })),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/firestore', () => firestore);

describe('SocialNotificationService', () => {
  const currentUser = signal<{ id: string; displayName: string } | null>(null);
  const followingIds = signal<string[]>([]);
  let mockNotifications: any;
  let onSnapshotCallbacks: Map<string, (snapshot: any) => void>;
  let unsubscribeSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.set(null);
    followingIds.set([]);
    onSnapshotCallbacks = new Map();
    unsubscribeSpy = vi.fn();

    mockNotifications = {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };

    firestore.onSnapshot.mockImplementation((ref: any, next: any) => {
      const path = ref.kind === 'query' ? ref.ref.segments.join('/') : ref.segments.join('/');
      onSnapshotCallbacks.set(path, next);
      return unsubscribeSpy;
    });

    TestBed.configureTestingModule({
      providers: [
        SocialNotificationService,
        { provide: AuthSession, useValue: { currentUser: currentUser.asReadonly() } },
        { provide: FirebaseClient, useValue: { db: {} } },
        { provide: NotificationCenter, useValue: mockNotifications },
        { provide: CommunityShelf, useValue: { followingIds: followingIds.asReadonly() } },
      ],
    });
  });

  it('does not listen to snapshots when logged out', () => {
    TestBed.inject(SocialNotificationService);
    TestBed.flushEffects();

    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });

  it('starts listening to snapshots upon login and unsubscribes upon logout', () => {
    TestBed.inject(SocialNotificationService);
    TestBed.flushEffects();

    currentUser.set({ id: 'user-123', displayName: 'Daniele' });
    TestBed.flushEffects();

    expect(firestore.onSnapshot).toHaveBeenCalledTimes(2);
    expect(onSnapshotCallbacks.has('userNotifications/user-123/items')).toBe(true);
    expect(onSnapshotCallbacks.has('activities')).toBe(true);

    currentUser.set(null);
    TestBed.flushEffects();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(2);
  });

  it('triggers info notification for new follow events', () => {
    TestBed.inject(SocialNotificationService);
    currentUser.set({ id: 'user-123', displayName: 'Daniele' });
    TestBed.flushEffects();

    const callback = onSnapshotCallbacks.get('userNotifications/user-123/items');
    expect(callback).toBeDefined();

    // Trigger follow event after startup time
    const futureTimestamp = new Date(Date.now() + 10000).toISOString();
    callback!({
      docChanges: () => [
        {
          type: 'added',
          doc: {
            id: 'notif-1',
            data: () => ({
              type: 'follow',
              senderId: 'user-456',
              senderName: 'Follower Alice',
              timestamp: futureTimestamp,
            }),
          },
        },
      ],
    });

    expect(mockNotifications.info).toHaveBeenCalledWith(
      'Nuovo follower!',
      'Follower Alice ha iniziato a seguirti!',
    );
  });

  it('ignores follow events that occurred before session start', () => {
    TestBed.inject(SocialNotificationService);
    currentUser.set({ id: 'user-123', displayName: 'Daniele' });
    TestBed.flushEffects();

    const callback = onSnapshotCallbacks.get('userNotifications/user-123/items');

    // Past timestamp
    const pastTimestamp = new Date(Date.now() - 10000).toISOString();
    callback!({
      docChanges: () => [
        {
          type: 'added',
          doc: {
            id: 'notif-old',
            data: () => ({
              type: 'follow',
              senderId: 'user-456',
              senderName: 'Old Follower',
              timestamp: pastTimestamp,
            }),
          },
        },
      ],
    });

    expect(mockNotifications.info).not.toHaveBeenCalled();
  });

  it('triggers info notification when a followed user completes a game', () => {
    TestBed.inject(SocialNotificationService);
    currentUser.set({ id: 'user-123', displayName: 'Daniele' });
    followingIds.set(['followed-user-789']);
    TestBed.flushEffects();

    const callback = onSnapshotCallbacks.get('activities');
    expect(callback).toBeDefined();

    const futureTimestamp = new Date(Date.now() + 10000).toISOString();
    callback!({
      docChanges: () => [
        {
          type: 'added',
          doc: {
            id: 'activity-1',
            data: () => ({
              type: 'completion',
              userId: 'followed-user-789',
              userName: 'Bob',
              gameId: 'hades',
              gameTitle: 'Hades',
              timestamp: futureTimestamp,
            }),
          },
        },
      ],
    });

    expect(mockNotifications.info).toHaveBeenCalledWith(
      'Completamento gioco!',
      'Bob ha completato "Hades"!',
    );
  });

  it('ignores completion activities from non-followed users', () => {
    TestBed.inject(SocialNotificationService);
    currentUser.set({ id: 'user-123', displayName: 'Daniele' });
    followingIds.set(['followed-user-789']);
    TestBed.flushEffects();

    const callback = onSnapshotCallbacks.get('activities');

    const futureTimestamp = new Date(Date.now() + 10000).toISOString();
    callback!({
      docChanges: () => [
        {
          type: 'added',
          doc: {
            id: 'activity-2',
            data: () => ({
              type: 'completion',
              userId: 'stranger-999',
              userName: 'Stranger',
              gameId: 'hades',
              gameTitle: 'Hades',
              timestamp: futureTimestamp,
            }),
          },
        },
      ],
    });

    expect(mockNotifications.info).not.toHaveBeenCalled();
  });

  it('ignores completion activities by the current user themselves', () => {
    TestBed.inject(SocialNotificationService);
    currentUser.set({ id: 'user-123', displayName: 'Daniele' });
    followingIds.set(['user-123']); // Even if they follow themselves somehow
    TestBed.flushEffects();

    const callback = onSnapshotCallbacks.get('activities');

    const futureTimestamp = new Date(Date.now() + 10000).toISOString();
    callback!({
      docChanges: () => [
        {
          type: 'added',
          doc: {
            id: 'activity-3',
            data: () => ({
              type: 'completion',
              userId: 'user-123',
              userName: 'Daniele',
              gameId: 'hades',
              gameTitle: 'Hades',
              timestamp: futureTimestamp,
            }),
          },
        },
      ],
    });

    expect(mockNotifications.info).not.toHaveBeenCalled();
  });
});
