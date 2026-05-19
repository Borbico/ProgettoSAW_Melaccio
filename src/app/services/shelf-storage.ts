import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Unsubscribe,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { MOCK_GAMES } from '../data/mock-games';
import { ShelfEntry } from '../models/shelf-entry';
import { FirebaseClient } from './firebase-client';

@Injectable({
  providedIn: 'root'
})
export class ShelfStorage {
  private readonly firebase = inject(FirebaseClient);
  private readonly guestUserId = 'guest';
  private readonly keyPrefix = 'gameshelf:shelf';

  watch(userId: string, onEntries: (entries: Record<string, ShelfEntry>) => void): Unsubscribe {
    if (userId === this.guestUserId) {
      onEntries(this.readLocal(userId));
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

        if (!snapshot.exists()) {
          void this.write(userId, entries);
        }
      },
      () => {
        onEntries(this.readLocal(userId));
      }
    );
  }

  async write(userId: string, entries: Record<string, ShelfEntry>): Promise<void> {
    this.writeLocal(userId, entries);

    if (userId === this.guestUserId) {
      return;
    }

    await setDoc(
      this.shelfDocument(userId),
      {
        entries,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  private shelfDocument(userId: string) {
    return doc(this.firebase.db, 'users', userId, 'shelf', 'default');
  }

  private normalizeEntries(data: DocumentData): Record<string, ShelfEntry> {
    const rawEntries = data['entries'];

    if (!rawEntries || typeof rawEntries !== 'object') {
      return this.defaultEntries();
    }

    return {
      ...this.defaultEntries(),
      ...(rawEntries as Record<string, ShelfEntry>)
    };
  }

  private readLocal(userId: string): Record<string, ShelfEntry> {
    const storedEntries = this.readJson<Record<string, ShelfEntry>>(this.storageKey(userId));

    return storedEntries ?? this.defaultEntries();
  }

  private writeLocal(userId: string, entries: Record<string, ShelfEntry>): void {
    if (this.hasStorage()) {
      localStorage.setItem(this.storageKey(userId), JSON.stringify(entries));
    }
  }

  private defaultEntries(): Record<string, ShelfEntry> {
    return Object.fromEntries(
      MOCK_GAMES.map((game) => [
        game.id,
        {
          status: game.status,
          rating: game.rating,
          hoursPlayed: game.hoursPlayed,
          progress: game.progress,
          notes: game.notes,
          personalGoal: game.personalGoal
        }
      ])
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
