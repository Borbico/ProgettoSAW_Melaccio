import { Injectable, computed, inject, signal } from '@angular/core';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { UserProfile } from '../models/user-profile';
import { FirebaseClient } from './firebase-client';

@Injectable({
  providedIn: 'root',
})
export class AuthSession {
  private readonly firebase = inject(FirebaseClient);
  private readonly currentUserState = signal<UserProfile | null>(null);
  private readonly authReadyState = signal(false);
  private readonly readyResolvers: Array<() => void> = [];

  readonly currentUser = this.currentUserState.asReadonly();
  readonly authReady = this.authReadyState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly displayName = computed(() => this.currentUser()?.displayName ?? 'Ospite');

  constructor() {
    onAuthStateChanged(this.firebase.auth, (user) => {
      const profile = user ? this.toUserProfile(user) : null;

      this.currentUserState.set(profile);
      this.authReadyState.set(true);
      this.resolveReady();

      if (profile) {
        void this.syncPublicProfile(profile).catch(() => undefined);
      }
    });
  }

  whenReady(): Promise<void> {
    if (this.authReadyState()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.readyResolvers.push(resolve);
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.firebase.auth, email.trim().toLowerCase(), password);
  }

  async register(displayName: string, email: string, password: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(
      this.firebase.auth,
      email.trim().toLowerCase(),
      password,
    );
    const cleanDisplayName = displayName.trim() || this.displayNameFromEmail(email);

    await updateProfile(credential.user, { displayName: cleanDisplayName });
    const profile = this.toUserProfile(credential.user);

    this.currentUserState.set(profile);
    await this.syncPublicProfile(profile).catch(() => undefined);
  }

  async signOut(): Promise<void> {
    await signOut(this.firebase.auth);
  }

  private toUserProfile(user: User): UserProfile {
    const email = user.email ?? 'player@gameshelf.local';
    const displayName = user.displayName ?? this.displayNameFromEmail(email);

    return {
      id: user.uid,
      displayName,
      email,
      handle: `@${this.handleFromEmail(email)}`,
      createdAt: user.metadata.creationTime ?? new Date().toISOString(),
    };
  }

  private displayNameFromEmail(email: string): string {
    const localPart = email.split('@')[0] || 'Player';

    return localPart
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private handleFromEmail(email: string): string {
    return (email.split('@')[0] || 'player').replace(/[^a-z0-9-]/g, '-');
  }

  private async syncPublicProfile(profile: UserProfile): Promise<void> {
    await setDoc(
      doc(this.firebase.db, 'userProfiles', profile.id),
      {
        displayName: profile.displayName,
        handle: profile.handle,
        createdAt: profile.createdAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  private resolveReady(): void {
    while (this.readyResolvers.length) {
      this.readyResolvers.shift()?.();
    }
  }
}
