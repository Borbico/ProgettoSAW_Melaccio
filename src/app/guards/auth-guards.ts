import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSession } from '../services/auth-session';
import { NotificationCenter } from '../services/notification-center';

export const requireSignedInGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthSession);
  const router = inject(Router);
  const notifications = inject(NotificationCenter);

  await auth.whenReady();

  if (auth.currentUser()) {
    return true;
  }

  notifications.warning(
    'Accesso richiesto',
    'Accedi o registrati per aprire la tua MyShelf personale.',
  );

  return router.createUrlTree(['/profilo'], {
    fragment: 'accesso',
    queryParams: { redirectTo: state.url },
  });
};
