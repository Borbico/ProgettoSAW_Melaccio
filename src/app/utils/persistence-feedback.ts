import type { PersistenceResult } from '../models/persistence-result';
import type { NotificationCenter } from '../services/notification-center';

interface PersistenceFeedbackOptions {
  deniedTitle: string;
  deniedMessage: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  localMessage?: string;
}

export function notifyPersistenceResult(
  notifications: NotificationCenter,
  persistence: PersistenceResult,
  successTitle: string,
  successMessage: string,
  options: PersistenceFeedbackOptions,
): void {
  if (persistence === 'firebase') {
    notifications.success(successTitle, `${successMessage} Salvato su Firebase.`);
    return;
  }

  if (persistence === 'fallback') {
    notifications.warning(
      options.fallbackTitle ?? 'Salvataggio locale',
      options.fallbackMessage ??
        `${successMessage} Firebase non ha risposto: la copia locale e aggiornata.`,
    );
    return;
  }

  if (persistence === 'denied') {
    notifications.error(options.deniedTitle, options.deniedMessage);
    return;
  }

  notifications.info(
    successTitle,
    options.localMessage ?? `${successMessage} Salvataggio locale attivo.`,
  );
}
