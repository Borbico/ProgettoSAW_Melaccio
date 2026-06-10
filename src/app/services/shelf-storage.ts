import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Unsubscribe,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { PublicShelfSummary } from '../models/public-shelf-summary';
import { ShelfEntry } from '../models/shelf-entry';
import { normalizeShelfEntry } from '../utils/shelf-entry-utils';
import { FirebaseClient } from './firebase-client';

@Injectable({
  providedIn: 'root',
})
export class ShelfStorage {
  private readonly firebase = inject(FirebaseClient);
  private readonly guestUserId = 'guest';
  private readonly keyPrefix = 'gameshelf:shelf';

  watch(userId: string, onEntries: (entries: Record<string, ShelfEntry>) => void): Unsubscribe {
    if (userId === this.guestUserId) {
      onEntries({});
      return () => undefined;
    }

    const shelfRef = this.shelfDocument(userId);

    return onSnapshot(
      shelfRef,
      (snapshot) => {
        let entries = snapshot.exists()
          ? this.normalizeEntries(snapshot.data())
          : this.readLocal(userId);

        entries = this.mergePendingChanges(userId, entries);

        onEntries(entries);
      },
      () => {
        onEntries(this.readLocal(userId));
      },
    );
  }

  markPendingChange(userId: string, gameId: string, entry: ShelfEntry | null): void {
    const pending = this.readPendingChanges(userId);
    pending[gameId] = entry;
    this.writePendingChanges(userId, pending);
  }

  clearPendingChange(userId: string, gameId: string): void {
    const pending = this.readPendingChanges(userId);
    delete pending[gameId];
    this.writePendingChanges(userId, pending);
  }

  readPendingChanges(userId: string): Record<string, ShelfEntry | null> {
    const key = `gameshelf:pending_sync:${userId}`;
    return this.readJson<Record<string, ShelfEntry | null>>(key) ?? {};
  }

  private writePendingChanges(userId: string, pending: Record<string, ShelfEntry | null>): void {
    const key = `gameshelf:pending_sync:${userId}`;
    if (this.hasStorage()) {
      localStorage.setItem(key, JSON.stringify(pending));
    }
  }

  clearPendingChanges(userId: string): void {
    const key = `gameshelf:pending_sync:${userId}`;
    if (this.hasStorage()) {
      localStorage.removeItem(key);
    }
  }

  private mergePendingChanges(
    userId: string,
    remoteEntries: Record<string, ShelfEntry>,
  ): Record<string, ShelfEntry> {
    const pending = this.readPendingChanges(userId);
    if (Object.keys(pending).length === 0) {
      return remoteEntries;
    }

    const merged = { ...remoteEntries };
    for (const [gameId, change] of Object.entries(pending)) {
      if (change === null) {
        delete merged[gameId];
      } else {
        merged[gameId] = change;
      }
    }
    return merged;
  }

  async write(
    userId: string,
    entries: Record<string, ShelfEntry>,
    publicSummary?: PublicShelfSummary,
  ): Promise<void> {
    if (userId === this.guestUserId) {
      return;
    }

    this.writeLocal(userId, entries);
    const batch = writeBatch(this.firebase.db);

    batch.set(
      this.shelfDocument(userId),
      {
        entries,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    if (publicSummary) {
      batch.set(
        doc(this.firebase.db, 'userProfiles', userId),
        {
          shelfSummary: publicSummary,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    await batch.commit();
  }

  private shelfDocument(userId: string) {
    return doc(this.firebase.db, 'users', userId, 'shelf', 'default');
  }

  private normalizeEntries(data: DocumentData): Record<string, ShelfEntry> {
    const rawEntries = data['entries'];

    if (!rawEntries || typeof rawEntries !== 'object') {
      return {};
    }

    return this.normalizeEntryMap(rawEntries as Record<string, Partial<ShelfEntry>>);
  }

  readLocal(userId: string): Record<string, ShelfEntry> {
    const storedEntries = this.readJson<Record<string, ShelfEntry>>(this.storageKey(userId));

    return storedEntries ? this.normalizeEntryMap(storedEntries) : {};
  }

  private writeLocal(userId: string, entries: Record<string, ShelfEntry>): void {
    if (this.hasStorage()) {
      localStorage.setItem(this.storageKey(userId), JSON.stringify(entries));
    }
  }

  private normalizeEntryMap(
    entries: Record<string, Partial<ShelfEntry>>,
  ): Record<string, ShelfEntry> {
    return Object.fromEntries(
      Object.entries(entries).map(([gameId, entry]) => [gameId, normalizeShelfEntry(entry)]),
    );
  }

  private storageKey(userId: string): string {
    return `${this.keyPrefix}:${userId}`;
  }

  private readJson<T>(key: string): T | null {
    if (!this.hasStorage()) {
      return null;
    }

    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private hasStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
