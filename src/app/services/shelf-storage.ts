import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Unsubscribe,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ShelfEntry } from '../models/shelf-entry';
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
        const entries = snapshot.exists()
          ? this.normalizeEntries(snapshot.data())
          : this.readLocal(userId);

        onEntries(entries);
      },
      () => {
        onEntries(this.readLocal(userId));
      },
    );
  }

  async write(userId: string, entries: Record<string, ShelfEntry>): Promise<void> {
    if (userId === this.guestUserId) {
      return;
    }

    this.writeLocal(userId, entries);

    await setDoc(
      this.shelfDocument(userId),
      {
        entries,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
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

  private readLocal(userId: string): Record<string, ShelfEntry> {
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
      Object.entries(entries).map(([gameId, entry]) => [gameId, this.normalizeEntry(entry)]),
    );
  }

  private normalizeEntry(entry: Partial<ShelfEntry>): ShelfEntry {
    return {
      status: this.normalizeStatus(entry.status),
      rating: this.clampNumber(entry.rating, 0, 5),
      hoursPlayed: this.clampNumber(entry.hoursPlayed, 0, 999),
      progress: this.clampNumber(entry.progress, 0, 100),
      notes: String(entry.notes ?? ''),
      personalGoal: String(entry.personalGoal ?? ''),
    };
  }

  private normalizeStatus(status: unknown): ShelfEntry['status'] {
    return status === 'Backlog' || status === 'In corso' || status === 'Completato'
      ? status
      : 'Wishlist';
  }

  private clampNumber(value: unknown, min: number, max: number): number {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return min;
    }

    return Math.min(max, Math.max(min, Math.round(numericValue)));
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
