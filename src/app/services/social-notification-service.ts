import { Injectable, effect, inject } from '@angular/core';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AuthSession } from './auth-session';
import { FirebaseClient } from './firebase-client';
import { NotificationCenter } from './notification-center';
import { CommunityShelf } from './community-shelf';

@Injectable({
  providedIn: 'root',
})
export class SocialNotificationService {
  private readonly auth = inject(AuthSession);
  private readonly firebase = inject(FirebaseClient);
  private readonly notifications = inject(NotificationCenter);
  private readonly communityShelf = inject(CommunityShelf);

  private readonly sessionStartTime = Date.now();
  private readonly shownNotificationIds = new Set<string>();

  constructor() {
    effect((onCleanup) => {
      const currentUser = this.auth.currentUser();
      if (!currentUser) {
        return;
      }

      // 1. Listen to personal user notifications (follow alerts)
      const userNotificationsRef = collection(
        this.firebase.db,
        'userNotifications',
        currentUser.id,
        'items',
      );
      const unsubscribeNotifications = onSnapshot(
        userNotificationsRef,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const id = change.doc.id;
              const timestamp = data['timestamp'];
              const timestampMs = timestamp ? new Date(timestamp).getTime() : 0;

              if (
                timestampMs > this.sessionStartTime &&
                !this.shownNotificationIds.has(id) &&
                data['type'] === 'follow'
              ) {
                this.shownNotificationIds.add(id);
                this.notifications.info(
                  'Nuovo follower!',
                  `${data['senderName']} ha iniziato a seguirti!`,
                );
              }
            }
          });
        },
        (error) => {
          console.error('Error listening to user notifications', error);
        },
      );

      // 2. Listen to global activities (completion alerts)
      const activitiesRef = collection(this.firebase.db, 'activities');
      const activitiesQuery = query(activitiesRef, orderBy('timestamp', 'desc'), limit(20));
      const unsubscribeActivities = onSnapshot(
        activitiesQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const id = change.doc.id;
              const timestamp = data['timestamp'];
              const timestampMs = timestamp ? new Date(timestamp).getTime() : 0;

              if (
                timestampMs > this.sessionStartTime &&
                !this.shownNotificationIds.has(id) &&
                data['type'] === 'completion' &&
                data['userId'] !== currentUser.id
              ) {
                // Check if the author is being followed by current user
                const followedUserIds = this.communityShelf.followingIds();
                if (followedUserIds.includes(data['userId'])) {
                  this.shownNotificationIds.add(id);
                  this.notifications.info(
                    'Completamento gioco!',
                    `${data['userName']} ha completato "${data['gameTitle']}"!`,
                  );
                }
              }
            }
          });
        },
        (error) => {
          console.error('Error listening to activities', error);
        },
      );

      onCleanup(() => {
        unsubscribeNotifications();
        unsubscribeActivities();
      });
    });
  }
}
