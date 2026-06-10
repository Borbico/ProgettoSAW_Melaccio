import { Injectable, signal } from '@angular/core';

export type NotificationTone = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: number;
  tone: NotificationTone;
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationCenter {
  private readonly notificationState = signal<AppNotification[]>([]);
  private nextId = 1;

  readonly notifications = this.notificationState.asReadonly();

  success(title: string, message: string): void {
    this.show('success', title, message);
  }

  info(title: string, message: string): void {
    this.show('info', title, message);
  }

  warning(title: string, message: string): void {
    this.show('warning', title, message, 7000);
  }

  error(title: string, message: string): void {
    this.show('error', title, message, 9000);
  }

  dismiss(id: number): void {
    this.notificationState.update((notifications) =>
      notifications.filter((notification) => notification.id !== id),
    );
  }

  private show(tone: NotificationTone, title: string, message: string, timeoutMs = 5000): void {
    const notification: AppNotification = {
      id: this.nextId,
      tone,
      title,
      message,
    };

    this.nextId += 1;
    this.notificationState.update((notifications) => [notification, ...notifications].slice(0, 4));
    window.setTimeout(() => this.dismiss(notification.id), timeoutMs);
  }
}
