import { Injectable, inject, signal } from '@angular/core';
import { NotificationCenter } from './notification-center';
import { AuthSession } from './auth-session';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private readonly notificationCenter = inject(NotificationCenter);
  private readonly auth = inject(AuthSession);
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

    if (this.isLocalDevelopment()) {
      this.supported.set(false);
      this.installable.set(false);
      this.unregisterLocalServiceWorkers();
      this.listenForConnectionChanges();
      this.checkStartupConnection();
      return;
    }

    this.registerServiceWorker();
    this.listenForInstallPrompt();
    this.listenForConnectionChanges();
    this.checkStartupConnection();
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
    if (!this.notificationsSupported() || !this.supported()) {
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
    window.addEventListener('online', () => {
      this.online.set(true);
      this.notificationCenter.success(
        'Connessione ripristinata',
        'Sei di nuovo online. Tutte le modifiche offline verranno sincronizzate.',
      );
    });
    window.addEventListener('offline', () => {
      this.online.set(false);
      const currentUser = this.auth.currentUser();
      if (currentUser) {
        this.notificationCenter.warning(
          'Modalità offline attiva',
          'Puoi esclusivamente inserire progressi o interagire con la tua MyShelf (le modifiche verranno salvate in locale e sincronizzate al rientro online). Le altre azioni sono bloccate: la ricerca/importazione di giochi da RAWG, la gestione del catalogo comune, i follow nella community e la navigazione su pagine non caricate in cache.',
        );
      } else {
        this.notificationCenter.warning(
          'Sei disconnesso',
          "L'applicazione è offline. Le modifiche alla tua shelf verranno salvate in locale e sincronizzate al rientro online.",
        );
      }
    });
  }

  private notificationsSupported(): boolean {
    return (
      this.isBrowser() &&
      this.supported() &&
      'Notification' in window &&
      'serviceWorker' in navigator
    );
  }

  private unregisterLocalServiceWorkers(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => void registration.unregister());
        })
        .catch(() => undefined);
    }

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key.startsWith('gameshelf-pwa-')).map((key) => caches.delete(key)),
          ),
        )
        .catch(() => undefined);
    }
  }

  private isLocalDevelopment(): boolean {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
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

  private checkStartupConnection(): void {
    if (!this.isBrowser()) {
      return;
    }

    // Imposta il valore iniziale basato su navigator.onLine
    this.online.set(navigator.onLine);

    // Esegue un ping di rete asincrono per confermare l'effettiva connettività
    fetch('https://firestore.googleapis.com', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
    })
      .then(() => {
        this.online.set(true);
      })
      .catch(() => {
        this.online.set(false);
      });
  }
}
