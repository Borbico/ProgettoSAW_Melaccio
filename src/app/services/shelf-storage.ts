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
import { IndexedDbStore } from './indexed-db-store';

@Injectable({
  providedIn: 'root',
})
export class ShelfStorage {
  private readonly firebase = inject(FirebaseClient);
  private readonly db = inject(IndexedDbStore);
  private readonly guestUserId = 'guest';
  private readonly keyPrefix = 'gameshelf:shelf';

  watch(userId: string, onEntries: (entries: Record<string, ShelfEntry>) => void): Unsubscribe {
    if (userId === this.guestUserId) {
      onEntries({});
      return () => undefined;
    }

    const shelfRef = this.shelfDocument(userId);

    // Carica immediatamente lo stato offline asincrono all'avvio
    this.readLocal(userId).then(async (localEntries) => {
      const merged = await this.mergePendingChanges(userId, localEntries);
      onEntries(merged);
    });

    return onSnapshot(
      shelfRef,
      async (snapshot) => {
        let entries = snapshot.exists()
          ? this.normalizeEntries(snapshot.data())
          : await this.readLocal(userId);

        entries = await this.mergePendingChanges(userId, entries);

        onEntries(entries);
      },
      async () => {
        onEntries(await this.readLocal(userId));
      },
    );
  }

  async markPendingChange(userId: string, gameId: string, entry: ShelfEntry | null): Promise<void> {
    const pending = await this.readPendingChanges(userId);
    pending[gameId] = entry;
    await this.writePendingChanges(userId, pending);
  }

  async clearPendingChange(userId: string, gameId: string): Promise<void> {
    const pending = await this.readPendingChanges(userId);
    delete pending[gameId];
    await this.writePendingChanges(userId, pending);
  }

  async readPendingChanges(userId: string): Promise<Record<string, ShelfEntry | null>> {
    const key = `gameshelf:pending_sync:${userId}`;
    return (await this.db.get<Record<string, ShelfEntry | null>>(key)) ?? {};
  }

  private async writePendingChanges(userId: string, pending: Record<string, ShelfEntry | null>): Promise<void> {
    const key = `gameshelf:pending_sync:${userId}`;
    await this.db.set(key, pending);
  }

  async clearPendingChanges(userId: string): Promise<void> {
    const key = `gameshelf:pending_sync:${userId}`;
    await this.db.remove(key);
  }

  private async mergePendingChanges(
    userId: string,
    remoteEntries: Record<string, ShelfEntry>,
  ): Promise<Record<string, ShelfEntry>> {
    const pending = await this.readPendingChanges(userId);
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

    await this.writeLocal(userId, entries);
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

  async readLocal(userId: string): Promise<Record<string, ShelfEntry>> {
    const storedEntries = await this.db.get<Record<string, ShelfEntry>>(this.storageKey(userId));

    return storedEntries ? this.normalizeEntryMap(storedEntries) : {};
  }

  private async writeLocal(userId: string, entries: Record<string, ShelfEntry>): Promise<void> {
    await this.db.set(this.storageKey(userId), entries);
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
}
