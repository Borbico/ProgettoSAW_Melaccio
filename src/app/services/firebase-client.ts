import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/firebase-config';

@Injectable({
  providedIn: 'root'
})
export class FirebaseClient {
  readonly app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  readonly auth: Auth = getAuth(this.app);
  readonly db: Firestore = getFirestore(this.app);
}
