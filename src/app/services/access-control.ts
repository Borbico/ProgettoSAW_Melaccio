import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserRole, roleLabel } from '../models/user-role';
import { AuthSession } from './auth-session';
import { FirebaseClient } from './firebase-client';

@Injectable({
  providedIn: 'root'
})
export class AccessControl {
  private readonly auth = inject(AuthSession);
  private readonly firebase = inject(FirebaseClient);
  private readonly roleState = signal<UserRole>('guest');

  readonly role = this.roleState.asReadonly();
  readonly roleLabel = computed(() => roleLabel(this.role()));
  readonly canEditShelf = computed(() => this.role() === 'standard' || this.role() === 'admin');
  readonly canEditCatalog = computed(() => this.role() === 'admin');
  readonly isGuest = computed(() => this.role() === 'guest');

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.currentUser();

      if (!user) {
        this.roleState.set('guest');
        return;
      }

      const roleRef = doc(this.firebase.db, 'userRoles', user.id);
      const unsubscribe = onSnapshot(
        roleRef,
        (snapshot) => {
          const role = snapshot.exists() ? snapshot.data()['role'] : 'standard';

          untracked(() => this.roleState.set(role === 'admin' ? 'admin' : 'standard'));
        },
        () => {
          untracked(() => this.roleState.set('standard'));
        }
      );

      onCleanup(() => unsubscribe());
    });
  }
}
