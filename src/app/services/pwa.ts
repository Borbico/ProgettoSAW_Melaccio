import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  readonly supported = signal(this.isBrowser() && 'serviceWorker' in navigator);
  readonly installable = signal(false);
  readonly standalone = signal(this.isStandalone());
  readonly online = signal(this.isBrowser() ? navigator.onLine : true);
  readonly notificationPermission = signal<NotificationPermission>(
    this.notificationsSupported() ? Notification.permission : 'default',
  );

  constructor() {
    if (!this.isBrowser()) {
      return;
    }

    this.registerServiceWorker();
    this.listenForInstallPrompt();
    this.listenForConnectionChanges();
  }

  async install(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    const prompt = this.installPrompt;
    this.installPrompt = null;
    this.installable.set(false);

    await prompt.prompt();
    const choice = await prompt.userChoice;

    if (choice.outcome === 'accepted') {
      this.standalone.set(true);
    }

    return choice.outcome === 'accepted';
  }

  async showReminderNotification(): Promise<boolean> {
    if (!this.notificationsSupported()) {
      return false;
    }

    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;

    this.notificationPermission.set(permission);

    if (permission !== 'granted') {
      return false;
    }

    const registration = this.registration ?? (await navigator.serviceWorker.ready);
    await registration.showNotification('GameShelf', {
      body: 'Promemoria attivo: torna nella tua shelf e aggiorna i progressi di gioco.',
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png',
      tag: 'gameshelf-reminder',
    });

    return true;
  }

  private registerServiceWorker(): void {
    if (!this.supported()) {
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          this.registration = registration;
        })
        .catch(() => {
          this.supported.set(false);
        });
    });
  }

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as BeforeInstallPromptEvent;
      this.installable.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.installable.set(false);
      this.standalone.set(true);
    });
  }

  private listenForConnectionChanges(): void {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  private notificationsSupported(): boolean {
    return this.isBrowser() && 'Notification' in window && 'serviceWorker' in navigator;
  }

  private isStandalone(): boolean {
    if (!this.isBrowser()) {
      return false;
    }

    const hasStandaloneDisplayMode =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const iosNavigator = navigator as Navigator & { standalone?: boolean };

    return hasStandaloneDisplayMode || Boolean(iosNavigator.standalone);
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
  }
}
