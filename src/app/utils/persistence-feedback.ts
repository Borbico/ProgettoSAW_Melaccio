import type { PersistenceResult } from '../models/persistence-result';
import type { NotificationCenter } from '../services/notification-center';

interface PersistenceFeedbackOptions {
  deniedTitle: string;
  deniedMessage: string;
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
      'Salvataggio locale',
      `${successMessage} Firebase non ha risposto: la copia locale e aggiornata.`,
    );
    return;
  }

  if (persistence === 'denied') {
    notifications.error(options.deniedTitle, options.deniedMessage);
    return;
  }

  notifications.info(successTitle, `${successMessage} Salvataggio locale attivo.`);
}
